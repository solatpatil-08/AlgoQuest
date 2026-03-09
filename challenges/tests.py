from django.contrib.auth.models import User
from django.core.management import call_command
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from pathlib import Path
import json
import re
from io import StringIO
from html import escape
import time

from leaderboard.models import Leaderboard

from .models import Challenge, ChallengeAttempt, Topic, UserChallengeProg
from .validators import ChallengeBankValidator, ChallengeBankValidationError
from .views import (
    ALGORITHM_TYPE_FILTER_MAP,
    CATEGORY_TO_ALGORITHM_TYPES,
    _category_targets,
    _matches_selected_category,
)


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

    def test_submit_incorrect_algorithm_answer_gives_zero_on_first_attempt(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'abc'},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertEqual(payload['score'], 0)
        self.assertEqual(payload['xp_gained'], 0)

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.xp, 0)

    def test_submit_empty_answer_gives_zero_score_and_zero_xp(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': '   '},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertEqual(payload['score'], 0)
        self.assertEqual(payload['xp_gained'], 0)

        self.user.refresh_from_db()
        self.assertEqual(self.user.profile.xp, 0)

    def test_submit_long_incorrect_answer_cannot_reach_max_score(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'x' * 500},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertLess(payload['score'], self.challenge.max_score)
        self.assertEqual(payload['xp_gained'], 0)

    def test_attempt_index_must_be_unique_for_same_user_and_challenge(self):
        ChallengeAttempt.objects.create(
            user=self.user,
            challenge=self.challenge,
            attempt_index=1,
            is_correct=False,
            score=0,
            submitted_answer='x',
        )

        with self.assertRaises(Exception):
            ChallengeAttempt.objects.create(
                user=self.user,
                challenge=self.challenge,
                attempt_index=1,
                is_correct=True,
                score=100,
                submitted_answer='queue',
            )


class KnapsackActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='knapsack-player', password='StrongPass123!')
        self.challenge = Challenge.objects.create(
            title='Knapsack Action Mode',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.KNAPSACK,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            starter_code='Try selecting the best value combination under capacity.',
            expected_answer='13',
            xp_reward=50,
            max_score=100,
            visualization_payload={
                'mode': 'grid',
                'algorithm': 'knapsack',
                'weights': [2, 3, 4],
                'values': [6, 7, 8],
                'capacity': 5,
            },
        )

    def test_knapsack_action_payload_is_ignored_until_hint_is_used(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {
                'answer': '999',
                'action_payload': json.dumps({'selected_indices': [0, 1], 'actions': []}),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertFalse(payload['hint_used'])
        self.assertEqual(payload['score'], 0)
        self.assertEqual(payload['xp_gained'], 0)
        self.assertNotIn('knapsack_total_weight', payload)

        attempt = ChallengeAttempt.objects.get(user=self.user, challenge=self.challenge)
        self.assertEqual(attempt.submitted_answer, '999')

    def test_knapsack_over_capacity_submission_stays_incorrect(self):
        self.client.force_login(self.user)
        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 200)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {
                'answer': '13',
                'action_payload': json.dumps({'selected_indices': [1, 2], 'actions': []}),
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertTrue(payload['knapsack_over_capacity'])
        self.assertEqual(payload['score'], 0)
        self.assertEqual(payload['xp_gained'], 0)
        self.assertIn('overweight', payload['message'].lower())

    def test_knapsack_action_with_hint_applies_first_attempt_penalty(self):
        self.client.force_login(self.user)

        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 200)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {
                'answer': '999',
                'action_payload': json.dumps({'selected_indices': [0, 1], 'actions': []}),
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['hint_used'])
        self.assertEqual(payload['score'], 25)
        self.assertEqual(payload['xp_gained'], 12)


class AdvancedDsaActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='advanced-dsa-player', password='StrongPass123!')

    def test_activity_selection_action_payload_derives_count(self):
        challenge = Challenge.objects.create(
            title='Activity Selection Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ACTIVITY_SELECTION,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='4',
            xp_reward=40,
            max_score=100,
            visualization_payload={'starts': [1, 3, 0, 5, 8], 'ends': [2, 4, 6, 7, 9]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'selected_indices': [0, 1, 3, 4]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['activity_selected_count'], 4)

    def test_lcs_action_payload_uses_candidate_length(self):
        challenge = Challenge.objects.create(
            title='LCS Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LCS,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='4',
            xp_reward=45,
            max_score=100,
            visualization_payload={'s1': 'ABCBDAB', 's2': 'BDCABA'},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '1', 'action_payload': json.dumps({'candidate_subsequence': 'BCBA'})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['lcs_candidate_valid'])

    def test_backtracking_action_payload_counts_unique_valid_subsets(self):
        challenge = Challenge.objects.create(
            title='Backtracking Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BACKTRACKING,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='2',
            xp_reward=50,
            max_score=100,
            visualization_payload={'values': [2, 3, 5, 6, 8], 'target': 10},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'found_subsets': [[2, 8], [2, 3, 5]]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['backtracking_valid_subset_count'], 2)

    def test_recursion_action_payload_requires_valid_fibonacci_sequence(self):
        challenge = Challenge.objects.create(
            title='Recursion Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.RECURSION,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='21',
            xp_reward=35,
            max_score=100,
            visualization_payload={'n': 8},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'sequence': [0, 1, 1, 2, 3, 5, 8, 13, 21]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['recursion_sequence_valid'])

    def test_bit_conversion_action_payload_uses_binary_candidate(self):
        challenge = Challenge.objects.create(
            title='Bit Conversion Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BIT_CONVERSION,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='11010',
            xp_reward=30,
            max_score=100,
            visualization_payload={'decimal': 26, 'binary': '11010'},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'binary': '011010'})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['bit_binary'], '11010')


class GraphActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='graph-player', password='StrongPass123!')

    def test_bfs_action_payload_uses_selected_order(self):
        challenge = Challenge.objects.create(
            title='BFS Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='0 1 2 3 4 5',
            xp_reward=35,
            max_score=100,
            visualization_payload={
                'nodes': [0, 1, 2, 3, 4, 5],
                'edges': [[0, 1], [0, 2], [1, 3], [2, 4], [4, 5]],
                'start': 0,
            },
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'visitation_order': [0, 1, 2, 3, 4, 5]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['graph_algorithm'], 'bfs')

    def test_dfs_action_payload_uses_selected_order(self):
        challenge = Challenge.objects.create(
            title='DFS Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.DFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='0 1 3 2 4 5',
            xp_reward=35,
            max_score=100,
            visualization_payload={
                'nodes': [0, 1, 2, 3, 4, 5],
                'edges': [[0, 1], [0, 2], [1, 3], [2, 4], [4, 5]],
                'start': 0,
            },
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'visitation_order': [0, 1, 3, 2, 4, 5]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['graph_algorithm'], 'dfs')

    def test_dijkstra_action_payload_derives_distance_from_path(self):
        challenge = Challenge.objects.create(
            title='Dijkstra Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.DIJKSTRA,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='5',
            xp_reward=40,
            max_score=100,
            visualization_payload={
                'weighted_edges': [[0, 1, 2], [1, 3, 3], [0, 2, 6], [2, 3, 2]],
                'source': 0,
                'target': 3,
            },
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'path_nodes': [0, 1, 3]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['graph_selected_distance'], 5)

    def test_dijkstra_action_payload_warns_on_non_shortest_path(self):
        challenge = Challenge.objects.create(
            title='Dijkstra Non Shortest',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.DIJKSTRA,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='5',
            xp_reward=40,
            max_score=100,
            visualization_payload={
                'weighted_edges': [[0, 1, 2], [1, 3, 3], [0, 2, 6], [2, 3, 2]],
                'source': 0,
                'target': 3,
            },
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'path_nodes': [0, 2, 3]})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertIn('not shortest', payload['message'].lower())

    def test_astar_action_payload_uses_path_length(self):
        challenge = Challenge.objects.create(
            title='AStar Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ASTAR,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='4',
            xp_reward=35,
            max_score=100,
            visualization_payload={'rows': 3, 'cols': 3, 'blocked': [[1, 1]]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'path': [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['graph_selected_moves'], 4)

    def test_astar_action_payload_unreachable(self):
        challenge = Challenge.objects.create(
            title='AStar Unreachable',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ASTAR,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='-1',
            xp_reward=35,
            max_score=100,
            visualization_payload={'rows': 3, 'cols': 3, 'blocked': [[0, 1], [1, 0], [1, 1]]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'is_unreachable': True})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['graph_selected_moves'], -1)

    def test_minimax_action_payload_uses_root_value(self):
        challenge = Challenge.objects.create(
            title='Minimax Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.MINIMAX,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='3',
            xp_reward=40,
            max_score=100,
            visualization_payload={'leaves': [3, 5, 2, 9, 12, 5, 23, 23]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'root_value': 3, 'fold_steps': ['MIN', 'MAX', 'MIN']})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['graph_root_expected'], 3)


class SortingActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sorting-player', password='StrongPass123!')

    def test_sorting_action_payload_uses_array_state(self):
        challenge = Challenge.objects.create(
            title='Bubble Sort Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BUBBLE_SORT,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='1 3 5',
            xp_reward=30,
            max_score=100,
            visualization_payload={'data': [5, 1, 3]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'array': [1, 3, 5], 'swaps': [[0, 1], [1, 2]]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['sorting_is_sorted'])
        self.assertEqual(payload['sorting_current_answer'], '1 3 5')

    def test_sorting_action_payload_can_derive_from_swaps_only(self):
        challenge = Challenge.objects.create(
            title='Quick Sort Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.QUICK_SORT,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='1 2 3',
            xp_reward=35,
            max_score=100,
            visualization_payload={'data': [3, 1, 2]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'swaps': [[0, 1], [1, 2]]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['sorting_current_answer'], '1 2 3')

    def test_sorting_action_payload_rejects_value_mismatch(self):
        challenge = Challenge.objects.create(
            title='Selection Sort Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.SELECTION_SORT,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='1 2 3',
            xp_reward=30,
            max_score=100,
            visualization_payload={'data': [3, 1, 2]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'array': [1, 2, 9]})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertIn('same values', payload['message'].lower())

    def test_sorting_action_payload_feedback_when_not_sorted(self):
        challenge = Challenge.objects.create(
            title='Merge Sort Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.MERGE_SORT,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='1 2 4 6',
            xp_reward=40,
            max_score=100,
            visualization_payload={'data': [6, 1, 4, 2]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'array': [1, 6, 2, 4]})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertFalse(payload['sorting_is_sorted'])
        self.assertIn('not fully sorted', payload['message'].lower())


class SearchingActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='search-player', password='StrongPass123!')

    def test_linear_search_action_payload_derives_index(self):
        challenge = Challenge.objects.create(
            title='Linear Search Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LINEAR_SEARCH,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='2',
            xp_reward=25,
            max_score=100,
            visualization_payload={'data': [8, 3, 11, 5], 'target': 11},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '999', 'action_payload': json.dumps({'selected_index': 2, 'inspected_indices': [0, 1, 2]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['search_type'], 'linear')
        self.assertEqual(payload['search_selected_index'], 2)

    def test_linear_search_action_payload_rejects_non_matching_pick(self):
        challenge = Challenge.objects.create(
            title='Linear Search Invalid Pick',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LINEAR_SEARCH,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='1',
            xp_reward=25,
            max_score=100,
            visualization_payload={'data': [5, 2, 9], 'target': 2},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '1', 'action_payload': json.dumps({'selected_index': 0})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertIn('does not match target', payload['message'].lower())

    def test_binary_search_action_payload_derives_index(self):
        challenge = Challenge.objects.create(
            title='Binary Search Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BINARY_SEARCH,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='4',
            xp_reward=30,
            max_score=100,
            visualization_payload={'data': [2, 5, 8, 13, 21, 34], 'target': 21},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'selected_index': 4, 'trace': [{'low': 0, 'high': 5, 'mid': 2, 'decision': 'gt'}]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['search_type'], 'binary')
        self.assertEqual(payload['search_selected_index'], 4)

    def test_binary_search_action_payload_not_found(self):
        challenge = Challenge.objects.create(
            title='Binary Search Not Found',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BINARY_SEARCH,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='-1',
            xp_reward=30,
            max_score=100,
            visualization_payload={'data': [1, 4, 7, 10, 15], 'target': 9},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '2', 'action_payload': json.dumps({'selected_index': -1, 'trace': []})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['search_selected_index'], -1)

    def test_binary_search_action_payload_wrong_not_found_is_rejected(self):
        challenge = Challenge.objects.create(
            title='Binary Search Wrong Not Found',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BINARY_SEARCH,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='3',
            xp_reward=30,
            max_score=100,
            visualization_payload={'data': [3, 6, 9, 12, 18], 'target': 12},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '-1', 'action_payload': json.dumps({'selected_index': -1})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertIn('target exists', payload['message'].lower())


class StringActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='string-player', password='StrongPass123!')

    def test_string_action_payload_uses_candidate_prefix(self):
        challenge = Challenge.objects.create(
            title='String Prefix Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.STRING_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='algo',
            xp_reward=25,
            max_score=100,
            visualization_payload={'words': ['algox', 'algop', 'algozz']},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'x', 'action_payload': json.dumps({'candidate_prefix': 'algo'})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['string_is_common_prefix'])
        self.assertFalse(payload['string_can_extend'])

    def test_string_action_payload_rejects_invalid_prefix(self):
        challenge = Challenge.objects.create(
            title='String Prefix Invalid',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.STRING_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='data',
            xp_reward=25,
            max_score=100,
            visualization_payload={'words': ['datax', 'datay', 'dataz']},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'data', 'action_payload': json.dumps({'candidate_prefix': 'datx'})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertIn('not a common prefix', payload['message'].lower())

    def test_string_action_payload_reports_extendable_prefix(self):
        challenge = Challenge.objects.create(
            title='String Prefix Extendable',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.STRING_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='graph',
            xp_reward=25,
            max_score=100,
            visualization_payload={'words': ['graphx', 'graphy', 'graphzz']},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'graph', 'action_payload': json.dumps({'candidate_prefix': 'gra'})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertTrue(payload['string_can_extend'])
        self.assertIn('can be extended', payload['message'].lower())


class ArrayActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='array-player', password='StrongPass123!')

    def test_array_action_payload_derives_sum_from_range_bounds(self):
        challenge = Challenge.objects.create(
            title='Array Max Subarray Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ARRAY_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='6',
            xp_reward=25,
            max_score=100,
            visualization_payload={'data': [4, -1, 2, 1, -5, 4]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'start_index': 0, 'end_index': 3})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['array_selection_valid'])
        self.assertEqual(payload['array_selected_sum'], '6')

    def test_array_action_payload_accepts_contiguous_indices(self):
        challenge = Challenge.objects.create(
            title='Array Contiguous Indices',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ARRAY_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='4',
            xp_reward=25,
            max_score=100,
            visualization_payload={'data': [-2, 5, -1]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '999', 'action_payload': json.dumps({'selected_indices': [1, 2]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['array_selected_start'], 1)
        self.assertEqual(payload['array_selected_end'], 2)

    def test_array_action_payload_rejects_non_contiguous_selection(self):
        challenge = Challenge.objects.create(
            title='Array Non Contiguous',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ARRAY_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='7',
            xp_reward=25,
            max_score=100,
            visualization_payload={'data': [3, -2, 4]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '7', 'action_payload': json.dumps({'selected_indices': [0, 2]})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertIn('contiguous', payload['message'].lower())


class HashingActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='hash-player', password='StrongPass123!')

    def test_hashing_action_payload_valid_pair_derives_true(self):
        challenge = Challenge.objects.create(
            title='Hash Pair Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.HASHING_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='true',
            xp_reward=25,
            max_score=100,
            visualization_payload={'arr': [7, 14, 16, 6, 23, 11], 'target': 37},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'false', 'action_payload': json.dumps({'selected_indices': [1, 4]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertTrue(payload['hashing_selection_valid'])
        self.assertEqual(payload['hashing_selected_indices'], [1, 4])

    def test_hashing_action_payload_no_pair_derives_false(self):
        challenge = Challenge.objects.create(
            title='Hash Pair No Match',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.HASHING_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='false',
            xp_reward=25,
            max_score=100,
            visualization_payload={'arr': [20, 12, 23, 28, 11, 28], 'target': 20},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'true', 'action_payload': json.dumps({'declare_no_pair': True})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertFalse(payload['hashing_pair_exists'])

    def test_hashing_action_payload_rejects_wrong_pair(self):
        challenge = Challenge.objects.create(
            title='Hash Pair Wrong',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.HASHING_ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='true',
            xp_reward=25,
            max_score=100,
            visualization_payload={'arr': [7, 14, 16, 6, 23, 11], 'target': 37},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'true', 'action_payload': json.dumps({'selected_indices': [0, 1]})},
        )
        payload = response.json()
        self.assertFalse(payload['is_correct'])
        self.assertIn('does not sum', payload['message'].lower())


class LinkedStackQueueActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='linked-stack-queue-player', password='StrongPass123!')

    def test_linked_list_action_payload_derives_first_match_index(self):
        challenge = Challenge.objects.create(
            title='Linked List Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LINKED_LIST,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='1',
            xp_reward=25,
            max_score=100,
            visualization_payload={'values': [8, 4, 9, 4], 'target': 4},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '-1', 'action_payload': json.dumps({'selected_index': 1})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['linked_expected_index'], 1)
        attempt = ChallengeAttempt.objects.get(user=self.user, challenge=challenge)
        self.assertEqual(attempt.submitted_answer, '1')

    def test_circular_linked_list_respects_start_index(self):
        challenge = Challenge.objects.create(
            title='Circular Linked List Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.CIRCULAR_LINKED_LIST,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='3',
            xp_reward=25,
            max_score=100,
            visualization_payload={'values': [5, 2, 9, 2], 'target': 2, 'start_index': 2},
        )
        self.client.force_login(self.user)

        wrong_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '3', 'action_payload': json.dumps({'selected_index': 1})},
        )
        wrong_payload = wrong_response.json()
        self.assertFalse(wrong_payload['is_correct'])
        self.assertIn('expected traversal result', wrong_payload['message'].lower())

        correct_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '-1', 'action_payload': json.dumps({'selected_index': 3})},
        )
        correct_payload = correct_response.json()
        self.assertTrue(correct_payload['is_correct'])
        self.assertEqual(correct_payload['linked_expected_index'], 3)

    def test_stack_action_payload_requires_full_simulation(self):
        challenge = Challenge.objects.create(
            title='Stack Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.STACK,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='3',
            xp_reward=25,
            max_score=100,
            visualization_payload={'initial': [1, 3], 'operations': [{'op': 'push', 'value': 7}, {'op': 'pop'}]},
        )
        self.client.force_login(self.user)

        incomplete_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '3', 'action_payload': json.dumps({'applied_count': 1, 'final_stack': [1, 3, 7]})},
        )
        incomplete_payload = incomplete_response.json()
        self.assertFalse(incomplete_payload['is_correct'])
        self.assertIn('apply all operations', incomplete_payload['message'].lower())

        correct_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '-1', 'action_payload': json.dumps({'applied_count': 2, 'final_stack': [1, 3]})},
        )
        correct_payload = correct_response.json()
        self.assertTrue(correct_payload['is_correct'])
        self.assertEqual(correct_payload['stack_top'], '3')

    def test_stack_action_payload_accepts_empty_final_stack(self):
        challenge = Challenge.objects.create(
            title='Stack Action Empty',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.STACK,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='empty',
            xp_reward=25,
            max_score=100,
            visualization_payload={'initial': [5], 'operations': [{'op': 'pop'}]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'empty', 'action_payload': json.dumps({'applied_count': 1, 'final_stack': []})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['stack_top'], 'empty')

    def test_queue_action_payload_derives_final_front(self):
        challenge = Challenge.objects.create(
            title='Queue Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.QUEUE,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='20',
            xp_reward=25,
            max_score=100,
            visualization_payload={
                'initial': [10, 20],
                'operations': [{'op': 'enqueue', 'value': 30}, {'op': 'dequeue'}],
            },
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '-1', 'action_payload': json.dumps({'applied_count': 2, 'final_queue': [20, 30]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['queue_front'], '20')

    def test_queue_action_payload_accepts_empty_final_queue(self):
        challenge = Challenge.objects.create(
            title='Queue Action Empty',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.QUEUE,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='empty',
            xp_reward=25,
            max_score=100,
            visualization_payload={'initial': [9], 'operations': [{'op': 'dequeue'}]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'empty', 'action_payload': json.dumps({'applied_count': 1, 'final_queue': []})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['queue_front'], 'empty')


class AiMlActionSubmissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='ai-ml-player', password='StrongPass123!')

    def test_linear_regression_action_payload_derives_prediction(self):
        challenge = Challenge.objects.create(
            title='Linear Regression Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LINEAR_REGRESSION,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='20',
            xp_reward=30,
            max_score=100,
            visualization_payload={'points': [[1, 5], [2, 8], [3, 11]], 'query_x': 6},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'selected_indices': [0, 2]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['linear_prediction'], '20')

    def test_logistic_regression_action_payload_uses_probability(self):
        challenge = Challenge.objects.create(
            title='Logistic Regression Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LOGISTIC_REGRESSION,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='0.500',
            xp_reward=30,
            max_score=100,
            visualization_payload={'z': 0.0},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'probability': 0.5})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['logistic_probability'], '0.500')

    def test_kmeans_action_payload_derives_updated_centroids(self):
        challenge = Challenge.objects.create(
            title='K-Means Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.KMEANS,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='3.00 10.00',
            xp_reward=40,
            max_score=100,
            visualization_payload={'points': [2, 4, 8, 12], 'centroids': [3, 11]},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'assignments': [0, 0, 1, 1]})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['kmeans_updated_centroids'], '3.00 10.00')

    def test_knn_action_payload_requires_true_nearest_neighbors(self):
        challenge = Challenge.objects.create(
            title='KNN Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.KNN,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='B',
            xp_reward=35,
            max_score=100,
            visualization_payload={
                'train_points': [[2, 'A'], [4, 'A'], [9, 'B'], [12, 'B'], [7, 'B']],
                'query_x': 8,
                'k': 3,
            },
        )
        self.client.force_login(self.user)

        wrong_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'A', 'action_payload': json.dumps({'selected_indices': [0, 1, 2]})},
        )
        wrong_payload = wrong_response.json()
        self.assertFalse(wrong_payload['is_correct'])
        self.assertIn('nearest', wrong_payload['message'].lower())

        correct_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'A', 'action_payload': json.dumps({'selected_indices': [4, 2, 1]})},
        )
        correct_payload = correct_response.json()
        self.assertTrue(correct_payload['is_correct'])
        self.assertEqual(correct_payload['knn_prediction'], 'B')

    def test_decision_tree_action_payload_uses_entropy_candidate(self):
        challenge = Challenge.objects.create(
            title='Decision Tree Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.DECISION_TREE,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='0.811',
            xp_reward=40,
            max_score=100,
            visualization_payload={'positive': 3, 'negative': 1},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'entropy': 0.811})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['decision_tree_entropy'], '0.811')

    def test_naive_bayes_action_payload_uses_selected_label(self):
        challenge = Challenge.objects.create(
            title='Naive Bayes Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.NAIVE_BAYES,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='spam',
            xp_reward=30,
            max_score=100,
            visualization_payload={'spam_score': 0.42, 'ham_score': 0.31},
        )
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': 'ham', 'action_payload': json.dumps({'label': 'spam'})},
        )
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertEqual(payload['naive_bayes_label'], 'spam')

    def test_neural_network_action_payload_requires_linear_sum(self):
        challenge = Challenge.objects.create(
            title='Neural Network Action',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.NEURAL_NETWORK,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='0.731',
            xp_reward=45,
            max_score=100,
            visualization_payload={'x1': 2, 'x2': -1, 'w1': 1.0, 'w2': 0.5, 'b': -0.5},
        )
        self.client.force_login(self.user)

        wrong_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'linear_sum': 0.5, 'output': 0.731})},
        )
        wrong_payload = wrong_response.json()
        self.assertFalse(wrong_payload['is_correct'])
        self.assertIn('linear combination', wrong_payload['message'].lower())

        correct_response = self.client.post(
            reverse('challenge-submit', args=[challenge.slug]),
            {'answer': '0', 'action_payload': json.dumps({'linear_sum': 1.0, 'output': 0.731})},
        )
        correct_payload = correct_response.json()
        self.assertTrue(correct_payload['is_correct'])
        self.assertEqual(correct_payload['neural_output'], '0.731')


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


class ChallengeCategoryTests(TestCase):
    def test_ai_ml_category_mapping(self):
        challenge = Challenge.objects.create(
            title='Linear Regression Fundamentals',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LINEAR_REGRESSION,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='mse',
        )

        self.assertEqual(challenge.algorithm_category, 'ai_ml')
        self.assertEqual(challenge.algorithm_category_display, 'AI/ML')


class ChallengeListFilterTests(TestCase):
    def setUp(self):
        self.ai_topic = Topic.objects.create(
            stable_id='ml_search_topic',
            label='Machine Learning Foundations',
            category=Topic.Category.AI_ML,
            description='ml topic',
        )
        Challenge.objects.create(
            title='Graph Traversal BFS',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='a b',
            xp_reward=73,
        )
        Challenge.objects.create(
            title='KMeans Cluster Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.KMEANS,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='mean position',
            xp_reward=91,
            topic=self.ai_topic,
        )

    def test_category_filter_only_returns_requested_category(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'ai_ml'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'K-Means')
        self.assertNotContains(response, 'BFS')

    def test_search_by_xp_points_returns_matching_challenge(self):
        response = self.client.get(reverse('challenges-list'), {'search': '91'})

        self.assertEqual(response.status_code, 200)
        returned_titles = {challenge.title for challenge in response.context['challenges']}
        self.assertIn('KMeans Cluster Challenge', returned_titles)
        self.assertNotIn('Graph Traversal BFS', returned_titles)

    def test_search_by_topic_label_returns_related_challenge(self):
        response = self.client.get(reverse('challenges-list'), {'search': 'Machine Learning Foundations'})

        self.assertEqual(response.status_code, 200)
        returned_titles = {challenge.title for challenge in response.context['challenges']}
        self.assertIn('KMeans Cluster Challenge', returned_titles)

    def test_search_typo_keyword_graph_like_still_returns_related_results_only(self):
        response = self.client.get(reverse('challenges-list'), {'search': 'grapht'})

        self.assertEqual(response.status_code, 200)
        returned_titles = {challenge.title for challenge in response.context['challenges']}
        self.assertIn('Graph Traversal BFS', returned_titles)
        self.assertNotIn('KMeans Cluster Challenge', returned_titles)

class TopicModelTests(TestCase):
    def test_topic_creation(self):
        topic = Topic.objects.create(
            stable_id='dsa_arrays',
            label='Arrays & Lists',
            category=Topic.Category.DSA_CORE,
            description='Master array manipulation',
            icon_class='bi-list',
            visualization_type='array',
        )

        self.assertEqual(topic.stable_id, 'dsa_arrays')
        self.assertEqual(topic.label, 'Arrays & Lists')
        self.assertEqual(topic.category, 'dsa_core')
        self.assertTrue(topic.is_active)
        self.assertIsNotNone(topic.created_at)

    def test_topic_str_representation(self):
        topic = Topic.objects.create(
            stable_id='dsa_strings',
            label='Strings & Text',
            category=Topic.Category.DSA_CORE,
            description='String processing',
        )

        self.assertEqual(str(topic), 'Strings & Text (dsa_strings)')

    def test_topic_stable_id_unique(self):
        Topic.objects.create(
            stable_id='dsa_unique',
            label='Test Topic 1',
            category=Topic.Category.DSA_CORE,
            description='test',
        )

        with self.assertRaises(Exception):
            Topic.objects.create(
                stable_id='dsa_unique',
                label='Test Topic 2',
                category=Topic.Category.DSA_CORE,
                description='test',
            )

    def test_topic_visualization_choices(self):
        for viz_type in ['array', 'graph', 'tree', 'grid', 'matrix', 'conceptual', 'none']:
            topic = Topic.objects.create(
                stable_id=f'test_{viz_type}',
                label=f'Test {viz_type}',
                category=Topic.Category.DSA_CORE,
                description='test',
                visualization_type=viz_type,
            )
            self.assertEqual(topic.visualization_type, viz_type)


class UserChallengeProgModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='proguser', password='Pass123!')
        self.challenge = Challenge.objects.create(
            title='Test Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
        )

    def test_user_challenge_prog_creation(self):
        prog = UserChallengeProg.objects.create(
            user=self.user,
            challenge=self.challenge,
            is_solved=False,
            is_unlocked=True,
            best_score=75,
            attempt_count=3,
        )

        self.assertEqual(prog.user, self.user)
        self.assertEqual(prog.challenge, self.challenge)
        self.assertFalse(prog.is_solved)
        self.assertTrue(prog.is_unlocked)
        self.assertEqual(prog.best_score, 75)
        self.assertEqual(prog.attempt_count, 3)

    def test_user_challenge_prog_unique_together(self):
        UserChallengeProg.objects.create(
            user=self.user,
            challenge=self.challenge,
            is_solved=False,
            is_unlocked=True,
        )

        with self.assertRaises(Exception):
            UserChallengeProg.objects.create(
                user=self.user,
                challenge=self.challenge,
                is_solved=True,
                is_unlocked=True,
            )

    def test_user_challenge_prog_str(self):
        prog = UserChallengeProg.objects.create(
            user=self.user,
            challenge=self.challenge,
            is_solved=True,
            is_unlocked=True,
        )

        expected = f"{self.user.username} - {self.challenge.title} (solved=True, unlocked=True)"
        self.assertEqual(str(prog), expected)


class ChallengeBankValidatorTests(TestCase):
    def setUp(self):
        self.bank_file = Path('challenges/data/challenge_bank.json')

    def test_challenge_bank_file_exists(self):
        self.assertTrue(self.bank_file.exists(), "challenge_bank.json not found")

    def test_challenge_bank_valid_json(self):
        with open(self.bank_file, 'r') as f:
            data = json.load(f)
        self.assertIsInstance(data, dict)
        self.assertIn('topics', data)

    def test_challenge_bank_schema_validation(self):
        is_valid, errors = ChallengeBankValidator.validate_file(str(self.bank_file))
        
        if not is_valid:
            print("Validation errors:")
            for error in errors:
                print(f"  - {error}")
        
        self.assertTrue(is_valid, f"Challenge bank validation failed: {errors}")

    def test_challenge_bank_has_topics(self):
        with open(self.bank_file, 'r') as f:
            data = json.load(f)
        
        self.assertGreater(len(data['topics']), 0, "Challenge bank has no topics")

    def test_challenge_bank_topic_structure(self):
        with open(self.bank_file, 'r') as f:
            data = json.load(f)
        
        for topic in data['topics']:
            self.assertIn('stable_id', topic)
            self.assertIn('label', topic)
            self.assertIn('category', topic)
            self.assertIn('challenges', topic)
            self.assertIsInstance(topic['challenges'], list)
            self.assertGreater(len(topic['challenges']), 0)

    def test_challenge_bank_challenge_structure(self):
        with open(self.bank_file, 'r') as f:
            data = json.load(f)
        
        for topic in data['topics']:
            for challenge in topic['challenges']:
                self.assertIn('stable_id', challenge)
                self.assertIn('title', challenge)
                self.assertIn('algorithm_type', challenge)
                self.assertIn('difficulty', challenge)
                self.assertIn('expected_answer', challenge)
                self.assertIn('xp_reward', challenge)

    def test_challenge_bank_quality_no_template_prompts_or_placeholder_answers(self):
        with open(self.bank_file, 'r', encoding='utf-8') as handle:
            data = json.load(handle)

        prompt_template_re = re.compile(r'^solve\s+.+\s+problem at level\s+\d+\s+\((easy|medium|hard)\)\.?$', re.IGNORECASE)
        expected_placeholder_re = re.compile(r'.*_answer_\d+$', re.IGNORECASE)

        for topic in data['topics']:
            for challenge in topic['challenges']:
                prompt = challenge.get('prompt', '')
                self.assertFalse(prompt_template_re.match(prompt), f"Template prompt found: {challenge['stable_id']}")
                for section in ('Problem:', 'Input:', 'Output:', 'Constraints:', 'Example:'):
                    self.assertIn(section, prompt, f"Missing '{section}' in {challenge['stable_id']}")

                expected_answer = challenge.get('expected_answer', '')
                self.assertFalse(
                    expected_placeholder_re.match(expected_answer),
                    f"Placeholder expected_answer found: {challenge['stable_id']}",
                )

                self.assertIn('visualization_payload', challenge, f"Missing visualization_payload in {challenge['stable_id']}")
                self.assertIsInstance(
                    challenge['visualization_payload'],
                    dict,
                    f"visualization_payload must be object in {challenge['stable_id']}",
                )

    def test_challenge_bank_prompts_are_unique_per_challenge(self):
        with open(self.bank_file, 'r', encoding='utf-8') as handle:
            data = json.load(handle)

        seen = {}
        duplicates = []
        for topic in data['topics']:
            for challenge in topic['challenges']:
                prompt = challenge.get('prompt', '').strip()
                if not prompt:
                    continue
                if prompt in seen:
                    duplicates.append((seen[prompt], challenge['stable_id']))
                else:
                    seen[prompt] = challenge['stable_id']

        self.assertFalse(duplicates, f"Duplicate prompts found: {duplicates[:5]}")

    def test_validator_detects_invalid_difficulty(self):
        """Test that validator can detect invalid difficulty values."""
        # Create a test temp file with invalid difficulty
        import tempfile
        bad_data = {
            'schema_version': '1.0',
            'topics': [
                {
                    'stable_id': 'test',
                    'label': 'Test',
                    'category': 'dsa_core',
                    'description': 'test',
                    'icon_class': 'bi-test',
                    'visualization_type': 'array',
                    'challenges': [
                        {
                            'stable_id': 'ch_001',
                            'title': 'Test',
                            'difficulty': 'invalid_difficulty',
                            'order_index': 1,
                            'description': 'test',
                            'prompt': 'test',
                            'expected_answer': 'test',
                            'starter_code': 'test',
                            'tags': [],
                            'xp_reward': 50,
                            'is_active': True,
                        }
                    ]
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(bad_data, f)
            temp_file = f.name
        
        try:
            is_valid, errors = ChallengeBankValidator.validate_file(temp_file)
            self.assertFalse(is_valid)
            self.assertTrue(any('invalid_difficulty' in str(err) for err in errors))
        finally:
            import os
            os.unlink(temp_file)


class ChallengeBankLoadCommandTests(TestCase):
    def setUp(self):
        self.bank_file = Path('challenges/data/challenge_bank.json')
        with open(self.bank_file, 'r', encoding='utf-8') as handle:
            self.bank_data = json.load(handle)
        self.expected_topics = len(self.bank_data.get('topics', []))
        self.expected_challenges = sum(len(topic.get('challenges', [])) for topic in self.bank_data.get('topics', []))

    def _run_loader(self, *args):
        output = StringIO()
        call_command('load_challenge_bank', *args, stdout=output)
        return output.getvalue()

    def test_load_command_populates_expected_counts_and_required_fields(self):
        self._run_loader('--reset')

        self.assertEqual(Topic.objects.count(), self.expected_topics)
        self.assertEqual(Challenge.objects.filter(topic__isnull=False).count(), self.expected_challenges)
        self.assertEqual(Challenge.objects.filter(is_active=True, topic__isnull=False).count(), self.expected_challenges)

        sample = Challenge.objects.filter(topic__isnull=False).select_related('topic').first()
        self.assertIsNotNone(sample)
        self.assertTrue(sample.slug.startswith(f'{sample.topic.stable_id}-'))
        self.assertTrue(sample.title)
        self.assertIn(sample.difficulty, {choice[0] for choice in Challenge.Difficulty.choices})
        self.assertTrue(sample.description)
        self.assertTrue(sample.prompt)
        self.assertTrue(sample.expected_answer)
        self.assertGreaterEqual(sample.xp_reward, 0)
        self.assertIsNotNone(sample.order_index)
        self.assertIsNotNone(sample.topic)
        self.assertIsInstance(sample.visualization_payload, dict)
        self.assertTrue(sample.visualization_payload)

    def test_load_command_is_idempotent_and_syncs_topic_updates(self):
        self._run_loader('--reset')
        topic = Topic.objects.order_by('stable_id').first()
        self.assertIsNotNone(topic)
        stable_id = topic.stable_id
        topic.label = 'Outdated Label'
        topic.save(update_fields=['label'])

        self._run_loader()
        topic.refresh_from_db()
        expected_label = next(item['label'] for item in self.bank_data['topics'] if item['stable_id'] == stable_id)
        self.assertEqual(topic.label, expected_label)
        self.assertEqual(Topic.objects.count(), self.expected_topics)
        self.assertEqual(Challenge.objects.filter(topic__isnull=False).count(), self.expected_challenges)

    def test_load_command_recovers_from_slug_collision_without_reset(self):
        collision_slug = 'algo_bfs-bfs-traversal-1'
        Challenge.objects.create(
            title='Legacy Collision Holder',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='legacy',
            prompt='legacy prompt',
            expected_answer='legacy',
            slug=collision_slug,
        )

        self._run_loader()

        challenge = Challenge.objects.filter(topic__stable_id='algo_bfs', order_index=0).first()
        self.assertIsNotNone(challenge)
        self.assertEqual(challenge.slug, collision_slug)
        self.assertEqual(challenge.algorithm_type, Challenge.AlgorithmType.BFS)

    def test_loaded_challenge_detail_route_is_accessible(self):
        self._run_loader('--reset')
        sample = Challenge.objects.filter(topic__isnull=False, is_active=True).first()
        self.assertIsNotNone(sample)
        response = self.client.get(reverse('challenge-detail', args=[sample.slug]))
        self.assertEqual(response.status_code, 200)

    def test_load_command_ensures_30_plus_levels_per_algorithm_with_mixed_difficulty(self):
        self._run_loader('--reset')
        algorithm_types = {choice[0] for choice in Challenge.AlgorithmType.choices}
        for algorithm_type in algorithm_types:
            with self.subTest(algorithm_type=algorithm_type):
                qs = Challenge.objects.filter(topic__isnull=False, is_active=True, algorithm_type=algorithm_type)
                self.assertGreaterEqual(qs.count(), 30)
                difficulties = set(qs.values_list('difficulty', flat=True))
                self.assertTrue({'easy', 'medium', 'hard'}.issubset(difficulties))


class ChallengeModelBackwardCompatTests(TestCase):
    def test_challenge_algorithm_type_still_works(self):
        """Ensure algorithm_type enum still functions after new fields added."""
        challenge = Challenge.objects.create(
            title='BFS Test',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            expected_answer='a b',
        )

        self.assertEqual(challenge.algorithm_type, Challenge.AlgorithmType.BFS)
        self.assertEqual(challenge.algorithm_category, 'graph')

    def test_challenge_topic_optional(self):
        """Topic field should be optional for backward compatibility."""
        challenge = Challenge.objects.create(
            title='Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            # topic is not set
        )

        self.assertIsNone(challenge.topic)

    def test_challenge_order_index_default(self):
        """order_index should default to 0."""
        challenge = Challenge.objects.create(
            title='Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
        )

        self.assertEqual(challenge.order_index, 0)

    def test_challenge_is_visual_supported_default(self):
        """is_visual_supported should default to False."""
        challenge = Challenge.objects.create(
            title='Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
        )

        self.assertFalse(challenge.is_visual_supported)


class QuickFilterAndCategoryTests(TestCase):
    def setUp(self):
        # Create topics
        self.topic_dsa = Topic.objects.create(
            stable_id='dsa_arrays',
            label='Arrays & Lists',
            category=Topic.Category.DSA_CORE,
            description='Array mastery',
        )
        self.topic_ai = Topic.objects.create(
            stable_id='ai_regression',
            label='Regression Basics',
            category=Topic.Category.AI_ML,
            description='ML fundamentals',
        )
        
        # Create topic-based challenges
        self.challenge_topic_dsa = Challenge.objects.create(
            title='Array Sum Challenge',
            topic=self.topic_dsa,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='Sum an array',
            prompt='Sum the array',
            expected_answer='sum',
        )
        
        self.challenge_topic_ai = Challenge.objects.create(
            title='Linear Regression Intro',
            topic=self.topic_ai,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='Basic regression',
            prompt='What is regression?',
            expected_answer='line',
        )
        
        # Create legacy challenge (no topic)
        self.challenge_legacy = Challenge.objects.create(
            title='BFS Graph Traversal',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='BFS basics',
            prompt='BFS question',
            expected_answer='queue',
        )
    
    def test_challenge_list_displays_all_categories(self):
        """Test that challenge list shows both topic-based and legacy categories."""
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Choose A Type To Start')
        self.assertNotContains(response, 'Array Sum Challenge')
        self.assertNotContains(response, 'BFS Graph Traversal')
    
    def test_filter_by_topic_category_dsa(self):
        """Test filtering by topic category dsa_core."""
        response = self.client.get(reverse('challenges-list'), {'category': 'dsa_core'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Array Sum Challenge')
        self.assertNotContains(response, 'Linear Regression Intro')
        self.assertNotContains(response, 'BFS Graph Traversal')
    
    def test_filter_by_topic_category_ai_ml(self):
        """Test filtering by topic category ai_ml."""
        response = self.client.get(reverse('challenges-list'), {'category': 'ai_ml'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Linear Regression Intro')
        self.assertNotContains(response, 'Array Sum Challenge')
    
    def test_category_section_has_effective_category(self):
        """Test that category sections use effective_category for data-category."""
        response = self.client.get(reverse('challenges-list'), {'category': 'dsa_core'})
        content = response.content.decode('utf-8')
        self.assertIn('data-category="dsa_core"', content)
    
    def test_quick_filter_matches_effective_category(self):
        """Test that quick filter buttons match section data-category."""
        response = self.client.get(reverse('challenges-list'))
        content = response.content.decode('utf-8')
        # Quick filter buttons should match section data-category values
        self.assertIn('data-category="dsa_core"', content)
        self.assertIn('data-category="ai_ml"', content)


class CategoryCoverageAndQuickBarTests(TestCase):
    def setUp(self):
        self.control_topic = Topic.objects.create(
            stable_id='dsa_queue_basics',
            label='Queue Basics',
            category=Topic.Category.DSA_CORE,
            description='Queue fundamentals',
        )
        Challenge.objects.create(
            title='Control Queue Challenge',
            topic=self.control_topic,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='Queue challenge',
            prompt='Queue prompt',
            expected_answer='queue',
        )

        topic_cases = [
            ('ml_intro', 'AI/ML Fundamentals', Topic.Category.AI_ML, 'AI ML Topic Challenge', Challenge.AlgorithmType.LINEAR_REGRESSION),
            ('dsa_arrays', 'Array Patterns', Topic.Category.DSA_CORE, 'Array Topic Challenge', Challenge.AlgorithmType.ARRAY_ALGORITHM),
            ('dsa_strings', 'String Manipulation', Topic.Category.DSA_CORE, 'String Topic Challenge', Challenge.AlgorithmType.STRING_ALGORITHM),
            ('dsa_hashing', 'Hashing Concepts', Topic.Category.DSA_CORE, 'Hashing Topic Challenge', Challenge.AlgorithmType.HASHING_ALGORITHM),
            ('adv_backtracking', 'Backtracking Essentials', Topic.Category.ADVANCED_DSA, 'Backtracking Topic Challenge', Challenge.AlgorithmType.BACKTRACKING),
            ('adv_recursion', 'Recursion Deep Dive', Topic.Category.ADVANCED_DSA, 'Recursion Topic Challenge', Challenge.AlgorithmType.RECURSION),
            ('adv_math', 'Math Problem Solving', Topic.Category.ADVANCED_DSA, 'Math Topic Challenge', Challenge.AlgorithmType.MATH_ALGORITHM),
            ('adv_bits', 'Bit Manipulation Basics', Topic.Category.ADVANCED_DSA, 'Bit Manipulation Topic Challenge', Challenge.AlgorithmType.BIT_CONVERSION),
        ]
        for stable_id, label, category, challenge_title, algorithm_type in topic_cases:
            topic = Topic.objects.create(
                stable_id=stable_id,
                label=label,
                category=category,
                description='test',
            )
            Challenge.objects.create(
                title=challenge_title,
                topic=topic,
                order_index=1,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                algorithm_type=algorithm_type,
                difficulty=Challenge.Difficulty.EASY,
                description='test',
                prompt='test',
                expected_answer='test',
            )

        Challenge.objects.create(
            title='Linked List Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.LINKED_LIST,
            difficulty=Challenge.Difficulty.EASY,
            description='linked list legacy',
            prompt='linked list',
            expected_answer='node',
        )
        Challenge.objects.create(
            title='Stack Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.STACK,
            difficulty=Challenge.Difficulty.EASY,
            description='stack legacy',
            prompt='stack',
            expected_answer='top',
        )
        Challenge.objects.create(
            title='Queue Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.QUEUE,
            difficulty=Challenge.Difficulty.EASY,
            description='queue legacy',
            prompt='queue',
            expected_answer='front',
        )
        Challenge.objects.create(
            title='Sorting Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.QUICK_SORT,
            difficulty=Challenge.Difficulty.EASY,
            description='sorting legacy',
            prompt='sort',
            expected_answer='sort',
        )
        Challenge.objects.create(
            title='Searching Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BINARY_SEARCH,
            difficulty=Challenge.Difficulty.EASY,
            description='searching legacy',
            prompt='search',
            expected_answer='search',
        )
        Challenge.objects.create(
            title='Graph Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='graph legacy',
            prompt='graph',
            expected_answer='graph',
        )
        Challenge.objects.create(
            title='DP Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.KNAPSACK,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='dp legacy',
            prompt='dp',
            expected_answer='dp',
        )
        Challenge.objects.create(
            title='Greedy Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ACTIVITY_SELECTION,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='greedy legacy',
            prompt='greedy',
            expected_answer='greedy',
        )
        Challenge.objects.create(
            title='Tree Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BST,
            difficulty=Challenge.Difficulty.EASY,
            description='tree legacy',
            prompt='tree',
            expected_answer='tree',
        )
        Challenge.objects.create(
            title='Minimax Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.MINIMAX,
            difficulty=Challenge.Difficulty.HARD,
            description='minimax legacy',
            prompt='minimax',
            expected_answer='value',
        )
        Challenge.objects.create(
            title='Bit Conversion Legacy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BIT_CONVERSION,
            difficulty=Challenge.Difficulty.EASY,
            description='bit conversion legacy',
            prompt='bit conversion',
            expected_answer='1010',
        )

    def test_category_options_include_all_required_algorithm_types(self):
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        category_values = {opt['value'] for opt in response.context['category_options']}
        required = {
            'ai_ml',
            'linked_list',
            'stack',
            'queue',
            'sorting',
            'searching',
            'graph',
            'dynamic_programming',
            'greedy',
            'backtracking',
            'recursion',
            'string',
            'math',
            'bit_manipulation',
            'array',
            'hashing',
            'tree',
        }
        self.assertTrue(required.issubset(category_values))

    def test_quick_filter_bar_renders_single_row_scroll_container(self):
        response = self.client.get(reverse('challenges-list'))
        self.assertContains(response, 'class="quick-filter-bar d-flex gap-2 align-items-center"')
        self.assertContains(response, 'id="quickFilterControls"')
        self.assertContains(response, 'id="quickFilterSearchInput"')
        self.assertContains(response, 'Search Algorithm')
        self.assertNotContains(response, 'data-category="all"')

    def test_search_input_and_options_are_rendered_from_category_options(self):
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        category_options = response.context['category_options']
        for category in category_options:
            self.assertContains(response, f'data-category="{category["value"]}"')
            self.assertContains(response, escape(category['label']))

        self.assertContains(response, 'id="quickFilterClear"')

    def test_representative_category_icons_are_rendered(self):
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'bi-hash me-1')
        self.assertContains(response, 'bi-diagram-2 me-1')
        self.assertContains(response, 'bi-cpu me-1')
        self.assertContains(response, 'bi-arrow-down-up me-1')

    def test_filtering_works_for_each_required_algorithm_type(self):
        expected_titles = {
            'ai_ml': 'AI ML Topic Challenge',
            'linked_list': 'Linked List Legacy Challenge',
            'stack': 'Stack Legacy Challenge',
            'queue': 'Queue Legacy Challenge',
            'sorting': 'Sorting Legacy Challenge',
            'searching': 'Searching Legacy Challenge',
            'graph': 'Graph Legacy Challenge',
            'dynamic_programming': 'DP Legacy Challenge',
            'greedy': 'Greedy Legacy Challenge',
            'backtracking': 'Backtracking Topic Challenge',
            'recursion': 'Recursion Topic Challenge',
            'string': 'String Topic Challenge',
            'math': 'Math Topic Challenge',
            'bit_manipulation': 'Bit Manipulation Topic Challenge',
            'bit_conversion': 'Bit Conversion Legacy Challenge',
            'array': 'Array Topic Challenge',
            'hashing': 'Hashing Topic Challenge',
            'tree': 'Tree Legacy Challenge',
        }

        for category, expected_title in expected_titles.items():
            with self.subTest(category=category):
                response = self.client.get(reverse('challenges-list'), {'category': category})
                self.assertEqual(response.status_code, 200)
                returned_titles = {challenge.title for challenge in response.context['challenges']}
                if category == 'bit_manipulation':
                    self.assertTrue(
                        {'Bit Manipulation Topic Challenge', 'Bit Conversion Legacy Challenge'}.intersection(returned_titles)
                    )
                else:
                    self.assertIn(expected_title, returned_titles)
                self.assertNotIn('Control Queue Challenge', returned_titles)

    def test_ai_ml_filter_excludes_dynamic_programming_algorithms(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'ai_ml'})
        self.assertEqual(response.status_code, 200)
        returned_titles = {challenge.title for challenge in response.context['challenges']}
        self.assertIn('AI ML Topic Challenge', returned_titles)
        self.assertNotIn('DP Legacy Challenge', returned_titles)
        self.assertNotIn('Greedy Legacy Challenge', returned_titles)

    def test_graph_filter_excludes_tree_algorithms_and_includes_explicit_graph_mapping(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'graph'})
        self.assertEqual(response.status_code, 200)
        returned_titles = {challenge.title for challenge in response.context['challenges']}
        self.assertIn('Graph Legacy Challenge', returned_titles)
        self.assertIn('Minimax Legacy Challenge', returned_titles)
        self.assertNotIn('Tree Legacy Challenge', returned_titles)

    def test_string_filter_only_returns_string_mapped_challenges(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'string'})
        self.assertEqual(response.status_code, 200)
        returned_titles = {challenge.title for challenge in response.context['challenges']}
        self.assertIn('String Topic Challenge', returned_titles)
        self.assertNotIn('DP Legacy Challenge', returned_titles)
        self.assertNotIn('Control Queue Challenge', returned_titles)

    def test_category_results_are_structurally_scoped(self):
        categories = (
            'ai_ml',
            'linked_list',
            'stack',
            'queue',
            'sorting',
            'searching',
            'graph',
            'dynamic_programming',
            'greedy',
            'backtracking',
            'recursion',
            'string',
            'math',
            'bit_manipulation',
            'array',
            'hashing',
            'tree',
            'dsa_core',
            'sorting_searching',
            'trees_graphs',
            'trees_dp_greedy',
        )
        for category in categories:
            with self.subTest(category=category):
                response = self.client.get(reverse('challenges-list'), {'category': category})
                self.assertEqual(response.status_code, 200)
                targets = _category_targets(category)
                mapped_algorithm_types = set()
                for target in targets:
                    mapped_algorithm_types.update(CATEGORY_TO_ALGORITHM_TYPES.get(target, set()))
                for challenge in response.context['challenges']:
                    topic_category = challenge.topic.category if challenge.topic else None
                    self.assertTrue(
                        (topic_category in targets) or (challenge.algorithm_type in mapped_algorithm_types),
                        msg=f"Unexpected challenge '{challenge.title}' in category '{category}'",
                    )

    def test_filter_aliases_map_to_canonical_categories(self):
        advanced_alias = self.client.get(reverse('challenges-list'), {'category': 'advance_dsa'})
        advanced_canonical = self.client.get(reverse('challenges-list'), {'category': 'advanced_dsa'})
        self.assertEqual(advanced_alias.status_code, 200)
        self.assertEqual(advanced_canonical.status_code, 200)
        self.assertEqual(
            {challenge.title for challenge in advanced_alias.context['challenges']},
            {challenge.title for challenge in advanced_canonical.context['challenges']},
        )

        dp_alias = self.client.get(reverse('challenges-list'), {'category': 'dynamic_programmin'})
        dp_canonical = self.client.get(reverse('challenges-list'), {'category': 'dynamic_programming'})
        self.assertEqual(dp_alias.status_code, 200)
        self.assertEqual(dp_canonical.status_code, 200)
        self.assertEqual(
            {challenge.title for challenge in dp_alias.context['challenges']},
            {challenge.title for challenge in dp_canonical.context['challenges']},
        )

    def test_grouped_sections_do_not_duplicate_challenges(self):
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        grouped = response.context['grouped_by_category']
        grouped_ids = [challenge.id for group in grouped for challenge in group['list']]
        self.assertEqual(len(grouped_ids), len(set(grouped_ids)))
        self.assertEqual(set(grouped_ids), {challenge.id for challenge in response.context['challenges']})

    def test_graph_filter_renders_only_graph_section(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'graph'})
        self.assertEqual(response.status_code, 200)
        grouped = response.context['grouped_by_category']
        self.assertTrue(grouped)
        self.assertTrue(all(group['effective_category'] == 'graph' for group in grouped))

    def test_legacy_trees_dp_greedy_filter_still_works(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'trees_dp_greedy'})
        self.assertEqual(response.status_code, 200)
        returned_titles = {challenge.title for challenge in response.context['challenges']}
        self.assertIn('DP Legacy Challenge', returned_titles)
        self.assertIn('Greedy Legacy Challenge', returned_titles)
        self.assertIn('Tree Legacy Challenge', returned_titles)

    def test_tree_dynamic_programming_and_greedy_filters_are_precise(self):
        tree_response = self.client.get(reverse('challenges-list'), {'category': 'tree'})
        self.assertEqual(tree_response.status_code, 200)
        self.assertContains(tree_response, 'Tree Challenges')
        tree_titles = {challenge.title for challenge in tree_response.context['challenges']}
        self.assertIn('Tree Legacy Challenge', tree_titles)
        self.assertNotIn('DP Legacy Challenge', tree_titles)
        self.assertNotIn('Greedy Legacy Challenge', tree_titles)

        dp_response = self.client.get(reverse('challenges-list'), {'category': 'dynamic_programming'})
        self.assertEqual(dp_response.status_code, 200)
        self.assertContains(dp_response, 'Dynamic Programming Challenges')
        dp_titles = {challenge.title for challenge in dp_response.context['challenges']}
        self.assertIn('DP Legacy Challenge', dp_titles)
        self.assertNotIn('Tree Legacy Challenge', dp_titles)
        self.assertNotIn('Greedy Legacy Challenge', dp_titles)

        greedy_response = self.client.get(reverse('challenges-list'), {'category': 'greedy'})
        self.assertEqual(greedy_response.status_code, 200)
        self.assertContains(greedy_response, 'Greedy Challenges')
        greedy_titles = {challenge.title for challenge in greedy_response.context['challenges']}
        self.assertIn('Greedy Legacy Challenge', greedy_titles)
        self.assertNotIn('Tree Legacy Challenge', greedy_titles)
        self.assertNotIn('DP Legacy Challenge', greedy_titles)

    def test_clearing_category_returns_unfiltered_results(self):
        baseline_response = self.client.get(reverse('challenges-list'))
        self.assertEqual(baseline_response.status_code, 200)
        baseline_titles = {challenge.title for challenge in baseline_response.context['challenges']}

        filtered_response = self.client.get(reverse('challenges-list'), {'category': 'graph'})
        self.assertEqual(filtered_response.status_code, 200)
        filtered_titles = {challenge.title for challenge in filtered_response.context['challenges']}
        self.assertNotEqual(filtered_titles, baseline_titles)

        cleared_response = self.client.get(reverse('challenges-list'), {'category': 'all'})
        self.assertEqual(cleared_response.status_code, 200)
        cleared_titles = {challenge.title for challenge in cleared_response.context['challenges']}
        self.assertEqual(cleared_titles, baseline_titles)


class ChallengeCategorySubtypeNavigationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.ai_topic = Topic.objects.create(
            stable_id='ai_ml_nav_topic',
            label='AI ML Navigation',
            category=Topic.Category.AI_ML,
            description='AI/ML navigation tests',
        )
        cls.graph_topic = Topic.objects.create(
            stable_id='graph_nav_topic',
            label='Graph Navigation',
            category=Topic.Category.DSA_CORE,
            description='Graph navigation tests',
        )
        cls.bits_topic = Topic.objects.create(
            stable_id='bits_nav_topic',
            label='Bits Navigation',
            category=Topic.Category.ADVANCED_DSA,
            description='Bit manipulation navigation tests',
        )

        difficulties = [
            Challenge.Difficulty.EASY,
            Challenge.Difficulty.MEDIUM,
            Challenge.Difficulty.HARD,
        ]

        for idx in range(30):
            Challenge.objects.create(
                title=f'Decision Tree Level {idx + 1}',
                topic=cls.ai_topic,
                order_index=idx,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                algorithm_type=Challenge.AlgorithmType.DECISION_TREE,
                difficulty=difficulties[idx % 3],
                description='Entropy focused level' if idx < 5 else 'Decision tree classification level',
                prompt='Build the decision tree',
                expected_answer='split',
            )

        for idx in range(30):
            Challenge.objects.create(
                title=f'KMeans Level {idx + 1}',
                topic=cls.ai_topic,
                order_index=30 + idx,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                algorithm_type=Challenge.AlgorithmType.KMEANS,
                difficulty=difficulties[idx % 3],
                description='KMeans clustering level',
                prompt='Compute centroid updates',
                expected_answer='centroid',
            )

        for idx in range(30):
            Challenge.objects.create(
                title=f'BFS Level {idx + 1}',
                topic=cls.graph_topic,
                order_index=idx,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                algorithm_type=Challenge.AlgorithmType.BFS,
                difficulty=difficulties[idx % 3],
                description='Graph traversal level',
                prompt='Traverse graph',
                expected_answer='queue',
            )

        for idx in range(3):
            Challenge.objects.create(
                title=f'Bit Conversion Level {idx + 1}',
                topic=cls.bits_topic,
                order_index=idx,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                algorithm_type=Challenge.AlgorithmType.BIT_CONVERSION,
                difficulty=difficulties[idx % 3],
                description='Bit conversion level',
                prompt='Convert between bases',
                expected_answer='1010',
            )

    def test_default_load_shows_all_cards(self):
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context['challenges']), 4)

    def test_main_category_filtering(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'ai_ml'})
        self.assertEqual(response.status_code, 200)
        returned = response.context['challenges']
        self.assertEqual(len(returned), 2)
        self.assertTrue(all(ch.algorithm_type in {'decision_tree', 'kmeans'} for ch in returned))

    def test_subtype_filtering(self):
        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'ai_ml', 'subtype': 'decision_tree'},
        )
        self.assertEqual(response.status_code, 200)
        returned = response.context['challenges']
        self.assertEqual(len(returned), 30)
        self.assertTrue(all(ch.algorithm_type == 'decision_tree' for ch in returned))

    def test_category_subtype_search_combined(self):
        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'ai_ml', 'subtype': 'decision_tree', 'search': 'entropy'},
        )
        self.assertEqual(response.status_code, 200)
        returned = response.context['challenges']
        self.assertEqual(len(returned), 5)
        self.assertTrue(all('Entropy' in ch.description or 'entropy' in ch.description for ch in returned))

    def test_search_without_subtype_shows_matching_subtype_cards(self):
        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'ai_ml', 'search': 'Decision Tree Level'},
        )

        self.assertEqual(response.status_code, 200)
        returned = response.context['challenges']
        self.assertEqual(len(returned), 1)
        self.assertTrue(all(ch.algorithm_type == 'decision_tree' for ch in returned))
        self.assertEqual(response.context['selected_subtype'], 'all')
        self.assertTrue(response.context['is_subtype_index_mode'])

    def test_subtype_link_preserves_search_query(self):
        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'ai_ml', 'search': 'AI/ML'},
        )

        self.assertEqual(response.status_code, 200)
        cards = response.context['challenges']
        self.assertTrue(cards)
        self.assertTrue(all('search=AI%2FML' in ch.subtype_query for ch in cards))

    def test_subtype_returns_all_30_levels(self):
        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'ai_ml', 'subtype': 'decision_tree'},
        )
        self.assertEqual(response.status_code, 200)
        levels = [challenge.order_index for challenge in response.context['challenges']]
        self.assertEqual(len(levels), 30)
        self.assertEqual(min(levels), 0)
        self.assertEqual(max(levels), 29)

    def test_subtype_index_hides_blank_or_unsupported_algorithm_types(self):
        noise_topic = Topic.objects.create(
            stable_id='noise_topic',
            label='Noise Topic',
            category=Topic.Category.DSA_CORE,
            description='noise',
        )
        Challenge.objects.create(
            title='Probe A',
            topic=noise_topic,
            order_index=0,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type='',
            difficulty=Challenge.Difficulty.EASY,
            description='noise',
            prompt='noise',
            expected_answer='x',
        )

        response = self.client.get(reverse('challenges-list'), {'category': 'dsa_core'})
        self.assertEqual(response.status_code, 200)
        cards = response.context['challenges']
        self.assertGreaterEqual(len(cards), 1)
        self.assertTrue(all(ch.algorithm_type for ch in cards))
        self.assertTrue(all(ch.algorithm_type in dict(Challenge.AlgorithmType.choices) for ch in cards))
        self.assertFalse(any(ch.title == 'Probe A' for ch in cards))

    def test_subtype_ignores_legacy_duplicates_for_same_algorithm_level(self):
        Challenge.objects.create(
            title='Legacy BFS Duplicate',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='legacy duplicate',
            prompt='test',
            expected_answer='queue',
            order_index=0,
        )
        Challenge.objects.create(
            title='Legacy BFS Duplicate 2',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='legacy duplicate',
            prompt='test',
            expected_answer='queue',
            order_index=1,
        )

        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'trees_graphs', 'subtype': 'bfs'},
        )
        self.assertEqual(response.status_code, 200)
        returned = response.context['challenges']
        self.assertEqual(len(returned), 30)
        self.assertTrue(all(ch.topic_id == self.graph_topic.id for ch in returned))

    def test_challenge_detail_redirects_duplicate_level_to_preferred_variant(self):
        canonical = Challenge.objects.filter(
            topic=self.graph_topic,
            algorithm_type=Challenge.AlgorithmType.BFS,
            order_index=0,
        ).first()
        self.assertIsNotNone(canonical)

        duplicate = Challenge.objects.create(
            title='Legacy BFS Redirect Candidate',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='legacy duplicate',
            prompt='test',
            expected_answer='queue',
            order_index=0,
        )

        response = self.client.get(reverse('challenge-detail', args=[duplicate.slug]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('challenge-detail', args=[canonical.slug]))

    def test_solved_ids_use_preferred_variant_for_legacy_progress_rows(self):
        user = User.objects.create_user(username='legacy_progress_user', password='StrongPass123!')
        self.client.force_login(user)

        canonical = Challenge.objects.filter(
            topic=self.graph_topic,
            algorithm_type=Challenge.AlgorithmType.BFS,
            order_index=0,
        ).first()
        self.assertIsNotNone(canonical)

        duplicate = Challenge.objects.create(
            title='Legacy BFS Solved Duplicate',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='legacy solved duplicate',
            prompt='test',
            expected_answer='queue',
            order_index=0,
        )
        UserChallengeProg.objects.create(
            user=user,
            challenge=duplicate,
            is_solved=True,
            is_unlocked=True,
        )

        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'trees_graphs', 'subtype': 'bfs'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(canonical.id, response.context['solved_ids'])
        self.assertIn(canonical.id, response.context['unlocked_ids'])

    def test_alias_compatibility(self):
        alias_cases = [
            ('advance_dsa', 'advanced_dsa'),
            ('dynamic_programmin', 'dynamic_programming'),
            ('bit_conversion', 'bit_manipulation'),
        ]
        for alias, canonical in alias_cases:
            with self.subTest(alias=alias, canonical=canonical):
                alias_response = self.client.get(reverse('challenges-list'), {'category': alias})
                canonical_response = self.client.get(reverse('challenges-list'), {'category': canonical})
                self.assertEqual(alias_response.status_code, 200)
                self.assertEqual(canonical_response.status_code, 200)
                alias_ids = {challenge.id for challenge in alias_response.context['challenges']}
                canonical_ids = {challenge.id for challenge in canonical_response.context['challenges']}
                self.assertEqual(alias_ids, canonical_ids)

    def test_ui_uses_friendly_category_labels_without_key_changes(self):
        response = self.client.get(
            reverse('challenges-list'),
            {'category': 'ai_ml', 'subtype': 'decision_tree'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<span class="badge badge-accent">AI/ML</span>', html=True)
        self.assertNotContains(response, '<span class="badge badge-accent">ai_ml</span>', html=True)
        self.assertContains(response, 'data-category="ai_ml"')

    def test_performance_sanity_for_challenge_list(self):
        start = time.perf_counter()
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(reverse('challenges-list'))
        elapsed = time.perf_counter() - start
        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(len(ctx.captured_queries), 7)
        self.assertLess(elapsed, 3.0)


class AlgorithmTypeCoverageTests(TestCase):
    def test_algorithm_type_maps_cover_all_enum_values(self):
        algorithm_types = {choice[0] for choice in Challenge.AlgorithmType.choices}
        self.assertEqual(algorithm_types, set(Challenge.ALGORITHM_CATEGORY_MAP.keys()))
        self.assertEqual(algorithm_types, set(ALGORITHM_TYPE_FILTER_MAP.keys()))

    def test_algorithm_type_category_matching_is_consistent(self):
        algorithm_types = {choice[0] for choice in Challenge.AlgorithmType.choices}
        targets = {
            'linked_list',
            'stack',
            'queue',
            'graph',
            'sorting',
            'searching',
            'ai_ml',
            'tree',
            'dynamic_programming',
            'greedy',
            'trees_dp_greedy',
        }

        for algorithm_type in algorithm_types:
            challenge = Challenge(
                title='Type Coverage',
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                algorithm_type=algorithm_type,
                difficulty=Challenge.Difficulty.EASY,
                description='Coverage case',
                prompt='Coverage prompt',
            )
            expected_keys = set(ALGORITHM_TYPE_FILTER_MAP[algorithm_type])
            if challenge.algorithm_category:
                expected_keys.add(challenge.algorithm_category)

            for target in targets:
                with self.subTest(algorithm_type=algorithm_type, target=target):
                    if target == 'trees_dp_greedy':
                        should_match = bool(
                            expected_keys.intersection({'trees_dp_greedy', 'tree', 'dynamic_programming', 'greedy'})
                        )
                    else:
                        should_match = target in expected_keys
                    self.assertEqual(_matches_selected_category(challenge, target), should_match)


class FilterPersistenceTests(TestCase):
    def setUp(self):
        Challenge.objects.create(
            title='Easy Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            expected_answer='a',
        )
        Challenge.objects.create(
            title='Hard Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.HARD,
            description='test',
            prompt='test',
            expected_answer='b',
        )
    
    def test_filter_params_persist_after_reset(self):
        """Test that current filter params persist in context and quick-filter input."""
        response = self.client.get(reverse('challenges-list'), {'difficulty': 'easy', 'search': 'Easy'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['selected_difficulty'], 'easy')
        self.assertEqual(response.context['search_query'], 'Easy')
        self.assertContains(response, 'id="quickFilterSearchInput"')
        self.assertContains(response, 'value=""')
        self.assertEqual(len(response.context['challenges']), 1)
        self.assertContains(response, 'BFS')
    
    def test_search_filter_persistence(self):
        """Test that search query persists in input field."""
        response = self.client.get(reverse('challenges-list'), {'search': 'Easy'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['search_query'], 'Easy')
        self.assertContains(response, 'id="quickFilterSearchInput"')
        self.assertContains(response, 'value=""')


class ProgressPanelStructureTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='progress_user', password='Pass123!')
        self.topic = Topic.objects.create(
            stable_id='progress_topic',
            label='Progress Topic',
            category=Topic.Category.DSA_CORE,
            description='progress topic',
        )
        self.easy = Challenge.objects.create(
            title='Progress Easy',
            topic=self.topic,
            order_index=0,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='easy',
            prompt='easy prompt',
            expected_answer='easy',
        )
        self.medium = Challenge.objects.create(
            title='Progress Medium',
            topic=self.topic,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.DFS,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='medium',
            prompt='medium prompt',
            expected_answer='medium',
        )
        self.hard = Challenge.objects.create(
            title='Progress Hard',
            topic=self.topic,
            order_index=2,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.ASTAR,
            difficulty=Challenge.Difficulty.HARD,
            description='hard',
            prompt='hard prompt',
            expected_answer='hard',
        )
        UserChallengeProg.objects.create(user=self.user, challenge=self.easy, is_solved=True, is_unlocked=True)
        UserChallengeProg.objects.create(user=self.user, challenge=self.hard, is_solved=True, is_unlocked=True)

    def test_progress_panel_shows_overall_and_difficulty_only(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Overall')
        self.assertContains(response, 'By Difficulty')
        self.assertNotContains(response, 'By Topic')
        self.assertNotIn('by_topic', response.context['user_progress'])
        self.assertEqual(response.context['user_progress']['total_solved'], 2)
        self.assertEqual(response.context['user_progress']['total_challenges'], 3)
        by_diff = response.context['user_progress']['by_difficulty']
        self.assertEqual(by_diff['easy']['solved'], 1)
        self.assertEqual(by_diff['medium']['solved'], 0)
        self.assertEqual(by_diff['hard']['solved'], 1)


class SolvedUnlockedBadgesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='badgeuser', password='Pass123!')
        self.topic = Topic.objects.create(
            stable_id='test_topic',
            label='Test Topic',
            category=Topic.Category.DSA_CORE,
            description='test',
        )
        self.challenge1 = Challenge.objects.create(
            title='Challenge 1',
            topic=self.topic,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            expected_answer='ans1',
        )
        self.challenge2 = Challenge.objects.create(
            title='Challenge 2',
            topic=self.topic,
            order_index=2,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            expected_answer='ans2',
        )
    
    def test_solved_badge_visible_for_solved_challenges(self):
        """Test that solved challenges show solved badge."""
        # Mark challenge as solved
        prog = UserChallengeProg.objects.create(
            user=self.user,
            challenge=self.challenge1,
            is_solved=True,
            is_unlocked=True,
        )
        
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        # Response should include solved_ids in context
        self.assertIn(self.challenge1.id, response.context['solved_ids'])
    
    def test_unlocked_badge_visible_for_unlocked_challenges(self):
        """Test that unlocked challenges show unlocked badge."""
        prog = UserChallengeProg.objects.create(
            user=self.user,
            challenge=self.challenge1,
            is_solved=False,
            is_unlocked=True,
        )
        
        self.client.force_login(self.user)
        response = self.client.get(reverse('challenges-list'))
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.challenge1.id, response.context['unlocked_ids'])


class SubmitBehaviorTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='submitter', password='Pass123!')
        self.topic = Topic.objects.create(
            stable_id='submit_topic',
            label='Submit Topic',
            category=Topic.Category.DSA_CORE,
            description='test',
        )
        self.challenge1 = Challenge.objects.create(
            title='Submit Challenge 1',
            topic=self.topic,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            expected_answer='correct_answer',
            xp_reward=100,
            max_score=100,
        )
        self.challenge2 = Challenge.objects.create(
            title='Submit Challenge 2',
            topic=self.topic,
            order_index=2,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            expected_answer='another_answer',
            xp_reward=100,
            max_score=100,
        )
        # Auto-unlock first challenge
        UserChallengeProg.objects.create(
            user=self.user,
            challenge=self.challenge1,
            is_unlocked=True,
        )
    
    def test_submit_incorrect_shows_try_again_message(self):
        """Test that incorrect answers show 'Try again' message."""
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge1.slug]),
            {'answer': 'wrong_answer'},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data['is_correct'])
        self.assertEqual(data['message'], 'Try again')
    
    def test_submit_correct_returns_next_challenge_url(self):
        """Test that correct answers include next_challenge_url."""
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge1.slug]),
            {'answer': 'CORRECT_ANSWER'},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['is_correct'])
        self.assertIn('next_challenge_url', data)
        self.assertIn('next_round_index', data)
        self.assertIn('total_rounds_in_topic', data)
        self.assertIn(self.challenge2.slug, data['next_challenge_url'])
    
    def test_submit_correct_creates_completion_message(self):
        """Test that correct submission shows round completion message."""
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge1.slug]),
            {'answer': 'correct_answer'},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['is_correct'])
        self.assertIn('Round', data['message'])
        self.assertIn('completed', data['message'])
    
    def test_submit_unlocks_next_challenge(self):
        """Test that solving a challenge unlocks the next one."""
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge1.slug]),
            {'answer': 'correct_answer'},
        )
        self.assertEqual(response.status_code, 200)
        
        # Check that next challenge is now unlocked
        prog = UserChallengeProg.objects.get(user=self.user, challenge=self.challenge2)
        self.assertTrue(prog.is_unlocked)
        self.assertTrue(UserChallengeProg.objects.get(
            user=self.user, challenge=self.challenge1
        ).is_solved)


class HintDrivenScoringTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='hint_user', password='Pass123!')
        self.topic = Topic.objects.create(
            stable_id='hint_topic',
            label='Hint Topic',
            category=Topic.Category.DSA_CORE,
            description='hint test topic',
        )
        self.challenge = Challenge.objects.create(
            title='Hinted Challenge',
            topic=self.topic,
            order_index=0,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='hint challenge',
            prompt='Explain BFS frontier order',
            expected_answer='queue',
            starter_code='Use FIFO queue behavior.',
            xp_reward=100,
            max_score=100,
        )

    def test_hint_endpoint_returns_single_hint_and_marks_usage(self):
        self.client.force_login(self.user)
        response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['hint_used'])
        self.assertEqual(payload['hint'], 'Use FIFO queue behavior.')

        prog = UserChallengeProg.objects.get(user=self.user, challenge=self.challenge)
        self.assertTrue(prog.hint_used)

    def test_first_correct_attempt_without_hint_gets_full_points(self):
        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'queue'},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['is_score_eligible'])
        self.assertEqual(payload['attempt_index'], 1)
        self.assertEqual(payload['score'], 100)
        self.assertEqual(payload['xp_gained'], 100)

        attempt = ChallengeAttempt.objects.get(user=self.user, challenge=self.challenge, attempt_index=1)
        self.assertFalse(attempt.hint_used)
        self.assertTrue(attempt.is_score_eligible)

    def test_first_correct_attempt_with_hint_applies_75_percent_reduction(self):
        self.client.force_login(self.user)
        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 200)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'queue'},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['attempt_index'], 1)
        self.assertTrue(payload['hint_used'])
        self.assertEqual(payload['score'], 25)
        self.assertEqual(payload['xp_gained'], 25)

        attempt = ChallengeAttempt.objects.get(user=self.user, challenge=self.challenge, attempt_index=1)
        self.assertTrue(attempt.hint_used)
        self.assertTrue(attempt.is_score_eligible)

    def test_correct_after_manual_failure_and_then_hint_gets_reduced_points(self):
        self.client.force_login(self.user)
        wrong = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'wrong'},
        )
        self.assertEqual(wrong.status_code, 200)
        self.assertEqual(wrong.json()['score'], 0)

        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 200)

        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'queue'},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['attempt_index'], 2)
        self.assertTrue(payload['hint_used'])
        self.assertTrue(payload['is_score_eligible'])
        self.assertEqual(payload['score'], 25)
        self.assertEqual(payload['xp_gained'], 25)

    def test_second_attempt_without_hint_can_still_get_full_points(self):
        self.client.force_login(self.user)
        first = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'wrong'},
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()['score'], 0)

        second = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'queue'},
        )
        self.assertEqual(second.status_code, 200)
        payload = second.json()
        self.assertEqual(payload['attempt_index'], 2)
        self.assertTrue(payload['is_score_eligible'])
        self.assertEqual(payload['score'], 100)
        self.assertEqual(payload['xp_gained'], 100)

        attempt = ChallengeAttempt.objects.get(user=self.user, challenge=self.challenge, attempt_index=2)
        self.assertTrue(attempt.is_score_eligible)

    def test_hint_remains_available_after_wrong_manual_attempt(self):
        self.client.force_login(self.user)
        submit = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'wrong'},
        )
        self.assertEqual(submit.status_code, 200)

        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 200)
        self.assertTrue(hint_response.json()['hint_used'])

    def test_repeat_correct_submission_after_solving_awards_no_additional_points(self):
        self.client.force_login(self.user)
        first = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'queue'},
        )
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()['score'], 100)

        second = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'queue'},
        )
        self.assertEqual(second.status_code, 200)
        payload = second.json()
        self.assertEqual(payload['attempt_index'], 2)
        self.assertFalse(payload['is_score_eligible'])
        self.assertEqual(payload['score'], 0)
        self.assertEqual(payload['xp_gained'], 0)

    def test_hint_button_is_disabled_after_hint_is_used(self):
        self.client.force_login(self.user)
        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 200)

        detail = self.client.get(reverse('challenge-detail', args=[self.challenge.slug]))
        self.assertEqual(detail.status_code, 200)
        self.assertContains(detail, 'id="hintBtn"')
        self.assertTrue(detail.context['hint_used'])
        self.assertFalse(detail.context['can_use_hint'])

    def test_hint_button_stays_enabled_after_wrong_manual_attempt(self):
        self.client.force_login(self.user)
        submit = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'wrong'},
        )
        self.assertEqual(submit.status_code, 200)

        detail = self.client.get(reverse('challenge-detail', args=[self.challenge.slug]))
        self.assertEqual(detail.status_code, 200)
        self.assertFalse(detail.context['hint_used'])
        self.assertTrue(detail.context['can_use_hint'])

    def test_challenge_detail_renders_prompt_with_line_break_support(self):
        response = self.client.get(reverse('challenge-detail', args=[self.challenge.slug]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Explain BFS frontier order')


class BattleLobbyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='battle_player', password='Pass123!')
        self.topic = Topic.objects.create(
            stable_id='battle_test',
            label='Battle Test Topic',
            category=Topic.Category.DSA_CORE,
            description='test',
            visualization_type='graph',
        )
        # Create challenges with difficulty distribution
        for i in range(3):
            Challenge.objects.create(
                title=f'Easy Battle Challenge {i}',
                topic=self.topic,
                order_index=i,
                difficulty=Challenge.Difficulty.EASY,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                description='test',
                prompt='test',
                expected_answer=f'ans{i}',
            )
        for i in range(3):
            Challenge.objects.create(
                title=f'Medium Battle Challenge {i}',
                topic=self.topic,
                order_index=3+i,
                difficulty=Challenge.Difficulty.MEDIUM,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                description='test',
                prompt='test',
                expected_answer=f'ans{3+i}',
            )
    
    def test_battle_lobby_shows_topic_cards(self):
        """Test that battle lobby displays topic cards."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('battle-lobby'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('topic_data', response.context)
        self.assertGreater(len(response.context['topic_data']), 0)
    
    def test_battle_lobby_shows_difficulty_distribution(self):
        """Test that topic cards show difficulty distribution."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('battle-lobby'))
        self.assertEqual(response.status_code, 200)
        topic_data = response.context['topic_data']
        self.assertTrue(any(
            item['topic'].stable_id == 'battle_test' for item in topic_data
        ))
        battle_topic = next(
            item for item in topic_data if item['topic'].stable_id == 'battle_test'
        )
        self.assertEqual(battle_topic['difficulty_distribution']['easy'], 3)
        self.assertEqual(battle_topic['difficulty_distribution']['medium'], 3)
    
    def test_battle_lobby_shows_challenge_count(self):
        """Test that topic cards show challenge count."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('battle-lobby'))
        topic_data = response.context['topic_data']
        battle_topic = next(
            item for item in topic_data if item['topic'].stable_id == 'battle_test'
        )
        self.assertEqual(battle_topic['challenge_count'], 6)


class BattleLiveContextTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='live_player', password='Pass123!')
        self.other_user = User.objects.create_user(username='other_player', password='Pass123!')
        
        from battle.models import BattleMatch
        self.match = BattleMatch.objects.create(
            player_one=self.user,
            player_two=self.other_user,
            status=BattleMatch.Status.LIVE,
        )
        
        self.topic = Topic.objects.create(
            stable_id='live_test',
            label='Live Test Topic',
            category=Topic.Category.DSA_CORE,
            description='test',
        )
        self.challenge = Challenge.objects.create(
            title='Live Battle Challenge',
            topic=self.topic,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            difficulty=Challenge.Difficulty.EASY,
            description='test',
            prompt='test',
            expected_answer='answer',
        )
    
    def test_battle_live_view_has_challenge(self):
        """Test that battle live view always provides a challenge."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('battle-live', args=[self.match.room_code]))
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context['challenge'])
    
    def test_battle_live_view_has_submit_form(self):
        """Test that battle live view has a submit form."""
        self.client.force_login(self.user)
        response = self.client.get(reverse('battle-live', args=[self.match.room_code]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'attemptForm')
        self.assertContains(response, 'Submit')

    def test_submit_attempt_from_live_battle_returns_score_token(self):
        from battle.models import BattleMatch

        self.match.challenge = self.challenge
        self.match.status = BattleMatch.Status.LIVE
        self.match.save(update_fields=['challenge', 'status'])
        UserChallengeProg.objects.update_or_create(
            user=self.user,
            challenge=self.challenge,
            defaults={'is_unlocked': True},
        )

        self.client.force_login(self.user)
        response = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {
                'answer': 'answer',
                'battle_room_code': self.match.room_code,
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['is_correct'])
        self.assertIn('battle_score_token', payload)
