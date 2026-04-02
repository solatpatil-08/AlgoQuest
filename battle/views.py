from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, render
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from challenges.models import Challenge, Topic
from leaderboard.services import finalize_battle_rewards

from .bot_matches import bot_challenge_count, forfeit_bot_round, reconcile_bot_match, restart_bot_match, start_bot_round
from .matchmaking import create_bot_match, find_or_create_match, resolve_topic_preference, select_challenge_for_match
from .models import BattleMatch
from .serializers import BattleMatchSerializer

def _assign_match_challenge_if_needed(match):
    if match.is_bot_match and match.status == BattleMatch.Status.LIVE:
        with transaction.atomic():
            locked_match = (
                BattleMatch.objects.select_for_update()
                .select_related('preferred_topic', 'challenge', 'player_one', 'player_two')
                .get(id=match.id)
            )
            locked_match, _ = reconcile_bot_match(locked_match)
            return locked_match

    if match.challenge_id is not None or match.status != BattleMatch.Status.LIVE:
        return match

    with transaction.atomic():
        locked_match = (
            BattleMatch.objects.select_for_update()
            .select_related('preferred_topic', 'challenge', 'player_one', 'player_two')
            .get(id=match.id)
        )
        if locked_match.challenge_id is None and locked_match.status == BattleMatch.Status.LIVE:
            locked_match.challenge = select_challenge_for_match(
                topic=locked_match.preferred_topic,
                participants=[locked_match.player_one, locked_match.player_two],
            )
            locked_match.save(update_fields=['challenge'])
        return locked_match


def _serialize_match_state_for_client(match):
    return {
        'room_code': match.room_code,
        'mode': match.mode,
        'status': match.status,
        'winner': match.winner_display_name,
        'player_one_username': match.player_one.username,
        'player_two_username': match.opponent_display_name,
        'player_one_score': match.player_one_score,
        'player_two_score': match.player_two_score,
        'challenge_id': match.challenge_id,
        'challenge_title': match.challenge.title if match.challenge else '',
        'used_challenge_count': match.used_challenge_count,
        'bot_total_challenge_count': bot_challenge_count(topic=match.preferred_topic) if match.is_bot_match else 0,
        'bot_round_status': match.bot_round_status if match.is_bot_match else '',
        'started_at': match.started_at.isoformat() if match.started_at else '',
        'ended_at': match.ended_at.isoformat() if match.ended_at else '',
        'bot_score_interval_seconds': match.get_bot_score_interval_seconds(),
        'bot_next_solve_at': match.bot_next_solve_at.isoformat() if match.bot_next_solve_at else '',
    }


def _finalize_live_match_for_client(match):
    if match.status == BattleMatch.Status.FINISHED:
        return match
    if match.status != BattleMatch.Status.LIVE:
        raise ValueError('Only live battles can be finalized.')

    if match.is_bot_match:
        match, _ = reconcile_bot_match(match)
        if match.status == BattleMatch.Status.FINISHED:
            return match
        if match.player_one_score > match.player_two_score:
            match.winner = match.player_one
        else:
            match.winner = None
    else:
        if match.player_one_score > match.player_two_score:
            match.winner = match.player_one
        elif match.player_two_score > match.player_one_score:
            match.winner = match.player_two
        else:
            match.winner = None

    match.status = BattleMatch.Status.FINISHED
    match.ended_at = timezone.now()
    match.bot_round_status = BattleMatch.BotRoundStatus.READY
    match.bot_next_solve_at = None
    match.save(update_fields=['winner', 'status', 'ended_at', 'bot_round_status', 'bot_next_solve_at', 'player_two_score'])
    finalize_battle_rewards(match)
    return match


def battle_lobby_view(request):
    battle_challenge_filter = Q(
        challenges__is_active=True,
        challenges__challenge_type=Challenge.ChallengeType.ALGORITHM,
    )
    active_matches = BattleMatch.objects.filter(
        status=BattleMatch.Status.LIVE,
        mode=BattleMatch.Mode.PVP,
    ).select_related('player_one', 'player_two')[:10]

    topics = Topic.objects.filter(is_active=True).annotate(
        challenge_count=Count('challenges', filter=battle_challenge_filter, distinct=True),
        easy_count=Count(
            'challenges',
            filter=Q(
                challenges__is_active=True,
                challenges__challenge_type=Challenge.ChallengeType.ALGORITHM,
                challenges__difficulty=Challenge.Difficulty.EASY,
            ),
            distinct=True,
        ),
        medium_count=Count(
            'challenges',
            filter=Q(
                challenges__is_active=True,
                challenges__challenge_type=Challenge.ChallengeType.ALGORITHM,
                challenges__difficulty=Challenge.Difficulty.MEDIUM,
            ),
            distinct=True,
        ),
        hard_count=Count(
            'challenges',
            filter=Q(
                challenges__is_active=True,
                challenges__challenge_type=Challenge.ChallengeType.ALGORITHM,
                challenges__difficulty=Challenge.Difficulty.HARD,
            ),
            distinct=True,
        ),
    ).filter(challenge_count__gt=0)

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
        'user_attempts': user_attempts,
        'battle_mode': match.mode,
        'opponent_display_name': match.opponent_display_name,
        'winner_display_name': match.winner_display_name,
        'bot_score_interval_seconds': match.get_bot_score_interval_seconds(challenge=challenge),
        'bot_challenge_pool_count': bot_challenge_count(topic=match.preferred_topic) if match.is_bot_match else 0,
        'used_challenge_count': match.used_challenge_count,
        'remaining_challenge_count': max(0, bot_challenge_count(topic=match.preferred_topic) - match.used_challenge_count) if match.is_bot_match else 0,
        'bot_round_status': match.bot_round_status,
    })


class BattleMatchApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        room_code = request.query_params.get('room_code', '').strip()
        if room_code:
            match = get_object_or_404(
                BattleMatch.objects.select_related('player_one', 'player_two', 'winner', 'challenge'),
                room_code=room_code,
            )
            if not match.is_participant(request.user):
                return Response({'detail': 'Only battle participants can access this room.'}, status=status.HTTP_403_FORBIDDEN)
            if match.is_bot_match and match.status == BattleMatch.Status.LIVE:
                with transaction.atomic():
                    locked_match = (
                        BattleMatch.objects.select_for_update()
                        .select_related('player_one', 'player_two', 'winner', 'challenge')
                        .get(id=match.id)
                    )
                    match, _ = reconcile_bot_match(locked_match)
            return Response(_serialize_match_state_for_client(match))

        matches = BattleMatch.objects.filter(
            status__in=[BattleMatch.Status.WAITING, BattleMatch.Status.LIVE]
        ).select_related('player_one', 'player_two')
        return Response(BattleMatchSerializer(matches, many=True).data)

    def post(self, request):
        room_code = (request.data.get('room_code') or '').strip()
        battle_action = (request.data.get('battle_action') or '').strip().lower()
        if room_code and battle_action:
            with transaction.atomic():
                match = get_object_or_404(
                    BattleMatch.objects.select_for_update().select_related('player_one', 'player_two', 'winner', 'challenge'),
                    room_code=room_code,
                )
                if not match.is_participant(request.user):
                    return Response({'detail': 'Only battle participants can control this room.'}, status=status.HTTP_403_FORBIDDEN)

                if battle_action == 'finalize':
                    try:
                        match = _finalize_live_match_for_client(match)
                    except ValueError as exc:
                        return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                    payload = _serialize_match_state_for_client(match)
                    payload['bot_action'] = 'finalize'
                    return Response(payload, status=status.HTTP_200_OK)

                if not match.is_bot_match:
                    return Response({'error': 'Round controls are only available in computer battles.'}, status=status.HTTP_400_BAD_REQUEST)

                previous_challenge_id = match.challenge_id
                match, _ = reconcile_bot_match(match)
                if match.status != BattleMatch.Status.LIVE:
                    payload = _serialize_match_state_for_client(match)
                    payload['bot_action'] = battle_action
                    return Response(payload, status=status.HTTP_200_OK)

                changed = False
                last_solver = ''
                if battle_action == 'start':
                    if match.bot_round_is_running:
                        return Response({'error': 'This round is already running.'}, status=status.HTTP_400_BAD_REQUEST)
                    match, changed = start_bot_round(match)
                elif battle_action == 'forfeit':
                    if not match.bot_round_is_running:
                        return Response({'error': 'Start the round before you stop it.'}, status=status.HTTP_400_BAD_REQUEST)
                    match, changed = forfeit_bot_round(match)
                    last_solver = 'computer'
                elif battle_action == 'restart':
                    match, changed = restart_bot_match(match)
                else:
                    return Response({'error': 'Unsupported battle action.'}, status=status.HTTP_400_BAD_REQUEST)

                if not changed:
                    return Response({'error': 'No battle change was applied.'}, status=status.HTTP_400_BAD_REQUEST)

                payload = _serialize_match_state_for_client(match)
                payload.update({
                    'challenge_changed': previous_challenge_id != match.challenge_id,
                    'last_solver': last_solver,
                    'bot_action': battle_action,
                })
                return Response(payload, status=status.HTTP_200_OK)

        battle_mode = request.data.get('battle_mode') or BattleMatch.Mode.PVP
        if battle_mode not in {BattleMatch.Mode.PVP, BattleMatch.Mode.BOT}:
            return Response({'error': 'Unsupported battle mode.'}, status=status.HTTP_400_BAD_REQUEST)

        topic_preference = request.data.get('topic_preference')
        topic = resolve_topic_preference(topic_preference)
        if battle_mode == BattleMatch.Mode.BOT:
            match, waiting = create_bot_match(request.user, topic_preference=topic_preference)
        else:
            match, waiting = find_or_create_match(request.user, topic_preference=topic_preference)
        request.session['battle_topic_preference'] = topic.stable_id if topic else None
        data = BattleMatchSerializer(match).data
        data['is_waiting'] = waiting
        return Response(data, status=status.HTTP_200_OK)

# Create your views here.
