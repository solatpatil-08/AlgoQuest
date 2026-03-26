import json
from datetime import timedelta
from pathlib import Path

from asgiref.sync import async_to_sync
from django.conf import settings
from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from challenges.models import Challenge, ChallengeAttempt, Topic, UserChallengeProg
from leaderboard.models import Leaderboard, Reward
from leaderboard.services import finalize_battle_rewards

from .bot_matches import forfeit_bot_round, reconcile_bot_match, register_bot_player_solve, restart_bot_match, start_bot_round
from .consumers import BattleConsumer
from .matchmaking import create_bot_match, find_or_create_match, select_challenge_for_match
from .models import BattleMatch
from .score_tokens import build_score_token


class MatchmakingTests(TestCase):
    def setUp(self):
        self.topic_arrays = Topic.objects.create(
            stable_id='arrays',
            label='Arrays',
            category=Topic.Category.DSA_CORE,
            description='Arrays',
        )
        self.topic_graphs = Topic.objects.create(
            stable_id='graphs',
            label='Graphs',
            category=Topic.Category.DSA_CORE,
            description='Graphs',
        )
        self.array_challenge = Challenge.objects.create(
            title='Array Battle',
            topic=self.topic_arrays,
            order_index=0,
            difficulty=Challenge.Difficulty.EASY,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Array challenge',
            prompt='Array prompt',
            expected_answer='a',
        )
        self.graph_challenge = Challenge.objects.create(
            title='Graph Battle',
            topic=self.topic_graphs,
            order_index=0,
            difficulty=Challenge.Difficulty.EASY,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Graph challenge',
            prompt='Graph prompt',
            expected_answer='g',
        )

    def test_find_or_create_creates_waiting_match_when_no_candidate(self):
        user = User.objects.create_user(username='p1', password='StrongPass123!')

        match, waiting = find_or_create_match(user, topic_preference='arrays')

        self.assertTrue(waiting)
        self.assertEqual(match.player_one, user)
        self.assertEqual(match.status, BattleMatch.Status.WAITING)
        self.assertIsNone(match.player_two)
        self.assertEqual(match.preferred_topic, self.topic_arrays)

    def test_find_or_create_does_not_join_waiting_match_with_conflicting_topic(self):
        user_one = User.objects.create_user(username='p1', password='StrongPass123!')
        user_two = User.objects.create_user(username='p2', password='StrongPass123!')

        user_one.profile.level = 4
        user_one.profile.xp = 700
        user_one.profile.save(update_fields=['level', 'xp', 'updated_at'])
        user_two.profile.level = 5
        user_two.profile.xp = 760
        user_two.profile.save(update_fields=['level', 'xp', 'updated_at'])

        waiting_match = BattleMatch.objects.create(
            player_one=user_one,
            preferred_topic=self.topic_arrays,
            status=BattleMatch.Status.WAITING,
        )

        match, waiting = find_or_create_match(user_two, topic_preference='graphs')
        waiting_match.refresh_from_db()

        self.assertTrue(waiting)
        self.assertNotEqual(match.id, waiting_match.id)
        self.assertIsNone(waiting_match.player_two)
        self.assertEqual(waiting_match.status, BattleMatch.Status.WAITING)
        self.assertIsNone(waiting_match.started_at)
        self.assertEqual(waiting_match.preferred_topic, self.topic_arrays)

    def test_matchmaking_topic_preference_honored(self):
        creator = User.objects.create_user(username='creator', password='StrongPass123!')
        joiner = User.objects.create_user(username='joiner', password='StrongPass123!')

        first_match, first_waiting = find_or_create_match(creator, topic_preference='graphs')
        joined_match, second_waiting = find_or_create_match(joiner, topic_preference='arrays')

        first_match.refresh_from_db()
        joined_match.refresh_from_db()

        self.assertTrue(first_waiting)
        self.assertTrue(second_waiting)
        self.assertNotEqual(first_match.id, joined_match.id)
        self.assertEqual(first_match.preferred_topic, self.topic_graphs)
        self.assertEqual(joined_match.preferred_topic, self.topic_arrays)

    def test_find_or_create_reuses_existing_waiting_room_for_same_user(self):
        user = User.objects.create_user(username='single_waiter', password='StrongPass123!')

        first_match, first_waiting = find_or_create_match(user, topic_preference='arrays')
        second_match, second_waiting = find_or_create_match(user, topic_preference='graphs')

        self.assertTrue(first_waiting)
        self.assertTrue(second_waiting)
        self.assertEqual(first_match.id, second_match.id)
        first_match.refresh_from_db()
        self.assertEqual(first_match.preferred_topic, self.topic_arrays)
        self.assertEqual(
            BattleMatch.objects.filter(
                player_one=user,
                status=BattleMatch.Status.WAITING,
                player_two__isnull=True,
            ).count(),
            1,
        )

    def test_reused_waiting_room_can_adopt_topic_preference_when_missing(self):
        user = User.objects.create_user(username='topicless_waiter', password='StrongPass123!')

        first_match, first_waiting = find_or_create_match(user, topic_preference=None)
        second_match, second_waiting = find_or_create_match(user, topic_preference='graphs')

        self.assertTrue(first_waiting)
        self.assertTrue(second_waiting)
        self.assertEqual(first_match.id, second_match.id)
        first_match.refresh_from_db()
        self.assertEqual(first_match.preferred_topic, self.topic_graphs)

    def test_select_challenge_for_match_prefers_unsolved_challenge_for_participant(self):
        user = User.objects.create_user(username='solver', password='StrongPass123!')
        second_array_challenge = Challenge.objects.create(
            title='Array Battle Two',
            topic=self.topic_arrays,
            order_index=1,
            difficulty=Challenge.Difficulty.EASY,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Array challenge 2',
            prompt='Array prompt 2',
            expected_answer='b',
        )
        user.challenge_progress.create(
            challenge=self.array_challenge,
            is_solved=True,
            is_unlocked=True,
        )

        selected = select_challenge_for_match(topic=self.topic_arrays, participants=[user])

        self.assertEqual(selected, second_array_challenge)

    def test_create_bot_match_initializes_random_marathon_state(self):
        user = User.objects.create_user(username='bot_runner', password='StrongPass123!')

        match, waiting = create_bot_match(user)

        self.assertFalse(waiting)
        self.assertEqual(match.mode, BattleMatch.Mode.BOT)
        self.assertEqual(match.status, BattleMatch.Status.LIVE)
        self.assertIsNotNone(match.challenge)
        self.assertEqual(match.used_challenge_ids, [match.challenge_id])
        self.assertEqual(match.bot_round_status, BattleMatch.BotRoundStatus.READY)
        self.assertIsNone(match.bot_next_solve_at)

    def test_create_bot_match_honors_topic_preference(self):
        user = User.objects.create_user(username='topic_bot_runner', password='StrongPass123!')

        match, waiting = create_bot_match(user, topic_preference='graphs')

        self.assertFalse(waiting)
        self.assertEqual(match.mode, BattleMatch.Mode.BOT)
        self.assertEqual(match.preferred_topic, self.topic_graphs)
        self.assertEqual(match.challenge.topic, self.topic_graphs)

    def test_existing_live_bot_match_can_switch_to_requested_topic(self):
        user = User.objects.create_user(username='switch_bot_runner', password='StrongPass123!')
        existing_match, _ = create_bot_match(user, topic_preference='arrays')

        switched_match, waiting = create_bot_match(user, topic_preference='graphs')
        existing_match.refresh_from_db()

        self.assertFalse(waiting)
        self.assertEqual(switched_match.id, existing_match.id)
        self.assertEqual(switched_match.preferred_topic, self.topic_graphs)
        self.assertEqual(switched_match.challenge.topic, self.topic_graphs)
        self.assertEqual(switched_match.player_one_score, 0)
        self.assertEqual(switched_match.player_two_score, 0)


class BattleApiAndAccessTests(TestCase):
    def setUp(self):
        self.first = User.objects.create_user(username='first', password='StrongPass123!')
        self.second = User.objects.create_user(username='second', password='StrongPass123!')
        self.third = User.objects.create_user(username='third', password='StrongPass123!')
        self.topic = Topic.objects.create(
            stable_id='battle_topic',
            label='Battle Topic',
            category=Topic.Category.DSA_CORE,
            description='Battle topic',
        )
        self.challenge = Challenge.objects.create(
            title='Battle Challenge',
            topic=self.topic,
            order_index=0,
            difficulty=Challenge.Difficulty.EASY,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Challenge',
            prompt='Prompt',
            expected_answer='ok',
        )

    def test_battle_api_requires_authentication(self):
        response = self.client.get('/api/battle/')
        self.assertEqual(response.status_code, 403)

    def test_battle_api_post_returns_waiting_for_first_user_and_live_for_second(self):
        self.client.force_login(self.first)
        first_response = self.client.post(
            '/api/battle/',
            data=json.dumps({'topic_preference': self.topic.stable_id}),
            content_type='application/json',
        )
        self.assertEqual(first_response.status_code, 200)
        self.assertTrue(first_response.json()['is_waiting'])

        self.client.force_login(self.second)
        second_response = self.client.post('/api/battle/', content_type='application/json')
        self.assertEqual(second_response.status_code, 200)
        self.assertFalse(second_response.json()['is_waiting'])

        room_code = second_response.json()['room_code']
        match = BattleMatch.objects.get(room_code=room_code)
        self.assertEqual(match.status, BattleMatch.Status.LIVE)
        self.assertEqual(match.challenge, self.challenge)

    def test_battle_api_post_can_start_bot_battle_immediately(self):
        self.client.force_login(self.first)
        response = self.client.post(
            '/api/battle/',
            data=json.dumps({
                'battle_mode': BattleMatch.Mode.BOT,
                'topic_preference': self.topic.stable_id,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_waiting'])
        self.assertEqual(payload['mode'], BattleMatch.Mode.BOT)

        match = BattleMatch.objects.get(room_code=payload['room_code'])
        self.assertEqual(match.status, BattleMatch.Status.LIVE)
        self.assertEqual(match.mode, BattleMatch.Mode.BOT)
        self.assertIsNone(match.player_two)
        self.assertEqual(match.challenge, self.challenge)
        self.assertEqual(match.used_challenge_ids, [match.challenge_id])
        self.assertEqual(match.bot_round_status, BattleMatch.BotRoundStatus.READY)
        self.assertIsNone(match.bot_next_solve_at)

    def test_battle_api_room_state_progresses_bot_match(self):
        next_challenge = Challenge.objects.create(
            title='Battle Challenge Two',
            topic=self.topic,
            order_index=1,
            difficulty=Challenge.Difficulty.MEDIUM,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Challenge 2',
            prompt='Prompt 2',
            expected_answer='next',
        )
        match = BattleMatch.objects.create(
            player_one=self.first,
            challenge=self.challenge,
            mode=BattleMatch.Mode.BOT,
            status=BattleMatch.Status.LIVE,
            started_at=timezone.now(),
            used_challenge_ids=[self.challenge.id],
            bot_round_status=BattleMatch.BotRoundStatus.RUNNING,
            bot_next_solve_at=timezone.now() - timedelta(seconds=1),
        )

        self.client.force_login(self.first)
        response = self.client.get(f'/api/battle/?room_code={match.room_code}')

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['player_two_score'], 1)
        self.assertEqual(payload['challenge_id'], next_challenge.id)

    def test_battle_api_can_start_and_forfeit_bot_round_without_websocket(self):
        next_challenge = Challenge.objects.create(
            title='Battle Challenge Two',
            topic=self.topic,
            order_index=1,
            difficulty=Challenge.Difficulty.MEDIUM,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Challenge 2',
            prompt='Prompt 2',
            expected_answer='next',
        )
        match = BattleMatch.objects.create(
            player_one=self.first,
            challenge=self.challenge,
            mode=BattleMatch.Mode.BOT,
            status=BattleMatch.Status.LIVE,
            started_at=timezone.now(),
            used_challenge_ids=[self.challenge.id],
            bot_round_status=BattleMatch.BotRoundStatus.READY,
        )

        self.client.force_login(self.first)
        start_response = self.client.post(
            '/api/battle/',
            data=json.dumps({
                'room_code': match.room_code,
                'battle_action': 'start',
            }),
            content_type='application/json',
        )
        self.assertEqual(start_response.status_code, 200)
        start_payload = start_response.json()
        self.assertEqual(start_payload['bot_round_status'], BattleMatch.BotRoundStatus.RUNNING)
        self.assertTrue(start_payload['bot_next_solve_at'])

        forfeit_response = self.client.post(
            '/api/battle/',
            data=json.dumps({
                'room_code': match.room_code,
                'battle_action': 'forfeit',
            }),
            content_type='application/json',
        )
        self.assertEqual(forfeit_response.status_code, 200)
        forfeit_payload = forfeit_response.json()
        self.assertEqual(forfeit_payload['player_two_score'], 1)
        self.assertEqual(forfeit_payload['bot_round_status'], BattleMatch.BotRoundStatus.READY)
        self.assertEqual(forfeit_payload['challenge_id'], next_challenge.id)

    def test_battle_api_can_finalize_live_battle_without_websocket(self):
        match = BattleMatch.objects.create(
            player_one=self.first,
            player_two=self.second,
            challenge=self.challenge,
            status=BattleMatch.Status.LIVE,
            player_one_score=3,
            player_two_score=1,
        )

        self.client.force_login(self.first)
        response = self.client.post(
            '/api/battle/',
            data=json.dumps({
                'room_code': match.room_code,
                'battle_action': 'finalize',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], BattleMatch.Status.FINISHED)
        self.assertEqual(payload['winner'], self.first.username)

    def test_unauthorized_live_room_access_denied(self):
        match = BattleMatch.objects.create(
            player_one=self.first,
            player_two=self.second,
            challenge=self.challenge,
            status=BattleMatch.Status.LIVE,
        )
        self.client.force_login(self.third)
        response = self.client.get(reverse('battle-live', args=[match.room_code]))
        self.assertEqual(response.status_code, 403)

    def test_participant_access_allowed(self):
        match = BattleMatch.objects.create(
            player_one=self.first,
            player_two=self.second,
            challenge=self.challenge,
            status=BattleMatch.Status.LIVE,
        )
        self.client.force_login(self.first)
        response = self.client.get(reverse('battle-live', args=[match.room_code]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['challenge'].id, self.challenge.id)

    def test_bot_battle_live_view_labels_computer_opponent(self):
        match = BattleMatch.objects.create(
            player_one=self.first,
            challenge=self.challenge,
            mode=BattleMatch.Mode.BOT,
            status=BattleMatch.Status.LIVE,
            started_at=timezone.now(),
        )
        self.client.force_login(self.first)
        response = self.client.get(reverse('battle-live', args=[match.room_code]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Computer Battle')
        self.assertContains(response, 'Computer')

    def test_submit_attempt_in_bot_battle_advances_to_next_challenge(self):
        next_challenge = Challenge.objects.create(
            title='Battle Challenge Two',
            topic=self.topic,
            order_index=1,
            difficulty=Challenge.Difficulty.MEDIUM,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Challenge 2',
            prompt='Prompt 2',
            expected_answer='next',
        )
        match = BattleMatch.objects.create(
            player_one=self.first,
            challenge=self.challenge,
            mode=BattleMatch.Mode.BOT,
            status=BattleMatch.Status.LIVE,
            started_at=timezone.now(),
            used_challenge_ids=[self.challenge.id],
            bot_round_status=BattleMatch.BotRoundStatus.RUNNING,
            bot_next_solve_at=timezone.now() + timedelta(seconds=45),
        )
        UserChallengeProg.objects.update_or_create(
            user=self.first,
            challenge=self.challenge,
            defaults={'is_unlocked': True, 'is_solved': True},
        )

        self.client.force_login(self.first)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {
                'answer': 'ok',
                'battle_room_code': match.room_code,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['battle_reload_required'])
        self.assertEqual(payload['battle_player_one_score'], 1)
        self.assertEqual(payload['battle_next_challenge_title'], next_challenge.title)

    def test_same_challenge_for_both_players_in_same_room(self):
        self.client.force_login(self.first)
        first_response = self.client.post(
            '/api/battle/',
            data=json.dumps({'topic_preference': self.topic.stable_id}),
            content_type='application/json',
        )
        room_code = first_response.json()['room_code']

        self.client.force_login(self.second)
        self.client.post('/api/battle/', content_type='application/json')
        match = BattleMatch.objects.get(room_code=room_code)

        self.client.force_login(self.first)
        first_live = self.client.get(reverse('battle-live', args=[room_code]))
        self.client.force_login(self.second)
        second_live = self.client.get(reverse('battle-live', args=[room_code]))

        self.assertEqual(first_live.status_code, 200)
        self.assertEqual(second_live.status_code, 200)
        self.assertEqual(first_live.context['challenge'].id, match.challenge_id)
        self.assertEqual(second_live.context['challenge'].id, match.challenge_id)

    def test_stale_topic_preference_falls_back_cleanly(self):
        self.client.force_login(self.first)
        first_response = self.client.post(
            '/api/battle/',
            data=json.dumps({'topic_preference': 'missing-topic'}),
            content_type='application/json',
        )
        room_code = first_response.json()['room_code']

        self.client.force_login(self.second)
        self.client.post('/api/battle/', content_type='application/json')
        match = BattleMatch.objects.get(room_code=room_code)

        self.assertIsNone(match.preferred_topic)
        self.assertIsNotNone(match.challenge)

    def test_lobby_template_contains_online_and_computer_matchmake_flows(self):
        self.client.force_login(self.first)
        response = self.client.get(reverse('battle-lobby'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="matchmakeBtn"')
        self.assertContains(response, 'id="battleComputerBtn"')
        self.assertContains(response, 'id="matchStatus"')
        self.assertContains(response, 'startMatchmaking')
        self.assertContains(response, 'battle_mode')
        self.assertContains(response, 'Computer Marathon')
        self.assertNotContains(response, 'if (button)')
        self.assertNotContains(response, 'statusEl.innerHTML')

    def test_lobby_waiting_flow_uses_polling_before_live_redirect(self):
        self.client.force_login(self.first)
        response = self.client.get(reverse('battle-lobby'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'pollWaitingRoom')
        self.assertContains(response, 'if (data.is_waiting)')
        self.assertContains(response, 'setInterval(pollWaitingRoom, 3000)')

    def test_battle_lobby_query_count_sanity(self):
        self.client.force_login(self.first)
        Topic.objects.create(
            stable_id='battle_topic_2',
            label='Battle Topic 2',
            category=Topic.Category.DSA_CORE,
            description='Battle topic 2',
        )
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(reverse('battle-lobby'))
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(context), 8)

    def test_lobby_hides_open_link_for_non_participants(self):
        match = BattleMatch.objects.create(
            player_one=self.first,
            player_two=self.second,
            challenge=self.challenge,
            status=BattleMatch.Status.LIVE,
        )
        self.client.force_login(self.third)
        response = self.client.get(reverse('battle-lobby'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'Match #{match.id}')
        self.assertNotContains(response, reverse('battle-live', args=[match.room_code]))
        self.assertContains(response, 'Private Match')

    def test_lobby_shows_open_link_for_participants(self):
        match = BattleMatch.objects.create(
            player_one=self.first,
            player_two=self.second,
            challenge=self.challenge,
            status=BattleMatch.Status.LIVE,
        )
        self.client.force_login(self.first)
        response = self.client.get(reverse('battle-lobby'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse('battle-live', args=[match.room_code]))

    def test_battle_client_uses_safe_alert_mapping(self):
        script_path = Path(settings.BASE_DIR) / 'static' / 'js' / 'battle-client.js'
        script = script_path.read_text(encoding='utf-8')
        self.assertNotIn('alert-${type}', script)
        self.assertNotIn('window.confirm', script)
        self.assertIn("error: 'alert-danger'", script)
        self.assertIn('queueScoreToken', script)
        self.assertIn('flushPendingScoreTokens', script)
        self.assertIn('openBattleConfirmDialog', script)


class BattleConsumerSecurityTests(TransactionTestCase):
    def setUp(self):
        self.player_one = User.objects.create_user(username='ws_one', password='StrongPass123!')
        self.player_two = User.objects.create_user(username='ws_two', password='StrongPass123!')
        self.observer = User.objects.create_user(username='ws_observer', password='StrongPass123!')
        self.topic = Topic.objects.create(
            stable_id='ws_topic',
            label='WS Topic',
            category=Topic.Category.DSA_CORE,
            description='WS topic',
        )
        self.challenge = Challenge.objects.create(
            title='WS Challenge',
            topic=self.topic,
            order_index=0,
            difficulty=Challenge.Difficulty.EASY,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='WS challenge',
            prompt='WS prompt',
            expected_answer='ws',
        )
        self.match = BattleMatch.objects.create(
            player_one=self.player_one,
            player_two=self.player_two,
            challenge=self.challenge,
            status=BattleMatch.Status.LIVE,
            xp_stake=80,
        )

    def _consumer_for(self, user):
        consumer = BattleConsumer()
        consumer.scope = {'user': user}
        consumer.room_code = self.match.room_code
        return consumer

    def test_non_participant_websocket_denied(self):
        consumer = self._consumer_for(self.observer)
        authorized, payload = async_to_sync(consumer._initial_state_for_participant)()
        self.assertFalse(authorized)
        self.assertEqual(payload, {})

    def test_score_updates_rejected_for_non_participants_and_finished_matches(self):
        non_participant_consumer = self._consumer_for(self.observer)
        participant_consumer = self._consumer_for(self.player_one)

        non_participant_result = async_to_sync(non_participant_consumer._apply_score)(
            {'event': 'score_update', 'score_token': 'invalid-token'}
        )
        self.assertFalse(non_participant_result['ok'])
        self.assertIn('participants', non_participant_result['error'])

        self.match.status = BattleMatch.Status.FINISHED
        self.match.save(update_fields=['status'])
        finished_result = async_to_sync(participant_consumer._apply_score)(
            {'event': 'score_update', 'score_token': 'invalid-token'}
        )
        self.assertFalse(finished_result['ok'])
        self.assertIn('live battle', finished_result['error'].lower())

    def test_score_update_requires_valid_single_use_token(self):
        attempt = ChallengeAttempt.objects.create(
            user=self.player_one,
            challenge=self.challenge,
            attempt_index=1,
            is_score_eligible=True,
            is_correct=True,
            score=100,
            submitted_answer='ws',
        )
        token = build_score_token(
            room_code=self.match.room_code,
            attempt_id=attempt.id,
            user_id=self.player_one.id,
        )

        consumer = self._consumer_for(self.player_one)

        first_result = async_to_sync(consumer._apply_score)(
            {'event': 'score_update', 'score_token': token}
        )
        second_result = async_to_sync(consumer._apply_score)(
            {'event': 'score_update', 'score_token': token}
        )

        self.assertTrue(first_result['ok'])
        self.assertFalse(second_result['ok'])
        self.assertIn('already used', second_result['error'])

        self.match.refresh_from_db()
        attempt.refresh_from_db()
        self.assertEqual(self.match.player_one_score, 1)
        self.assertTrue(attempt.battle_score_applied)

    def test_score_update_rejects_token_from_different_user(self):
        attempt = ChallengeAttempt.objects.create(
            user=self.player_one,
            challenge=self.challenge,
            attempt_index=1,
            is_score_eligible=True,
            is_correct=True,
            score=100,
            submitted_answer='ws',
        )
        token = build_score_token(
            room_code=self.match.room_code,
            attempt_id=attempt.id,
            user_id=self.player_one.id,
        )

        consumer = self._consumer_for(self.player_two)
        result = async_to_sync(consumer._apply_score)(
            {'event': 'score_update', 'score_token': token}
        )

        self.assertFalse(result['ok'])
        self.assertIn('does not belong to this user', result['error'])

    def test_invalid_payload_is_handled_without_crash(self):
        consumer = self._consumer_for(self.player_one)
        messages = []

        async def fake_send_error(message):
            messages.append(message)

        consumer._send_error = fake_send_error
        async_to_sync(consumer.receive)(text_data='{bad-json')
        self.assertTrue(messages)
        self.assertIn('Invalid JSON', messages[0])

    def test_finalize_is_idempotent_and_rewards_not_duplicated(self):
        self.match.player_one_score = 5
        self.match.player_two_score = 1
        self.match.save(update_fields=['player_one_score', 'player_two_score'])

        consumer = self._consumer_for(self.player_one)
        first_result = async_to_sync(consumer._finalize_match)()
        second_result = async_to_sync(consumer._finalize_match)()
        self.assertTrue(first_result['ok'])
        self.assertTrue(second_result['ok'])

        self.match.refresh_from_db()
        self.player_one.refresh_from_db()
        self.assertEqual(self.match.status, BattleMatch.Status.FINISHED)
        self.assertEqual(self.match.winner, self.player_one)
        self.assertEqual(self.player_one.profile.xp, self.match.xp_stake)
        self.assertEqual(Reward.objects.filter(user=self.player_one, name='Battle Winner').count(), 1)
        self.assertEqual(
            Leaderboard.objects.get(user=self.player_one, scope=Leaderboard.Scope.GLOBAL).score,
            self.match.xp_stake,
        )

    def test_register_bot_player_solve_advances_to_new_challenge_without_repeat(self):
        second_challenge = Challenge.objects.create(
            title='WS Challenge Two',
            topic=self.topic,
            order_index=1,
            difficulty=Challenge.Difficulty.MEDIUM,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='WS challenge two',
            prompt='WS prompt two',
            expected_answer='ws2',
        )
        self.match.player_two = None
        self.match.mode = BattleMatch.Mode.BOT
        self.match.used_challenge_ids = [self.challenge.id]
        self.match.bot_round_status = BattleMatch.BotRoundStatus.RUNNING
        self.match.bot_next_solve_at = timezone.now() + timedelta(seconds=30)
        self.match.save(update_fields=['player_two', 'mode', 'used_challenge_ids', 'bot_round_status', 'bot_next_solve_at'])

        attempt = ChallengeAttempt.objects.create(
            user=self.player_one,
            challenge=self.challenge,
            attempt_index=1,
            is_score_eligible=False,
            is_correct=True,
            score=0,
            submitted_answer='ws',
        )

        updated_match, challenge_advanced = register_bot_player_solve(self.match, attempt)

        self.assertTrue(challenge_advanced)
        self.assertEqual(updated_match.player_one_score, 1)
        self.assertEqual(updated_match.challenge_id, second_challenge.id)
        self.assertEqual(updated_match.used_challenge_ids, [self.challenge.id, second_challenge.id])
        attempt.refresh_from_db()
        self.assertTrue(attempt.battle_score_applied)

    def test_reconcile_bot_match_advances_computer_to_new_challenge(self):
        second_challenge = Challenge.objects.create(
            title='WS Challenge Two',
            topic=self.topic,
            order_index=1,
            difficulty=Challenge.Difficulty.MEDIUM,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='WS challenge two',
            prompt='WS prompt two',
            expected_answer='ws2',
        )
        self.match.player_two = None
        self.match.mode = BattleMatch.Mode.BOT
        self.match.used_challenge_ids = [self.challenge.id]
        self.match.bot_round_status = BattleMatch.BotRoundStatus.RUNNING
        self.match.bot_next_solve_at = timezone.now() - timedelta(seconds=1)
        self.match.save(update_fields=['player_two', 'mode', 'used_challenge_ids', 'bot_round_status', 'bot_next_solve_at'])

        updated_match, changed = reconcile_bot_match(self.match)

        self.assertTrue(changed)
        self.assertEqual(updated_match.player_two_score, 1)
        self.assertEqual(updated_match.challenge_id, second_challenge.id)
        self.assertEqual(updated_match.used_challenge_ids, [self.challenge.id, second_challenge.id])

    def test_start_forfeit_and_restart_bot_round_cycle(self):
        Challenge.objects.create(
            title='WS Challenge Three',
            topic=self.topic,
            order_index=2,
            difficulty=Challenge.Difficulty.HARD,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='WS challenge three',
            prompt='WS prompt three',
            expected_answer='ws3',
        )
        self.match.player_two = None
        self.match.mode = BattleMatch.Mode.BOT
        self.match.used_challenge_ids = [self.challenge.id]
        self.match.bot_round_status = BattleMatch.BotRoundStatus.READY
        self.match.bot_next_solve_at = None
        self.match.save(update_fields=['player_two', 'mode', 'used_challenge_ids', 'bot_round_status', 'bot_next_solve_at'])

        started_match, started = start_bot_round(self.match)
        self.assertTrue(started)
        self.assertEqual(started_match.bot_round_status, BattleMatch.BotRoundStatus.RUNNING)
        self.assertIsNotNone(started_match.bot_next_solve_at)

        forfeited_match, advanced = forfeit_bot_round(started_match)
        self.assertTrue(advanced)
        self.assertEqual(forfeited_match.player_two_score, 1)
        self.assertEqual(forfeited_match.bot_round_status, BattleMatch.BotRoundStatus.READY)
        self.assertIsNone(forfeited_match.bot_next_solve_at)

        restarted_match, restarted = restart_bot_match(forfeited_match)
        self.assertTrue(restarted)
        self.assertEqual(restarted_match.player_one_score, 0)
        self.assertEqual(restarted_match.player_two_score, 0)
        self.assertEqual(restarted_match.bot_round_status, BattleMatch.BotRoundStatus.READY)
        self.assertIsNone(restarted_match.bot_next_solve_at)
        self.assertIsNotNone(restarted_match.challenge)
        self.assertEqual(len(restarted_match.used_challenge_ids), 1)


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
