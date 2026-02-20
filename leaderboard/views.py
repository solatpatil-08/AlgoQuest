from django.db.models import Q
from django.shortcuts import render
from rest_framework.exceptions import ValidationError
from rest_framework import generics, permissions

from .models import Leaderboard
from .serializers import LeaderboardSerializer


def leaderboard_page_view(request):
    weekly_start = Leaderboard.current_week_start()
    global_board = (
        Leaderboard.objects.filter(scope=Leaderboard.Scope.GLOBAL)
        .select_related('user')
        .order_by('-score', '-updated_at', 'id')[:20]
    )
    weekly_board = (
        Leaderboard.objects.filter(
            scope=Leaderboard.Scope.WEEKLY,
            week_start=weekly_start,
        )
        .select_related('user')
        .order_by('-score', '-updated_at', 'id')[:20]
    )
    return render(
        request,
        'leaderboard/leaderboard.html',
        {
            'global_board': global_board,
            'weekly_board': weekly_board,
            'weekly_start': weekly_start,
        },
    )


class LeaderboardApiView(generics.ListAPIView):
    serializer_class = LeaderboardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        scope = self.request.query_params.get('scope', Leaderboard.Scope.GLOBAL)
        valid_scopes = {Leaderboard.Scope.GLOBAL, Leaderboard.Scope.WEEKLY}
        if scope not in valid_scopes:
            raise ValidationError({'scope': 'Invalid scope. Use "global" or "weekly".'})

        limit_raw = self.request.query_params.get('limit', '20')
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            raise ValidationError({'limit': 'Limit must be a positive integer.'})
        if limit <= 0 or limit > 100:
            raise ValidationError({'limit': 'Limit must be between 1 and 100.'})

        filters = Q(scope=scope)
        if scope == Leaderboard.Scope.WEEKLY:
            filters &= Q(week_start=Leaderboard.current_week_start())

        return (
            Leaderboard.objects.filter(filters)
            .select_related('user', 'user__profile')
            .order_by('-score', '-updated_at', 'id')[:limit]
        )

# Create your views here.
