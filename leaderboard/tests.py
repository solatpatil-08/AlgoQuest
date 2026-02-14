from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import Leaderboard, Reward
from .services import update_leaderboard_for_user


class LeaderboardViewsAndApiTests(TestCase):
    def setUp(self):
        self.user_one = User.objects.create_user(username='rank1', password='StrongPass123!')
        self.user_two = User.objects.create_user(username='rank2', password='StrongPass123!')
        Leaderboard.objects.create(user=self.user_one, scope=Leaderboard.Scope.GLOBAL, score=100)
        Leaderboard.objects.create(user=self.user_one, scope=Leaderboard.Scope.WEEKLY, score=80)
        Leaderboard.objects.create(user=self.user_two, scope=Leaderboard.Scope.GLOBAL, score=60)

    def test_leaderboard_page_renders(self):
        response = self.client.get(reverse('leaderboard-page'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'leaderboard/leaderboard.html')

    def test_leaderboard_api_allows_anonymous_and_scope_filter(self):
        global_response = self.client.get('/api/leaderboard/')
        self.assertEqual(global_response.status_code, 200)
        self.assertTrue(all(item['scope'] == Leaderboard.Scope.GLOBAL for item in global_response.json()))

        weekly_response = self.client.get('/api/leaderboard/?scope=weekly')
        self.assertEqual(weekly_response.status_code, 200)
        self.assertTrue(all(item['scope'] == Leaderboard.Scope.WEEKLY for item in weekly_response.json()))


class LeaderboardServicesTests(TestCase):
    def test_update_leaderboard_for_user_updates_both_scopes(self):
        user = User.objects.create_user(username='score-user', password='StrongPass123!')

        update_leaderboard_for_user(user, 42)

        self.assertEqual(
            Leaderboard.objects.get(user=user, scope=Leaderboard.Scope.GLOBAL).score,
            42,
        )
        self.assertEqual(
            Leaderboard.objects.get(user=user, scope=Leaderboard.Scope.WEEKLY).score,
            42,
        )

    def test_reward_default_badge_icon_is_trophy(self):
        user = User.objects.create_user(username='reward-user', password='StrongPass123!')

        reward = Reward.objects.create(user=user, name='Starter Reward')

        self.assertEqual(reward.badge_icon, '\U0001f3c5')
