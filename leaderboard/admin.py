from django.contrib import admin

from .models import Leaderboard, Reward


@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = ('user', 'scope', 'week_start', 'score', 'updated_at')
    list_filter = ('scope', 'week_start')
    search_fields = ('user__username',)


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'source_type', 'source_id', 'points_awarded', 'granted_at')
    search_fields = ('user__username', 'name', 'source_id')

# Register your models here.
