from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from challenges.models import Challenge, ChallengeAttempt

from .models import UserPerformance
from .services import recommend_next_challenges


class AnalyticsRecommendationTests(TestCase):
    def test_recommend_next_challenges_prioritizes_weak_algorithm(self):
        user = User.objects.create_user(username='analyst', password='StrongPass123!')

        bfs_done = Challenge.objects.create(
            title='BFS Intro',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='a',
        )
        dfs_done = Challenge.objects.create(
            title='DFS Intro',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.DFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='b',
        )
        bfs_new = Challenge.objects.create(
            title='BFS Advanced',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='c',
        )

        ChallengeAttempt.objects.create(user=user, challenge=bfs_done, score=10, is_correct=False)
        ChallengeAttempt.objects.create(user=user, challenge=dfs_done, score=90, is_correct=True)

        recommendations = list(recommend_next_challenges(user, limit=3))

        self.assertIn(bfs_new, recommendations)
        self.assertEqual(recommendations[0].algorithm_type, Challenge.AlgorithmType.BFS)


class AnalyticsViewsAndApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='api-analyst', password='StrongPass123!')
        self.challenge = Challenge.objects.create(
            title='Graph Drill',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='ok',
        )
        UserPerformance.objects.create(
            user=self.user,
            challenge=self.challenge,
            score=77,
            accuracy=0.8,
            time_spent_seconds=123,
        )

    def test_analytics_overview_requires_login(self):
        response = self.client.get(reverse('analytics-overview'))
        self.assertEqual(response.status_code, 302)

    def test_recommendations_endpoint_requires_login_and_returns_payload_for_auth_user(self):
        anonymous_response = self.client.get(reverse('analytics-recommendations'))
        self.assertEqual(anonymous_response.status_code, 302)

        self.client.force_login(self.user)
        response = self.client.get(reverse('analytics-recommendations'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('recommendations', response.json())

    def test_analytics_api_requires_authentication_and_returns_user_records(self):
        anonymous_response = self.client.get('/api/analytics/')
        self.assertEqual(anonymous_response.status_code, 403)

        self.client.force_login(self.user)
        response = self.client.get('/api/analytics/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]['score'], 77)
