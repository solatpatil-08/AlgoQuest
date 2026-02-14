from django.contrib import admin

from .models import Challenge, ChallengeAttempt


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ('title', 'challenge_type', 'algorithm_type', 'difficulty', 'xp_reward', 'is_active')
    list_filter = ('challenge_type', 'algorithm_type', 'difficulty', 'is_active')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(ChallengeAttempt)
class ChallengeAttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'challenge', 'score', 'is_correct', 'created_at')
    list_filter = ('is_correct', 'challenge__challenge_type')

# Register your models here.
