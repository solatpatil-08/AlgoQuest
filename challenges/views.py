from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_POST
from rest_framework import generics, permissions

from leaderboard.services import update_leaderboard_for_user

from .models import Challenge, ChallengeAttempt
from .serializers import ChallengeAttemptSerializer, ChallengeSerializer


def challenge_list_view(request):
    challenges = Challenge.objects.filter(is_active=True).order_by('difficulty', 'title')
    return render(request, 'challenges/challenge_list.html', {'challenges': challenges})


def challenge_detail_view(request, slug):
    challenge = get_object_or_404(Challenge, slug=slug, is_active=True)
    user_attempts = []
    if request.user.is_authenticated:
        user_attempts = ChallengeAttempt.objects.filter(user=request.user, challenge=challenge)[:5]
    return render(
        request,
        'challenges/challenge_detail.html',
        {
            'challenge': challenge,
            'user_attempts': user_attempts,
        },
    )


@login_required
@require_POST
def submit_attempt_view(request, slug):
    challenge = get_object_or_404(Challenge, slug=slug, is_active=True)
    answer = request.POST.get('answer', '').strip()
    is_correct = bool(challenge.expected_answer) and challenge.expected_answer.lower() == answer.lower()

    if is_correct:
        score = challenge.max_score
    elif challenge.challenge_type == Challenge.ChallengeType.ALGORITHM:
        score = min(challenge.max_score, max(20, len(answer) * 2))
    else:
        score = 0

    ChallengeAttempt.objects.create(
        user=request.user,
        challenge=challenge,
        score=score,
        is_correct=is_correct,
        submitted_answer=answer,
    )

    gained_xp = challenge.xp_reward if is_correct else max(5, challenge.xp_reward // 5)
    request.user.profile.add_xp(gained_xp)
    update_leaderboard_for_user(request.user, gained_xp)

    return JsonResponse(
        {
            'is_correct': is_correct,
            'score': score,
            'xp_gained': gained_xp,
            'current_xp': request.user.profile.xp,
            'current_level': request.user.profile.level,
        }
    )


class ChallengeListApiView(generics.ListAPIView):
    queryset = Challenge.objects.filter(is_active=True).order_by('title')
    serializer_class = ChallengeSerializer
    permission_classes = [permissions.AllowAny]


class ChallengeAttemptListApiView(generics.ListAPIView):
    serializer_class = ChallengeAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChallengeAttempt.objects.filter(user=self.request.user).select_related('challenge')

# Create your views here.
