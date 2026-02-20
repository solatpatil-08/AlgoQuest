from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta


class Leaderboard(models.Model):
    class Scope(models.TextChoices):
        GLOBAL = 'global', 'Global'
        WEEKLY = 'weekly', 'Weekly'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leaderboard_entries')
    scope = models.CharField(max_length=12, choices=Scope.choices, default=Scope.GLOBAL)
    week_start = models.DateField(null=True, blank=True, db_index=True)
    score = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-score', '-updated_at', 'id')
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'scope'],
                condition=Q(scope='global'),
                name='uq_leaderboard_user_global_scope',
            ),
            models.UniqueConstraint(
                fields=['user', 'scope', 'week_start'],
                condition=Q(scope='weekly'),
                name='uq_leaderboard_user_weekly_scope_window',
            ),
            models.CheckConstraint(
                check=Q(score__gte=0),
                name='ck_leaderboard_score_non_negative',
            ),
            models.CheckConstraint(
                check=(
                    Q(scope='global', week_start__isnull=True)
                    | Q(scope='weekly', week_start__isnull=False)
                ),
                name='ck_leaderboard_week_scope_consistency',
            ),
        ]
        indexes = [
            models.Index(fields=['scope', 'week_start', '-score', '-updated_at']),
        ]

    def __str__(self):
        if self.scope == self.Scope.WEEKLY and self.week_start:
            return f"{self.user.username} [{self.scope}:{self.week_start}] {self.score}"
        return f"{self.user.username} [{self.scope}] {self.score}"

    @staticmethod
    def current_week_start(now=None):
        current_date = timezone.localdate(now) if now else timezone.localdate()
        return current_date - timedelta(days=current_date.weekday())

    def save(self, *args, **kwargs):
        if self.scope == self.Scope.WEEKLY and self.week_start is None:
            self.week_start = self.current_week_start()
        elif self.scope == self.Scope.GLOBAL:
            self.week_start = None
        super().save(*args, **kwargs)


class Reward(models.Model):
    class SourceType(models.TextChoices):
        BATTLE_WIN = 'battle_win', 'Battle Win'
        OTHER = 'other', 'Other'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rewards')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    points_awarded = models.PositiveIntegerField(default=0)
    badge_icon = models.CharField(max_length=20, default='\U0001f3c5')
    source_type = models.CharField(max_length=30, choices=SourceType.choices, null=True, blank=True)
    source_id = models.CharField(max_length=80, null=True, blank=True)
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-granted_at',)
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'source_type', 'source_id'],
                condition=Q(source_type__isnull=False, source_id__isnull=False),
                name='uq_reward_user_source',
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.name}"

# Create your models here.
