import re
from urllib.parse import urlencode
from collections import defaultdict
from itertools import groupby

from django.contrib.auth.decorators import login_required
from django.db.models import Case, Count, Exists, IntegerField, OuterRef, Q, Value, When
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from rest_framework import generics, permissions

from leaderboard.services import update_leaderboard_for_user

from .models import Challenge, ChallengeAttempt, Topic, UserChallengeProg
from .serializers import ChallengeAttemptSerializer, ChallengeSerializer

HINT_REMAINING_RATIO = 0.25
GENERIC_LEVEL_PROMPT_RE = re.compile(r'^solve\s+.+\s+problem at level\s+\d+\s+\((easy|medium|hard)\)\.?$', re.IGNORECASE)


CATEGORY_OPTIONS = (
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
    'bit_manipulation': {'bit_manipulation', 'bit_conversion'},
}

CATEGORY_ALIASES = {
    'advance_dsa': 'advanced_dsa',
    'dynamic_programmin': 'dynamic_programming',
    'bit_conversion': 'bit_manipulation',
}

CATEGORY_ICON_MAP = {
    'dsa_core': 'bi-puzzle',
    'sorting_searching': 'bi-arrow-down-up',
    'trees_graphs': 'bi-diagram-3',
    'advanced_dsa': 'bi-lightning-charge',
    'ai_ml': 'bi-cpu',
    'sorting': 'bi-arrow-down-up',
    'searching': 'bi-search',
    'graph': 'bi-diagram-3',
    'dynamic_programming': 'bi-grid-3x3-gap',
    'greedy': 'bi-lightning-charge',
    'backtracking': 'bi-arrow-counterclockwise',
    'recursion': 'bi-arrow-repeat',
    'string': 'bi-fonts',
    'math': 'bi-calculator',
    'bit_manipulation': 'bi-cpu-fill',
    'bit_conversion': 'bi-cpu-fill',
    'array': 'bi-list-ul',
    'hashing': 'bi-hash',
    'tree': 'bi-diagram-2',
    'trees_dp_greedy': 'bi-diagram-2',
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
    Challenge.AlgorithmType.BACKTRACKING: {'backtracking'},
    Challenge.AlgorithmType.RECURSION: {'recursion'},
    Challenge.AlgorithmType.STRING_ALGORITHM: {'string'},
    Challenge.AlgorithmType.MATH_ALGORITHM: {'math'},
    Challenge.AlgorithmType.BIT_CONVERSION: {'bit_manipulation', 'bit_conversion'},
    Challenge.AlgorithmType.ARRAY_ALGORITHM: {'array'},
    Challenge.AlgorithmType.HASHING_ALGORITHM: {'hashing'},
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
    'bit_conversion': ('bit conversion', 'binary conversion', 'decimal to binary'),
    'ai_ml': ('ai', 'ml', 'machine learning', 'regression', 'kmeans', 'k nearest neighbors', 'naive bayes', 'neural network'),
}

ALGORITHM_TYPE_LABELS = dict(Challenge.AlgorithmType.choices)
CATEGORY_LABEL_MAP = dict(CATEGORY_OPTIONS)
CATEGORY_DISPLAY_LABELS = {
    **CATEGORY_LABEL_MAP,
    'dsa_core': 'DSA Core',
    'sorting_searching': 'Sorting & Searching',
    'trees_graphs': 'Trees & Graphs',
    'trees_dp_greedy': 'Trees, Dynamic Programming & Greedy',
    'bit_conversion': 'Bit Manipulation',
    'general': 'General',
}

CATEGORY_TO_ALGORITHM_TYPES = defaultdict(set)
for _algorithm_type, _category_keys in ALGORITHM_TYPE_FILTER_MAP.items():
    for _category_key in _category_keys:
        CATEGORY_TO_ALGORITHM_TYPES[_category_key].add(_algorithm_type)

ALGORITHM_TYPE_ICON_MAP = {
    Challenge.AlgorithmType.BFS: 'bi-diagram-3',
    Challenge.AlgorithmType.DFS: 'bi-diagram-3',
    Challenge.AlgorithmType.ASTAR: 'bi-signpost-split',
    Challenge.AlgorithmType.DIJKSTRA: 'bi-signpost-2',
    Challenge.AlgorithmType.MINIMAX: 'bi-robot',
    Challenge.AlgorithmType.BUBBLE_SORT: 'bi-arrow-down-up',
    Challenge.AlgorithmType.SELECTION_SORT: 'bi-filter',
    Challenge.AlgorithmType.INSERTION_SORT: 'bi-sort-down',
    Challenge.AlgorithmType.MERGE_SORT: 'bi-intersect',
    Challenge.AlgorithmType.QUICK_SORT: 'bi-lightning-charge',
    Challenge.AlgorithmType.HEAP_SORT: 'bi-diagram-2',
    Challenge.AlgorithmType.LINEAR_SEARCH: 'bi-search',
    Challenge.AlgorithmType.BINARY_SEARCH: 'bi-binoculars',
    Challenge.AlgorithmType.BST: 'bi-diagram-2',
    Challenge.AlgorithmType.KNAPSACK: 'bi-briefcase',
    Challenge.AlgorithmType.LCS: 'bi-link-45deg',
    Challenge.AlgorithmType.ACTIVITY_SELECTION: 'bi-check2-square',
    Challenge.AlgorithmType.LINEAR_REGRESSION: 'bi-graph-up',
    Challenge.AlgorithmType.LOGISTIC_REGRESSION: 'bi-graph-up-arrow',
    Challenge.AlgorithmType.KMEANS: 'bi-bullseye',
    Challenge.AlgorithmType.KNN: 'bi-people',
    Challenge.AlgorithmType.DECISION_TREE: 'bi-bug',
    Challenge.AlgorithmType.NAIVE_BAYES: 'bi-bar-chart-steps',
    Challenge.AlgorithmType.NEURAL_NETWORK: 'bi-cpu',
    Challenge.AlgorithmType.BACKTRACKING: 'bi-arrow-counterclockwise',
    Challenge.AlgorithmType.RECURSION: 'bi-arrow-repeat',
    Challenge.AlgorithmType.STRING_ALGORITHM: 'bi-fonts',
    Challenge.AlgorithmType.MATH_ALGORITHM: 'bi-calculator',
    Challenge.AlgorithmType.BIT_CONVERSION: 'bi-cpu-fill',
    Challenge.AlgorithmType.ARRAY_ALGORITHM: 'bi-list-ul',
    Challenge.AlgorithmType.HASHING_ALGORITHM: 'bi-hash',
}

ALGORITHM_PROMPT_ACTIONS = {
    Challenge.AlgorithmType.BFS: 'perform breadth-first traversal from the given start node and report traversal order',
    Challenge.AlgorithmType.DFS: 'perform depth-first traversal and report the visitation sequence',
    Challenge.AlgorithmType.ASTAR: 'find the best path using heuristic cost + path cost and report final path cost',
    Challenge.AlgorithmType.DIJKSTRA: 'compute shortest distances from source to all reachable nodes',
    Challenge.AlgorithmType.MINIMAX: 'evaluate the game tree and choose the optimal move',
    Challenge.AlgorithmType.BUBBLE_SORT: 'sort the input using adjacent swaps and provide the final sorted sequence',
    Challenge.AlgorithmType.SELECTION_SORT: 'select minimum elements iteratively and produce the sorted array',
    Challenge.AlgorithmType.INSERTION_SORT: 'insert elements in the correct position and return sorted output',
    Challenge.AlgorithmType.MERGE_SORT: 'split and merge subarrays to produce sorted output',
    Challenge.AlgorithmType.QUICK_SORT: 'partition around pivot(s) and provide the final sorted sequence',
    Challenge.AlgorithmType.HEAP_SORT: 'build heap and extract elements to produce sorted output',
    Challenge.AlgorithmType.LINEAR_SEARCH: 'scan elements sequentially and report the first matching index',
    Challenge.AlgorithmType.BINARY_SEARCH: 'search in sorted data and report target index or -1',
    Challenge.AlgorithmType.BST: 'apply BST rules and report required insertion/search/traversal result',
    Challenge.AlgorithmType.KNAPSACK: 'maximize value under capacity constraint and report optimal value',
    Challenge.AlgorithmType.LCS: 'compute longest common subsequence length for the given strings',
    Challenge.AlgorithmType.ACTIVITY_SELECTION: 'select maximum non-overlapping activities and report count/list',
    Challenge.AlgorithmType.LINEAR_REGRESSION: 'fit linear model and report predicted value or loss metric',
    Challenge.AlgorithmType.LOGISTIC_REGRESSION: 'compute classification output/probability using logistic model',
    Challenge.AlgorithmType.KMEANS: 'update cluster assignment/centroids and report final cluster state',
    Challenge.AlgorithmType.KNN: 'classify/query by nearest neighbors and report predicted class',
    Challenge.AlgorithmType.DECISION_TREE: 'choose best split and report resulting decision outcome',
    Challenge.AlgorithmType.NAIVE_BAYES: 'compute posterior probabilities and return predicted class',
    Challenge.AlgorithmType.NEURAL_NETWORK: 'run forward pass logic and compute final output/activation',
    Challenge.AlgorithmType.BACKTRACKING: 'explore valid choices with pruning and return one valid solution',
    Challenge.AlgorithmType.RECURSION: 'solve recursively and report final computed result',
    Challenge.AlgorithmType.STRING_ALGORITHM: 'process string operations and return required transformed/matched output',
    Challenge.AlgorithmType.MATH_ALGORITHM: 'apply required math logic and return exact numeric result',
    Challenge.AlgorithmType.BIT_CONVERSION: 'convert using bit operations and report converted value',
    Challenge.AlgorithmType.ARRAY_ALGORITHM: 'apply array operations and return requested index/value sequence',
    Challenge.AlgorithmType.HASHING_ALGORITHM: 'use hash-based lookup/update and return expected result',
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
    'bit_conversion': {'icon': 'bi-cpu-fill', 'label': 'Bit Conversion Algorithms'},
    'array': {'icon': 'bi-list-ul', 'label': 'Array Algorithms'},
    'hashing': {'icon': 'bi-hash', 'label': 'Hashing Algorithms'},
    'tree': {'icon': 'bi-diagram-2', 'label': 'Tree Algorithms'},
    'trees_dp_greedy': {'icon': 'bi-diagram-2', 'label': 'Trees, Dynamic Programming & Greedy'},
}


def _legacy_header_meta(category_code):
    return LEGACY_CATEGORY_HEADERS.get(category_code, {'icon': 'bi-puzzle', 'label': 'Other Challenges'})


def _normalize_text(value):
    return re.sub(r'[^a-z0-9*]+', ' ', (value or '').lower()).strip()


def _normalize_category(value):
    normalized = (value or 'all').strip().lower()
    return CATEGORY_ALIASES.get(normalized, normalized)


def _category_targets(category_code):
    normalized = _normalize_category(category_code)
    return CATEGORY_FILTER_EQUIVALENTS.get(normalized, {normalized})


def _category_display_label(category_code):
    normalized = _normalize_category(category_code)
    label = CATEGORY_DISPLAY_LABELS.get(normalized)
    if label:
        return label
    return normalized.replace('_', ' ').title()


def _category_icon(category_code):
    normalized = _normalize_category(category_code)
    return CATEGORY_ICON_MAP.get(normalized, 'bi-puzzle')


def _build_category_options():
    """Build quick-filter category options shown in UI."""
    options = {
        value: {'value': value, 'label': label, 'icon': _category_icon(value)}
        for value, label in CATEGORY_OPTIONS
    }

    for topic_category in Topic.objects.filter(is_active=True).values_list('category', flat=True).distinct():
        normalized = _normalize_category(topic_category)
        if normalized and normalized not in options:
            options[normalized] = {
                'value': normalized,
                'label': _category_display_label(normalized),
                'icon': _category_icon(normalized),
            }

    return list(options.values())


def _build_category_filter_q(selected_category):
    targets = _category_targets(selected_category)
    mapped_algorithm_types = set()
    for key in targets:
        mapped_algorithm_types.update(CATEGORY_TO_ALGORITHM_TYPES.get(key, set()))

    category_q = Q(topic__category__in=targets)
    if mapped_algorithm_types:
        category_q |= Q(algorithm_type__in=mapped_algorithm_types)

    return category_q


def _build_subtype_options(selected_category, queryset):
    present_algorithm_types = set(
        queryset.exclude(algorithm_type='').values_list('algorithm_type', flat=True).distinct()
    )
    if selected_category == 'all':
        subtype_values = present_algorithm_types
    else:
        targets = _category_targets(selected_category)
        mapped_algorithm_types = set()
        for key in targets:
            mapped_algorithm_types.update(CATEGORY_TO_ALGORITHM_TYPES.get(key, set()))
        if mapped_algorithm_types:
            subtype_values = mapped_algorithm_types.intersection(present_algorithm_types) or mapped_algorithm_types
        else:
            subtype_values = present_algorithm_types

    options = []
    for subtype_value in sorted(subtype_values, key=lambda value: ALGORITHM_TYPE_LABELS.get(value, value)):
        options.append({'value': subtype_value, 'label': ALGORITHM_TYPE_LABELS.get(subtype_value, subtype_value)})
    return options


def _search_algorithm_type_values(search_query):
    normalized_query = _normalize_text(search_query)
    if not normalized_query:
        return set()

    matches = set()
    for value, label in Challenge.AlgorithmType.choices:
        normalized_label = _normalize_text(label)
        normalized_value = _normalize_text(value.replace('_', ' '))
        if normalized_query in normalized_label or normalized_query in normalized_value:
            matches.add(value)
    return matches


def _apply_queryset_sort(challenges_queryset, sort_by, user):
    if sort_by == 'title':
        return challenges_queryset.order_by('title')

    if sort_by == 'difficulty':
        return challenges_queryset.annotate(
            _difficulty_rank=Case(
                When(difficulty=Challenge.Difficulty.EASY, then=Value(0)),
                When(difficulty=Challenge.Difficulty.MEDIUM, then=Value(1)),
                When(difficulty=Challenge.Difficulty.HARD, then=Value(2)),
                default=Value(3),
                output_field=IntegerField(),
            )
        ).order_by('_difficulty_rank', 'title')

    if sort_by == 'xp':
        return challenges_queryset.order_by('-xp_reward', 'title')

    if sort_by == 'newest':
        return challenges_queryset.order_by('-created_at')

    if sort_by == 'completion':
        if user and user.is_authenticated:
            solved_subquery = UserChallengeProg.objects.filter(
                user=user,
                is_solved=True,
                challenge_id=OuterRef('pk'),
            )
            return challenges_queryset.annotate(
                _is_solved=Exists(solved_subquery)
            ).order_by('-_is_solved', 'order_index', 'title')
        return challenges_queryset.order_by('order_index', 'title')

    return challenges_queryset.order_by('order_index', 'difficulty', 'title')


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
    match_targets = _category_targets(selected_category)
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
    """Calculate overall + difficulty progress statistics for a user."""
    if not user or not user.is_authenticated:
        return {}

    total_by_difficulty = {
        row['difficulty']: row['total']
        for row in Challenge.objects.filter(is_active=True)
        .values('difficulty')
        .annotate(total=Count('id'))
    }
    solved_by_difficulty = {
        row['challenge__difficulty']: row['total']
        for row in UserChallengeProg.objects.filter(
            user=user,
            is_solved=True,
            challenge__is_active=True,
        )
        .values('challenge__difficulty')
        .annotate(total=Count('id'))
    }

    total_challenges = sum(total_by_difficulty.values())
    total_solved = sum(solved_by_difficulty.values())
    completion_pct = int((total_solved / total_challenges * 100) if total_challenges > 0 else 0)

    progress_by_difficulty = {}
    for difficulty, label in Challenge.Difficulty.choices:
        diff_challenges = total_by_difficulty.get(difficulty, 0)
        diff_solved = solved_by_difficulty.get(difficulty, 0)
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
        'by_difficulty': progress_by_difficulty,
    }


def _group_challenges_by_category(challenges, selected_category, category_options):
    option_order = {opt['value']: idx for idx, opt in enumerate(category_options)}

    grouped = []
    sorted_challenges = sorted(
        challenges,
        key=lambda c: (
            option_order.get(c.effective_category, 10_000),
            c.effective_category or '',
            c.topic.label.lower() if c.topic else '',
            c.order_index,
            c.title.lower(),
        ),
    )
    for category_code, group in groupby(sorted_challenges, key=lambda c: c.effective_category):
        header_meta = _legacy_header_meta(category_code)
        grouped.append(
            {
                'grouper': category_code,
                'label': _category_display_label(category_code),
                'effective_category': category_code,
                'header_label': f"{_category_display_label(category_code)} Challenges",
                'header_icon': _category_icon(category_code) or header_meta['icon'],
                'list': list(group),
            }
        )

    if selected_category != 'all' and len(grouped) == 1:
        grouped[0]['header_label'] = f"{_category_display_label(selected_category)} Challenges"
        grouped[0]['header_icon'] = _category_icon(selected_category)

    return grouped


def _effective_category_for_challenge(challenge):
    # Prefer algorithm-derived category to keep sections aligned with quick-filter types.
    if challenge.algorithm_type:
        mapped = sorted(ALGORITHM_TYPE_FILTER_MAP.get(challenge.algorithm_type, set()))
        if mapped:
            category_order = {value: idx for idx, (value, _) in enumerate(CATEGORY_OPTIONS)}
            return sorted(mapped, key=lambda key: category_order.get(key, 10_000))[0]
    if challenge.topic:
        return challenge.topic.category
    return challenge.algorithm_category or 'general'


def _build_subtype_query_string(request_querydict, subtype):
    query_params = request_querydict.copy()
    query_params['subtype'] = subtype
    encoded = query_params.urlencode()
    if encoded:
        return f'?{encoded}'
    return f'?{urlencode({"subtype": subtype})}'


def _display_prompt_for_challenge(challenge):
    prompt = (challenge.prompt or '').strip()
    if prompt and not GENERIC_LEVEL_PROMPT_RE.match(prompt):
        return prompt

    level = (challenge.order_index + 1) if challenge.order_index is not None else 1
    difficulty_label = challenge.get_difficulty_display() if hasattr(challenge, 'get_difficulty_display') else challenge.difficulty
    algorithm_label = challenge.get_algorithm_type_display() if challenge.algorithm_type else 'this algorithm'
    action = ALGORITHM_PROMPT_ACTIONS.get(
        challenge.algorithm_type,
        'solve the given input carefully and provide the final computed answer',
    )
    return f"Level {level} ({difficulty_label}): Using {algorithm_label}, {action}."


def challenge_list_view(request):
    """Enhanced list view with filtering, sorting, searching, and URL persistence."""
    challenges = Challenge.objects.filter(is_active=True).select_related('topic').only(
        'id',
        'title',
        'slug',
        'challenge_type',
        'algorithm_type',
        'difficulty',
        'description',
        'xp_reward',
        'order_index',
        'created_at',
        'topic__id',
        'topic__label',
        'topic__category',
        'topic__stable_id',
    )

    solved_ids = set()
    unlocked_ids = set()
    if request.user.is_authenticated:
        user_progress_rows = UserChallengeProg.objects.filter(user=request.user).values_list(
            'challenge_id',
            'is_solved',
            'is_unlocked',
        )
        for challenge_id, is_solved, is_unlocked in user_progress_rows:
            if is_solved:
                solved_ids.add(challenge_id)
            if is_unlocked:
                unlocked_ids.add(challenge_id)

    selected_kind = request.GET.get('kind', 'all')
    selected_difficulty = request.GET.get('difficulty', 'all')
    selected_category = _normalize_category(request.GET.get('category', 'all'))
    selected_subtype = request.GET.get('subtype', 'all').strip().lower()
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
    valid_category_values.update(CATEGORY_ALIASES.keys())
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
        if selected_solved == 'solved':
            challenges = challenges.filter(id__in=solved_ids)
        elif selected_solved == 'unsolved':
            challenges = challenges.exclude(id__in=solved_ids)
    elif selected_solved != 'all':
        selected_solved = 'all'

    if selected_category != 'all':
        challenges = challenges.filter(_build_category_filter_q(selected_category))

    subtype_options = _build_subtype_options(selected_category, challenges)
    valid_subtypes = {option['value'] for option in subtype_options}
    if selected_subtype != 'all' and selected_subtype not in valid_subtypes:
        selected_subtype = 'all'

    is_subtype_index_mode = selected_subtype == 'all'
    if not is_subtype_index_mode:
        challenges = challenges.filter(algorithm_type=selected_subtype)

    if search_query:
        matching_algorithm_types = _search_algorithm_type_values(search_query)
        search_filters = Q(title__icontains=search_query) | Q(description__icontains=search_query)
        if matching_algorithm_types:
            search_filters |= Q(algorithm_type__in=matching_algorithm_types)
        challenges = challenges.filter(search_filters)

    challenges = _apply_queryset_sort(challenges, sort_by, request.user)

    challenges = list(challenges)

    if request.user.is_authenticated and selected_unlocked != 'all':
        if selected_unlocked == 'unlocked':
            challenges = [c for c in challenges if _is_challenge_unlocked(request.user, c)]
        elif selected_unlocked == 'locked':
            challenges = [c for c in challenges if not _is_challenge_unlocked(request.user, c)]
        else:
            selected_unlocked = 'all'
    elif selected_unlocked != 'all':
        selected_unlocked = 'all'

    for challenge in challenges:
        effective_category = _effective_category_for_challenge(challenge)
        challenge.effective_category = _normalize_category(effective_category)
        challenge.ui_category_label = _category_display_label(challenge.effective_category)
        challenge.ui_subtype_label = ALGORITHM_TYPE_LABELS.get(challenge.algorithm_type, '')
        challenge.ui_subtype_icon = ALGORITHM_TYPE_ICON_MAP.get(challenge.algorithm_type, 'bi-cpu')

    display_challenges = challenges
    if is_subtype_index_mode:
        subtype_counts = defaultdict(int)
        representatives = {}
        for challenge in challenges:
            subtype_key = challenge.algorithm_type or f'challenge-{challenge.id}'
            subtype_counts[subtype_key] += 1
            if subtype_key not in representatives:
                representatives[subtype_key] = challenge

        display_challenges = list(representatives.values())
        for challenge in display_challenges:
            subtype_key = challenge.algorithm_type or f'challenge-{challenge.id}'
            challenge.subtype_level_count = subtype_counts[subtype_key]
            challenge.subtype_query = _build_subtype_query_string(request.GET, subtype_key)

    show_landing_placeholder = selected_category == 'all' and selected_subtype == 'all' and not search_query

    grouped_by_category = _group_challenges_by_category(display_challenges, selected_category, category_options)

    return render(
        request,
        'challenges/challenge_list.html',
        {
            'challenges': display_challenges,
            'grouped_by_category': grouped_by_category,
            'selected_kind': selected_kind,
            'selected_difficulty': selected_difficulty,
            'selected_category': selected_category,
            'selected_subtype': selected_subtype,
            'selected_topic': selected_topic,
            'selected_solved': selected_solved,
            'selected_unlocked': selected_unlocked,
            'sort_by': sort_by,
            'search_query': search_query,
            'show_landing_placeholder': show_landing_placeholder,
            'category_options': category_options,
            'subtype_options': subtype_options,
            'is_subtype_index_mode': is_subtype_index_mode,
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

    can_use_hint = False
    hint_used = False
    if request.user.is_authenticated and is_unlocked and challenge.starter_code:
        current_prog = user_progress or _get_user_challenge_progress(request.user, challenge)
        hint_used = bool(current_prog and current_prog.hint_used)
        can_use_hint = bool(current_prog and not current_prog.hint_used and current_prog.attempt_count == 0)

    return render(
        request,
        'challenges/challenge_detail.html',
        {
            'challenge': challenge,
            'display_prompt': _display_prompt_for_challenge(challenge),
            'user_attempts': user_attempts,
            'user_progress': user_progress,
            'is_unlocked': is_unlocked,
            'can_use_hint': can_use_hint,
            'hint_used': hint_used,
        },
    )


@login_required
@require_POST
def request_hint_view(request, slug):
    challenge = get_object_or_404(Challenge, slug=slug, is_active=True)

    if not _is_challenge_unlocked(request.user, challenge):
        return JsonResponse({'error': 'This challenge is locked.'}, status=403)

    if not challenge.starter_code.strip():
        return JsonResponse({'error': 'No hint is available for this challenge.'}, status=400)

    prog = _get_user_challenge_progress(request.user, challenge)
    if prog.attempt_count > 0:
        return JsonResponse({'error': 'Hints are available only before your first attempt.'}, status=400)

    if prog.hint_used:
        return JsonResponse(
            {
                'hint': challenge.starter_code.strip(),
                'hint_used': True,
                'remaining_ratio': HINT_REMAINING_RATIO,
            }
        )

    prog.hint_used = True
    prog.save(update_fields=['hint_used'])

    return JsonResponse(
        {
            'hint': challenge.starter_code.strip(),
            'hint_used': True,
            'remaining_ratio': HINT_REMAINING_RATIO,
        }
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

    prog = _get_user_challenge_progress(request.user, challenge)

    answer = request.POST.get('answer', '').strip()
    expected_answer = challenge.expected_answer.strip()
    is_correct = bool(expected_answer) and expected_answer.lower() == answer.lower()
    attempt_index = prog.attempt_count + 1
    is_score_eligible = attempt_index == 1
    hint_used = bool(prog.hint_used)

    if is_correct and is_score_eligible:
        if hint_used:
            score = int(challenge.max_score * HINT_REMAINING_RATIO)
            gained_xp = int(challenge.xp_reward * HINT_REMAINING_RATIO)
        else:
            score = challenge.max_score
            gained_xp = challenge.xp_reward
    else:
        score = 0
        gained_xp = 0

    attempt = ChallengeAttempt.objects.create(
        user=request.user,
        challenge=challenge,
        attempt_index=attempt_index,
        hint_used=hint_used,
        is_score_eligible=is_score_eligible,
        score=score,
        is_correct=is_correct,
        submitted_answer=answer,
    )

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

    if not is_score_eligible:
        message = 'Points are awarded only on the first attempt.'
    elif is_correct and hint_used:
        message = 'Correct! Hint penalty applied (75% reduction).'
    elif is_correct:
        message = 'Correct!'
    elif hint_used:
        message = 'Try again. First-attempt points were consumed with hint usage.'
    else:
        message = 'Try again'

    response_data = {
        'is_correct': is_correct,
        'score': score,
        'xp_gained': gained_xp,
        'attempt_index': attempt_index,
        'hint_used': hint_used,
        'is_score_eligible': is_score_eligible,
        'current_xp': request.user.profile.xp,
        'current_level': request.user.profile.level,
        'message': message,
    }

    battle_room_code = request.POST.get('battle_room_code', '').strip()
    if battle_room_code and is_correct and is_score_eligible:
        from battle.models import BattleMatch
        from battle.score_tokens import build_score_token

        battle_match = (
            BattleMatch.objects.filter(
                room_code=battle_room_code,
                status=BattleMatch.Status.LIVE,
                challenge_id=challenge.id,
            )
            .filter(Q(player_one=request.user) | Q(player_two=request.user))
            .first()
        )
        if battle_match:
            response_data['battle_score_token'] = build_score_token(
                room_code=battle_match.room_code,
                attempt_id=attempt.id,
                user_id=request.user.id,
            )

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
