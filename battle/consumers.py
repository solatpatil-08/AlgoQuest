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
        else:
            await self._send_error('Unsupported battle event.')

    async def battle_event(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    @sync_to_async
    def _initial_state_for_participant(self):
        user = self.scope.get('user')
        try:
            match = BattleMatch.objects.select_related('player_one', 'player_two', 'winner').get(
                room_code=self.room_code
            )
        except BattleMatch.DoesNotExist:
            return False, {}

        if not match.is_participant(user):
            return False, {}

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
                    .select_related('player_one', 'player_two', 'winner')
                    .get(room_code=self.room_code)
                )
            except BattleMatch.DoesNotExist:
                return {'ok': False, 'error': 'Battle room does not exist.'}

            if not match.is_participant(user):
                return {'ok': False, 'error': 'Only participants can update scores.'}
            if match.status != BattleMatch.Status.LIVE:
                return {'ok': False, 'error': 'Scores can only be updated during a live battle.'}

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

            match.save(update_fields=['player_one_score', 'player_two_score'])
            return {'ok': True, 'state': self._serialize_match_state(match)}

    @sync_to_async
    def _finalize_match(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return {'ok': False, 'error': 'Authentication required.'}

        with transaction.atomic():
            try:
                match = (
                    BattleMatch.objects.select_for_update()
                    .select_related('player_one', 'player_two', 'winner')
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

            if match.player_one_score > match.player_two_score:
                match.winner = match.player_one
            elif match.player_two_score > match.player_one_score:
                match.winner = match.player_two
            else:
                match.winner = None

            match.status = BattleMatch.Status.FINISHED
            match.ended_at = timezone.now()
            try:
                finalize_battle_rewards(match)
            except Exception:
                logger.exception("Failed finalizing battle rewards for room %s", match.room_code)
                transaction.set_rollback(True)
                return {'ok': False, 'error': 'Could not finalize battle rewards.'}

            match.save(update_fields=['winner', 'status', 'ended_at'])
            return {'ok': True, 'state': self._serialize_match_state(match)}

    def _serialize_match_state(self, match):
        winner_name = match.winner.username if match.winner else 'Draw'
        return {
            'room_code': match.room_code,
            'status': match.status,
            'winner': winner_name,
            'player_one_username': match.player_one.username,
            'player_two_username': match.player_two.username if match.player_two else 'Waiting...',
            'player_one_score': match.player_one_score,
            'player_two_score': match.player_two_score,
        }

    async def _send_error(self, message):
        await self.send(text_data=json.dumps({'event': 'error', 'message': message}))
