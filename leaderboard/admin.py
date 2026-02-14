from django.contrib import admin

from .models import Leaderboard, Reward


@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = ('user', 'scope', 'score', 'updated_at')
    list_filter = ('scope',)
    search_fields = ('user__username',)


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ('user', 'name', 'points_awarded', 'granted_at')
    search_fields = ('user__username', 'name')

# Register your models here.
