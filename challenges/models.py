from django.contrib.auth.models import User
from django.db import models
from django.utils.text import slugify


class Topic(models.Model):
    """Normalized algorithm/topic definition for scalable challenge bank."""

    class Category(models.TextChoices):
        DSA_CORE = 'dsa_core', 'DSA Core'
        SORTING_SEARCHING = 'sorting_searching', 'Sorting & Searching'
        TREES_GRAPHS = 'trees_graphs', 'Trees & Graphs'
        ADVANCED_DSA = 'advanced_dsa', 'Advanced DSA'
        AI_ML = 'ai_ml', 'AI/ML'

    stable_id = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=150)
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField()
    icon_class = models.CharField(max_length=50, default='bi-puzzle')
    visualization_type = models.CharField(
        max_length=20,
        choices=[
            ('array', 'Array'),
            ('graph', 'Graph'),
            ('tree', 'Tree'),
            ('grid', 'Grid'),
            ('matrix', 'Matrix'),
            ('conceptual', 'Conceptual'),
            ('none', 'None'),
        ],
        default='conceptual',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('category', 'label')

    def __str__(self):
        return f"{self.label} ({self.stable_id})"


class Challenge(models.Model):
    class ChallengeType(models.TextChoices):
        ALGORITHM = 'algorithm', 'Algorithm'
        QUIZ = 'quiz', 'Quiz'
        APTITUDE = 'aptitude', 'Placement Aptitude'

    class AlgorithmType(models.TextChoices):
        BFS = 'bfs', 'BFS'
        DFS = 'dfs', 'DFS'
        ASTAR = 'astar', 'A*'
        MINIMAX = 'minimax', 'Minimax'
        BUBBLE_SORT = 'bubble_sort', 'Bubble Sort'
        SELECTION_SORT = 'selection_sort', 'Selection Sort'
        INSERTION_SORT = 'insertion_sort', 'Insertion Sort'
        MERGE_SORT = 'merge_sort', 'Merge Sort'
        QUICK_SORT = 'quick_sort', 'Quick Sort'
        HEAP_SORT = 'heap_sort', 'Heap Sort'
        LINEAR_SEARCH = 'linear_search', 'Linear Search'
        BINARY_SEARCH = 'binary_search', 'Binary Search'
        DIJKSTRA = 'dijkstra', 'Dijkstra'
        BST = 'bst', 'Binary Search Tree'
        KNAPSACK = 'knapsack', 'Knapsack'
        LCS = 'lcs', 'Longest Common Subsequence'
        ACTIVITY_SELECTION = 'activity_selection', 'Activity Selection'
        LINEAR_REGRESSION = 'linear_regression', 'Linear Regression'
        LOGISTIC_REGRESSION = 'logistic_regression', 'Logistic Regression'
        KMEANS = 'kmeans', 'K-Means'
        KNN = 'knn', 'K-Nearest Neighbors'
        DECISION_TREE = 'decision_tree', 'Decision Tree'
        NAIVE_BAYES = 'naive_bayes', 'Naive Bayes'
        NEURAL_NETWORK = 'neural_network', 'Neural Network'

    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Easy'
        MEDIUM = 'medium', 'Medium'
        HARD = 'hard', 'Hard'

    title = models.CharField(max_length=150)
    slug = models.SlugField(unique=True, blank=True)
    challenge_type = models.CharField(max_length=20, choices=ChallengeType.choices)
    algorithm_type = models.CharField(
        max_length=20,
        choices=AlgorithmType.choices,
        blank=True,
        default='',
    )
    difficulty = models.CharField(max_length=10, choices=Difficulty.choices, default=Difficulty.EASY)
    description = models.TextField()
    prompt = models.TextField()
    starter_code = models.TextField(blank=True)
    expected_answer = models.CharField(max_length=255, blank=True)
    visualization_payload = models.JSONField(default=dict, blank=True)
    xp_reward = models.PositiveIntegerField(default=50)
    max_score = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # New fields for scaled challenge bank
    topic = models.ForeignKey(Topic, on_delete=models.SET_NULL, null=True, blank=True, related_name='challenges')
    order_index = models.PositiveIntegerField(default=0)
    is_visual_supported = models.BooleanField(default=False)

    ALGORITHM_CATEGORY_MAP = {
        AlgorithmType.BFS: 'graph',
        AlgorithmType.DFS: 'graph',
        AlgorithmType.ASTAR: 'graph',
        AlgorithmType.DIJKSTRA: 'graph',
        AlgorithmType.MINIMAX: 'graph',
        AlgorithmType.BUBBLE_SORT: 'sorting',
        AlgorithmType.SELECTION_SORT: 'sorting',
        AlgorithmType.INSERTION_SORT: 'sorting',
        AlgorithmType.MERGE_SORT: 'sorting',
        AlgorithmType.QUICK_SORT: 'sorting',
        AlgorithmType.HEAP_SORT: 'sorting',
        AlgorithmType.LINEAR_SEARCH: 'searching',
        AlgorithmType.BINARY_SEARCH: 'searching',
        AlgorithmType.BST: 'trees_dp_greedy',
        AlgorithmType.KNAPSACK: 'trees_dp_greedy',
        AlgorithmType.LCS: 'trees_dp_greedy',
        AlgorithmType.ACTIVITY_SELECTION: 'trees_dp_greedy',
        AlgorithmType.LINEAR_REGRESSION: 'ai_ml',
        AlgorithmType.LOGISTIC_REGRESSION: 'ai_ml',
        AlgorithmType.KMEANS: 'ai_ml',
        AlgorithmType.KNN: 'ai_ml',
        AlgorithmType.DECISION_TREE: 'ai_ml',
        AlgorithmType.NAIVE_BAYES: 'ai_ml',
        AlgorithmType.NEURAL_NETWORK: 'ai_ml',
    }

    ALGORITHM_CATEGORY_LABELS = {
        'graph': 'Graph/Traversal',
        'sorting': 'Sorting',
        'searching': 'Searching',
        'trees_dp_greedy': 'Trees/DP/Greedy',
        'ai_ml': 'AI/ML',
    }

    def save(self, *args, **kwargs):
        if not self.slug:
            # Include topic stable_id if available to avoid collisions across topics
            if self.topic and self.topic.stable_id:
                self.slug = slugify(f"{self.topic.stable_id}-{self.title}")
            else:
                self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

    @property
    def algorithm_category(self):
        if self.challenge_type != self.ChallengeType.ALGORITHM:
            return ''
        return self.ALGORITHM_CATEGORY_MAP.get(self.algorithm_type, 'general')

    @property
    def algorithm_category_display(self):
        category = self.algorithm_category
        if not category:
            return ''
        return self.ALGORITHM_CATEGORY_LABELS.get(category, 'General')

    class Meta:
        unique_together = ('topic', 'order_index')
        ordering = ('topic_id', 'order_index')


class ChallengeAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='challenge_attempts')
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='attempts')
    score = models.PositiveIntegerField(default=0)
    is_correct = models.BooleanField(default=False)
    submitted_answer = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"{self.user.username} - {self.challenge.title} ({self.score})"


class UserChallengeProg(models.Model):
    """Tracks per-user progression, unlock state, and solve history for each challenge."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='challenge_progress')
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='user_progress')
    is_solved = models.BooleanField(default=False)
    is_unlocked = models.BooleanField(default=False)
    solved_at = models.DateTimeField(null=True, blank=True)
    best_score = models.PositiveIntegerField(default=0)
    attempt_count = models.PositiveIntegerField(default=0)
    first_attempted_at = models.DateTimeField(null=True, blank=True)
    last_attempted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'challenge')
        ordering = ('challenge__order_index',)

    def __str__(self):
        return f"{self.user.username} - {self.challenge.title} (solved={self.is_solved}, unlocked={self.is_unlocked})"

