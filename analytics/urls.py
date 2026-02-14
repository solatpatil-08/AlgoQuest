from django.urls import path

from .views import analytics_overview_view, recommendation_api_view

urlpatterns = [
    path('', analytics_overview_view, name='analytics-overview'),
    path('recommendations/', recommendation_api_view, name='analytics-recommendations'),
]
