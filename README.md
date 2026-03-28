# AlgoQuest

AlgoQuest is a full-stack Django platform for algorithm learning, competitive real-time battles, gamification, and user performance analytics.

## Stack
- Backend: Django 5
- APIs: Django REST framework
- Real-time: Django Channels (WebSockets)
- Database: SQLite for local development, PostgreSQL recommended for production
- Frontend: Django Templates + Bootstrap 5 + vanilla JavaScript

## Apps
- `users`: auth flows, profile, dashboard, user API
- `challenges`: challenge catalog, challenge attempts, algorithm views/API
- `battle`: matchmaking + live battle pages + WebSocket consumer/API
- `leaderboard`: global/weekly ranking, rewards, leaderboard API
- `analytics`: performance tracking and challenge recommendations

## Project Structure
```text
AlgoQuest/
  AlgoQuest/
    settings.py
    urls.py
    asgi.py
  users/
  challenges/
  battle/
  leaderboard/
  analytics/
  templates/
  static/
  manage.py
  requirements.txt
```

## Setup
1. Create and activate a virtual environment.
2. Install dependencies:
```bash
pip install -r requirements.txt
```
3. Run migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```
4. Create a superuser:
```bash
python manage.py createsuperuser
```
5. Seed sample data (users, BFS/DFS/A* challenges, leaderboard):
```bash
python manage.py seed_data
```

## Database Configuration

Local development can continue using SQLite by leaving `DJANGO_USE_POSTGRES=False`.

For PostgreSQL, use either:

```env
DJANGO_USE_POSTGRES=True
POSTGRES_DB=algoquest_db
POSTGRES_USER=algoquest_user
POSTGRES_PASSWORD=replace-with-db-password
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_SSLMODE=require
```

or a single connection string:

```env
DATABASE_URL=postgresql://algoquest_user:replace-with-db-password@127.0.0.1:5432/algoquest_db
```

On Koyeb, PostgreSQL is the recommended production database. If you use a Koyeb Database Service, set `DATABASE_URL` from the database connection string and set `DJANGO_ALLOWED_HOSTS={{ KOYEB_PUBLIC_DOMAIN }}` in your service environment variables.

## Koyeb Deployment

This repository includes a root [Procfile](c:/Users/Hp/DjangoProjects/AlgoQuest/Procfile) so Koyeb buildpack deployments can start the app with Daphne/ASGI:

```text
web: daphne -b 0.0.0.0 -p ${PORT:-8000} AlgoQuest.asgi:application
```

Recommended Koyeb setup:

1. Use `buildpack` deployment from GitHub.
2. Set the build command to:
```bash
python manage.py collectstatic --noinput
```
3. Leave the run command blank so Koyeb uses the `Procfile`, or set it to the same Daphne command explicitly.
4. Add these environment variables:
```env
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=replace-with-a-new-secret
DJANGO_ALLOWED_HOSTS={{ KOYEB_PUBLIC_DOMAIN }}
DJANGO_CSRF_TRUSTED_ORIGINS=https://{{ KOYEB_PUBLIC_DOMAIN }}
DATABASE_URL=postgresql://...
POSTGRES_SSLMODE=require
```
5. After the first deploy, run migrations:
```bash
python manage.py migrate
```

Notes:
- Static files are served by WhiteNoise in production.
- User-uploaded media should be moved to object storage before production use.
- The default SQLite database is only for local development.

## Run Servers

### HTTP development server
```bash
python manage.py runserver
```

### WebSocket-capable ASGI server
Use either command:
```bash
python manage.py runserver
```
or
```bash
daphne -p 8000 AlgoQuest.asgi:application
```

## Default Seed Users
- `alice` / `AlgoQuest123!`
- `bob` / `AlgoQuest123!`
- `charlie` / `AlgoQuest123!`

## Main Pages
- `/` Home
- `/users/dashboard/` Dashboard
- `/challenges/` Challenges list
- `/battle/` Battle lobby
- `/leaderboard/` Leaderboard
- `/users/profile/` Profile & settings

## API Endpoints
- `/api/challenges/`
- `/api/leaderboard/`
- `/api/battle/`
- `/api/users/`
- `/api/analytics/`

## Battle WebSocket Endpoint
- `ws://<host>/ws/battle/<room_code>/`

## Notes
- If `channels` is not installed in your environment, HTTP features still run, but WebSocket battle mode requires installing `channels` (and optionally `daphne`).
