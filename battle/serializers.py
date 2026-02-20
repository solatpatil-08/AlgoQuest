from rest_framework import serializers

from .models import BattleMatch


class BattleMatchSerializer(serializers.ModelSerializer):
    player_one_name = serializers.CharField(source='player_one.username', read_only=True)
    player_two_name = serializers.CharField(source='player_two.username', read_only=True)
    challenge_title = serializers.CharField(source='challenge.title', read_only=True)
    preferred_topic_stable_id = serializers.CharField(source='preferred_topic.stable_id', read_only=True)

    class Meta:
        model = BattleMatch
        fields = (
            'id',
            'room_code',
            'player_one',
            'player_one_name',
            'player_two',
            'player_two_name',
            'preferred_topic',
            'preferred_topic_stable_id',
            'challenge',
            'challenge_title',
            'player_one_score',
            'player_two_score',
            'status',
            'xp_stake',
            'created_at',
            'started_at',
            'ended_at',
        )
        read_only_fields = (
            'room_code',
            'preferred_topic',
            'challenge',
            'player_one_score',
            'player_two_score',
            'status',
            'created_at',
            'started_at',
            'ended_at',
        )
