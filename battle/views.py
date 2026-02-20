from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, render
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from challenges.models import Challenge, Topic

from .matchmaking import find_or_create_match, resolve_topic_preference, select_challenge_for_match
from .models import BattleMatch
from .serializers import BattleMatchSerializer

def _assign_match_challenge_if_needed(match):
    if match.challenge_id is not None or match.status != BattleMatch.Status.LIVE:
        return match

    with transaction.atomic():
        locked_match = (
            BattleMatch.objects.select_for_update()
            .select_related('preferred_topic', 'challenge', 'player_one', 'player_two')
            .get(id=match.id)
        )
        if locked_match.challenge_id is None and locked_match.status == BattleMatch.Status.LIVE:
            locked_match.challenge = select_challenge_for_match(topic=locked_match.preferred_topic)
            locked_match.save(update_fields=['challenge'])
        return locked_match


@login_required
def battle_lobby_view(request):
    active_matches = BattleMatch.objects.filter(
        status__in=[BattleMatch.Status.WAITING, BattleMatch.Status.LIVE]
    ).select_related('player_one', 'player_two')[:10]

    topics = Topic.objects.filter(is_active=True).annotate(
        challenge_count=Count('challenges', filter=Q(challenges__is_active=True), distinct=True),
        easy_count=Count(
            'challenges',
            filter=Q(
                challenges__is_active=True,
                challenges__difficulty=Challenge.Difficulty.EASY,
            ),
            distinct=True,
        ),
        medium_count=Count(
            'challenges',
            filter=Q(
                challenges__is_active=True,
                challenges__difficulty=Challenge.Difficulty.MEDIUM,
            ),
            distinct=True,
        ),
        hard_count=Count(
            'challenges',
            filter=Q(
                challenges__is_active=True,
                challenges__difficulty=Challenge.Difficulty.HARD,
            ),
            distinct=True,
        ),
    )

    topic_data = [
        {
            'topic': topic,
            'challenge_count': topic.challenge_count,
            'difficulty_distribution': {
                'easy': topic.easy_count,
                'medium': topic.medium_count,
                'hard': topic.hard_count,
            },
        }
        for topic in topics
    ]

    return render(request, 'battle/lobby.html', {
        'active_matches': active_matches,
        'topic_data': topic_data,
    })


@login_required
def battle_live_view(request, room_code):
    match = get_object_or_404(
        BattleMatch.objects.select_related('player_one', 'player_two', 'challenge', 'preferred_topic'),
        room_code=room_code,
    )
    if not match.is_participant(request.user):
        return HttpResponseForbidden("Only battle participants can access this room.")

    match = _assign_match_challenge_if_needed(match)
    challenge = match.challenge

    user_attempts = []
    if challenge:
        user_attempts = challenge.attempts.filter(
            user=request.user
        ).order_by('-created_at')[:5]
    
    return render(request, 'battle/live_battle.html', {
        'match': match,
        'challenge': challenge,
        'user_attempts': user_attempts
    })


class BattleMatchApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        matches = BattleMatch.objects.filter(
            status__in=[BattleMatch.Status.WAITING, BattleMatch.Status.LIVE]
        ).select_related('player_one', 'player_two')
        return Response(BattleMatchSerializer(matches, many=True).data)

    def post(self, request):
        topic_preference = request.data.get('topic_preference')
        topic = resolve_topic_preference(topic_preference)
        match, waiting = find_or_create_match(request.user, topic_preference=topic_preference)
        request.session['battle_topic_preference'] = topic.stable_id if topic else None
        data = BattleMatchSerializer(match).data
        data['is_waiting'] = waiting
        return Response(data, status=status.HTTP_200_OK)

# Create your views here.
