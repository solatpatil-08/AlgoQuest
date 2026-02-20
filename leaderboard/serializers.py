from rest_framework import serializers

from .models import Leaderboard, Reward


class LeaderboardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    level = serializers.SerializerMethodField()
    xp = serializers.SerializerMethodField()

    class Meta:
        model = Leaderboard
        fields = ('id', 'username', 'scope', 'week_start', 'score', 'level', 'xp', 'updated_at')

    def get_level(self, obj):
        profile = getattr(obj.user, 'profile', None)
        return getattr(profile, 'level', None)

    def get_xp(self, obj):
        profile = getattr(obj.user, 'profile', None)
        return getattr(profile, 'xp', None)


class RewardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Reward
        fields = ('id', 'username', 'name', 'description', 'points_awarded', 'badge_icon', 'granted_at')
