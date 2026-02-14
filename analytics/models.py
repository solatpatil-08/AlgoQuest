from django.contrib.auth.models import User
from django.db import models

from challenges.models import Challenge


class UserPerformance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='performance_events')
    challenge = models.ForeignKey(
        Challenge,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='performance_events',
    )
    score = models.PositiveIntegerField(default=0)
    accuracy = models.FloatField(default=0.0)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    attempts = models.PositiveIntegerField(default=1)
    recommended_next = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        challenge_name = self.challenge.title if self.challenge else 'General'
        return f"{self.user.username} - {challenge_name} ({self.score})"

# Create your models here.
