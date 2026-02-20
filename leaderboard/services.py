from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from .models import Leaderboard, Reward


def update_leaderboard_for_user(user, score_delta: int):
    if isinstance(score_delta, bool) or not isinstance(score_delta, int):
        raise ValueError('score_delta must be an integer.')
    if score_delta < 0:
        raise ValueError('score_delta must be non-negative.')
    if score_delta == 0:
        return

    now = timezone.now()
    week_start = Leaderboard.current_week_start(now)

    with transaction.atomic():
        _increment_scope_score(
            user=user,
            scope=Leaderboard.Scope.GLOBAL,
            score_delta=score_delta,
            week_start=None,
            now=now,
        )
        _increment_scope_score(
            user=user,
            scope=Leaderboard.Scope.WEEKLY,
            score_delta=score_delta,
            week_start=week_start,
            now=now,
        )


def _increment_scope_score(user, scope, score_delta, week_start, now):
    filters = {
        'user': user,
        'scope': scope,
        'week_start': week_start,
    }
    updated_count = Leaderboard.objects.filter(**filters).update(
        score=F('score') + score_delta,
        updated_at=now,
    )
    if updated_count:
        return

    try:
        Leaderboard.objects.create(
            user=user,
            scope=scope,
            week_start=week_start,
            score=score_delta,
        )
    except IntegrityError:
        Leaderboard.objects.filter(**filters).update(
            score=F('score') + score_delta,
            updated_at=now,
        )


def finalize_battle_rewards(match):
    if not match.winner:
        return

    reward, created = Reward.objects.get_or_create(
        user=match.winner,
        source_type=Reward.SourceType.BATTLE_WIN,
        source_id=match.room_code,
        defaults={
            'name': 'Battle Winner',
            'description': f'Won battle room {match.room_code}',
            'points_awarded': match.xp_stake,
            'badge_icon': '\u2694\ufe0f',
        },
    )
    if not created:
        return

    winner_profile = match.winner.profile
    winner_profile.add_xp(match.xp_stake)
    update_leaderboard_for_user(match.winner, match.xp_stake)
