from django.contrib.auth.models import User
from django.db import models
from django.utils.text import slugify


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

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


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

# Create your models here.
