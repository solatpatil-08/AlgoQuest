from .models import Leaderboard, Reward


def update_leaderboard_for_user(user, score_delta: int):
    for scope in [Leaderboard.Scope.GLOBAL, Leaderboard.Scope.WEEKLY]:
        entry, _ = Leaderboard.objects.get_or_create(user=user, scope=scope)
        entry.score += score_delta
        entry.save(update_fields=['score', 'updated_at'])


def finalize_battle_rewards(match):
    if not match.winner:
        return

    winner_profile = match.winner.profile
    winner_profile.add_xp(match.xp_stake)
    update_leaderboard_for_user(match.winner, match.xp_stake)
    Reward.objects.create(
        user=match.winner,
        name='Battle Winner',
        description=f'Won battle room {match.room_code}',
        points_awarded=match.xp_stake,
        badge_icon='\u2694\ufe0f',
    )
