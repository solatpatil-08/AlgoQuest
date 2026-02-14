# AlgoQuest

AlgoQuest is a full-stack Django platform for algorithm learning, competitive real-time battles, gamification, and user performance analytics.

## Stack
- Backend: Django 5
- APIs: Django REST framework
- Real-time: Django Channels (WebSockets)
- Database: SQLite
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
