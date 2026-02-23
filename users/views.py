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
from django.db import IntegrityError, transaction
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from rest_framework import generics, permissions

from analytics.services import recommend_next_challenges
from battle.models import BattleMatch
from challenges.models import Challenge, ChallengeAttempt
from leaderboard.models import Leaderboard, Reward

from .forms import (
    CustomAuthenticationForm,
    CustomPasswordResetForm,
    CustomSetPasswordForm,
    SignUpForm,
    UserProfileForm,
    UserSettingsForm,
)
from .models import UserProfile
from .serializers import UserSerializer

XP_PER_LEVEL = 250


def home(request):
    total_challenges = Challenge.objects.filter(is_active=True).count()
    algorithm_types = (
        Challenge.objects.filter(
            is_active=True,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
        )
        .exclude(algorithm_type='')
        .values('algorithm_type')
        .distinct()
        .count()
    )
    live_battles = BattleMatch.objects.filter(status=BattleMatch.Status.LIVE).count()
    total_learners = User.objects.count()

    context = {
        'home_stats': {
            'total_challenges': total_challenges,
            'algorithm_types': algorithm_types,
            'live_battles': live_battles,
            'total_learners': total_learners,
        }
    }
    return render(request, 'home.html', context)


def signup_view(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    user = form.save()
            except IntegrityError:
                form.add_error('email', 'An account with this email already exists.')
            else:
                login(request, user)
                messages.success(request, 'Your account has been created successfully.')
                return redirect('dashboard')
        messages.error(request, 'Please fix the highlighted signup errors.')
    else:
        form = SignUpForm()
    return render(request, 'users/signup.html', {'form': form})


@login_required
def dashboard_view(request):
    profile, _created = UserProfile.objects.get_or_create(user=request.user)

    # Progress should reflect the active level band, not total lifetime XP.
    level_floor_xp = max(profile.level - 1, 0) * XP_PER_LEVEL
    xp_in_level = profile.xp - level_floor_xp
    if xp_in_level < 0 or xp_in_level >= XP_PER_LEVEL:
        xp_in_level = profile.xp % XP_PER_LEVEL
    xp_to_next_level = XP_PER_LEVEL - xp_in_level
    xp_percentage = max(0, min(100, int((xp_in_level / XP_PER_LEVEL) * 100)))

    recent_attempts = (
        ChallengeAttempt.objects.filter(user=request.user)
        .select_related('challenge')
        .order_by('-created_at', '-id')[:5]
    )
    weekly_start = Leaderboard.current_week_start()
    global_rank = (
        Leaderboard.objects.filter(scope=Leaderboard.Scope.GLOBAL)
        .select_related('user')
        .order_by('-score', '-updated_at', 'id')
    )
    weekly_rank = (
        Leaderboard.objects.filter(
            scope=Leaderboard.Scope.WEEKLY,
            week_start=weekly_start,
        )
        .select_related('user')
        .order_by('-score', '-updated_at', 'id')
    )
    rewards = Reward.objects.filter(user=request.user).order_by('-granted_at', '-id')[:5]
    recommendations = recommend_next_challenges(request.user)

    context = {
        'profile': profile,
        'xp_in_level': xp_in_level,
        'xp_to_next_level': xp_to_next_level,
        'xp_percentage': xp_percentage,
        'xp_level_band': XP_PER_LEVEL,
        'recent_attempts': recent_attempts,
        'global_rankings': global_rank[:10],
        'weekly_rankings': weekly_rank[:10],
        'weekly_start': weekly_start,
        'rewards': rewards,
        'recommendations': recommendations,
    }
    return render(request, 'users/dashboard.html', context)


@login_required
def profile_settings_view(request):
    profile, _created = UserProfile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        form = UserSettingsForm(request.POST, instance=request.user)
        profile_form = UserProfileForm(request.POST, instance=profile)
        if form.is_valid() and profile_form.is_valid():
            try:
                with transaction.atomic():
                    form.save()
                    profile_form.save()
            except IntegrityError:
                form.add_error('email', 'An account with this email already exists.')
            else:
                messages.success(request, 'Profile updated successfully.')
                return redirect('profile-settings')
        messages.error(request, 'Please fix the highlighted profile errors.')
    else:
        form = UserSettingsForm(instance=request.user)
        profile_form = UserProfileForm(instance=profile)

    return render(
        request,
        'users/profile.html',
        {
            'form': form,
            'profile_form': profile_form,
            'profile': profile,
        },
    )


class UsersApiView(generics.ListAPIView):
    queryset = User.objects.select_related('profile').all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]


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
