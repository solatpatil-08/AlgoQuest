import secrets
import time
from email.utils import formataddr

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.views import (
    LoginView,
    PasswordResetCompleteView,
)
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.sites.shortcuts import get_current_site
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.shortcuts import redirect, render
from django.template.loader import render_to_string
from django.urls import reverse_lazy
from django.utils.html import strip_tags
from django.views.generic import FormView
from rest_framework import generics, permissions

from analytics.services import recommend_next_challenges
from battle.models import BattleMatch
from challenges.models import Challenge, ChallengeAttempt
from leaderboard.models import Leaderboard, Reward

from .forms import (
    CustomAuthenticationForm,
    CustomPasswordResetForm,
    CustomSetPasswordForm,
    PasswordResetOtpForm,
    SignUpForm,
    UserProfileForm,
    UserSettingsForm,
)
from .models import UserProfile
from .serializers import UserSerializer

XP_PER_LEVEL = 250
PASSWORD_RESET_OTP_EXPIRY_SECONDS = 10 * 60
PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5
PASSWORD_RESET_OTP_SESSION_KEY = 'password_reset_otp_data'
PASSWORD_RESET_VERIFIED_USER_SESSION_KEY = 'password_reset_verified_user_id'
PASSWORD_RESET_RATE_LIMIT_SESSION_KEY = 'password_reset_rate_limit'
PASSWORD_RESET_OTP_COOLDOWN_SECONDS = 60
PASSWORD_RESET_OTP_WINDOW_SECONDS = 60 * 60
PASSWORD_RESET_OTP_MAX_REQUESTS_PER_WINDOW = 5


def _mask_email(email):
    if '@' not in email:
        return email
    username, domain = email.split('@', 1)
    if len(username) <= 2:
        masked_username = username[0] + '*'
    else:
        masked_username = username[0] + ('*' * (len(username) - 2)) + username[-1]
    return f'{masked_username}@{domain}'


def _clear_password_reset_session(request):
    request.session.pop(PASSWORD_RESET_OTP_SESSION_KEY, None)
    request.session.pop(PASSWORD_RESET_VERIFIED_USER_SESSION_KEY, None)


def _consume_password_reset_rate_limit(request, email):
    now = int(time.time())
    state = request.session.get(PASSWORD_RESET_RATE_LIMIT_SESSION_KEY, {})
    if not isinstance(state, dict):
        state = {}

    key = (email or '').strip().lower()
    entry = state.get(key, {})
    raw_timestamps = entry.get('timestamps', [])

    timestamps = []
    for value in raw_timestamps:
        try:
            timestamp = int(value)
        except (TypeError, ValueError):
            continue
        if now - timestamp < PASSWORD_RESET_OTP_WINDOW_SECONDS:
            timestamps.append(timestamp)

    if timestamps:
        since_last = now - timestamps[-1]
        if since_last < PASSWORD_RESET_OTP_COOLDOWN_SECONDS:
            retry_after = PASSWORD_RESET_OTP_COOLDOWN_SECONDS - since_last
            state[key] = {'timestamps': timestamps}
            request.session[PASSWORD_RESET_RATE_LIMIT_SESSION_KEY] = state
            return False, ('cooldown', max(1, retry_after))

    if len(timestamps) >= PASSWORD_RESET_OTP_MAX_REQUESTS_PER_WINDOW:
        retry_after = PASSWORD_RESET_OTP_WINDOW_SECONDS - (now - timestamps[0])
        state[key] = {'timestamps': timestamps}
        request.session[PASSWORD_RESET_RATE_LIMIT_SESSION_KEY] = state
        return False, ('window', max(1, retry_after))

    timestamps.append(now)
    state[key] = {'timestamps': timestamps}
    request.session[PASSWORD_RESET_RATE_LIMIT_SESSION_KEY] = state
    return True, None


def _get_branded_from_email():
    default_from_email = settings.DEFAULT_FROM_EMAIL
    if '<' in default_from_email and '>' in default_from_email:
        return default_from_email

    from_name = getattr(settings, 'DEFAULT_FROM_NAME', 'AlgoQuest') or 'AlgoQuest'
    return formataddr((from_name, default_from_email))


def _send_password_reset_otp_email(user, otp):
    context = {
        'user': user,
        'otp': otp,
        'otp_expiry_minutes': PASSWORD_RESET_OTP_EXPIRY_SECONDS // 60,
        'product_name': 'AlgoQuest',
    }

    subject = render_to_string('emails/password_reset_otp_subject.txt', context).strip()
    text_body = render_to_string('emails/password_reset_otp_body.txt', context)
    html_body = render_to_string('emails/password_reset_otp_body.html', context)

    message = EmailMultiAlternatives(
        subject=subject,
        body=strip_tags(text_body),
        from_email=_get_branded_from_email(),
        to=[user.email],
    )
    message.attach_alternative(html_body, 'text/html')
    message.send(fail_silently=False)


def _is_social_provider_configured(request, provider, env_client_id_key, env_secret_key):
    env_client_id = getattr(settings, env_client_id_key, '').strip()
    env_secret = getattr(settings, env_secret_key, '').strip()
    if env_client_id and env_secret:
        return True

    try:
        from allauth.socialaccount.models import SocialApp
    except Exception:
        return False

    try:
        current_site = get_current_site(request)
        return SocialApp.objects.filter(provider=provider, sites=current_site).exists()
    except Exception:
        return False


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
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                messages.success(request, 'Your account has been created successfully.')
                return redirect('dashboard')
        messages.error(request, 'Please fix the highlighted signup errors.')
    else:
        form = SignUpForm()
    return render(request, 'users/signup.html', {'form': form})


@login_required
def dashboard_view(request):
    profile, _created = UserProfile.objects.get_or_create(user=request.user)

    # Keep dashboard progress aligned with XP even if stored level is stale.
    effective_level = max(1, (profile.xp // XP_PER_LEVEL) + 1)
    if profile.level != effective_level:
        profile.level = effective_level
        profile.save(update_fields=['level', 'updated_at'])

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

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        google_oauth_configured = _is_social_provider_configured(
            self.request, 'google', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'
        )
        github_oauth_configured = _is_social_provider_configured(
            self.request, 'github', 'GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET'
        )
        context['google_oauth_configured'] = google_oauth_configured
        context['github_oauth_configured'] = github_oauth_configured
        return context

    def form_valid(self, form):
        messages.success(self.request, f'Welcome back, {form.get_user().username}.')
        return super().form_valid(form)

    def form_invalid(self, form):
        messages.error(self.request, 'Invalid username/email or password.')
        return super().form_invalid(form)


class CustomPasswordResetView(FormView):
    template_name = 'registration/password_reset_form.html'
    success_url = reverse_lazy('password_reset_done')
    form_class = CustomPasswordResetForm

    def form_valid(self, form):
        email = form.cleaned_data.get('email', '').strip().lower()
        allowed, limit_payload = _consume_password_reset_rate_limit(self.request, email)
        if not allowed:
            limit_kind, retry_after = limit_payload
            if limit_kind == 'cooldown':
                form.add_error(None, f'Please wait {retry_after} second(s) before requesting another OTP.')
            else:
                retry_after_minutes = max(1, (retry_after + 59) // 60)
                form.add_error(None, f'Too many OTP requests. Try again in {retry_after_minutes} minute(s).')
            return self.form_invalid(form)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        _clear_password_reset_session(self.request)

        if user:
            otp = f'{secrets.randbelow(900000) + 100000:06d}'
            try:
                _send_password_reset_otp_email(user, otp)
            except Exception:
                form.add_error(None, 'Unable to send OTP right now. Please try again.')
                return self.form_invalid(form)

            self.request.session[PASSWORD_RESET_OTP_SESSION_KEY] = {
                'user_id': user.id,
                'email': user.email,
                'otp': otp,
                'issued_at': int(time.time()),
                'attempts': 0,
            }

        return super().form_valid(form)


class CustomPasswordResetDoneView(FormView):
    template_name = 'registration/password_reset_done.html'
    form_class = PasswordResetOtpForm
    success_url = reverse_lazy('password_reset_confirm')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        otp_data = self.request.session.get(PASSWORD_RESET_OTP_SESSION_KEY, {})
        email = otp_data.get('email', '')
        context['masked_email'] = _mask_email(email) if email else ''
        context['password_reset_uses_console_email'] = settings.EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend'
        context['otp_expiry_minutes'] = PASSWORD_RESET_OTP_EXPIRY_SECONDS // 60
        return context

    def form_valid(self, form):
        otp_data = self.request.session.get(PASSWORD_RESET_OTP_SESSION_KEY)
        if not otp_data:
            form.add_error(None, 'No OTP request found. Please request a new OTP.')
            return self.form_invalid(form)

        if int(time.time()) - int(otp_data.get('issued_at', 0)) > PASSWORD_RESET_OTP_EXPIRY_SECONDS:
            _clear_password_reset_session(self.request)
            form.add_error(None, 'OTP expired. Please request a new OTP.')
            return self.form_invalid(form)

        attempts = int(otp_data.get('attempts', 0))
        if attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS:
            _clear_password_reset_session(self.request)
            form.add_error(None, 'Too many invalid attempts. Request a new OTP.')
            return self.form_invalid(form)

        entered_otp = form.cleaned_data['otp']
        if entered_otp != otp_data.get('otp'):
            attempts += 1
            otp_data['attempts'] = attempts
            self.request.session[PASSWORD_RESET_OTP_SESSION_KEY] = otp_data
            if attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS:
                _clear_password_reset_session(self.request)
                form.add_error('otp', 'Invalid OTP. Request a new OTP.')
            else:
                remaining = PASSWORD_RESET_OTP_MAX_ATTEMPTS - attempts
                form.add_error('otp', f'Invalid OTP. {remaining} attempt(s) left.')
            return self.form_invalid(form)

        self.request.session[PASSWORD_RESET_VERIFIED_USER_SESSION_KEY] = otp_data['user_id']
        return super().form_valid(form)


class CustomPasswordResetConfirmView(FormView):
    template_name = 'registration/password_reset_confirm.html'
    form_class = CustomSetPasswordForm
    success_url = reverse_lazy('password_reset_complete')

    def dispatch(self, request, *args, **kwargs):
        self.verified_user = self.get_verified_user()
        if self.verified_user is None:
            return redirect('password_reset')
        return super().dispatch(request, *args, **kwargs)

    def get_verified_user(self):
        user_id = self.request.session.get(PASSWORD_RESET_VERIFIED_USER_SESSION_KEY)
        if not user_id:
            return None
        return User.objects.filter(pk=user_id, is_active=True).first()

    def get_form(self, form_class=None):
        if form_class is None:
            form_class = self.get_form_class()
        return form_class(self.verified_user, **self.get_form_kwargs())

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['validlink'] = True
        return context

    def form_valid(self, form):
        form.save()
        _clear_password_reset_session(self.request)
        return super().form_valid(form)


class CustomPasswordResetCompleteView(PasswordResetCompleteView):
    template_name = 'registration/password_reset_complete.html'

# Create your views here.
