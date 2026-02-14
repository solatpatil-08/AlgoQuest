from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from leaderboard.models import Leaderboard

from .models import Challenge, ChallengeAttempt


class ChallengeAttemptFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='solver', password='StrongPass123!')
        self.challenge = Challenge.objects.create(
            title='BFS Basics',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='queue',
            xp_reward=50,
            max_score=100,
        )

    def test_submit_correct_answer_updates_xp_and_leaderboard(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'QUEUE'},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['score'], 100)
        self.assertEqual(payload['xp_gained'], 50)

        attempt = ChallengeAttempt.objects.get(user=self.user, challenge=self.challenge)
        self.assertTrue(attempt.is_correct)
        self.assertEqual(attempt.score, 100)

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.xp, 50)
        self.assertEqual(
            Leaderboard.objects.get(user=self.user, scope=Leaderboard.Scope.GLOBAL).score,
            50,
        )
        self.assertEqual(
            Leaderboard.objects.get(user=self.user, scope=Leaderboard.Scope.WEEKLY).score,
            50,
        )

    def test_submit_incorrect_algorithm_answer_gives_partial_score_and_xp(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'abc'},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertEqual(payload['score'], 20)
        self.assertEqual(payload['xp_gained'], 10)


class ChallengesApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='api-solver', password='StrongPass123!')
        self.challenge = Challenge.objects.create(
            title='DFS Basics',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.DFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='stack',
        )
        ChallengeAttempt.objects.create(user=self.user, challenge=self.challenge, score=33, submitted_answer='x')

    def test_challenge_list_api_allows_anonymous(self):
        response = self.client.get('/api/challenges/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_challenge_attempts_api_requires_authentication(self):
        anonymous_response = self.client.get('/api/challenges/attempts/')
        self.assertEqual(anonymous_response.status_code, 403)

        self.client.force_login(self.user)
        authed_response = self.client.get('/api/challenges/attempts/')
        self.assertEqual(authed_response.status_code, 200)
        self.assertEqual(len(authed_response.json()), 1)
