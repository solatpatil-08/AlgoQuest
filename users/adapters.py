import logging

from django.contrib import messages
from django.shortcuts import redirect

from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.providers.base.constants import AuthError

logger = logging.getLogger(__name__)


class AlgoQuestSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Provide clearer UX and logs when social auth callback fails."""

    _PROVIDER_LABELS = {
        'google': 'Google',
        'github': 'GitHub',
    }

    def on_authentication_error(
        self,
        request,
        provider,
        error=None,
        exception=None,
        extra_context=None,
    ):
        super().on_authentication_error(
            request=request,
            provider=provider,
            error=error,
            exception=exception,
            extra_context=extra_context,
        )

        provider_id = getattr(provider, 'id', '') or ''
        provider_label = self._PROVIDER_LABELS.get(provider_id, provider_id.title() or 'Provider')
        details = str(exception or '').strip()
        lowered_details = details.lower()

        if error == AuthError.CANCELLED:
            messages.warning(request, f'{provider_label} sign-in was cancelled.')
            raise ImmediateHttpResponse(redirect('login'))

        if 'invalid_grant' in lowered_details:
            messages.error(
                request,
                (
                    f'{provider_label} sign-in failed. '
                    'Retry once and ensure you use the same host URL (localhost vs 127.0.0.1) for the full flow.'
                ),
            )
        elif 'state' in lowered_details:
            messages.error(
                request,
                (
                    f'{provider_label} sign-in session expired. '
                    'Please start the sign-in flow again from the login page.'
                ),
            )
        else:
            messages.error(
                request,
                f'{provider_label} sign-in failed. Please try again.',
            )

        logger.warning(
            'Social auth error provider=%s error=%s exception=%s extra_context=%s',
            provider_id,
            error,
            details or '<none>',
            extra_context or {},
        )
        raise ImmediateHttpResponse(redirect('login'))
