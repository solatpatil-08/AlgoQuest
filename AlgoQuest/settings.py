import importlib.util
import os
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlparse
from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/
def _load_env_file(path: Path):
    if not path.exists():
        return

    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        if not key:
            continue

        value = value.strip()
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]

        # Allow .env values to replace only blank pre-set variables.
        current = os.environ.get(key)
        if current is None or not current.strip():
            os.environ[key] = value


_load_env_file(BASE_DIR / '.env')

def _env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


def _env_text(name, default=''):
    value = os.getenv(name, default).strip()
    upper_value = value.upper()
    if upper_value.startswith('ROTATE_') or value.startswith('replace-with-') or value.startswith('your-'):
        return ''
    return value


def _postgres_db_config(name, user, password, host, port, options=None):
    config = {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': name,
        'USER': user,
        'PASSWORD': password,
        'HOST': host,
        'PORT': port,
    }
    if options:
        config['OPTIONS'] = options
    return {'default': config}


def _database_from_url(database_url):
    parsed = urlparse(database_url)
    if parsed.scheme not in {'postgres', 'postgresql'}:
        raise ImproperlyConfigured('DATABASE_URL must start with postgres:// or postgresql://')

    db_name = unquote(parsed.path.lstrip('/'))
    if not db_name:
        raise ImproperlyConfigured('DATABASE_URL must include a database name')

    options = {key: value for key, value in parse_qsl(parsed.query, keep_blank_values=False)}
    sslmode = os.getenv('POSTGRES_SSLMODE', '').strip()
    if sslmode and 'sslmode' not in options:
        options['sslmode'] = sslmode

    return _postgres_db_config(
        name=db_name,
        user=unquote(parsed.username or ''),
        password=unquote(parsed.password or ''),
        host=parsed.hostname or '',
        port=str(parsed.port or 5432),
        options=options or None,
    )

DEBUG = _env_bool('DJANGO_DEBUG', True)

# SECURITY WARNING: keep the secret key used in production secret.
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = get_random_secret_key()
    else:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is False')

raw_allowed_hosts = os.getenv('DJANGO_ALLOWED_HOSTS', '')
if raw_allowed_hosts:
    ALLOWED_HOSTS = [host.strip() for host in raw_allowed_hosts.split(',') if host.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0', 'testserver']
else:
    ALLOWED_HOSTS = []

CHANNELS_AVAILABLE = importlib.util.find_spec("channels") is not None

# Application definition

INSTALLED_APPS = [
    'whitenoise.runserver_nostatic',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.github',
    'rest_framework',
    'users',
    'challenges',
    'battle',
    'leaderboard',
    'analytics',
]

if CHANNELS_AVAILABLE:
    INSTALLED_APPS.append('channels')

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'allauth.account.middleware.AccountMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'AlgoQuest.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

ASGI_APPLICATION = 'AlgoQuest.asgi.application'
WSGI_APPLICATION = 'AlgoQuest.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases
DATABASE_URL = _env_text('DATABASE_URL')
USE_POSTGRES = _env_bool('DJANGO_USE_POSTGRES', bool(DATABASE_URL))

if DATABASE_URL:
    DATABASES = _database_from_url(DATABASE_URL)
elif USE_POSTGRES:
    postgres_config = {
        'POSTGRES_DB': _env_text('POSTGRES_DB'),
        'POSTGRES_USER': _env_text('POSTGRES_USER'),
        'POSTGRES_PASSWORD': _env_text('POSTGRES_PASSWORD'),
        'POSTGRES_HOST': _env_text('POSTGRES_HOST', '127.0.0.1'),
        'POSTGRES_PORT': _env_text('POSTGRES_PORT', '5432'),
    }
    missing_postgres_settings = [
        name for name, value in postgres_config.items()
        if name != 'POSTGRES_PORT' and not value
    ]
    if missing_postgres_settings:
        raise ImproperlyConfigured(
            'Missing PostgreSQL settings: ' + ', '.join(missing_postgres_settings)
        )

    postgres_options = {}
    postgres_sslmode = _env_text('POSTGRES_SSLMODE')
    if postgres_sslmode:
        postgres_options['sslmode'] = postgres_sslmode

    DATABASES = _postgres_db_config(
        name=postgres_config['POSTGRES_DB'],
        user=postgres_config['POSTGRES_USER'],
        password=postgres_config['POSTGRES_PASSWORD'],
        host=postgres_config['POSTGRES_HOST'],
        port=postgres_config['POSTGRES_PORT'],
        options=postgres_options or None,
    )
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = Path(os.getenv('DJANGO_STATIC_ROOT', str(BASE_DIR / 'staticfiles')))
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.getenv('DJANGO_MEDIA_ROOT', str(BASE_DIR / 'media')))

raw_csrf_trusted_origins = os.getenv('DJANGO_CSRF_TRUSTED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in raw_csrf_trusted_origins.split(',') if origin.strip()
]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = _env_bool('DJANGO_SECURE_SSL_REDIRECT', True)
    SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool('DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS', True)
    SECURE_HSTS_PRELOAD = _env_bool('DJANGO_SECURE_HSTS_PRELOAD', True)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True

LOGIN_REDIRECT_URL = 'dashboard'
LOGOUT_REDIRECT_URL = 'home'
EMAIL_BACKEND = os.getenv('DJANGO_EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('DJANGO_EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('DJANGO_EMAIL_PORT', '587'))
EMAIL_USE_TLS = _env_bool('DJANGO_EMAIL_USE_TLS', True)
EMAIL_USE_SSL = _env_bool('DJANGO_EMAIL_USE_SSL', False)
EMAIL_HOST_USER = os.getenv('DJANGO_EMAIL_HOST_USER', '').strip()
EMAIL_HOST_PASSWORD = os.getenv('DJANGO_EMAIL_HOST_PASSWORD', '').strip()
EMAIL_TIMEOUT = int(os.getenv('DJANGO_EMAIL_TIMEOUT', '30'))
DEFAULT_FROM_NAME = os.getenv('DJANGO_DEFAULT_FROM_NAME', 'AlgoQuest').strip() or 'AlgoQuest'
DEFAULT_FROM_EMAIL = os.getenv('DJANGO_DEFAULT_FROM_EMAIL', 'noreply@algoquest.local')
SITE_ID = int(os.getenv('DJANGO_SITE_ID', '1'))

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

GOOGLE_OAUTH_CLIENT_ID = _env_text('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_OAUTH_CLIENT_SECRET = _env_text('GOOGLE_OAUTH_CLIENT_SECRET')
GITHUB_OAUTH_CLIENT_ID = _env_text('GITHUB_OAUTH_CLIENT_ID')
GITHUB_OAUTH_CLIENT_SECRET = _env_text('GITHUB_OAUTH_CLIENT_SECRET')

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
        'APPS': [],
    },
    'github': {
        'SCOPE': ['read:user', 'user:email'],
        'APPS': [],
    },
}

if GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET:
    SOCIALACCOUNT_PROVIDERS['google']['APPS'] = [
        {
            'client_id': GOOGLE_OAUTH_CLIENT_ID,
            'secret': GOOGLE_OAUTH_CLIENT_SECRET,
            'key': '',
        }
    ]

if GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET:
    SOCIALACCOUNT_PROVIDERS['github']['APPS'] = [
        {
            'client_id': GITHUB_OAUTH_CLIENT_ID,
            'secret': GITHUB_OAUTH_CLIENT_SECRET,
            'key': '',
        }
    ]

if CHANNELS_AVAILABLE:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
}

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
