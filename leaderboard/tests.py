from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import time
from threading import Lock
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.db import close_old_connections
from django.db.utils import OperationalError
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from battle.models import BattleMatch

from .models import Leaderboard, Reward
from .services import finalize_battle_rewards, update_leaderboard_for_user


class LeaderboardViewsAndApiTests(TestCase):
    def setUp(self):
        self.user_one = User.objects.create_user(username='rank1', password='StrongPass123!')
        self.user_two = User.objects.create_user(username='rank2', password='StrongPass123!')
        self.user_three = User.objects.create_user(username='rank3', password='StrongPass123!')

        self.current_week = Leaderboard.current_week_start()
        self.previous_week = self.current_week - timedelta(days=7)

        Leaderboard.objects.create(user=self.user_one, scope=Leaderboard.Scope.GLOBAL, score=100)
        Leaderboard.objects.create(user=self.user_two, scope=Leaderboard.Scope.GLOBAL, score=60)
        Leaderboard.objects.create(
            user=self.user_one,
            scope=Leaderboard.Scope.WEEKLY,
            week_start=self.current_week,
            score=30,
        )
        Leaderboard.objects.create(
            user=self.user_two,
            scope=Leaderboard.Scope.WEEKLY,
            week_start=self.previous_week,
            score=999,
        )

    def test_leaderboard_page_renders(self):
        response = self.client.get(reverse('leaderboard-page'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'leaderboard/leaderboard.html')
        self.assertContains(response, 'Week of')

    def test_leaderboard_page_query_count_sanity(self):
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(reverse('leaderboard-page'))
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(context), 3)

    def test_leaderboard_api_allows_anonymous_scope_filter_for_current_week(self):
        global_response = self.client.get('/api/leaderboard/?scope=global')
        self.assertEqual(global_response.status_code, 200)
        self.assertTrue(all(item['scope'] == Leaderboard.Scope.GLOBAL for item in global_response.json()))

        weekly_response = self.client.get('/api/leaderboard/?scope=weekly')
        self.assertEqual(weekly_response.status_code, 200)
        weekly_rows = weekly_response.json()
        self.assertEqual(len(weekly_rows), 1)
        self.assertEqual(weekly_rows[0]['username'], self.user_one.username)
        self.assertEqual(weekly_rows[0]['week_start'], str(self.current_week))

    def test_leaderboard_api_rejects_invalid_scope(self):
        response = self.client.get('/api/leaderboard/?scope=invalid')
        self.assertEqual(response.status_code, 400)
        self.assertIn('scope', response.json())

    def test_leaderboard_api_limit_behavior(self):
        for idx in range(10):
            user = User.objects.create_user(username=f'extra-{idx}', password='StrongPass123!')
            Leaderboard.objects.create(
                user=user,
                scope=Leaderboard.Scope.GLOBAL,
                score=idx,
            )
        response = self.client.get('/api/leaderboard/?scope=global&limit=3')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 3)

    def test_leaderboard_api_rejects_invalid_limit(self):
        response = self.client.get('/api/leaderboard/?scope=global&limit=0')
        self.assertEqual(response.status_code, 400)
        self.assertIn('limit', response.json())

    def test_leaderboard_api_handles_missing_profile_safely(self):
        no_profile_user = User.objects.create_user(username='no-profile', password='StrongPass123!')
        no_profile_user.profile.delete()
        Leaderboard.objects.create(
            user=no_profile_user,
            scope=Leaderboard.Scope.GLOBAL,
            score=11,
        )

        response = self.client.get('/api/leaderboard/?scope=global')
        self.assertEqual(response.status_code, 200)
        payload = next(item for item in response.json() if item['username'] == 'no-profile')
        self.assertIsNone(payload['level'])
        self.assertIsNone(payload['xp'])

    @patch('users.views.recommend_next_challenges', return_value=[])
    def test_dashboard_renders_weekly_rankings_and_query_count(self, _mock_recs):
        self.client.force_login(self.user_one)
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(reverse('dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Top Weekly Players')
        self.assertLessEqual(len(context), 12)


class LeaderboardServicesTests(TestCase):
    def test_update_leaderboard_for_user_updates_global_and_weekly_current_window(self):
        user = User.objects.create_user(username='score-user', password='StrongPass123!')

        update_leaderboard_for_user(user, 42)

        global_entry = Leaderboard.objects.get(user=user, scope=Leaderboard.Scope.GLOBAL)
        weekly_entry = Leaderboard.objects.get(
            user=user,
            scope=Leaderboard.Scope.WEEKLY,
            week_start=Leaderboard.current_week_start(),
        )
        self.assertEqual(global_entry.score, 42)
        self.assertEqual(weekly_entry.score, 42)

    def test_update_leaderboard_for_user_rejects_negative_delta(self):
        user = User.objects.create_user(username='neg-user', password='StrongPass123!')

        with self.assertRaises(ValueError):
            update_leaderboard_for_user(user, -1)

    def test_finalize_battle_rewards_is_idempotent(self):
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
        finalize_battle_rewards(match)

        winner.refresh_from_db()
        self.assertEqual(winner.profile.xp, 120)
        self.assertEqual(
            Leaderboard.objects.get(user=winner, scope=Leaderboard.Scope.GLOBAL).score,
            120,
        )
        self.assertEqual(
            Leaderboard.objects.get(
                user=winner,
                scope=Leaderboard.Scope.WEEKLY,
                week_start=Leaderboard.current_week_start(),
            ).score,
            120,
        )
        self.assertEqual(
            Reward.objects.filter(
                user=winner,
                source_type=Reward.SourceType.BATTLE_WIN,
                source_id=match.room_code,
            ).count(),
            1,
        )

    def test_reward_default_badge_icon_is_trophy(self):
        user = User.objects.create_user(username='reward-user', password='StrongPass123!')

        reward = Reward.objects.create(user=user, name='Starter Reward')

        self.assertEqual(reward.badge_icon, '\U0001f3c5')


class LeaderboardConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def test_concurrent_updates_do_not_lose_score(self):
        user = User.objects.create_user(username='concurrent', password='StrongPass123!')
        user_id = user.id
        increments = 24
        successes = {'count': 0}
        lock = Lock()

        def worker():
            close_old_connections()
            applied = False
            for _ in range(4):
                try:
                    thread_user = User.objects.get(id=user_id)
                    update_leaderboard_for_user(thread_user, 1)
                    applied = True
                    break
                except OperationalError as exc:
                    if 'locked' not in str(exc).lower():
                        raise
                    time.sleep(0.01)
            if applied:
                with lock:
                    successes['count'] += 1
            close_old_connections()

        with ThreadPoolExecutor(max_workers=6) as executor:
            list(executor.map(lambda _: worker(), range(increments)))

        global_entry = Leaderboard.objects.get(user=user, scope=Leaderboard.Scope.GLOBAL)
        weekly_entry = Leaderboard.objects.get(
            user=user,
            scope=Leaderboard.Scope.WEEKLY,
            week_start=Leaderboard.current_week_start(),
        )
        self.assertEqual(global_entry.score, successes['count'])
        self.assertEqual(weekly_entry.score, successes['count'])
        self.assertGreater(successes['count'], 0)
