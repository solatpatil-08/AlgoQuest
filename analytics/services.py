from django.db.models import Avg, Case, IntegerField, Value, When

from challenges.models import Challenge, ChallengeAttempt


def _difficulty_rank_case():
    return Case(
        When(difficulty=Challenge.Difficulty.EASY, then=Value(0)),
        When(difficulty=Challenge.Difficulty.MEDIUM, then=Value(1)),
        When(difficulty=Challenge.Difficulty.HARD, then=Value(2)),
        default=Value(99),
        output_field=IntegerField(),
    )


def recommend_next_challenges(user, limit=3):
    attempted_ids = ChallengeAttempt.objects.filter(user=user, is_correct=True).values_list('challenge_id', flat=True)
    weak_area = (
        ChallengeAttempt.objects.filter(user=user)
        .values('challenge__algorithm_type')
        .annotate(avg_score=Avg('score'))
        .order_by('avg_score')
        .first()
    )
    weak_algorithm = weak_area['challenge__algorithm_type'] if weak_area else ''

    ordered_queryset = (
        Challenge.objects.filter(is_active=True)
        .exclude(id__in=attempted_ids)
        .annotate(difficulty_rank=_difficulty_rank_case())
        .order_by('difficulty_rank', 'title', 'id')
    )
    if weak_algorithm:
        prioritized = ordered_queryset.filter(algorithm_type=weak_algorithm)[:limit]
        if prioritized:
            return prioritized
    return ordered_queryset[:limit]
