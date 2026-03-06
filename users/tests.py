from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.messages import get_messages
from django.core import mail
from django.db import connection
from django.db.utils import IntegrityError
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.contrib.auth.tokens import default_token_generator
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from challenges.models import Challenge, ChallengeAttempt
from .models import UserProfile


class UserViewsTests(TestCase):
    def test_signup_creates_user_and_logs_them_in(self):
        response = self.client.post(
            reverse('signup'),
            {
                'username': 'newuser',
                'email': 'newuser@example.com',
                'password1': 'StrongPass123!',
                'password2': 'StrongPass123!',
            },
        )

        self.assertRedirects(response, reverse('dashboard'))
        self.assertTrue(User.objects.filter(username='newuser').exists())
        self.assertIn('_auth_user_id', self.client.session)

    def test_signup_validation_errors_for_duplicate_email(self):
        User.objects.create_user(username='existing', email='dupe@example.com', password='StrongPass123!')

        response = self.client.post(
            reverse('signup'),
            {
                'username': 'newuser',
                'email': 'dupe@example.com',
                'password1': 'StrongPass123!',
                'password2': 'StrongPass123!',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'An account with this email already exists.')

    def test_dashboard_requires_login(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('dashboard'), response.url)

    def test_dashboard_renders_for_authenticated_user(self):
        user = User.objects.create_user(username='alice', password='StrongPass123!')
        self.client.force_login(user)

        response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'users/dashboard.html')

    def test_login_failure_sets_popup_error_message(self):
        User.objects.create_user(username='alice', email='alice@example.com', password='StrongPass123!')

        response = self.client.post(
            reverse('login'),
            {'username': 'alice', 'password': 'WrongPass123!'},
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        messages = [str(message) for message in get_messages(response.wsgi_request)]
        self.assertIn('Invalid username/email or password.', messages)

    def test_password_reset_request_flow_sends_email(self):
        user = User.objects.create_user(username='resetuser', email='reset@example.com', password='StrongPass123!')

        response = self.client.post(reverse('password_reset'), {'email': user.email})

        self.assertRedirects(response, reverse('password_reset_done'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('password reset', mail.outbox[0].subject.lower())

    def test_password_reset_request_rate_limit_enforces_cooldown(self):
        user = User.objects.create_user(username='cooldown-user', email='cooldown@example.com', password='StrongPass123!')

        with patch('users.views.time.time', return_value=1_700_000_000):
            first = self.client.post(reverse('password_reset'), {'email': user.email})
        self.assertRedirects(first, reverse('password_reset_done'))

        with patch('users.views.time.time', return_value=1_700_000_015):
            second = self.client.post(reverse('password_reset'), {'email': user.email})
        self.assertEqual(second.status_code, 200)
        self.assertContains(second, 'Please wait')
        self.assertEqual(len(mail.outbox), 1)

    def test_password_reset_request_rate_limit_enforces_hourly_cap(self):
        user = User.objects.create_user(username='window-user', email='window@example.com', password='StrongPass123!')
        start = 1_700_100_000

        for idx in range(5):
            with patch('users.views.time.time', return_value=start + (idx * 61)):
                response = self.client.post(reverse('password_reset'), {'email': user.email})
            self.assertRedirects(response, reverse('password_reset_done'))

        with patch('users.views.time.time', return_value=start + (5 * 61)):
            blocked = self.client.post(reverse('password_reset'), {'email': user.email})
        self.assertEqual(blocked.status_code, 200)
        self.assertContains(blocked, 'Too many OTP requests')
        self.assertEqual(len(mail.outbox), 5)

    def test_password_reset_confirm_page_renders_with_valid_token(self):
        user = User.objects.create_user(username='tokenuser', email='token@example.com', password='StrongPass123!')
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        response = self.client.get(
            reverse('password_reset_confirm', kwargs={'uidb64': uid, 'token': token}),
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'registration/password_reset_confirm.html')

    def test_password_reset_complete_page_renders(self):
        response = self.client.get(reverse('password_reset_complete'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'registration/password_reset_complete.html')

    def test_dashboard_context_includes_xp_level_progress_values(self):
        user = User.objects.create_user(username='xp-user', password='StrongPass123!')
        user.profile.level = 3
        user.profile.xp = 610
        user.profile.save(update_fields=['level', 'xp', 'updated_at'])
        self.client.force_login(user)

        response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['xp_in_level'], 110)
        self.assertEqual(response.context['xp_to_next_level'], 140)
        self.assertEqual(response.context['xp_percentage'], 44)
        self.assertEqual(response.context['xp_level_band'], 250)

    def test_dashboard_progress_bar_uses_computed_percentage_not_fallback(self):
        user = User.objects.create_user(username='progress-user', password='StrongPass123!')
        self.client.force_login(user)

        response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'style="width: 0%;"')
        self.assertContains(response, 'aria-valuenow="0"')
        self.assertContains(response, 'aria-valuemax="250"')
        self.assertNotContains(response, 'width: 45%')

    def test_dashboard_missing_profile_user_does_not_500(self):
        user = User.objects.create_user(username='no-profile-dashboard', password='StrongPass123!')
        user.profile.delete()
        self.client.force_login(user)

        response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(id=user.id, profile__isnull=False).exists())

    def test_dashboard_renders_global_rankings_empty_state(self):
        user = User.objects.create_user(username='empty-global', password='StrongPass123!')
        self.client.force_login(user)

        response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'No global entries yet.')

    def test_recent_attempts_icon_and_status_reflect_outcome(self):
        user = User.objects.create_user(username='attempt-icons', password='StrongPass123!')
        challenge = Challenge.objects.create(
            title='Attempt Icon Challenge',
            challenge_type=Challenge.ChallengeType.QUIZ,
            algorithm_type='',
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='ok',
        )
        ChallengeAttempt.objects.create(
            user=user,
            challenge=challenge,
            attempt_index=1,
            score=80,
            is_correct=True,
        )
        ChallengeAttempt.objects.create(
            user=user,
            challenge=challenge,
            attempt_index=2,
            score=0,
            is_correct=False,
        )
        self.client.force_login(user)

        response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'bi-check2-circle')
        self.assertContains(response, 'bi-x-circle')
        self.assertContains(response, 'badge badge-xp">80 pts')
        self.assertContains(response, 'badge badge-danger">0 pts')

    @patch('users.views.recommend_next_challenges', return_value=[])
    def test_dashboard_query_count_sanity(self, _mock_recommendations):
        user = User.objects.create_user(username='query-sanity', password='StrongPass123!')
        self.client.force_login(user)

        with CaptureQueriesContext(connection) as context:
            response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(context), 13)


class UsersApiTests(TestCase):
    def test_users_api_requires_authentication(self):
        User.objects.create_user(username='api-user', email='api@example.com', password='StrongPass123!')

        response = self.client.get('/api/users/')

        self.assertEqual(response.status_code, 403)

    def test_users_api_hides_email_fields(self):
        user = User.objects.create_user(username='api-user', email='api@example.com', password='StrongPass123!')
        self.client.force_login(user)

        response = self.client.get('/api/users/')

        self.assertEqual(response.status_code, 200)
        usernames = [item['username'] for item in response.json()]
        self.assertIn('api-user', usernames)
        first_row = response.json()[0]
        self.assertNotIn('email', first_row)
        self.assertNotIn('email', first_row['profile'])


class UserEmailConstraintTests(TestCase):
    def test_email_is_unique_case_insensitive_at_db_level(self):
        User.objects.create_user(username='first-email-user', email='Same@Example.com', password='StrongPass123!')

        with self.assertRaises(IntegrityError):
            User.objects.create_user(username='second-email-user', email='same@example.com', password='StrongPass123!')


class UserProfileIdentityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='profile-user',
            email='profile@example.com',
            password='StrongPass123!',
        )
        self.client.force_login(self.user)

    def _profile_payload(self, **overrides):
        payload = {
            'email': 'profile@example.com',
            'first_name': 'Profile',
            'last_name': 'User',
            'bio': '',
            'coding_interests': '',
            'preferred_language': '',
            'experience_level': '',
        }
        payload.update(overrides)
        return payload

    def test_profile_settings_saves_local_coding_metadata(self):
        response = self.client.post(
            reverse('profile-settings'),
            self._profile_payload(
                bio='Competitive programmer focused on arrays and graphs.',
                coding_interests='Arrays, Graphs, Dynamic Programming',
                preferred_language='Python',
                experience_level='intermediate',
            ),
        )

        self.assertRedirects(response, reverse('profile-settings'))
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.bio, 'Competitive programmer focused on arrays and graphs.')
        self.assertEqual(profile.coding_interests, 'Arrays, Graphs, Dynamic Programming')
        self.assertEqual(profile.preferred_language, 'Python')
        self.assertEqual(profile.experience_level, 'intermediate')

    def test_profile_settings_trims_local_metadata_fields(self):
        response = self.client.post(
            reverse('profile-settings'),
            self._profile_payload(
                coding_interests='  Graphs, Trees  ',
                preferred_language='  C++  ',
            ),
        )

        self.assertRedirects(response, reverse('profile-settings'))
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.coding_interests, 'Graphs, Trees')
        self.assertEqual(profile.preferred_language, 'C++')

    def test_profile_settings_rejects_bio_over_300_chars(self):
        response = self.client.post(
            reverse('profile-settings'),
            self._profile_payload(bio='a' * 301),
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Ensure this value has at most 300 characters')

    def test_profile_settings_renders_local_coding_identity_summary(self):
        profile = self.user.profile
        profile.bio = 'Focused on dynamic programming and interviews.'
        profile.coding_interests = 'Dynamic Programming, Graphs'
        profile.preferred_language = 'Python'
        profile.experience_level = 'advanced'
        profile.save(
            update_fields=[
                'bio',
                'coding_interests',
                'preferred_language',
                'experience_level',
                'updated_at',
            ]
        )

        response = self.client.get(reverse('profile-settings'))
        self.assertContains(response, 'Coding Identity')
        self.assertContains(response, 'Focused on dynamic programming and interviews.')
        self.assertContains(response, 'Dynamic Programming, Graphs')
        self.assertContains(response, 'Python')
        self.assertContains(response, 'Advanced')
        self.assertNotContains(response, 'LeetCode')
        self.assertNotContains(response, 'HackerRank')

    def test_profile_settings_missing_profile_user_does_not_500(self):
        self.user.profile.delete()

        response = self.client.get(reverse('profile-settings'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(id=self.user.id, profile__isnull=False).exists())
