"""Additional tests for BATCH B - unlock enforcement, filtering, and progression."""
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import Challenge, Topic, UserChallengeProg


class UnlockEnforcementTests(TestCase):
    """Tests for progressive unlock logic and enforcement."""

    def setUp(self):
        self.user = User.objects.create_user(username='progressuser', password='Pass123!')
        
        # Create a topic with sequential challenges
        self.topic = Topic.objects.create(
            stable_id='test_topic',
            label='Test Topic',
            category=Topic.Category.DSA_CORE,
            description='Test',
        )
        
        # Create 3 sequential challenges
        self.chal_1 = Challenge.objects.create(
            title='Challenge 1',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='First challenge',
            prompt='Solve it',
            expected_answer='correct',
            topic=self.topic,
            order_index=1,
        )
        
        self.chal_2 = Challenge.objects.create(
            title='Challenge 2',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='Second challenge',
            prompt='Solve it',
            expected_answer='correct',
            topic=self.topic,
            order_index=2,
        )

    def test_first_challenge_unlocked_by_default(self):
        """First challenge should be unlocked."""
        from challenges.views import _is_challenge_unlocked
        self.assertTrue(_is_challenge_unlocked(self.user, self.chal_1))

    def test_second_challenge_locked_initially(self):
        """Second challenge should be locked until first is solved."""
        from challenges.views import _is_challenge_unlocked
        self.assertFalse(_is_challenge_unlocked(self.user, self.chal_2))

    def test_detail_view_403_for_locked(self):
        """Detail view should return 403 for locked challenges."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenge-detail', args=[self.chal_2.slug]))
        self.assertEqual(response.status_code, 403)

    def test_submit_locked_returns_403(self):
        """Submit to locked challenge should return 403."""
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[self.chal_2.slug]),
            {'answer': 'correct'},
        )
        self.assertEqual(response.status_code, 403)

    def test_solved_state_persists(self):
        """Solved state should persist."""
        self.client.force_login(self.user)
        
        # Submit correct answer
        self.client.post(
            reverse('challenge-submit', args=[self.chal_1.slug]),
            {'answer': 'correct'},
        )
        
        # Check it's saved
        prog = UserChallengeProg.objects.get(user=self.user, challenge=self.chal_1)
        self.assertTrue(prog.is_solved)


class FilterSortSearchTests(TestCase):
    """Tests for enhanced filtering, sorting, and searching."""

    def setUp(self):
        self.user = User.objects.create_user(username='filteruser', password='Pass123!')
        
        # Create topics
        self.topic_arr = Topic.objects.create(
            stable_id='dsa_arrays',
            label='Arrays',
            category=Topic.Category.DSA_CORE,
            description='Array challenges',
        )
        
        # Create challenges
        self.chal_easy = Challenge.objects.create(
            title='Array Sum',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='Sum array',
            prompt='Sum',
            expected_answer='10',
            xp_reward=50,
            topic=self.topic_arr,
            order_index=1,
        )
        
        self.chal_hard = Challenge.objects.create(
            title='Array Permutation',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.HARD,
            description='Find permutation',
            prompt='Permute',
            expected_answer='123',
            xp_reward=100,
            topic=self.topic_arr,
            order_index=2,
        )

    def test_filter_by_topic(self):
        """Filter by topic."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenges-list'), {'topic': 'dsa_arrays'})
        self.assertEqual(response.status_code, 200)
        challenges = response.context['challenges']
        self.assertEqual(len(challenges), 2)

    def test_filter_by_difficulty(self):
        """Filter by difficulty."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenges-list'), {'difficulty': 'easy'})
        self.assertEqual(response.status_code, 200)
        challenges = response.context['challenges']
        self.assertEqual(len(challenges), 1)

    def test_sort_by_xp(self):
        """Sort by XP."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenges-list'), {'sort': 'xp'})
        self.assertEqual(response.status_code, 200)
        challenges = response.context['challenges']
        self.assertEqual(challenges[0].xp_reward, 100)

    def test_search_by_title(self):
        """Search by title."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenges-list'), {'search': 'Array'})
        self.assertEqual(response.status_code, 200)
        challenges = response.context['challenges']
        self.assertEqual(len(challenges), 2)

    def test_solved_filter(self):
        """Filter by solved."""
        self.client.force_login(self.user)
        
        UserChallengeProg.objects.create(
            user=self.user,
            challenge=self.chal_easy,
            is_solved=True,
        )
        
        response = self.client.get(reverse('challenges-list'), {'solved': 'solved'})
        self.assertEqual(response.status_code, 200)
        challenges = response.context['challenges']
        self.assertEqual(len(challenges), 1)

    def test_combined_filters(self):
        """Apply multiple filters."""
        self.client.force_login(self.user)
        response = self.client.get(
            reverse('challenges-list'),
            {'topic': 'dsa_arrays', 'difficulty': 'easy'},
        )
        self.assertEqual(response.status_code, 200)
        challenges = response.context['challenges']
        self.assertEqual(len(challenges), 1)

    def test_params_preserved(self):
        """Query params preserved in context."""
        self.client.force_login(self.user)
        response = self.client.get(
            reverse('challenges-list'),
            {'topic': 'dsa_arrays', 'sort': 'xp', 'search': 'Array'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['selected_topic'], 'dsa_arrays')
        self.assertEqual(response.context['sort_by'], 'xp')
        self.assertEqual(response.context['search_query'], 'Array')


class ProgressionIntegrationTests(TestCase):
    """Integration tests for full progression flow."""

    def setUp(self):
        self.user = User.objects.create_user(username='intuser', password='Pass123!')
        
        self.topic = Topic.objects.create(
            stable_id='integration_test',
            label='Integration',
            category=Topic.Category.DSA_CORE,
            description='Test',
        )
        
        # Create 3 sequential challenges
        self.challenges = []
        for i in range(1, 4):
            c = Challenge.objects.create(
                title=f'Challenge {i}',
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                difficulty=Challenge.Difficulty.EASY,
                description=f'Challenge {i}',
                prompt='Solve',
                expected_answer='correct',
                xp_reward=50,
                topic=self.topic,
                order_index=i,
            )
            self.challenges.append(c)

    def test_solve_in_sequence(self):
        """Solve challenges in sequence."""
        self.client.force_login(self.user)
        
        for i, challenge in enumerate(self.challenges):
            response = self.client.post(
                reverse('challenge-submit', args=[challenge.slug]),
                {'answer': 'correct'},
            )
            
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertTrue(payload['is_correct'])

    def test_cannot_skip_challenges(self):
        """Cannot skip challenges."""
        self.client.force_login(self.user)
        
        # Try challenge 3 (should fail since 1,2 not solved)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenges[2].slug]),
            {'answer': 'correct'},
        )
        
        self.assertEqual(response.status_code, 403)
