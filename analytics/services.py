from django.db.models import Avg

from challenges.models import Challenge, ChallengeAttempt


def recommend_next_challenges(user, limit=3):
    attempted_ids = list(
        ChallengeAttempt.objects.filter(user=user, is_correct=True).values_list('challenge_id', flat=True)
    )
    weak_area = (
        ChallengeAttempt.objects.filter(user=user)
        .values('challenge__algorithm_type')
        .annotate(avg_score=Avg('score'))
        .order_by('avg_score')
        .first()
    )
    weak_algorithm = weak_area['challenge__algorithm_type'] if weak_area else ''

    queryset = Challenge.objects.filter(is_active=True).exclude(id__in=attempted_ids)
    if weak_algorithm:
        prioritized = queryset.filter(algorithm_type=weak_algorithm)[:limit]
        if prioritized:
            return prioritized
    return queryset.order_by('difficulty', 'title')[:limit]
