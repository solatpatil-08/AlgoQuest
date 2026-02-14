from django.urls import path

from .views import AnalyticsApiView

urlpatterns = [
    path('', AnalyticsApiView.as_view(), name='api-analytics'),
]
