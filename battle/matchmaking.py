import logging

from django.db import transaction
from django.utils import timezone

from challenges.models import Challenge, Topic

from .models import BattleMatch

logger = logging.getLogger(__name__)


def resolve_topic_preference(topic_preference):
    if not topic_preference:
        return None
    try:
        topic = Topic.objects.get(stable_id=topic_preference, is_active=True)
    except Topic.DoesNotExist:
        logger.info("Ignoring stale battle topic preference: %s", topic_preference)
        return None
    has_battle_challenges = Challenge.objects.filter(
        topic=topic,
        is_active=True,
        challenge_type=Challenge.ChallengeType.ALGORITHM,
    ).exists()
    if not has_battle_challenges:
        logger.info("Ignoring topic preference without battle-ready challenges: %s", topic_preference)
        return None
    return topic


def select_challenge_for_match(topic=None):
    base_queryset = Challenge.objects.filter(
        is_active=True,
        challenge_type=Challenge.ChallengeType.ALGORITHM,
    ).select_related('topic')

    if topic is not None:
        topic_challenge = (
            base_queryset.filter(topic=topic)
            .order_by('order_index', 'id')
            .first()
        )
        if topic_challenge:
            return topic_challenge

    return base_queryset.order_by('topic_id', 'order_index', 'id').first()


def find_or_create_match(user, topic_preference=None):
    profile = user.profile
    preferred_topic = resolve_topic_preference(topic_preference)
    candidates = BattleMatch.objects.filter(
        status=BattleMatch.Status.WAITING,
        player_two__isnull=True,
    ).exclude(player_one=user)

    for match_id in candidates.values_list('id', flat=True):
        with transaction.atomic():
            match = (
                BattleMatch.objects.select_for_update()
                .select_related('player_one__profile', 'preferred_topic')
                .filter(id=match_id)
                .first()
            )
            if not match:
                continue
            if match.player_two_id is not None or match.status != BattleMatch.Status.WAITING:
                continue
            opponent_profile = match.player_one.profile
            if (
                abs(opponent_profile.level - profile.level) > 2
                or abs(opponent_profile.xp - profile.xp) > 400
            ):
                continue
            if (
                preferred_topic is not None
                and match.preferred_topic_id is not None
                and match.preferred_topic_id != preferred_topic.id
            ):
                continue

            if match.preferred_topic_id is None and preferred_topic is not None:
                match.preferred_topic = preferred_topic

            match.player_two = user
            match.status = BattleMatch.Status.LIVE
            match.started_at = timezone.now()
            if match.challenge_id is None:
                match.challenge = select_challenge_for_match(topic=match.preferred_topic)
            match.save(
                update_fields=[
                    'preferred_topic',
                    'player_two',
                    'status',
                    'started_at',
                    'challenge',
                ]
            )
            return match, False

    new_match = BattleMatch.objects.create(
        player_one=user,
        preferred_topic=preferred_topic,
        min_level=max(1, profile.level - 2),
        max_level=profile.level + 2,
        status=BattleMatch.Status.WAITING,
    )
    return new_match, True
