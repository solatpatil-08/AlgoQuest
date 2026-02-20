from django.core import signing

SCORE_TOKEN_SALT = 'battle.score.token'
SCORE_TOKEN_MAX_AGE_SECONDS = 10 * 60


def build_score_token(*, room_code: str, attempt_id: int, user_id: int) -> str:
    payload = {
        'room_code': room_code,
        'attempt_id': int(attempt_id),
        'user_id': int(user_id),
    }
    return signing.dumps(payload, salt=SCORE_TOKEN_SALT)


def parse_score_token(token: str):
    try:
        payload = signing.loads(
            token,
            salt=SCORE_TOKEN_SALT,
            max_age=SCORE_TOKEN_MAX_AGE_SECONDS,
        )
    except signing.BadSignature:
        return None

    required_keys = {'room_code', 'attempt_id', 'user_id'}
    if not isinstance(payload, dict) or not required_keys.issubset(payload):
        return None
    return payload
