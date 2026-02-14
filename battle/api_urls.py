from django.urls import path

from .views import BattleMatchApiView

urlpatterns = [
    path('', BattleMatchApiView.as_view(), name='api-battle'),
]
