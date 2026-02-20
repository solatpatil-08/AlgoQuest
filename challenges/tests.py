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
        Challenge.objects.create(
            title='Graph Traversal BFS',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.BFS,
            difficulty=Challenge.Difficulty.EASY,
            description='desc',
            prompt='prompt',
            expected_answer='a b',
        )
        Challenge.objects.create(
            title='KMeans Cluster Challenge',
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type=Challenge.AlgorithmType.KMEANS,
            difficulty=Challenge.Difficulty.MEDIUM,
            description='desc',
            prompt='prompt',
            expected_answer='mean position',
        )

    def test_category_filter_only_returns_requested_category(self):
        response = self.client.get(reverse('challenges-list'), {'category': 'ai_ml'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'K-Means')
        self.assertNotContains(response, 'BFS')

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
        self.assertContains(response, 'value="Easy"')
        self.assertEqual(len(response.context['challenges']), 1)
        self.assertContains(response, 'BFS')
    
    def test_search_filter_persistence(self):
        """Test that search query persists in input field."""
        response = self.client.get(reverse('challenges-list'), {'search': 'Easy'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['search_query'], 'Easy')
        self.assertContains(response, 'id="quickFilterSearchInput"')
        self.assertContains(response, 'value="Easy"')


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


class HintAndFirstAttemptScoringTests(TestCase):
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

    def test_second_attempt_gets_zero_points_even_if_correct(self):
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
        self.assertFalse(payload['is_score_eligible'])
        self.assertEqual(payload['score'], 0)
        self.assertEqual(payload['xp_gained'], 0)

        attempt = ChallengeAttempt.objects.get(user=self.user, challenge=self.challenge, attempt_index=2)
        self.assertFalse(attempt.is_score_eligible)

    def test_hint_not_available_after_first_attempt(self):
        self.client.force_login(self.user)
        submit = self.client.post(
            reverse('challenge-submit', args=[self.challenge.slug]),
            {'answer': 'wrong'},
        )
        self.assertEqual(submit.status_code, 200)

        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 400)

    def test_hint_button_is_disabled_after_hint_is_used(self):
        self.client.force_login(self.user)
        hint_response = self.client.post(reverse('challenge-hint', args=[self.challenge.slug]))
        self.assertEqual(hint_response.status_code, 200)

        detail = self.client.get(reverse('challenge-detail', args=[self.challenge.slug]))
        self.assertEqual(detail.status_code, 200)
        self.assertContains(detail, 'id="hintBtn"')
        self.assertTrue(detail.context['hint_used'])
        self.assertFalse(detail.context['can_use_hint'])

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
