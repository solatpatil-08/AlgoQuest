import random
from datetime import timedelta

from django.utils import timezone

from challenges.models import Challenge
from leaderboard.services import finalize_battle_rewards

from .models import BattleMatch


def bot_challenge_queryset(topic=None):
    queryset = Challenge.objects.filter(
        is_active=True,
        challenge_type=Challenge.ChallengeType.ALGORITHM,
    ).select_related('topic')
    if topic is not None:
        queryset = queryset.filter(topic=topic)
    return queryset


def bot_challenge_count(topic=None):
    return bot_challenge_queryset(topic=topic).count()


def pick_random_unused_bot_challenge(match):
    used_ids = list(match.used_challenge_ids or [])
    available_ids = list(
        bot_challenge_queryset(topic=match.preferred_topic)
        .exclude(id__in=used_ids)
        .values_list('id', flat=True)
    )
    if not available_ids:
        return None
    challenge_id = random.choice(available_ids)
    return bot_challenge_queryset(topic=match.preferred_topic).get(id=challenge_id)


def _set_bot_round_ready(match):
    match.bot_round_status = BattleMatch.BotRoundStatus.READY
    match.bot_next_solve_at = None


def _schedule_next_bot_solve(match, now=None):
    base_time = now or timezone.now()
    interval_seconds = match.get_bot_score_interval_seconds()
    if not interval_seconds:
        match.bot_round_status = BattleMatch.BotRoundStatus.READY
        match.bot_next_solve_at = None
        return
    match.bot_round_status = BattleMatch.BotRoundStatus.RUNNING
    match.bot_next_solve_at = base_time + timedelta(seconds=interval_seconds)


def _finalize_bot_match(match, now=None):
    effective_now = now or timezone.now()
    if match.player_one_score > match.player_two_score:
        match.winner = match.player_one
    else:
        match.winner = None
    match.status = BattleMatch.Status.FINISHED
    match.ended_at = effective_now
    _set_bot_round_ready(match)
    match.save(update_fields=['winner', 'status', 'ended_at', 'bot_round_status', 'bot_next_solve_at'])
    finalize_battle_rewards(match)


def initialize_bot_match(match, now=None):
    effective_now = now or timezone.now()
    challenge = pick_random_unused_bot_challenge(match)
    if not challenge:
        match.challenge = None
        _set_bot_round_ready(match)
        match.status = BattleMatch.Status.FINISHED
        match.ended_at = effective_now
        match.save(update_fields=['challenge', 'bot_round_status', 'bot_next_solve_at', 'status', 'ended_at'])
        return match

    used_ids = list(match.used_challenge_ids or [])
    if challenge.id not in used_ids:
        used_ids.append(challenge.id)
    match.challenge = challenge
    match.used_challenge_ids = used_ids
    _set_bot_round_ready(match)
    match.save(update_fields=['challenge', 'used_challenge_ids', 'bot_round_status', 'bot_next_solve_at'])
    return match


def advance_bot_match(match, scorer, now=None):
    effective_now = now or timezone.now()
    if match.status != BattleMatch.Status.LIVE or not match.is_bot_match:
        return match, False

    if scorer == 'player':
        match.player_one_score += 1
    elif scorer == 'computer':
        match.player_two_score += 1
    else:
        raise ValueError('Unsupported bot battle scorer.')

    next_challenge = pick_random_unused_bot_challenge(match)
    if not next_challenge:
        match.save(update_fields=['player_one_score', 'player_two_score'])
        _finalize_bot_match(match, now=effective_now)
        return match, False

    used_ids = list(match.used_challenge_ids or [])
    if next_challenge.id not in used_ids:
        used_ids.append(next_challenge.id)
    match.challenge = next_challenge
    match.used_challenge_ids = used_ids
    _set_bot_round_ready(match)
    match.save(
        update_fields=[
            'player_one_score',
            'player_two_score',
            'challenge',
            'used_challenge_ids',
            'bot_round_status',
            'bot_next_solve_at',
        ]
    )
    return match, True


def start_bot_round(match, now=None):
    effective_now = now or timezone.now()
    if match.status != BattleMatch.Status.LIVE or not match.is_bot_match:
        return match, False

    if match.challenge_id is None:
        initialize_bot_match(match, now=effective_now)
        if match.status != BattleMatch.Status.LIVE or match.challenge_id is None:
            return match, False

    if match.bot_round_is_running and match.bot_next_solve_at and effective_now < match.bot_next_solve_at:
        return match, False

    _schedule_next_bot_solve(match, now=effective_now)
    match.save(update_fields=['bot_round_status', 'bot_next_solve_at'])
    return match, True


def forfeit_bot_round(match, now=None):
    effective_now = now or timezone.now()
    if match.status != BattleMatch.Status.LIVE or not match.is_bot_match:
        return match, False
    if not match.bot_round_is_running:
        return match, False
    return advance_bot_match(match, scorer='computer', now=effective_now)


def restart_bot_match(match, now=None):
    effective_now = now or timezone.now()
    if not match.is_bot_match or match.status != BattleMatch.Status.LIVE:
        return match, False

    match.winner = None
    match.ended_at = None
    match.player_one_score = 0
    match.player_two_score = 0
    match.challenge = None
    match.used_challenge_ids = []
    _set_bot_round_ready(match)
    match.save(
        update_fields=[
            'winner',
            'ended_at',
            'player_one_score',
            'player_two_score',
            'challenge',
            'used_challenge_ids',
            'bot_round_status',
            'bot_next_solve_at',
        ]
    )
    initialize_bot_match(match, now=effective_now)
    return match, True


def reconcile_bot_match(match, now=None):
    effective_now = now or timezone.now()
    if not match.is_bot_match or match.status != BattleMatch.Status.LIVE:
        return match, False

    changed = False
    if match.challenge_id is None:
        initialize_bot_match(match, now=effective_now)
        return match, True

    if not match.bot_round_is_running or not match.bot_next_solve_at:
        return match, False

    while match.status == BattleMatch.Status.LIVE and match.bot_round_is_running and match.bot_next_solve_at and effective_now >= match.bot_next_solve_at:
        advance_time = match.bot_next_solve_at
        match, _ = advance_bot_match(match, scorer='computer', now=advance_time)
        changed = True
        if match.status != BattleMatch.Status.LIVE:
            break

    return match, changed


def register_bot_player_solve(match, attempt, now=None):
    effective_now = now or timezone.now()
    if not match.is_bot_match or match.status != BattleMatch.Status.LIVE:
        return match, False

    match, _ = reconcile_bot_match(match, now=effective_now)
    if not match.is_bot_match or match.status != BattleMatch.Status.LIVE:
        return match, False
    if not match.bot_round_is_running:
        return match, False
    if attempt.battle_score_applied:
        return match, False
    if attempt.challenge_id != match.challenge_id or not attempt.is_correct:
        return match, False

    attempt.battle_score_applied = True
    attempt.save(update_fields=['battle_score_applied'])
    match, challenge_advanced = advance_bot_match(match, scorer='player', now=effective_now)
    return match, challenge_advanced
