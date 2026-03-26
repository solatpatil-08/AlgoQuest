import logging

from django.db import transaction
from django.utils import timezone

from challenges.models import Challenge, Topic

from .bot_matches import initialize_bot_match
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


def select_challenge_for_match(topic=None, participants=None):
    base_queryset = Challenge.objects.filter(
        is_active=True,
        challenge_type=Challenge.ChallengeType.ALGORITHM,
    ).select_related('topic')

    participant_ids = sorted({
        participant.id
        for participant in (participants or [])
        if participant is not None and getattr(participant, 'id', None)
    })
    candidate_queryset = base_queryset
    if participant_ids:
        candidate_queryset = (
            candidate_queryset.exclude(
                user_progress__user_id__in=participant_ids,
                user_progress__is_solved=True,
            )
            .distinct()
        )

    if topic is not None:
        topic_challenge = (
            candidate_queryset.filter(topic=topic)
            .order_by('order_index', 'id')
            .first()
        )
        if topic_challenge:
            return topic_challenge

        topic_fallback = (
            base_queryset.filter(topic=topic)
            .order_by('order_index', 'id')
            .first()
        )
        if topic_fallback:
            return topic_fallback

    match_fresh_challenge = candidate_queryset.order_by('topic_id', 'order_index', 'id').first()
    if match_fresh_challenge:
        return match_fresh_challenge

    return base_queryset.order_by('topic_id', 'order_index', 'id').first()


def _waiting_room_for_user(user):
    return (
        BattleMatch.objects.filter(
            player_one=user,
            status=BattleMatch.Status.WAITING,
            player_two__isnull=True,
            mode=BattleMatch.Mode.PVP,
        )
        .select_related('preferred_topic')
        .order_by('created_at')
        .first()
    )


def find_or_create_match(user, topic_preference=None):
    profile = user.profile
    preferred_topic = resolve_topic_preference(topic_preference)

    # Reuse an already-open waiting room for this user to avoid queue spam.
    existing_waiting = _waiting_room_for_user(user)
    if existing_waiting:
        if existing_waiting.preferred_topic_id is None and preferred_topic is not None:
            existing_waiting.preferred_topic = preferred_topic
            existing_waiting.save(update_fields=['preferred_topic'])
        return existing_waiting, True

    candidates = BattleMatch.objects.filter(
        status=BattleMatch.Status.WAITING,
        player_two__isnull=True,
        mode=BattleMatch.Mode.PVP,
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
                match.challenge = select_challenge_for_match(
                    topic=match.preferred_topic,
                    participants=[match.player_one, user],
                )
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
        mode=BattleMatch.Mode.PVP,
        min_level=max(1, profile.level - 2),
        max_level=profile.level + 2,
        status=BattleMatch.Status.WAITING,
    )
    return new_match, True


def create_bot_match(user, topic_preference=None):
    profile = user.profile
    preferred_topic = resolve_topic_preference(topic_preference)

    existing_live_bot = (
        BattleMatch.objects.filter(
            player_one=user,
            status=BattleMatch.Status.LIVE,
            mode=BattleMatch.Mode.BOT,
        )
        .select_related('preferred_topic', 'challenge')
        .order_by('-created_at')
        .first()
    )
    if existing_live_bot:
        if existing_live_bot.preferred_topic_id == getattr(preferred_topic, 'id', None):
            return existing_live_bot, False

        existing_live_bot.preferred_topic = preferred_topic
        existing_live_bot.ended_at = None
        existing_live_bot.winner = None
        existing_live_bot.player_one_score = 0
        existing_live_bot.player_two_score = 0
        existing_live_bot.challenge = None
        existing_live_bot.used_challenge_ids = []
        existing_live_bot.bot_round_status = BattleMatch.BotRoundStatus.READY
        existing_live_bot.bot_next_solve_at = None
        existing_live_bot.save(
            update_fields=[
                'preferred_topic',
                'ended_at',
                'winner',
                'player_one_score',
                'player_two_score',
                'challenge',
                'used_challenge_ids',
                'bot_round_status',
                'bot_next_solve_at',
            ]
        )
        initialize_bot_match(existing_live_bot, now=timezone.now())
        return existing_live_bot, False

    waiting_match = _waiting_room_for_user(user)
    if waiting_match:
        waiting_match.preferred_topic = preferred_topic
        waiting_match.mode = BattleMatch.Mode.BOT
        waiting_match.status = BattleMatch.Status.LIVE
        waiting_match.started_at = timezone.now()
        waiting_match.ended_at = None
        waiting_match.winner = None
        waiting_match.player_one_score = 0
        waiting_match.player_two_score = 0
        waiting_match.challenge = None
        waiting_match.used_challenge_ids = []
        waiting_match.bot_round_status = BattleMatch.BotRoundStatus.READY
        waiting_match.bot_next_solve_at = None
        waiting_match.save(
            update_fields=[
                'preferred_topic',
                'mode',
                'status',
                'started_at',
                'ended_at',
                'winner',
                'player_one_score',
                'player_two_score',
                'challenge',
                'used_challenge_ids',
                'bot_round_status',
                'bot_next_solve_at',
            ]
        )
        initialize_bot_match(waiting_match, now=waiting_match.started_at)
        return waiting_match, False

    match = BattleMatch.objects.create(
        player_one=user,
        preferred_topic=preferred_topic,
        challenge=None,
        used_challenge_ids=[],
        bot_round_status=BattleMatch.BotRoundStatus.READY,
        bot_next_solve_at=None,
        mode=BattleMatch.Mode.BOT,
        min_level=max(1, profile.level - 2),
        max_level=profile.level + 2,
        status=BattleMatch.Status.LIVE,
        started_at=timezone.now(),
    )
    initialize_bot_match(match, now=match.started_at)
    return match, False
