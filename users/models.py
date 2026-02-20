from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    class ExperienceLevel(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    level = models.PositiveIntegerField(default=1)
    xp = models.PositiveIntegerField(default=0)
    badges = models.JSONField(default=list, blank=True)
    bio = models.TextField(
        max_length=300,
        blank=True,
        default='',
    )
    coding_interests = models.CharField(
        max_length=200,
        blank=True,
        default='',
    )
    preferred_language = models.CharField(
        max_length=40,
        blank=True,
        default='',
    )
    experience_level = models.CharField(
        max_length=20,
        choices=ExperienceLevel.choices,
        blank=True,
        default='',
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} | L{self.level} ({self.xp} XP)"

    @property
    def username(self):
        return self.user.username

    @property
    def email(self):
        return self.user.email

    def add_xp(self, amount: int) -> bool:
        if amount <= 0:
            return False

        old_level = self.level
        self.xp += amount
        self.level = max(1, (self.xp // 250) + 1)
        leveled_up = self.level > old_level
        if leveled_up:
            self.badges.append(f"Level {self.level} Achiever")
        self.save(update_fields=['xp', 'level', 'badges', 'updated_at'])
        return leveled_up

# Create your models here.
