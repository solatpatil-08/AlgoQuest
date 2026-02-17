from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .matchmaking import find_or_create_match
from .models import BattleMatch
from .serializers import BattleMatchSerializer


@login_required
def battle_lobby_view(request):
    from challenges.models import Topic, Challenge
    
    active_matches = BattleMatch.objects.filter(
        status__in=[BattleMatch.Status.WAITING, BattleMatch.Status.LIVE]
    ).select_related('player_one', 'player_two')[:10]
    
    # Get all active topics with difficulty distribution and challenge counts
    topics = Topic.objects.filter(is_active=True).prefetch_related('challenges')
    topic_data = []
    for topic in topics:
        challenges = topic.challenges.filter(is_active=True)
        difficulty_dist = {
            'easy': challenges.filter(difficulty='easy').count(),
            'medium': challenges.filter(difficulty='medium').count(),
            'hard': challenges.filter(difficulty='hard').count(),
        }
        topic_data.append({
            'topic': topic,
            'challenge_count': challenges.count(),
            'difficulty_distribution': difficulty_dist,
        })
    
    return render(request, 'battle/lobby.html', {
        'active_matches': active_matches,
        'topic_data': topic_data,
    })


@login_required
def battle_live_view(request, room_code):
    match = get_object_or_404(BattleMatch, room_code=room_code)
    
    # Select a challenge if not already assigned
    # Prefer topic from session if available, otherwise pick any valid challenge
    from challenges.models import Challenge, Topic
    
    session = getattr(request, 'session', None)
    topic_preference = session.get('battle_topic_preference') if session is not None else None
    challenge = None
    
    try:
        # Get user's solved challenges
        user_solved = set(
            request.user.challenge_attempts.filter(
                is_correct=True
            ).values_list('challenge_id', flat=True)
        )
        
        # Build query filters
        base_filter = {
            'is_active': True,
            'challenge_type': Challenge.ChallengeType.ALGORITHM
        }
        
        # Try to get a challenge from the preferred topic first
        if topic_preference:
            try:
                topic = Topic.objects.get(stable_id=topic_preference, is_active=True)
                challenge = topic.challenges.filter(
                    **base_filter
                ).exclude(id__in=user_solved).first()
            except Topic.DoesNotExist:
                pass
        
        # Fallback: get any unsolved algorithm challenge
        if not challenge:
            challenge = Challenge.objects.filter(
                **base_filter
            ).exclude(id__in=user_solved).first()
        
        # Final fallback: get any active algorithm challenge
        if not challenge:
            challenge = Challenge.objects.filter(
                **base_filter
            ).first()
    except:
        challenge = None
    
    # Get user's recent attempts on this challenge if available
    user_attempts = []
    if challenge and request.user.is_authenticated:
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
        match, waiting = find_or_create_match(request.user, topic_preference=topic_preference)
        # Store topic preference in session for the live battle view
        request.session['battle_topic_preference'] = topic_preference
        data = BattleMatchSerializer(match).data
        data['is_waiting'] = waiting
        return Response(data, status=status.HTTP_200_OK)

# Create your views here.
