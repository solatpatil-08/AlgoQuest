import json
import logging

from asgiref.sync import sync_to_async

try:
    from channels.generic.websocket import AsyncWebsocketConsumer
except ImportError:  # pragma: no cover - fallback when channels is unavailable
    class AsyncWebsocketConsumer:  # type: ignore
        async def accept(self):
            return None

        async def close(self):
            return None

        async def send(self, text_data=None, bytes_data=None):
            return None

from django.utils import timezone
from django.db import transaction

from challenges.models import ChallengeAttempt
from leaderboard.services import finalize_battle_rewards

from .bot_matches import (
    bot_challenge_count,
    forfeit_bot_round,
    reconcile_bot_match,
    restart_bot_match,
    start_bot_round,
)
from .matchmaking import select_next_challenge_for_live_match
from .models import BattleMatch
from .score_tokens import parse_score_token

logger = logging.getLogger(__name__)


class BattleConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.room_code = self.scope['url_route']['kwargs']['room_code']
        authorized, payload = await self._initial_state_for_participant()
        if not authorized:
            await self.close(code=4403)
            return

        self.room_group_name = f'battle_{self.room_code}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps(payload))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error('Invalid JSON payload.')
            return

        if not isinstance(payload, dict):
            await self._send_error('Payload must be a JSON object.')
            return

        event = payload.get('event')

        if event == 'score_update':
            updated = await self._apply_score(payload)
            if not updated.get('ok'):
                await self._send_error(updated.get('error', 'Score update was rejected.'))
                return
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'battle_event',
                    'payload': {'event': 'score_update', **updated['state']},
                },
            )
        elif event == 'battle_end':
            result = await self._finalize_match()
            if not result.get('ok'):
                await self._send_error(result.get('error', 'Could not finalize battle.'))
                return
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'battle_event',
                    'payload': {'event': 'battle_end', **result['state']},
                },
            )
        elif event == 'bot_progress':
            progressed = await self._progress_bot_match()
            if not progressed.get('ok'):
                if progressed.get('error'):
                    await self._send_error(progressed['error'])
                return
            if progressed.get('changed'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'battle_event',
                        'payload': {'event': 'bot_progress', **progressed['state']},
                    },
                )
        elif event == 'bot_control':
            result = await self._control_bot_match(payload)
            if not result.get('ok'):
                await self._send_error(result.get('error', 'Could not update computer battle.'))
                return
            if result.get('state'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'battle_event',
                        'payload': {'event': 'bot_control', **result['state']},
                    },
                )
        else:
            await self._send_error('Unsupported battle event.')

    async def battle_event(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    @sync_to_async
    def _initial_state_for_participant(self):
        user = self.scope.get('user')
        try:
            match = BattleMatch.objects.select_related('player_one', 'player_two', 'winner', 'challenge').get(
                room_code=self.room_code
            )
        except BattleMatch.DoesNotExist:
            return False, {}

        if not match.is_participant(user):
            return False, {}

        if match.is_bot_match and match.status == BattleMatch.Status.LIVE:
            with transaction.atomic():
                match = (
                    BattleMatch.objects.select_for_update()
                    .select_related('player_one', 'player_two', 'winner', 'challenge')
                    .get(id=match.id)
                )
                match, _ = reconcile_bot_match(match)

        return True, {
            'event': 'battle_state',
            **self._serialize_match_state(match),
        }

    @sync_to_async
    def _apply_score(self, payload):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return {'ok': False, 'error': 'Authentication required.'}

        with transaction.atomic():
            try:
                match = (
                    BattleMatch.objects.select_for_update()
                    .select_related('player_one', 'player_two', 'winner', 'challenge')
                    .get(room_code=self.room_code)
                )
            except BattleMatch.DoesNotExist:
                return {'ok': False, 'error': 'Battle room does not exist.'}

            if not match.is_participant(user):
                return {'ok': False, 'error': 'Only participants can update scores.'}
            if match.status != BattleMatch.Status.LIVE:
                return {'ok': False, 'error': 'Scores can only be updated during a live battle.'}
            if match.is_bot_match:
                return {'ok': False, 'error': 'Computer battles advance score directly from the battle room.'}

            score_token = payload.get('score_token')
            if not isinstance(score_token, str) or not score_token.strip():
                return {'ok': False, 'error': 'Score token is required.'}

            token_payload = parse_score_token(score_token)
            if not token_payload:
                return {'ok': False, 'error': 'Invalid or expired score token.'}
            if token_payload['room_code'] != match.room_code:
                return {'ok': False, 'error': 'Score token does not belong to this room.'}
            if token_payload['user_id'] != user.id:
                return {'ok': False, 'error': 'Score token does not belong to this user.'}

            attempt = (
                ChallengeAttempt.objects.select_for_update()
                .filter(id=token_payload['attempt_id'], user=user)
                .select_related('challenge')
                .first()
            )
            if not attempt:
                return {'ok': False, 'error': 'Referenced attempt was not found.'}
            if attempt.challenge_id != match.challenge_id:
                return {'ok': False, 'error': 'Score token challenge does not match this battle.'}
            if not attempt.is_correct or not attempt.is_score_eligible:
                return {'ok': False, 'error': 'Attempt is not eligible for battle scoring.'}
            if attempt.battle_score_applied:
                return {'ok': False, 'error': 'Score token was already used.'}

            attempt.battle_score_applied = True
            attempt.save(update_fields=['battle_score_applied'])

            if user.id == match.player_one_id:
                match.player_one_score += 1
            elif user.id == match.player_two_id:
                match.player_two_score += 1

            challenge_changed = False
            last_solver = ''
            next_challenge, used_ids = select_next_challenge_for_live_match(match)
            if next_challenge:
                match.challenge = next_challenge
                challenge_changed = True
                last_solver = 'player'
            match.used_challenge_ids = used_ids

            match.save(update_fields=['player_one_score', 'player_two_score', 'challenge', 'used_challenge_ids'])
            state = self._serialize_match_state(match)
            state['challenge_changed'] = challenge_changed
            state['last_solver'] = last_solver
            return {'ok': True, 'state': state}

    @sync_to_async
    def _progress_bot_match(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return {'ok': False, 'error': 'Authentication required.'}

        with transaction.atomic():
            try:
                match = (
                    BattleMatch.objects.select_for_update()
                    .select_related('player_one', 'player_two', 'winner', 'challenge')
                    .get(room_code=self.room_code)
                )
            except BattleMatch.DoesNotExist:
                return {'ok': False, 'error': 'Battle room does not exist.'}

            if not match.is_participant(user):
                return {'ok': False, 'error': 'Only participants can progress this battle.'}
            if not match.is_bot_match:
                return {'ok': False, 'error': 'Bot progress is only available in computer battles.'}

            previous_challenge_id = match.challenge_id
            match, changed = reconcile_bot_match(match)
            if not changed:
                return {'ok': True, 'changed': False}

            state = self._serialize_match_state(match)
            state['challenge_changed'] = previous_challenge_id != match.challenge_id
            state['last_solver'] = 'computer'
            return {'ok': True, 'changed': True, 'state': state}

    @sync_to_async
    def _control_bot_match(self, payload):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return {'ok': False, 'error': 'Authentication required.'}

        action = str(payload.get('action') or '').strip().lower()
        if action not in {'start', 'forfeit', 'restart'}:
            return {'ok': False, 'error': 'Unsupported computer battle action.'}

        with transaction.atomic():
            try:
                match = (
                    BattleMatch.objects.select_for_update()
                    .select_related('player_one', 'player_two', 'winner', 'challenge')
                    .get(room_code=self.room_code)
                )
            except BattleMatch.DoesNotExist:
                return {'ok': False, 'error': 'Battle room does not exist.'}

            if not match.is_participant(user):
                return {'ok': False, 'error': 'Only participants can control this battle.'}
            if not match.is_bot_match:
                return {'ok': False, 'error': 'Round controls are only available in computer battles.'}
            if match.status != BattleMatch.Status.LIVE:
                return {'ok': False, 'error': 'Only live computer battles can be controlled.'}

            previous_challenge_id = match.challenge_id
            match, _ = reconcile_bot_match(match)
            if match.status != BattleMatch.Status.LIVE:
                return {'ok': True, 'state': self._serialize_match_state(match)}

            changed = False
            last_solver = ''
            if action == 'start':
                if match.bot_round_is_running:
                    return {'ok': False, 'error': 'This round is already running.'}
                match, changed = start_bot_round(match)
            elif action == 'forfeit':
                if not match.bot_round_is_running:
                    return {'ok': False, 'error': 'Start the round before you stop it.'}
                match, changed = forfeit_bot_round(match)
                last_solver = 'computer'
            elif action == 'restart':
                match, changed = restart_bot_match(match)

            if not changed:
                return {'ok': False, 'error': 'No battle change was applied.'}

            state = self._serialize_match_state(match)
            state['challenge_changed'] = previous_challenge_id != match.challenge_id
            state['last_solver'] = last_solver
            state['bot_action'] = action
            return {'ok': True, 'state': state}

    @sync_to_async
    def _finalize_match(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return {'ok': False, 'error': 'Authentication required.'}

        with transaction.atomic():
            try:
                match = (
                    BattleMatch.objects.select_for_update()
                    .select_related('player_one', 'player_two', 'winner', 'challenge')
                    .get(room_code=self.room_code)
                )
            except BattleMatch.DoesNotExist:
                return {'ok': False, 'error': 'Battle room does not exist.'}

            if not match.is_participant(user):
                return {'ok': False, 'error': 'Only participants can finalize this battle.'}

            if match.status == BattleMatch.Status.FINISHED:
                return {'ok': True, 'state': self._serialize_match_state(match)}
            if match.status != BattleMatch.Status.LIVE:
                return {'ok': False, 'error': 'Only live battles can be finalized.'}

            if match.is_bot_match:
                match, _ = reconcile_bot_match(match)
                if match.status == BattleMatch.Status.FINISHED:
                    return {'ok': True, 'state': self._serialize_match_state(match)}
                if match.player_one_score > match.player_two_score:
                    match.winner = match.player_one
                elif match.player_two_score > match.player_one_score:
                    match.winner = None
                else:
                    match.winner = None
            else:
                if match.player_one_score > match.player_two_score:
                    match.winner = match.player_one
                elif match.player_two_score > match.player_one_score:
                    match.winner = match.player_two
                else:
                    match.winner = None

            match.status = BattleMatch.Status.FINISHED
            match.ended_at = timezone.now()
            match.bot_round_status = BattleMatch.BotRoundStatus.READY
            match.bot_next_solve_at = None
            try:
                finalize_battle_rewards(match)
            except Exception:
                logger.exception("Failed finalizing battle rewards for room %s", match.room_code)
                transaction.set_rollback(True)
                return {'ok': False, 'error': 'Could not finalize battle rewards.'}

            match.save(update_fields=['winner', 'status', 'ended_at', 'bot_round_status', 'bot_next_solve_at', 'player_two_score'])
            return {'ok': True, 'state': self._serialize_match_state(match)}

    def _serialize_match_state(self, match):
        return {
            'room_code': match.room_code,
            'mode': match.mode,
            'status': match.status,
            'winner': match.winner_display_name,
            'player_one_username': match.player_one.username,
            'player_two_username': match.opponent_display_name,
            'player_one_score': match.player_one_score,
            'player_two_score': match.player_two_score,
            'challenge_id': match.challenge_id,
            'challenge_title': match.challenge.title if match.challenge else '',
            'used_challenge_count': match.used_challenge_count,
            'bot_total_challenge_count': bot_challenge_count(topic=match.preferred_topic) if match.is_bot_match else 0,
            'bot_round_status': match.bot_round_status if match.is_bot_match else '',
            'started_at': match.started_at.isoformat() if match.started_at else '',
            'ended_at': match.ended_at.isoformat() if match.ended_at else '',
            'bot_score_interval_seconds': match.get_bot_score_interval_seconds(),
            'bot_next_solve_at': match.bot_next_solve_at.isoformat() if match.bot_next_solve_at else '',
        }

    async def _send_error(self, message):
        await self.send(text_data=json.dumps({'event': 'error', 'message': message}))
