import json

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

from leaderboard.services import finalize_battle_rewards

from .models import BattleMatch


class BattleConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.scope.get('user') or not self.scope['user'].is_authenticated:
            await self.close()
            return
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group_name = f'battle_{self.room_code}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'battle_event',
                'payload': {'event': 'player_joined'},
            },
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        payload = json.loads(text_data)
        event = payload.get('event')

        if event == 'score_update':
            score_delta = int(payload.get('score_delta', 0))
            updated = await self._apply_score(score_delta)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'battle_event',
                    'payload': {'event': 'score_update', **updated},
                },
            )
        elif event == 'battle_end':
            result = await self._finalize_match()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'battle_event',
                    'payload': {'event': 'battle_end', **result},
                },
            )

    async def battle_event(self, event):
        await self.send(text_data=json.dumps(event['payload']))

    @sync_to_async
    def _apply_score(self, score_delta):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return {}

        match = BattleMatch.objects.select_related('player_one', 'player_two').get(room_code=self.room_code)
        if user == match.player_one:
            match.player_one_score += score_delta
        elif user == match.player_two:
            match.player_two_score += score_delta
        match.save(update_fields=['player_one_score', 'player_two_score'])
        return {
            'player_one_score': match.player_one_score,
            'player_two_score': match.player_two_score,
        }

    @sync_to_async
    def _finalize_match(self):
        match = BattleMatch.objects.select_related('player_one', 'player_two').get(room_code=self.room_code)
        if match.status == BattleMatch.Status.FINISHED:
            winner_name = match.winner.username if match.winner else 'Draw'
            return {'winner': winner_name}

        if match.player_one_score > match.player_two_score:
            match.winner = match.player_one
        elif match.player_two_score > match.player_one_score:
            match.winner = match.player_two
        else:
            match.winner = None

        match.status = BattleMatch.Status.FINISHED
        match.ended_at = timezone.now()
        match.save(update_fields=['winner', 'status', 'ended_at'])
        finalize_battle_rewards(match)
        winner_name = match.winner.username if match.winner else 'Draw'
        return {'winner': winner_name}
