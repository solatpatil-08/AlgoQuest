from django.urls import path

from .views import ChallengeAttemptListApiView, ChallengeListApiView

urlpatterns = [
    path('', ChallengeListApiView.as_view(), name='api-challenges'),
    path('attempts/', ChallengeAttemptListApiView.as_view(), name='api-challenge-attempts'),
]
