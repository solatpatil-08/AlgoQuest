from django.urls import path

from .views import leaderboard_page_view

urlpatterns = [
    path('', leaderboard_page_view, name='leaderboard-page'),
]
