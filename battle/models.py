import uuid

from django.contrib.auth.models import User
from django.db import models


class BattleMatch(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        LIVE = 'live', 'Live'
        FINISHED = 'finished', 'Finished'

    class Mode(models.TextChoices):
        PVP = 'pvp', 'Online Opponent'
        BOT = 'bot', 'Computer'

    class BotRoundStatus(models.TextChoices):
        READY = 'ready', 'Ready'
        RUNNING = 'running', 'Running'

    room_code = models.CharField(max_length=12, unique=True, editable=False)
    player_one = models.ForeignKey(User, on_delete=models.CASCADE, related_name='battles_as_player_one')
    player_two = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='battles_as_player_two',
        null=True,
        blank=True,
    )
    preferred_topic = models.ForeignKey(
        'challenges.Topic',
        on_delete=models.SET_NULL,
        related_name='battle_matches',
        null=True,
        blank=True,
    )
    challenge = models.ForeignKey(
        'challenges.Challenge',
        on_delete=models.SET_NULL,
        related_name='battle_matches',
        null=True,
        blank=True,
    )
    used_challenge_ids = models.JSONField(default=list, blank=True)
    bot_round_status = models.CharField(
        max_length=16,
        choices=BotRoundStatus.choices,
        default=BotRoundStatus.READY,
    )
    bot_next_solve_at = models.DateTimeField(null=True, blank=True)
    player_one_score = models.IntegerField(default=0)
    player_two_score = models.IntegerField(default=0)
    mode = models.CharField(max_length=12, choices=Mode.choices, default=Mode.PVP)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.WAITING)
    min_level = models.PositiveIntegerField(default=1)
    max_level = models.PositiveIntegerField(default=50)
    xp_stake = models.PositiveIntegerField(default=50)
    winner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='won_battles',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.room_code} | {self.status}"

    def save(self, *args, **kwargs):
        if not self.room_code:
            self.room_code = uuid.uuid4().hex[:10]
        super().save(*args, **kwargs)

    @property
    def is_bot_match(self):
        return self.mode == self.Mode.BOT

    @property
    def opponent_display_name(self):
        if self.player_two_id and self.player_two:
            return self.player_two.username
        if self.is_bot_match:
            return 'Computer'
        return 'Waiting...'

    def get_bot_score_interval_seconds(self, challenge=None):
        if not self.is_bot_match:
            return None

        active_challenge = challenge or self.challenge
        difficulty = getattr(active_challenge, 'difficulty', '')
        interval_by_difficulty = {
            'easy': 45,
            'medium': 30,
            'hard': 20,
        }
        return interval_by_difficulty.get(difficulty, 30)

    @property
    def bot_round_is_ready(self):
        return self.is_bot_match and self.bot_round_status == self.BotRoundStatus.READY

    @property
    def bot_round_is_running(self):
        return self.is_bot_match and self.bot_round_status == self.BotRoundStatus.RUNNING

    def compute_bot_score(self, now=None, challenge=None):
        if not self.is_bot_match:
            return self.player_two_score
        return self.player_two_score

    @property
    def used_challenge_count(self):
        return len(self.used_challenge_ids or [])

    @property
    def winner_display_name(self):
        if self.is_bot_match:
            bot_score = self.player_two_score
            if self.player_one_score > bot_score:
                return self.player_one.username
            if bot_score > self.player_one_score:
                return 'Computer'
            return 'Draw'
        if self.winner_id and self.winner:
            return self.winner.username
        return 'Draw'

    def is_participant(self, user):
        if not user or not user.is_authenticated:
            return False
        return user.id in {self.player_one_id, self.player_two_id}

# Create your models here.
