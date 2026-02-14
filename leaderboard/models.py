from django.contrib.auth.models import User
from django.db import models


class Leaderboard(models.Model):
    class Scope(models.TextChoices):
        GLOBAL = 'global', 'Global'
        WEEKLY = 'weekly', 'Weekly'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leaderboard_entries')
    scope = models.CharField(max_length=12, choices=Scope.choices, default=Scope.GLOBAL)
    score = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'scope')
        ordering = ('-score', 'updated_at')

    def __str__(self):
        return f"{self.user.username} [{self.scope}] {self.score}"


class Reward(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rewards')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    points_awarded = models.PositiveIntegerField(default=0)
    badge_icon = models.CharField(max_length=20, default='\U0001f3c5')
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-granted_at',)

    def __str__(self):
        return f"{self.user.username} - {self.name}"

# Create your models here.
