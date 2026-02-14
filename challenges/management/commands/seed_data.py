from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from analytics.models import UserPerformance
from battle.models import BattleMatch
from challenges.models import Challenge, ChallengeAttempt
from leaderboard.models import Leaderboard, Reward


class Command(BaseCommand):
    help = 'Seeds sample users, algorithm challenges, and leaderboard data.'

    def handle(self, *args, **options):
        users_data = [
            ('alice', 'alice@example.com', 520),
            ('bob', 'bob@example.com', 430),
            ('charlie', 'charlie@example.com', 310),
        ]

        seeded_users = []
        for username, email, xp in users_data:
            user, created = User.objects.get_or_create(username=username, defaults={'email': email})
            if created:
                user.set_password('AlgoQuest123!')
                user.save()
                self.stdout.write(self.style.SUCCESS(f'Created user {username}'))
            user.profile.xp = xp
            user.profile.level = max(1, xp // 250 + 1)
            user.profile.badges = [f'Level {user.profile.level} Starter']
            user.profile.save(update_fields=['xp', 'level', 'badges', 'updated_at'])
            seeded_users.append(user)

        challenge_data = [
            {
                'title': 'Graph Traversal with BFS',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.BFS,
                'difficulty': Challenge.Difficulty.EASY,
                'description': 'Learn breadth-first traversal in unweighted graphs.',
                'prompt': 'Given graph A-B, A-C, B-D, C-E, provide BFS order from A.',
                'expected_answer': 'A B C D E',
                'visualization_payload': {'nodes': ['A', 'B', 'C', 'D', 'E']},
                'xp_reward': 60,
            },
            {
                'title': 'Depth-First Search Explorer',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.DFS,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Practice recursive and iterative DFS traversal.',
                'prompt': 'Provide a valid DFS order for graph A-B, A-C, B-D, C-E from A.',
                'expected_answer': 'A B D C E',
                'visualization_payload': {'nodes': ['A', 'B', 'C', 'D', 'E']},
                'xp_reward': 80,
            },
            {
                'title': 'A* Pathfinding Basics',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.ASTAR,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Use heuristic search to find shortest paths efficiently.',
                'prompt': 'Describe one reason A* can outperform Dijkstra on large maps.',
                'expected_answer': 'heuristic guidance',
                'visualization_payload': {'grid': '5x5', 'heuristic': 'manhattan'},
                'xp_reward': 90,
            },
        ]

        seeded_challenges = []
        for payload in challenge_data:
            challenge, _ = Challenge.objects.get_or_create(title=payload['title'], defaults=payload)
            seeded_challenges.append(challenge)

        for idx, user in enumerate(seeded_users):
            for challenge in seeded_challenges:
                attempt, _ = ChallengeAttempt.objects.get_or_create(
                    user=user,
                    challenge=challenge,
                    defaults={
                        'score': 70 + (idx * 10),
                        'is_correct': idx == 0,
                        'submitted_answer': challenge.expected_answer,
                    },
                )
                UserPerformance.objects.get_or_create(
                    user=user,
                    challenge=challenge,
                    defaults={
                        'score': attempt.score,
                        'accuracy': min(1.0, attempt.score / challenge.max_score),
                        'time_spent_seconds': 120 + idx * 30,
                        'attempts': 1,
                        'recommended_next': 'Try minimax strategy challenge',
                    },
                )

        for user in seeded_users:
            Leaderboard.objects.update_or_create(
                user=user,
                scope=Leaderboard.Scope.GLOBAL,
                defaults={'score': user.profile.xp},
            )
            Leaderboard.objects.update_or_create(
                user=user,
                scope=Leaderboard.Scope.WEEKLY,
                defaults={'score': user.profile.xp // 2},
            )

            Reward.objects.get_or_create(
                user=user,
                name='Early Adopter',
                defaults={
                    'description': 'Joined AlgoQuest seed cohort',
                    'points_awarded': 50,
                    'badge_icon': '🚀',
                },
            )

        BattleMatch.objects.get_or_create(
            player_one=seeded_users[0],
            player_two=seeded_users[1],
            status=BattleMatch.Status.LIVE,
            defaults={'player_one_score': 20, 'player_two_score': 18},
        )

        self.stdout.write(self.style.SUCCESS('Seed data generated successfully.'))
