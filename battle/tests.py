from django.contrib.auth.models import User
from django.test import TestCase

from leaderboard.models import Leaderboard, Reward
from leaderboard.services import finalize_battle_rewards

from .matchmaking import find_or_create_match
from .models import BattleMatch


class MatchmakingTests(TestCase):
    def test_find_or_create_creates_waiting_match_when_no_candidate(self):
        user = User.objects.create_user(username='p1', password='StrongPass123!')

        match, waiting = find_or_create_match(user)

        self.assertTrue(waiting)
        self.assertEqual(match.player_one, user)
        self.assertEqual(match.status, BattleMatch.Status.WAITING)
        self.assertIsNone(match.player_two)

    def test_find_or_create_joins_compatible_waiting_match(self):
        user_one = User.objects.create_user(username='p1', password='StrongPass123!')
        user_two = User.objects.create_user(username='p2', password='StrongPass123!')

        user_one.profile.level = 4
        user_one.profile.xp = 700
        user_one.profile.save(update_fields=['level', 'xp', 'updated_at'])
        user_two.profile.level = 5
        user_two.profile.xp = 760
        user_two.profile.save(update_fields=['level', 'xp', 'updated_at'])

        waiting_match = BattleMatch.objects.create(player_one=user_one, status=BattleMatch.Status.WAITING)

        match, waiting = find_or_create_match(user_two)
        waiting_match.refresh_from_db()

        self.assertFalse(waiting)
        self.assertEqual(match.id, waiting_match.id)
        self.assertEqual(waiting_match.player_two, user_two)
        self.assertEqual(waiting_match.status, BattleMatch.Status.LIVE)
        self.assertIsNotNone(waiting_match.started_at)


class BattleApiTests(TestCase):
    def test_battle_api_requires_authentication(self):
        response = self.client.get('/api/battle/')
        self.assertEqual(response.status_code, 403)

    def test_battle_api_post_returns_waiting_for_first_user_and_live_for_second(self):
        first = User.objects.create_user(username='first', password='StrongPass123!')
        second = User.objects.create_user(username='second', password='StrongPass123!')

        self.client.force_login(first)
        first_response = self.client.post('/api/battle/')
        self.assertEqual(first_response.status_code, 200)
        self.assertTrue(first_response.json()['is_waiting'])

        self.client.force_login(second)
        second_response = self.client.post('/api/battle/')
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(second_response.json()['is_waiting'])


class BattleRewardsTests(TestCase):
    def test_finalize_battle_rewards_grants_winner_xp_score_and_reward(self):
        winner = User.objects.create_user(username='winner', password='StrongPass123!')
        loser = User.objects.create_user(username='loser', password='StrongPass123!')
        match = BattleMatch.objects.create(
            player_one=winner,
            player_two=loser,
            winner=winner,
            status=BattleMatch.Status.FINISHED,
            xp_stake=120,
        )

        finalize_battle_rewards(match)

        winner.refresh_from_db()
        self.assertEqual(winner.profile.xp, 120)
        self.assertEqual(
            Leaderboard.objects.get(user=winner, scope=Leaderboard.Scope.GLOBAL).score,
            120,
        )
        self.assertEqual(
            Leaderboard.objects.get(user=winner, scope=Leaderboard.Scope.WEEKLY).score,
            120,
        )
        reward = Reward.objects.get(user=winner, name='Battle Winner')
        self.assertEqual(reward.points_awarded, 120)
