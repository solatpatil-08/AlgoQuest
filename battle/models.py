import uuid

from django.contrib.auth.models import User
from django.db import models


class BattleMatch(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        LIVE = 'live', 'Live'
        FINISHED = 'finished', 'Finished'

    room_code = models.CharField(max_length=12, unique=True, editable=False)
    player_one = models.ForeignKey(User, on_delete=models.CASCADE, related_name='battles_as_player_one')
    player_two = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='battles_as_player_two',
        null=True,
        blank=True,
    )
    player_one_score = models.IntegerField(default=0)
    player_two_score = models.IntegerField(default=0)
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

# Create your models here.
