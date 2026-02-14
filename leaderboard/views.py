from django.shortcuts import render
from rest_framework import generics, permissions

from .models import Leaderboard
from .serializers import LeaderboardSerializer


def leaderboard_page_view(request):
    global_board = Leaderboard.objects.filter(scope=Leaderboard.Scope.GLOBAL).select_related('user')[:20]
    weekly_board = Leaderboard.objects.filter(scope=Leaderboard.Scope.WEEKLY).select_related('user')[:20]
    return render(
        request,
        'leaderboard/leaderboard.html',
        {'global_board': global_board, 'weekly_board': weekly_board},
    )


class LeaderboardApiView(generics.ListAPIView):
    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        scope = self.request.query_params.get('scope', Leaderboard.Scope.GLOBAL)
        return Leaderboard.objects.filter(scope=scope).select_related('user', 'user__profile')

# Create your views here.
