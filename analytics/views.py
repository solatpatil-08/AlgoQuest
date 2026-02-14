from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from rest_framework import generics, permissions

from .models import UserPerformance
from .serializers import UserPerformanceSerializer
from .services import recommend_next_challenges


@login_required
def analytics_overview_view(request):
    performances = UserPerformance.objects.filter(user=request.user).select_related('challenge')[:20]
    recommendations = recommend_next_challenges(request.user)
    return render(
        request,
        'analytics/overview.html',
        {'performances': performances, 'recommendations': recommendations},
    )


@login_required
def recommendation_api_view(request):
    recommendations = recommend_next_challenges(request.user)
    return JsonResponse(
        {
            'recommendations': [
                {
                    'title': challenge.title,
                    'slug': challenge.slug,
                    'difficulty': challenge.difficulty,
                }
                for challenge in recommendations
            ]
        }
    )


class AnalyticsApiView(generics.ListAPIView):
    serializer_class = UserPerformanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserPerformance.objects.filter(user=self.request.user).select_related('challenge')

# Create your views here.
