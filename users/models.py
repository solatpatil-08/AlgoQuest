from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    level = models.PositiveIntegerField(default=1)
    xp = models.PositiveIntegerField(default=0)
    badges = models.JSONField(default=list, blank=True)
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
