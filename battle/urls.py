from django.urls import path

from .views import battle_live_view, battle_lobby_view

urlpatterns = [
    path('', battle_lobby_view, name='battle-lobby'),
    path('live/<str:room_code>/', battle_live_view, name='battle-live'),
]
