from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from analytics.models import UserPerformance
from battle.models import BattleMatch
from challenges.models import Challenge, ChallengeAttempt
from leaderboard.models import Leaderboard, Reward


class Command(BaseCommand):
    help = 'Seeds sample users, DSA + AI/ML challenges, and leaderboard data.'

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
                'starter_code': 'Expected answer format: space-separated node labels, e.g. A B C D E',
                'expected_answer': 'A B C D E',
                'visualization_payload': {'mode': 'visual', 'nodes': ['A', 'B', 'C', 'D', 'E']},
                'xp_reward': 60,
            },
            {
                'title': 'Depth-First Search Explorer',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.DFS,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Practice recursive and iterative DFS traversal.',
                'prompt': 'Provide a valid DFS order for graph A-B, A-C, B-D, C-E from A.',
                'starter_code': 'Expected answer format: space-separated node labels, e.g. A B D C E',
                'expected_answer': 'A B D C E',
                'visualization_payload': {'mode': 'visual', 'nodes': ['A', 'B', 'C', 'D', 'E']},
                'xp_reward': 80,
            },
            {
                'title': 'Dijkstra Shortest Path',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.DIJKSTRA,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Compute shortest weighted paths from a source node.',
                'prompt': 'In weighted graph A-B(4), A-C(1), C-D(2), B-D(1), provide shortest path A to D.',
                'starter_code': 'Expected answer format: path nodes separated by spaces, e.g. A C D',
                'expected_answer': 'A C D',
                'visualization_payload': {'mode': 'visual', 'weights': True},
                'xp_reward': 90,
            },
            {
                'title': 'A* Pathfinding Basics',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.ASTAR,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Use heuristic search to find shortest paths efficiently.',
                'prompt': 'Which idea helps A* expand fewer nodes than uninformed search?',
                'starter_code': 'Expected answer format: keyword phrase in lowercase',
                'expected_answer': 'heuristic guidance',
                'visualization_payload': {'mode': 'visual', 'grid': '5x5', 'heuristic': 'manhattan'},
                'xp_reward': 90,
            },
            {
                'title': 'Minimax Decision Strategy',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.MINIMAX,
                'difficulty': Challenge.Difficulty.HARD,
                'description': 'Evaluate adversarial game trees using max/min turns.',
                'prompt': 'What does the maximizing player choose at the root in minimax?',
                'starter_code': 'Expected answer format: short phrase in lowercase',
                'expected_answer': 'maximize minimum gain',
                'visualization_payload': {'mode': 'visual', 'tree_depth': 2},
                'xp_reward': 100,
            },
            {
                'title': 'Bubble Sort Walkthrough',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.BUBBLE_SORT,
                'difficulty': Challenge.Difficulty.EASY,
                'description': 'Track adjacent swaps and pass-by-pass ordering.',
                'prompt': 'Sort the list [5, 1, 4, 2, 3] in ascending order.',
                'starter_code': 'Expected answer format: space-separated numbers, e.g. 1 2 3 4 5',
                'expected_answer': '1 2 3 4 5',
                'visualization_payload': {'mode': 'visual', 'array': [5, 1, 4, 2, 3]},
                'xp_reward': 55,
            },
            {
                'title': 'Selection Sort Swap Count',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.SELECTION_SORT,
                'difficulty': Challenge.Difficulty.EASY,
                'description': 'Understand how selection sort chooses minimum elements.',
                'prompt': 'How many swaps does selection sort make on [1, 2, 3, 4]?',
                'starter_code': 'Expected answer format: one integer',
                'expected_answer': '0',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 55,
            },
            {
                'title': 'Insertion Sort Shift Reasoning',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.INSERTION_SORT,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Reason about shifting elements into a sorted prefix.',
                'prompt': 'How many shifts are needed to insert 2 into sorted prefix [1, 3, 4, 5]?',
                'starter_code': 'Expected answer format: one integer',
                'expected_answer': '3',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 65,
            },
            {
                'title': 'Merge Sort Core Idea',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.MERGE_SORT,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Understand recursive splitting and merging.',
                'prompt': 'What paradigm does merge sort use to split and combine arrays?',
                'starter_code': 'Expected answer format: short phrase in lowercase',
                'expected_answer': 'divide and conquer',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 70,
            },
            {
                'title': 'Quick Sort Partition Logic',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.QUICK_SORT,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Practice pivot-based partitioning intuition.',
                'prompt': 'Which operation is repeatedly applied around the pivot in quick sort?',
                'starter_code': 'Expected answer format: single lowercase word',
                'expected_answer': 'partition',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 75,
            },
            {
                'title': 'Heap Sort Foundation',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.HEAP_SORT,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Use heap properties to produce sorted output.',
                'prompt': 'Which heap type is typically used for ascending heap sort?',
                'starter_code': 'Expected answer format: two words in lowercase',
                'expected_answer': 'max heap',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 75,
            },
            {
                'title': 'Linear Search Complexity',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.LINEAR_SEARCH,
                'difficulty': Challenge.Difficulty.EASY,
                'description': 'Review sequential scan performance.',
                'prompt': 'What is the worst-case time complexity of linear search?',
                'starter_code': 'Expected answer format: one token, lowercase',
                'expected_answer': 'o(n)',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 50,
            },
            {
                'title': 'Binary Search Midpoint Update',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.BINARY_SEARCH,
                'difficulty': Challenge.Difficulty.EASY,
                'description': 'Apply left/right boundary updates in sorted arrays.',
                'prompt': 'If target is greater than mid value, which pointer moves?',
                'starter_code': 'Expected answer format: single lowercase word',
                'expected_answer': 'left',
                'visualization_payload': {'mode': 'visual', 'array': [3, 7, 11, 15, 19, 24, 31, 42]},
                'xp_reward': 60,
            },
            {
                'title': 'Binary Search Tree Insertion',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.BST,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Understand how BST ordering directs insertion.',
                'prompt': 'In a BST, where are values smaller than a node inserted?',
                'starter_code': 'Expected answer format: single lowercase word',
                'expected_answer': 'left',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 70,
            },
            {
                'title': '0/1 Knapsack Classic',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.KNAPSACK,
                'difficulty': Challenge.Difficulty.HARD,
                'description': 'Solve constrained optimization with dynamic programming.',
                'prompt': 'Items (w,v): (10,60), (20,100), (30,120), capacity 50. Max value?',
                'starter_code': 'Expected answer format: one integer',
                'expected_answer': '220',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 105,
            },
            {
                'title': 'Longest Common Subsequence Length',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.LCS,
                'difficulty': Challenge.Difficulty.HARD,
                'description': 'Build DP intuition for sequence alignment.',
                'prompt': 'What is LCS length of "AGGTAB" and "GXTXAYB"?',
                'starter_code': 'Expected answer format: one integer',
                'expected_answer': '4',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 105,
            },
            {
                'title': 'Activity Selection Greedy',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.ACTIVITY_SELECTION,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Choose optimal non-overlapping activities greedily.',
                'prompt': 'For start [1,3,0,5,8,5], finish [2,4,6,7,9,9], max activities?',
                'starter_code': 'Expected answer format: one integer',
                'expected_answer': '4',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 80,
            },
            {
                'title': 'Linear Regression Objective',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.LINEAR_REGRESSION,
                'difficulty': Challenge.Difficulty.EASY,
                'description': 'Model linear relationships between variables.',
                'prompt': 'Which loss is most commonly minimized in basic linear regression?',
                'starter_code': 'Expected answer format: lowercase acronym',
                'expected_answer': 'mse',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 65,
            },
            {
                'title': 'Logistic Regression Output',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.LOGISTIC_REGRESSION,
                'difficulty': Challenge.Difficulty.EASY,
                'description': 'Predict probabilities for binary classification.',
                'prompt': 'What does logistic regression output before thresholding?',
                'starter_code': 'Expected answer format: single lowercase word',
                'expected_answer': 'probability',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 65,
            },
            {
                'title': 'K-Means Update Step',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.KMEANS,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Iteratively cluster data by centroid updates.',
                'prompt': 'After assigning points, how is each centroid recomputed?',
                'starter_code': 'Expected answer format: two words in lowercase',
                'expected_answer': 'mean position',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 80,
            },
            {
                'title': 'KNN Core Mechanism',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.KNN,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Classify by nearest labeled examples.',
                'prompt': 'Which metric is commonly used to measure neighbor closeness?',
                'starter_code': 'Expected answer format: single lowercase word',
                'expected_answer': 'euclidean',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 80,
            },
            {
                'title': 'Decision Tree Split Criterion',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.DECISION_TREE,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Learn how trees choose high-value splits.',
                'prompt': 'What split score is commonly maximized in ID3?',
                'starter_code': 'Expected answer format: two words in lowercase',
                'expected_answer': 'information gain',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 85,
            },
            {
                'title': 'Naive Bayes Assumption',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.NAIVE_BAYES,
                'difficulty': Challenge.Difficulty.MEDIUM,
                'description': 'Use Bayes theorem with conditional independence.',
                'prompt': 'What simplifying assumption does naive Bayes make about features?',
                'starter_code': 'Expected answer format: two words in lowercase',
                'expected_answer': 'feature independence',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 85,
            },
            {
                'title': 'Neural Network Activation Role',
                'challenge_type': Challenge.ChallengeType.ALGORITHM,
                'algorithm_type': Challenge.AlgorithmType.NEURAL_NETWORK,
                'difficulty': Challenge.Difficulty.HARD,
                'description': 'Understand the role of nonlinear activations.',
                'prompt': 'What key property do activation functions add to neural nets?',
                'starter_code': 'Expected answer format: single lowercase word',
                'expected_answer': 'nonlinearity',
                'visualization_payload': {'mode': 'conceptual'},
                'xp_reward': 110,
            },
        ]

        seeded_challenges = []
        for payload in challenge_data:
            challenge, _ = Challenge.objects.update_or_create(title=payload['title'], defaults=payload)
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
