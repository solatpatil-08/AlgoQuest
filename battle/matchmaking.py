from django.utils import timezone

from .models import BattleMatch


def find_or_create_match(user):
    profile = user.profile
    candidates = BattleMatch.objects.filter(
        status=BattleMatch.Status.WAITING,
        player_two__isnull=True,
    ).exclude(player_one=user)

    for match in candidates.select_related('player_one__profile'):
        opponent_profile = match.player_one.profile
        if abs(opponent_profile.level - profile.level) <= 2 and abs(opponent_profile.xp - profile.xp) <= 400:
            match.player_two = user
            match.status = BattleMatch.Status.LIVE
            match.started_at = timezone.now()
            match.save(update_fields=['player_two', 'status', 'started_at'])
            return match, False

    new_match = BattleMatch.objects.create(
        player_one=user,
        min_level=max(1, profile.level - 2),
        max_level=profile.level + 2,
        status=BattleMatch.Status.WAITING,
    )
    return new_match, True
