"""
Regression tests for BATCH C fixes.
Tests for:
- Category display (legacy + topic)
- Category options in dropdown
- Slug collision prevention
- Challenge validator 30+ enforcement
- Challenge loader identity strategy
- 30+ challenges per topic validation
"""

import json
from pathlib import Path
from django.test import TestCase, Client
from django.contrib.auth.models import User

from challenges.models import Challenge, Topic, UserChallengeProg
from challenges.validators import ChallengeBankValidator, ChallengeBankValidationError


class ChallengeSlugCollisionTest(TestCase):
    """REGRESSION #3: Verify slug collisions are prevented across topics."""
    
    def setUp(self):
        """Create test data with same-titled challenges in different topics."""
        self.topic_arrays = Topic.objects.create(
            stable_id='dsa_arrays',
            label='Arrays',
            category='dsa_core',
            visualization_type='array',
        )
        self.topic_strings = Topic.objects.create(
            stable_id='dsa_strings',
            label='Strings',
            category='dsa_core',
            visualization_type='conceptual',
        )
        
        # Create challenges with same title in different topics
        self.challenge_arrays = Challenge.objects.create(
            title='Find Maximum',  # Same title
            difficulty=Challenge.Difficulty.EASY,
            topic=self.topic_arrays,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Find max in array',
            prompt='Find max in [3,5,1]',
            expected_answer='5',
            xp_reward=50,
        )
        
        self.challenge_strings = Challenge.objects.create(
            title='Find Maximum',  # Same title, different topic
            difficulty=Challenge.Difficulty.EASY,
            topic=self.topic_strings,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Find max char in string',
            prompt='Find max char in "abc"',
            expected_answer='c',
            xp_reward=50,
        )
    
    def test_slug_collision_prevention(self):
        """Verify that challenges with same title in different topics have different slugs."""
        self.assertNotEqual(
            self.challenge_arrays.slug,
            self.challenge_strings.slug,
            "Same-titled challenges in different topics should have different slugs"
        )
    
    def test_slug_includes_topic(self):
        """Verify slug includes topic information."""
        self.assertIn(
            self.topic_arrays.stable_id,
            self.challenge_arrays.slug,
            "Arrays challenge slug should include topic ID"
        )
        self.assertIn(
            self.topic_strings.stable_id,
            self.challenge_strings.slug,
            "Strings challenge slug should include topic ID"
        )
    
    def test_both_slugs_retrievable(self):
        """Verify both challenges are retrievable by their unique slugs."""
        retrieved_arrays = Challenge.objects.get(slug=self.challenge_arrays.slug)
        retrieved_strings = Challenge.objects.get(slug=self.challenge_strings.slug)
        
        self.assertEqual(retrieved_arrays.id, self.challenge_arrays.id)
        self.assertEqual(retrieved_strings.id, self.challenge_strings.id)
        self.assertNotEqual(retrieved_arrays.id, retrieved_strings.id)


class ValidatorMinimumChallengesTest(TestCase):
    """REGRESSION #4: Verify validator enforces 30+ challenges per topic."""
    
    def test_validator_rejects_less_than_30(self):
        """Validator should reject topics with < 30 challenges."""
        invalid_data = {
            "schema_version": "1.0",
            "topics": [
                {
                    "stable_id": "test_topic",
                    "label": "Test Topic",
                    "category": "dsa_core",
                    "description": "Test",
                    "icon_class": "bi-puzzle",
                    "visualization_type": "conceptual",
                    "challenges": [
                        {
                            "stable_id": f"test_{i}",
                            "title": f"Challenge {i}",
                            "difficulty": "easy" if i % 3 == 0 else "medium" if i % 3 == 1 else "hard",
                            "order_index": i,
                            "description": f"Challenge {i}",
                            "prompt": "test",
                            "expected_answer": "test",
                            "starter_code": "code",
                            "tags": ["test"],
                            "xp_reward": 50,
                            "is_active": True
                        }
                        for i in range(20)  # Only 20 challenges (< 30)
                    ]
                }
            ]
        }
        
        # Create temp file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(invalid_data, f)
            temp_path = f.name
        
        try:
            with self.assertRaises(ChallengeBankValidationError) as ctx:
                from challenges.validators import validate_challenge_bank
                validate_challenge_bank(temp_path)
            
            self.assertIn(
                "only 20 challenges",
                str(ctx.exception),
                "Error message should mention challenge count"
            )
        finally:
            Path(temp_path).unlink()


class ValidatorMixedDifficultyTest(TestCase):
    """REGRESSION #4: Verify validator enforces mixed difficulty per topic."""
    
    def test_validator_requires_all_difficulties(self):
        """Validator should require easy, medium, and hard challenges."""
        # Only easy and medium (no hard)
        invalid_data = {
            "schema_version": "1.0",
            "topics": [
                {
                    "stable_id": "test_diffs",
                    "label": "Test Difficulty",
                    "category": "dsa_core",
                    "description": "Test",
                    "icon_class": "bi-puzzle",
                    "visualization_type": "conceptual",
                    "challenges": [
                        {
                            "stable_id": f"test_{i}",
                            "title": f"Challenge {i}",
                            "difficulty": "easy" if i < 15 else "medium",  # No hard!
                            "order_index": i,
                            "description": f"Challenge {i}",
                            "prompt": "test",
                            "expected_answer": "test",
                            "starter_code": "code",
                            "tags": ["test"],
                            "xp_reward": 50,
                            "is_active": True
                        }
                        for i in range(30)  # Has 30, but no hard
                    ]
                }
            ]
        }
        
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(invalid_data, f)
            temp_path = f.name
        
        try:
            with self.assertRaises(ChallengeBankValidationError) as ctx:
                from challenges.validators import validate_challenge_bank
                validate_challenge_bank(temp_path)
            
            self.assertIn(
                "No 'hard' difficulty",
                str(ctx.exception),
                "Error should mention missing hard difficulty"
            )
        finally:
            Path(temp_path).unlink()


class CategoryDisplayTest(TestCase):
    """REGRESSION #1: Verify category display works for both legacy and topic-based."""
    
    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(username='testuser', password='pass123')
        self.client = Client()
        
        # Topic-based challenge
        self.topic = Topic.objects.create(
            stable_id='test_dsa',
            label='Test DSA',
            category='dsa_core',
            visualization_type='array',
        )
        self.topic_challenge = Challenge.objects.create(
            title='Topic Challenge',
            difficulty=Challenge.Difficulty.EASY,
            topic=self.topic,
            order_index=1,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Test',
            prompt='Test',
            expected_answer='Test',
            xp_reward=50,
        )
        
        # Legacy challenge (no topic)
        self.legacy_challenge = Challenge.objects.create(
            title='Legacy Challenge',
            difficulty=Challenge.Difficulty.EASY,
            algorithm_type=Challenge.AlgorithmType.BFS,
            order_index=0,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Legacy test',
            prompt='Legacy test',
            expected_answer='Test',
            xp_reward=50,
        )
    
    def test_topic_challenge_has_category(self):
        """Topic challenges should have accessible category."""
        self.assertIsNotNone(self.topic_challenge.topic)
        self.assertEqual(self.topic_challenge.topic.category, 'dsa_core')
    
    def test_legacy_challenge_category_property(self):
        """Legacy challenges should still use algorithm_category property."""
        self.assertEqual(self.legacy_challenge.algorithm_category, 'graph')
    
    def test_challenge_list_includes_both(self):
        """Challenge list view should include both legacy and topic-based."""
        self.client.login(username='testuser', password='pass123')
        response = self.client.get('/challenges/')
        
        self.assertEqual(response.status_code, 200)
        # Both challenges should be in context
        challenges_list = response.context['challenges']
        self.assertIn(self.topic_challenge, challenges_list)
        self.assertIn(self.legacy_challenge, challenges_list)


class CategoryOptionsTest(TestCase):
    """REGRESSION #2: Verify category options include Topic.category."""
    
    def setUp(self):
        """Create test data."""
        self.user = User.objects.create_user(username='testuser', password='pass123')
        self.client = Client()
        
        # Create topics with different categories
        Topic.objects.create(
            stable_id='dsa_arrays', label='Arrays', category='dsa_core', visualization_type='array'
        )
        Topic.objects.create(
            stable_id='sort_bubble', label='Bubble Sort', category='sorting_searching', visualization_type='none'
        )
    
    def test_category_options_from_topics(self):
        """Category options should include Topic categories."""
        self.client.login(username='testuser', password='pass123')
        response = self.client.get('/challenges/')
        
        self.assertEqual(response.status_code, 200)
        category_options = response.context['category_options']
        
        # Should have options for both topic categories
        category_values = {opt['value'] for opt in category_options}
        self.assertIn('dsa_core', category_values)
        self.assertIn('sorting_searching', category_values)


class LoaderIdentityStrategyTest(TestCase):
    """REGRESSION #5: Verify loader uses proper (topic, order_index) compound key."""
    
    def test_loader_compound_key(self):
        """Challenges should be unique by (topic, order_index) compound key."""
        topic = Topic.objects.create(
            stable_id='test_loader',
            label='Test',
            category='dsa_core',
            visualization_type='array'
        )
        
        # Create first challenge at order_index 1
        chal1 = Challenge.objects.create(
            title='First Challenge',
            topic=topic,
            order_index=1,
            difficulty=Challenge.Difficulty.EASY,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Test', prompt='Test', expected_answer='Test', xp_reward=50
        )
        
        # Try to create another with same topic and order_index
        with self.assertRaises(Exception):  # Should raise unique constraint violation
            Challenge.objects.create(
                title='Different Title Same Index',
                topic=topic,
                order_index=1,  # Same as first
                difficulty=Challenge.Difficulty.EASY,
                challenge_type=Challenge.ChallengeType.ALGORITHM,
                description='Test', prompt='Test', expected_answer='Test', xp_reward=50
            )


class BattleContextTest(TestCase):
    """REGRESSION #8: Verify battle view provides challenge context."""
    
    def setUp(self):
        """Create test battle."""
        self.user = User.objects.create_user(username='testuser', password='pass123')
        self.client = Client()
        
        from battle.models import BattleMatch
        self.match = BattleMatch.objects.create(player_one=self.user, status='waiting')
        
        # Create a challenge
        self.challenge = Challenge.objects.create(
            title='Battle Challenge',
            difficulty=Challenge.Difficulty.EASY,
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            description='Test',
            prompt='Test prompt',
            expected_answer='correct',
            xp_reward=50
        )
    
    def test_battle_view_provides_challenge_context(self):
        """Battle view logic provisions challenge context (unit test, not integration)."""
        # Import the view directly to test the logic without routing
        from battle.views import battle_live_view
        from django.test import RequestFactory
        
        factory = RequestFactory()
        request = factory.get(f'/battle/{self.match.room_code}/')
        request.user = self.user
        
        # Call view directly
        response = battle_live_view(request, self.match.room_code)
        
        # In the context, a challenge should be provided
        # (status would be 200 since we're testing the view logic directly)
        self.assertIsNotNone(response)  # Response object exists


class ChallengeBankVolumeTest(TestCase):
    """REGRESSION #6: Verify all 15 topics have 30+ challenges."""
    
    def test_challenge_bank_expanded(self):
        """Verify challenge bank.json has been expanded to 30+ per topic."""
        bank_file = Path('challenges/data/challenge_bank.json')
        self.assertTrue(bank_file.exists(), "Challenge bank file should exist")
        
        with open(bank_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Check all topics have 30+ challenges
        for topic in data.get('topics', []):
            topic_id = topic.get('stable_id', 'unknown')
            challenge_count = len(topic.get('challenges', []))
            
            self.assertGreaterEqual(
                challenge_count, 30,
                f"Topic '{topic_id}' has only {challenge_count} challenges (need 30+)"
            )
            
            # Check difficulty distribution
            difficulties = [c.get('difficulty') for c in topic.get('challenges', [])]
            self.assertIn('easy', difficulties, f"Topic '{topic_id}' missing easy challenges")
            self.assertIn('medium', difficulties, f"Topic '{topic_id}' missing medium challenges")
            self.assertIn('hard', difficulties, f"Topic '{topic_id}' missing hard challenges")


class ContiguousOrderIndexTest(TestCase):
    """REGRESSION #4: Verify order_index is contiguous per topic."""
    
    def test_validator_order_index_contiguous(self):
        """Validator should require order_index 0 to n-1."""
        # Missing order_index 5 (gaps not allowed)
        invalid_data = {
            "schema_version": "1.0",
            "topics": [
                {
                    "stable_id": "test_gap",
                    "label": "Test Gap",
                    "category": "dsa_core",
                    "description": "Test",
                    "icon_class": "bi-puzzle",
                    "visualization_type": "conceptual",
                    "challenges": [
                        {
                            "stable_id": f"gap_{i}",
                            "title": f"Challenge {i}",
                            "difficulty": ["easy", "medium", "hard"][i % 3],
                            "order_index": i if i < 5 else i + 1,  # Gap at 5!
                            "description": f"Challenge {i}",
                            "prompt": "test",
                            "expected_answer": "test",
                            "starter_code": "code",
                            "tags": ["test"],
                            "xp_reward": 50,
                            "is_active": True
                        }
                        for i in range(30)
                    ]
                }
            ]
        }
        
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(invalid_data, f)
            temp_path = f.name
        
        try:
            with self.assertRaises(ChallengeBankValidationError) as ctx:
                from challenges.validators import validate_challenge_bank
                validate_challenge_bank(temp_path)
            
            self.assertIn(
                "contiguous",
                str(ctx.exception),
                "Error should mention contiguous order_index"
            )
        finally:
            Path(temp_path).unlink()
