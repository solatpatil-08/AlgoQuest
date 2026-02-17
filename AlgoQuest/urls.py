from django.conf import settings
from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path

from users.views import (
    CustomLoginView,
    CustomPasswordResetCompleteView,
    CustomPasswordResetConfirmView,
    CustomPasswordResetDoneView,
    CustomPasswordResetView,
    home,
)

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),
    path('accounts/login/', CustomLoginView.as_view(), name='login'),
    path('accounts/logout/', LogoutView.as_view(), name='logout'),
    path('accounts/password_reset/', CustomPasswordResetView.as_view(), name='password_reset'),
    path('accounts/password_reset/done/', CustomPasswordResetDoneView.as_view(), name='password_reset_done'),
    path('accounts/reset/<uidb64>/<token>/', CustomPasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('accounts/reset/done/', CustomPasswordResetCompleteView.as_view(), name='password_reset_complete'),
    path('users/', include('users.urls')),
    path('challenges/', include('challenges.urls')),
    path('battle/', include('battle.urls')),
    path('leaderboard/', include('leaderboard.urls')),
    path('analytics/', include('analytics.urls')),
    path('api/challenges/', include('challenges.api_urls')),
    path('api/leaderboard/', include('leaderboard.api_urls')),
    path('api/battle/', include('battle.api_urls')),
    path('api/users/', include('users.api_urls')),
    path('api/analytics/', include('analytics.api_urls')),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
