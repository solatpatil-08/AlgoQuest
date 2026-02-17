"""Schema validation and integrity checks for challenge_bank.json"""
import json
from pathlib import Path
from typing import Dict, List, Set, Tuple


class ChallengeBankValidationError(Exception):
    """Raised when challenge bank schema validation fails."""
    pass


class ChallengeBankValidator:
    """Validates challenge bank JSON structure and content."""

    REQUIRED_TOP_LEVEL_KEYS = {'schema_version', 'topics'}
    REQUIRED_TOPIC_KEYS = {'stable_id', 'label', 'category', 'description', 'icon_class', 'visualization_type', 'challenges'}
    REQUIRED_CHALLENGE_KEYS = {'stable_id', 'title', 'difficulty', 'order_index', 'description', 'prompt', 'expected_answer', 'starter_code', 'tags', 'xp_reward', 'is_active'}

    VALID_CATEGORIES = {
        'dsa_core', 'sorting_searching', 'trees_graphs', 'advanced_dsa', 'ai_ml'
    }
    VALID_DIFFICULTIES = {'easy', 'medium', 'hard'}
    VALID_VISUALIZATIONS = {
        'array', 'graph', 'tree', 'grid', 'matrix', 'conceptual', 'none'
    }

    @classmethod
    def validate_file(cls, file_path: str) -> Tuple[bool, List[str]]:
        """
        Validate challenge bank JSON file.
        
        Returns:
            Tuple[bool, List[str]]: (is_valid, list_of_errors)
        """
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            return False, [f"Challenge bank file not found: {file_path}"]
        except json.JSONDecodeError as e:
            return False, [f"Invalid JSON format: {str(e)}"]
        
        # Validate top-level structure
        errors.extend(cls._validate_top_level(data))
        if not data.get('topics'):
            return False, errors + ["No topics found in challenge bank"]
        
        # Track IDs for duplicates
        seen_topic_ids: Set[str] = set()
        seen_challenge_ids: Set[str] = set()
        
        # Validate each topic
        for topic_idx, topic in enumerate(data.get('topics', [])):
            topic_errors = cls._validate_topic(topic, topic_idx)
            errors.extend(topic_errors)
            
            # Check for duplicate topic IDs
            topic_id = topic.get('stable_id', '')
            if topic_id in seen_topic_ids:
                errors.append(f"Duplicate topic stable_id: {topic_id}")
            if topic_id:
                seen_topic_ids.add(topic_id)
            
            # Validate challenges within topic
            topic_challenges_errors = cls._validate_topic_challenges(topic, topic_idx)
            errors.extend(topic_challenges_errors)
            
            for chal_idx, challenge in enumerate(topic.get('challenges', [])):
                chal_errors = cls._validate_challenge(challenge, topic_idx, chal_idx)
                errors.extend(chal_errors)
                
                # Check for duplicate challenge IDs
                chal_id = challenge.get('stable_id', '')
                if chal_id in seen_challenge_ids:
                    errors.append(f"Duplicate challenge stable_id: {chal_id}")
                if chal_id:
                    seen_challenge_ids.add(chal_id)
        
        return len(errors) == 0, errors

    @classmethod
    def _validate_top_level(cls, data: Dict) -> List[str]:
        """Validate top-level structure."""
        errors = []
        
        missing_keys = cls.REQUIRED_TOP_LEVEL_KEYS - set(data.keys())
        if missing_keys:
            errors.append(f"Missing required top-level keys: {missing_keys}")
        
        if data.get('schema_version') and not isinstance(data.get('schema_version'), str):
            errors.append("schema_version must be a string")
        
        if not isinstance(data.get('topics'), list):
            errors.append("topics must be a list")
        
        return errors

    @classmethod
    def _validate_topic(cls, topic: Dict, topic_idx: int) -> List[str]:
        """Validate individual topic structure."""
        errors = []
        prefix = f"Topic #{topic_idx}"
        
        # Check required keys
        missing_keys = cls.REQUIRED_TOPIC_KEYS - set(topic.keys())
        if missing_keys:
            errors.append(f"{prefix}: Missing required keys: {missing_keys}")
        
        # Validate stable_id
        stable_id = topic.get('stable_id', '')
        if not stable_id or not isinstance(stable_id, str):
            errors.append(f"{prefix}: stable_id must be non-empty string")
        elif not cls._is_valid_stable_id(stable_id):
            errors.append(f"{prefix}: stable_id '{stable_id}' has invalid format (use snake_case)")
        
        # Validate category
        category = topic.get('category', '')
        if category not in cls.VALID_CATEGORIES:
            errors.append(f"{prefix}: category '{category}' not in {cls.VALID_CATEGORIES}")
        
        # Validate visualization_type
        viz_type = topic.get('visualization_type', '')
        if viz_type not in cls.VALID_VISUALIZATIONS:
            errors.append(f"{prefix}: visualization_type '{viz_type}' not in {cls.VALID_VISUALIZATIONS}")
        
        # Validate challenges list
        if not isinstance(topic.get('challenges'), list):
            errors.append(f"{prefix}: challenges must be a list")
        elif len(topic.get('challenges', [])) == 0:
            errors.append(f"{prefix}: challenges list is empty")
        
        return errors

    @classmethod
    def _validate_topic_challenges(cls, topic: Dict, topic_idx: int) -> List[str]:
        """Validate challenges within a topic meet minimum requirements."""
        errors = []
        prefix = f"Topic #{topic_idx} ({topic.get('stable_id', 'unknown')})"
        challenges = topic.get('challenges', [])
        
        # Minimum 30 challenges per topic
        if len(challenges) < 30:
            errors.append(f"{prefix}: Has only {len(challenges)} challenges, minimum 30 required")
        
        # Check for mixed difficulty (easy, medium, hard)
        difficulties = [c.get('difficulty', '') for c in challenges]
        difficulty_counts = {'easy': 0, 'medium': 0, 'hard': 0}
        for d in difficulties:
            if d in difficulty_counts:
                difficulty_counts[d] += 1
        
        # Require at least 1 of each difficulty
        if difficulty_counts['easy'] == 0:
            errors.append(f"{prefix}: No 'easy' difficulty challenges found")
        if difficulty_counts['medium'] == 0:
            errors.append(f"{prefix}: No 'medium' difficulty challenges found")
        if difficulty_counts['hard'] == 0:
            errors.append(f"{prefix}: No 'hard' difficulty challenges found")
        
        # Validate monotonic and contiguous order_index (0 to len-1)
        order_indices = sorted([c.get('order_index', -1) for c in challenges])
        expected = list(range(len(challenges)))
        if order_indices != expected:
            errors.append(
                f"{prefix}: order_index must be contiguous from 0 to {len(challenges)-1}, "
                f"found {order_indices}"
            )
        
        return errors

    @classmethod
    def _validate_challenge(cls, challenge: Dict, topic_idx: int, chal_idx: int) -> List[str]:
        """Validate individual challenge structure."""
        errors = []
        prefix = f"Topic #{topic_idx}, Challenge #{chal_idx}"
        
        # Check required keys
        missing_keys = cls.REQUIRED_CHALLENGE_KEYS - set(challenge.keys())
        if missing_keys:
            errors.append(f"{prefix}: Missing required keys: {missing_keys}")
        
        # Validate stable_id
        stable_id = challenge.get('stable_id', '')
        if not stable_id or not isinstance(stable_id, str):
            errors.append(f"{prefix}: stable_id must be non-empty string")
        elif not cls._is_valid_stable_id(stable_id):
            errors.append(f"{prefix}: stable_id '{stable_id}' has invalid format")
        
        # Validate difficulty
        difficulty = challenge.get('difficulty', '')
        if difficulty not in cls.VALID_DIFFICULTIES:
            errors.append(f"{prefix}: difficulty '{difficulty}' not in {cls.VALID_DIFFICULTIES}")
        
        # Validate order_index
        order_idx = challenge.get('order_index')
        if not isinstance(order_idx, int) or order_idx < 0:
            errors.append(f"{prefix}: order_index must be non-negative integer")
        
        # Validate xp_reward
        xp = challenge.get('xp_reward')
        if not isinstance(xp, int) or xp < 0:
            errors.append(f"{prefix}: xp_reward must be non-negative integer")
        
        # Validate tags
        tags = challenge.get('tags')
        if not isinstance(tags, list):
            errors.append(f"{prefix}: tags must be a list of strings")
        
        # Validate title is not empty
        title = challenge.get('title', '')
        if not title or not isinstance(title, str):
            errors.append(f"{prefix}: title must be non-empty string")
        
        return errors

    @staticmethod
    def _is_valid_stable_id(stable_id: str) -> bool:
        """Check if stable_id follows naming conventions (snake_case)."""
        if not stable_id or not isinstance(stable_id, str):
            return False
        # Allow alphanumeric and underscore
        return all(c.isalnum() or c == '_' for c in stable_id) and stable_id[0].isalnum()


def validate_challenge_bank(file_path: str) -> Tuple[bool, List[str]]:
    """
    Public function to validate challenge bank.
    
    Args:
        file_path: Path to challenge_bank.json
    
    Returns:
        Tuple[bool, List[str]]: (is_valid, error_messages)
    
    Raises:
        ChallengeBankValidationError: If validation fails
    """
    is_valid, errors = ChallengeBankValidator.validate_file(file_path)
    
    if not is_valid:
        error_msg = "Challenge bank validation failed:\n" + "\n".join(f"  - {err}" for err in errors)
        raise ChallengeBankValidationError(error_msg)
    
    return is_valid, errors
