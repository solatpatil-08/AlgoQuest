from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.views import (
    LoginView,
    PasswordResetCompleteView,
    PasswordResetConfirmView,
    PasswordResetDoneView,
    PasswordResetView,
)
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from rest_framework import generics, permissions

from analytics.services import recommend_next_challenges
from challenges.models import ChallengeAttempt
from leaderboard.models import Leaderboard, Reward

from .forms import (
    CustomAuthenticationForm,
    CustomPasswordResetForm,
    CustomSetPasswordForm,
    SignUpForm,
    UserSettingsForm,
)
from .serializers import UserSerializer


def home(request):
    return render(request, 'home.html')


def signup_view(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Your account has been created successfully.')
            return redirect('dashboard')
        messages.error(request, 'Please fix the highlighted signup errors.')
    else:
        form = SignUpForm()
    return render(request, 'users/signup.html', {'form': form})


@login_required
def dashboard_view(request):
    profile = request.user.profile
    recent_attempts = ChallengeAttempt.objects.filter(user=request.user).select_related('challenge')[:5]
    global_rank = Leaderboard.objects.filter(scope=Leaderboard.Scope.GLOBAL).order_by('-score')
    weekly_rank = Leaderboard.objects.filter(scope=Leaderboard.Scope.WEEKLY).order_by('-score')
    rewards = Reward.objects.filter(user=request.user)[:5]
    recommendations = recommend_next_challenges(request.user)

    context = {
        'profile': profile,
        'recent_attempts': recent_attempts,
        'global_rankings': global_rank[:10],
        'weekly_rankings': weekly_rank[:10],
        'rewards': rewards,
        'recommendations': recommendations,
    }
    return render(request, 'users/dashboard.html', context)


@login_required
def profile_settings_view(request):
    profile = request.user.profile
    if request.method == 'POST':
        form = UserSettingsForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            return redirect('profile-settings')
    else:
        form = UserSettingsForm(instance=request.user)

    return render(
        request,
        'users/profile.html',
        {
            'form': form,
            'profile': profile,
        },
    )


class UsersApiView(generics.ListAPIView):
    queryset = User.objects.select_related('profile').all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class CustomLoginView(LoginView):
    template_name = 'registration/login.html'
    authentication_form = CustomAuthenticationForm

    def form_valid(self, form):
        messages.success(self.request, f'Welcome back, {form.get_user().username}.')
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, 'Invalid username/email or password.')
        return super().form_invalid(form)


class CustomPasswordResetView(PasswordResetView):
    template_name = 'registration/password_reset_form.html'
    email_template_name = 'registration/password_reset_email.html'
    subject_template_name = 'registration/password_reset_subject.txt'
    success_url = reverse_lazy('password_reset_done')
    form_class = CustomPasswordResetForm

    def form_valid(self, form):
        messages.success(self.request, 'If an account exists, a reset link has been sent to that email.')
        return super().form_valid(form)


class CustomPasswordResetDoneView(PasswordResetDoneView):
    template_name = 'registration/password_reset_done.html'


class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    template_name = 'registration/password_reset_confirm.html'
    form_class = CustomSetPasswordForm
    success_url = reverse_lazy('password_reset_complete')

    def form_valid(self, form):
        messages.success(self.request, 'Password reset successful. You can now log in.')
        return super().form_valid(form)


class CustomPasswordResetCompleteView(PasswordResetCompleteView):
    template_name = 'registration/password_reset_complete.html'

# Create your views here.
