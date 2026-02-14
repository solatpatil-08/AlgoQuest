from rest_framework import serializers

from .models import UserPerformance


class UserPerformanceSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    challenge_title = serializers.CharField(source='challenge.title', read_only=True)

    class Meta:
        model = UserPerformance
        fields = (
            'id',
            'username',
            'challenge',
            'challenge_title',
            'score',
            'accuracy',
            'time_spent_seconds',
            'attempts',
            'recommended_next',
            'created_at',
        )
