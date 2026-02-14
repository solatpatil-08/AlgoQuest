from rest_framework import serializers

from .models import Leaderboard, Reward


class LeaderboardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    level = serializers.IntegerField(source='user.profile.level', read_only=True)
    xp = serializers.IntegerField(source='user.profile.xp', read_only=True)

    class Meta:
        model = Leaderboard
        fields = ('id', 'username', 'scope', 'score', 'level', 'xp', 'updated_at')


class RewardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Reward
        fields = ('id', 'username', 'name', 'description', 'points_awarded', 'badge_icon', 'granted_at')
