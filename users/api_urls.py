from django.urls import path

from .views import UsersApiView

urlpatterns = [
    path('', UsersApiView.as_view(), name='api-users'),
]
