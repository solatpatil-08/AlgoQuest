from django.contrib.auth.models import User
from django.contrib.messages import get_messages
from django.core import mail
from django.test import TestCase
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.urls import reverse
from django.contrib.auth.tokens import default_token_generator


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


class UsersApiTests(TestCase):
    def test_users_api_returns_data_for_anonymous_read(self):
        User.objects.create_user(username='api-user', email='api@example.com', password='StrongPass123!')

        response = self.client.get('/api/users/')

        self.assertEqual(response.status_code, 200)
        usernames = [item['username'] for item in response.json()]
        self.assertIn('api-user', usernames)
