from django.urls import path

from .views import challenge_detail_view, challenge_list_view, request_hint_view, submit_attempt_view

urlpatterns = [
    path('', challenge_list_view, name='challenges-list'),
    path('<slug:slug>/', challenge_detail_view, name='challenge-detail'),
    path('<slug:slug>/hint/', request_hint_view, name='challenge-hint'),
    path('<slug:slug>/submit/', submit_attempt_view, name='challenge-submit'),
]
