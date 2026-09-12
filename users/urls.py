from django.urls import path

from .views import account_settings_view, dashboard_view, profile_settings_view, signup_view

urlpatterns = [
    path('signup/', signup_view, name='signup'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('profile/', profile_settings_view, name='profile-settings'),
    path('settings/', account_settings_view, name='account-settings'),
]
