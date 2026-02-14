from django.urls import path

from .views import LeaderboardApiView

urlpatterns = [
    path('', LeaderboardApiView.as_view(), name='api-leaderboard'),
]
