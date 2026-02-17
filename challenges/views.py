import re
from collections import OrderedDict

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from rest_framework import generics, permissions

from leaderboard.services import update_leaderboard_for_user

from .models import Challenge, ChallengeAttempt, Topic, UserChallengeProg
from .serializers import ChallengeAttemptSerializer, ChallengeSerializer


CATEGORY_OPTIONS = (
    ('dsa_core', 'DSA Core'),
    ('sorting_searching', 'Sorting & Searching'),
    ('trees_graphs', 'Trees & Graphs'),
    ('advanced_dsa', 'Advanced DSA'),
    ('ai_ml', 'AI/ML'),
    ('sorting', 'Sorting'),
    ('searching', 'Searching'),
    ('graph', 'Graph'),
    ('dynamic_programming', 'Dynamic Programming'),
    ('greedy', 'Greedy'),
    ('backtracking', 'Backtracking'),
    ('recursion', 'Recursion'),
    ('string', 'String'),
    ('math', 'Math'),
    ('bit_manipulation', 'Bit Manipulation'),
    ('array', 'Array'),
    ('hashing', 'Hashing'),
    ('tree', 'Tree'),
)

CATEGORY_FILTER_EQUIVALENTS = {
    'sorting_searching': {'sorting_searching', 'sorting', 'searching'},
    'trees_graphs': {'trees_graphs', 'tree', 'graph'},
    'advanced_dsa': {'advanced_dsa', 'dynamic_programming', 'greedy', 'backtracking', 'bit_manipulation', 'recursion'},
    'dsa_core': {'dsa_core', 'array', 'string', 'hashing', 'recursion', 'math', 'bit_manipulation'},
    'trees_dp_greedy': {'trees_dp_greedy', 'tree', 'dynamic_programming', 'greedy'},
}

ALGORITHM_TYPE_FILTER_MAP = {
    Challenge.AlgorithmType.BFS: {'graph'},
    Challenge.AlgorithmType.DFS: {'graph'},
    Challenge.AlgorithmType.ASTAR: {'graph'},
    Challenge.AlgorithmType.DIJKSTRA: {'graph'},
    Challenge.AlgorithmType.MINIMAX: {'graph'},
    Challenge.AlgorithmType.BUBBLE_SORT: {'sorting'},
    Challenge.AlgorithmType.SELECTION_SORT: {'sorting'},
    Challenge.AlgorithmType.INSERTION_SORT: {'sorting'},
    Challenge.AlgorithmType.MERGE_SORT: {'sorting'},
    Challenge.AlgorithmType.QUICK_SORT: {'sorting'},
    Challenge.AlgorithmType.HEAP_SORT: {'sorting'},
    Challenge.AlgorithmType.LINEAR_SEARCH: {'searching'},
    Challenge.AlgorithmType.BINARY_SEARCH: {'searching'},
    Challenge.AlgorithmType.BST: {'tree'},
    Challenge.AlgorithmType.KNAPSACK: {'dynamic_programming'},
    Challenge.AlgorithmType.LCS: {'dynamic_programming'},
    Challenge.AlgorithmType.ACTIVITY_SELECTION: {'greedy'},
    Challenge.AlgorithmType.LINEAR_REGRESSION: {'ai_ml'},
    Challenge.AlgorithmType.LOGISTIC_REGRESSION: {'ai_ml'},
    Challenge.AlgorithmType.KMEANS: {'ai_ml'},
    Challenge.AlgorithmType.KNN: {'ai_ml'},
    Challenge.AlgorithmType.DECISION_TREE: {'ai_ml', 'tree'},
    Challenge.AlgorithmType.NAIVE_BAYES: {'ai_ml'},
    Challenge.AlgorithmType.NEURAL_NETWORK: {'ai_ml'},
}

FILTER_KEYWORDS = {
    'array': ('array', 'arrays', 'list', 'lists'),
    'string': ('string', 'strings', 'text'),
    'hashing': ('hash', 'hashing', 'hashmap', 'hash map', 'set', 'sets'),
    'sorting': ('sorting', 'bubble sort', 'quick sort', 'merge sort', 'heap sort', 'insertion sort', 'selection sort'),
    'searching': ('searching', 'binary search', 'linear search'),
    'graph': ('graph', 'graphs', 'bfs', 'dfs', 'dijkstra', 'astar', 'a*', 'traversal'),
    'tree': ('tree', 'trees', 'bst', 'binary search tree', 'decision tree'),
    'dynamic_programming': ('dynamic programming', 'knapsack', 'lcs', 'longest common subsequence'),
    'greedy': ('greedy', 'activity selection'),
    'backtracking': ('backtracking', 'n queens', 'sudoku'),
    'recursion': ('recursion', 'recursive'),
    'math': ('math', 'mathematics', 'number theory', 'prime', 'gcd', 'lcm', 'modulo'),
    'bit_manipulation': ('bit manipulation', 'bitwise', 'xor', 'bitmask', 'bit mask'),
    'ai_ml': ('ai', 'ml', 'machine learning', 'regression', 'kmeans', 'k nearest neighbors', 'naive bayes', 'neural network'),
}

LEGACY_CATEGORY_HEADERS = {
    'dsa_core': {'icon': 'bi-puzzle', 'label': 'DSA Core Algorithms'},
    'sorting_searching': {'icon': 'bi-arrow-down-up', 'label': 'Sorting & Searching Algorithms'},
    'trees_graphs': {'icon': 'bi-diagram-3', 'label': 'Trees & Graphs Algorithms'},
    'advanced_dsa': {'icon': 'bi-lightning-charge', 'label': 'Advanced DSA Algorithms'},
    'ai_ml': {'icon': 'bi-cpu', 'label': 'AI & Machine Learning'},
    'sorting': {'icon': 'bi-arrow-down-up', 'label': 'Sorting Algorithms'},
    'searching': {'icon': 'bi-search', 'label': 'Searching Algorithms'},
    'graph': {'icon': 'bi-diagram-3', 'label': 'Graph & Traversal Algorithms'},
    'dynamic_programming': {'icon': 'bi-grid-3x3-gap', 'label': 'Dynamic Programming Algorithms'},
    'greedy': {'icon': 'bi-lightning-charge', 'label': 'Greedy Algorithms'},
    'backtracking': {'icon': 'bi-arrow-counterclockwise', 'label': 'Backtracking Algorithms'},
    'recursion': {'icon': 'bi-arrow-repeat', 'label': 'Recursion Algorithms'},
    'string': {'icon': 'bi-fonts', 'label': 'String Algorithms'},
    'math': {'icon': 'bi-calculator', 'label': 'Math Algorithms'},
    'bit_manipulation': {'icon': 'bi-cpu-fill', 'label': 'Bit Manipulation Algorithms'},
    'array': {'icon': 'bi-list-ul', 'label': 'Array Algorithms'},
    'hashing': {'icon': 'bi-hash', 'label': 'Hashing Algorithms'},
    'tree': {'icon': 'bi-diagram-2', 'label': 'Tree Algorithms'},
    'trees_dp_greedy': {'icon': 'bi-diagram-2', 'label': 'Trees, Dynamic Programming & Greedy'},
}


def _legacy_header_meta(category_code):
    return LEGACY_CATEGORY_HEADERS.get(category_code, {'icon': 'bi-puzzle', 'label': 'Other Challenges'})


def _normalize_text(value):
    return re.sub(r'[^a-z0-9*]+', ' ', (value or '').lower()).strip()


def _build_category_options():
    """Build category options with canonical and topic-derived values."""
    options = OrderedDict(CATEGORY_OPTIONS)
    for category in sorted(Topic.objects.filter(is_active=True).values_list('category', flat=True).distinct()):
        if category and category not in options:
            options[category] = category.replace('_', ' ').title()
    return [{'value': value, 'label': label} for value, label in options.items()]


def _matches_keyword(blob, tokens, keyword):
    normalized_keyword = _normalize_text(keyword)
    if not normalized_keyword:
        return False
    if ' ' in normalized_keyword:
        return normalized_keyword in blob
    return normalized_keyword in tokens


def _challenge_filter_keys(challenge):
    """Return canonical filter keys that represent a challenge."""
    keys = set()
    text_chunks = [challenge.title or '', challenge.description or '', challenge.algorithm_type or '']

    if challenge.topic:
        keys.add(challenge.topic.category)
        text_chunks.append(challenge.topic.label or '')
        text_chunks.append(challenge.topic.stable_id or '')

    algorithm_category = challenge.algorithm_category
    if algorithm_category:
        keys.add(algorithm_category)
    keys.update(ALGORITHM_TYPE_FILTER_MAP.get(challenge.algorithm_type, set()))

    normalized_blob = _normalize_text(' '.join(text_chunks))
    normalized_tokens = set(normalized_blob.split())

    for filter_key, keywords in FILTER_KEYWORDS.items():
        if any(_matches_keyword(normalized_blob, normalized_tokens, keyword) for keyword in keywords):
            keys.add(filter_key)

    return keys


def _matches_selected_category(challenge, selected_category):
    match_targets = CATEGORY_FILTER_EQUIVALENTS.get(selected_category, {selected_category})
    challenge_keys = _challenge_filter_keys(challenge)
    return bool(challenge_keys.intersection(match_targets))


def _get_user_challenge_progress(user, challenge):
    """Get or create UserChallengeProg for user/challenge."""
    if not user or not user.is_authenticated:
        return None
    prog, _ = UserChallengeProg.objects.get_or_create(
        user=user,
        challenge=challenge,
        defaults={'is_unlocked': False, 'is_solved': False},
    )
    return prog


def _is_challenge_unlocked(user, challenge):
    """Check if user has unlocked this challenge."""
    if not user or not user.is_authenticated:
        return False

    if not challenge.topic:
        return True

    first_in_topic = challenge.topic.challenges.order_by('order_index').first()
    if challenge == first_in_topic:
        return True

    if challenge.order_index > 0:
        prev_challenge = challenge.topic.challenges.filter(order_index=challenge.order_index - 1).first()
        if prev_challenge:
            prev_prog = UserChallengeProg.objects.filter(
                user=user,
                challenge=prev_challenge,
                is_solved=True,
            ).first()
            return prev_prog is not None

    prog = _get_user_challenge_progress(user, challenge)
    return prog.is_unlocked if prog else False


def _unlock_next_challenge(user, challenge):
    """Unlock next challenge in sequence when one is solved."""
    if not challenge.topic:
        return

    next_challenge = challenge.topic.challenges.filter(order_index=challenge.order_index + 1).first()
    if next_challenge:
        prog, _ = UserChallengeProg.objects.get_or_create(
            user=user,
            challenge=next_challenge,
            defaults={'is_unlocked': False},
        )
        prog.is_unlocked = True
        prog.save(update_fields=['is_unlocked'])


def _calculate_user_progress(user):
    """Calculate comprehensive progress statistics for a user."""
    if not user or not user.is_authenticated:
        return {}

    total_challenges = Challenge.objects.filter(is_active=True).count()
    user_progress = UserChallengeProg.objects.filter(user=user, is_solved=True)
    total_solved = user_progress.count()
    completion_pct = int((total_solved / total_challenges * 100) if total_challenges > 0 else 0)

    progress_by_topic = {}
    for topic in Topic.objects.all():
        topic_challenges = topic.challenges.filter(is_active=True).count()
        topic_solved = user_progress.filter(challenge__topic=topic).count()
        pct = int((topic_solved / topic_challenges * 100) if topic_challenges > 0 else 0)
        progress_by_topic[topic.stable_id] = {
            'label': topic.label,
            'solved': topic_solved,
            'total': topic_challenges,
            'pct': pct,
        }

    progress_by_difficulty = {}
    for difficulty, label in Challenge.Difficulty.choices:
        diff_challenges = Challenge.objects.filter(is_active=True, difficulty=difficulty).count()
        diff_solved = user_progress.filter(challenge__difficulty=difficulty).count()
        pct = int((diff_solved / diff_challenges * 100) if diff_challenges > 0 else 0)
        progress_by_difficulty[difficulty] = {
            'label': label,
            'solved': diff_solved,
            'total': diff_challenges,
            'pct': pct,
        }

    return {
        'total_solved': total_solved,
        'total_challenges': total_challenges,
        'completion_pct': completion_pct,
        'by_topic': progress_by_topic,
        'by_difficulty': progress_by_difficulty,
    }


def challenge_list_view(request):
    """Enhanced list view with filtering, sorting, searching, and URL persistence."""
    challenges = Challenge.objects.filter(is_active=True).select_related('topic')

    solved_ids = set()
    unlocked_ids = set()
    if request.user.is_authenticated:
        solved_ids = set(
            UserChallengeProg.objects.filter(
                user=request.user,
                is_solved=True,
            ).values_list('challenge_id', flat=True)
        )
        unlocked_ids = set(
            UserChallengeProg.objects.filter(
                user=request.user,
                is_unlocked=True,
            ).values_list('challenge_id', flat=True)
        )

    selected_kind = request.GET.get('kind', 'all')
    selected_difficulty = request.GET.get('difficulty', 'all')
    selected_category = request.GET.get('category', 'all')
    selected_topic = request.GET.get('topic', 'all')
    selected_solved = request.GET.get('solved', 'all')
    selected_unlocked = request.GET.get('unlocked', 'all')
    sort_by = request.GET.get('sort', 'difficulty')
    search_query = request.GET.get('search', '').strip()

    valid_kind_values = {choice[0] for choice in Challenge.ChallengeType.choices}
    valid_difficulty_values = {choice[0] for choice in Challenge.Difficulty.choices}

    if selected_kind in valid_kind_values:
        challenges = challenges.filter(challenge_type=selected_kind)
    else:
        selected_kind = 'all'

    if selected_difficulty in valid_difficulty_values:
        challenges = challenges.filter(difficulty=selected_difficulty)
    else:
        selected_difficulty = 'all'

    category_options = _build_category_options()
    valid_category_values = {category['value'] for category in category_options}
    valid_category_values.update(CATEGORY_FILTER_EQUIVALENTS.keys())
    if selected_category != 'all' and selected_category not in valid_category_values:
        selected_category = 'all'

    available_topics = Topic.objects.filter(is_active=True).values_list('stable_id', 'label')
    topic_options = [{'value': t[0], 'label': t[1]} for t in available_topics]
    valid_topic_values = {t[0] for t in available_topics}

    if selected_topic != 'all':
        if selected_topic in valid_topic_values:
            challenges = challenges.filter(topic__stable_id=selected_topic)
        else:
            selected_topic = 'all'

    if request.user.is_authenticated and selected_solved != 'all':
        solved_challenge_ids = set(
            UserChallengeProg.objects.filter(
                user=request.user,
                is_solved=True,
            ).values_list('challenge_id', flat=True)
        )
        if selected_solved == 'solved':
            challenges = challenges.filter(id__in=solved_challenge_ids)
        elif selected_solved == 'unsolved':
            challenges = challenges.exclude(id__in=solved_challenge_ids)
    elif selected_solved != 'all':
        selected_solved = 'all'

    if request.user.is_authenticated and selected_unlocked != 'all':
        challenges_list = list(challenges)
        if selected_unlocked == 'unlocked':
            challenges_list = [c for c in challenges_list if _is_challenge_unlocked(request.user, c)]
        elif selected_unlocked == 'locked':
            challenges_list = [c for c in challenges_list if not _is_challenge_unlocked(request.user, c)]
        challenges = challenges_list
    elif selected_unlocked != 'all':
        selected_unlocked = 'all'
    else:
        challenges = list(challenges)

    if selected_category != 'all':
        challenges = [challenge for challenge in challenges if _matches_selected_category(challenge, selected_category)]

    if search_query:
        lowered = search_query.lower()
        challenges = [
            c for c in challenges if lowered in c.title.lower() or lowered in c.description.lower()
        ]

    if sort_by == 'title':
        challenges = sorted(challenges, key=lambda c: c.title)
    elif sort_by == 'difficulty':
        diff_order = {'easy': 0, 'medium': 1, 'hard': 2}
        challenges = sorted(challenges, key=lambda c: (diff_order.get(c.difficulty, 3), c.title))
    elif sort_by == 'xp':
        challenges = sorted(challenges, key=lambda c: -c.xp_reward)
    elif sort_by == 'newest':
        challenges = sorted(challenges, key=lambda c: -c.created_at.timestamp())
    elif sort_by == 'completion':
        if request.user.is_authenticated:
            solved_now = set(
                UserChallengeProg.objects.filter(
                    user=request.user, is_solved=True
                ).values_list('challenge_id', flat=True)
            )
            challenges = sorted(
                challenges,
                key=lambda c: (c.id not in solved_now, c.order_index if c.topic else 0),
            )
        else:
            challenges = sorted(challenges, key=lambda c: (c.order_index if c.topic else 0, c.title))
    else:
        challenges = sorted(challenges, key=lambda c: (c.order_index if c.topic else 0, c.difficulty))

    from itertools import groupby

    for challenge in challenges:
        if challenge.topic:
            challenge.effective_category = challenge.topic.category
        else:
            challenge.effective_category = challenge.algorithm_category

    topic_challenges = [c for c in challenges if c.topic]
    legacy_challenges = [c for c in challenges if not c.topic]

    grouped_by_topic = []
    topic_challenges_sorted = sorted(topic_challenges, key=lambda c: c.topic.label if c.topic else '')
    for topic, group in groupby(topic_challenges_sorted, key=lambda c: c.topic):
        grouped_by_topic.append(
            {
                'grouper': topic.stable_id if topic else 'uncategorized',
                'label': topic.label if topic else 'Uncategorized',
                'effective_category': topic.category if topic else 'general',
                'grouper_obj': topic,
                'list': list(group),
            }
        )

    grouped_by_category = []
    legacy_challenges_sorted = sorted(legacy_challenges, key=lambda c: c.algorithm_category)
    for category_code, group in groupby(legacy_challenges_sorted, key=lambda c: c.algorithm_category):
        category_label = Challenge.ALGORITHM_CATEGORY_LABELS.get(category_code, 'Other')
        header_meta = _legacy_header_meta(category_code)
        grouped_by_category.append(
            {
                'grouper': category_code,
                'label': category_label,
                'effective_category': category_code,
                'header_label': header_meta['label'],
                'header_icon': header_meta['icon'],
                'list': list(group),
            }
        )

    if selected_category != 'all' and len(grouped_by_category) == 1:
        selected_header_meta = _legacy_header_meta(selected_category)
        grouped_by_category[0]['header_label'] = selected_header_meta['label']
        grouped_by_category[0]['header_icon'] = selected_header_meta['icon']

    return render(
        request,
        'challenges/challenge_list.html',
        {
            'challenges': challenges,
            'grouped_by_topic': grouped_by_topic,
            'grouped_by_category': grouped_by_category,
            'selected_kind': selected_kind,
            'selected_difficulty': selected_difficulty,
            'selected_category': selected_category,
            'selected_topic': selected_topic,
            'selected_solved': selected_solved,
            'selected_unlocked': selected_unlocked,
            'sort_by': sort_by,
            'search_query': search_query,
            'category_options': category_options,
            'topic_options': topic_options,
            'kind_choices': Challenge.ChallengeType.choices,
            'difficulty_choices': Challenge.Difficulty.choices,
            'user_progress': _calculate_user_progress(request.user) if request.user.is_authenticated else {},
            'solved_ids': solved_ids,
            'unlocked_ids': unlocked_ids,
        },
    )


def challenge_detail_view(request, slug):
    """Challenge detail view with unlock enforcement."""
    challenge = get_object_or_404(Challenge, slug=slug, is_active=True)

    is_unlocked = True
    user_progress = None

    if request.user.is_authenticated:
        user_progress = _get_user_challenge_progress(request.user, challenge)
        is_unlocked = _is_challenge_unlocked(request.user, challenge)

        if not is_unlocked:
            return HttpResponseForbidden(
                render(
                    request,
                    'challenges/challenge_locked.html',
                    {'challenge': challenge, 'user_progress': user_progress},
                ).content
            )

    user_attempts = []
    if request.user.is_authenticated:
        user_attempts = ChallengeAttempt.objects.filter(
            user=request.user, challenge=challenge
        ).select_related('challenge')[:5]

    return render(
        request,
        'challenges/challenge_detail.html',
        {
            'challenge': challenge,
            'user_attempts': user_attempts,
            'user_progress': user_progress,
            'is_unlocked': is_unlocked,
        },
    )


@login_required
@require_POST
def submit_attempt_view(request, slug):
    """Submit attempt with unlock enforcement and progression tracking."""
    challenge = get_object_or_404(Challenge, slug=slug, is_active=True)

    if not _is_challenge_unlocked(request.user, challenge):
        return JsonResponse(
            {'error': 'This challenge is locked', 'is_correct': False},
            status=403,
        )

    answer = request.POST.get('answer', '').strip()
    expected_answer = challenge.expected_answer.strip()
    is_correct = bool(expected_answer) and expected_answer.lower() == answer.lower()

    if not answer:
        score = 0
        gained_xp = 0
    elif is_correct:
        score = challenge.max_score
        gained_xp = challenge.xp_reward
    elif challenge.challenge_type == Challenge.ChallengeType.ALGORITHM:
        incorrect_score_ceiling = max(challenge.max_score - 1, 0)
        effort_score = min(max(challenge.max_score // 4, 1), max(1, len(answer) // 12))
        score = min(incorrect_score_ceiling, effort_score)
        gained_xp = 0
    else:
        score = 0
        gained_xp = 0

    ChallengeAttempt.objects.create(
        user=request.user,
        challenge=challenge,
        score=score,
        is_correct=is_correct,
        submitted_answer=answer,
    )

    prog = _get_user_challenge_progress(request.user, challenge)
    prog.attempt_count += 1
    prog.best_score = max(prog.best_score, score)
    prog.last_attempted_at = timezone.now()
    if not prog.first_attempted_at:
        prog.first_attempted_at = timezone.now()

    if is_correct and not prog.is_solved:
        prog.is_solved = True
        prog.solved_at = timezone.now()
        _unlock_next_challenge(request.user, challenge)

    prog.save()

    if gained_xp > 0:
        request.user.profile.add_xp(gained_xp)
        update_leaderboard_for_user(request.user, gained_xp)

    response_data = {
        'is_correct': is_correct,
        'score': score,
        'xp_gained': gained_xp,
        'current_xp': request.user.profile.xp,
        'current_level': request.user.profile.level,
        'message': 'Try again' if not is_correct else 'Correct!',
    }

    if is_correct and challenge.topic:
        next_challenge = challenge.topic.challenges.filter(order_index=challenge.order_index + 1).first()

        if next_challenge:
            next_is_unlocked = _is_challenge_unlocked(request.user, next_challenge)
            if next_is_unlocked:
                if hasattr(next_challenge, 'get_absolute_url'):
                    response_data['next_challenge_url'] = next_challenge.get_absolute_url()
                else:
                    response_data['next_challenge_url'] = f'/challenges/{next_challenge.slug}/'
            else:
                response_data['next_challenge_url'] = f'/challenges/{next_challenge.slug}/'

        total_rounds = challenge.topic.challenges.filter(is_active=True).count()
        response_data['next_round_index'] = challenge.order_index + 2
        response_data['current_round_index'] = challenge.order_index + 1
        response_data['total_rounds_in_topic'] = total_rounds

        if next_challenge:
            response_data['message'] = f'Round {challenge.order_index + 1} completed! Next: {next_challenge.title}'
        else:
            response_data['message'] = (
                f"Round {challenge.order_index + 1} completed! You've finished all rounds in {challenge.topic.label}!"
            )

    return JsonResponse(response_data)


class ChallengeListApiView(generics.ListAPIView):
    queryset = Challenge.objects.filter(is_active=True).order_by('title')
    serializer_class = ChallengeSerializer
    permission_classes = [permissions.AllowAny]


class ChallengeAttemptListApiView(generics.ListAPIView):
    serializer_class = ChallengeAttemptSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChallengeAttempt.objects.filter(user=self.request.user).select_related('challenge')
