from rest_framework import serializers

from .models import Challenge, ChallengeAttempt


class ChallengeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Challenge
        fields = (
            'id',
            'title',
            'slug',
            'challenge_type',
            'algorithm_type',
            'difficulty',
            'description',
            'prompt',
            'xp_reward',
            'max_score',
            'visualization_payload',
        )


class ChallengeAttemptSerializer(serializers.ModelSerializer):
    challenge_title = serializers.CharField(source='challenge.title', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ChallengeAttempt
        fields = (
            'id',
            'username',
            'challenge',
            'challenge_title',
            'score',
            'is_correct',
            'submitted_answer',
            'created_at',
        )
        read_only_fields = ('score', 'is_correct', 'created_at')
