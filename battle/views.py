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
    active_matches = BattleMatch.objects.filter(
        status__in=[BattleMatch.Status.WAITING, BattleMatch.Status.LIVE]
    ).select_related('player_one', 'player_two')[:10]
    return render(request, 'battle/lobby.html', {'active_matches': active_matches})


@login_required
def battle_live_view(request, room_code):
    match = get_object_or_404(BattleMatch, room_code=room_code)
    return render(request, 'battle/live_battle.html', {'match': match})


class BattleMatchApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        matches = BattleMatch.objects.filter(
            status__in=[BattleMatch.Status.WAITING, BattleMatch.Status.LIVE]
        ).select_related('player_one', 'player_two')
        return Response(BattleMatchSerializer(matches, many=True).data)

    def post(self, request):
        match, waiting = find_or_create_match(request.user)
        data = BattleMatchSerializer(match).data
        data['is_waiting'] = waiting
        return Response(data, status=status.HTTP_200_OK)

# Create your views here.
