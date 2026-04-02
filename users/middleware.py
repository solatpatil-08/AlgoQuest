from django.contrib import messages
from django.shortcuts import redirect


class SocialLoginConfigurationGuardMiddleware:
    """Gracefully handle direct social-login hits when provider secrets are missing."""

    _PROVIDER_LABELS = {
        'google': 'Google',
        'github': 'GitHub',
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except Exception as exc:
            provider = self._provider_from_path(request.path)
            if not provider or not self._looks_like_missing_social_app(exc):
                raise

            provider_label = self._PROVIDER_LABELS.get(provider, provider.title())
            messages.error(
                request,
                f'{provider_label} sign-in is not configured for this deployment yet.',
            )
            return redirect('login')

    @staticmethod
    def _provider_from_path(path):
        cleaned = (path or '').strip('/').lower()
        if not cleaned.startswith('accounts/'):
            return ''
        if cleaned.startswith('accounts/google/'):
            return 'google'
        if cleaned.startswith('accounts/github/'):
            return 'github'
        return ''

    @staticmethod
    def _looks_like_missing_social_app(exc):
        name = exc.__class__.__name__
        if name == 'DoesNotExist':
            return True
        message = str(exc).lower()
        return 'socialapp matching query does not exist' in message
