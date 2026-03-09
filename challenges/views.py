import json
import math
import re
from collections import Counter, defaultdict, deque
from heapq import heappop, heappush
from urllib.parse import urlencode
from itertools import groupby

from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.db.models import Case, Count, Exists, IntegerField, OuterRef, Q, Value, When
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from rest_framework import generics, permissions

from leaderboard.services import update_leaderboard_for_user

from .models import Challenge, ChallengeAttempt, Topic, UserChallengeProg
from .serializers import ChallengeAttemptSerializer, ChallengeSerializer

HINT_REMAINING_RATIO = 0.25
GENERIC_LEVEL_PROMPT_RE = re.compile(r'^solve\s+.+\s+problem at level\s+\d+\s+\((easy|medium|hard)\)\.?$', re.IGNORECASE)
PLACEHOLDER_PROMPT_RE = re.compile(r'^(prompt|test|todo|tbd|n/?a|null|none|sample)$', re.IGNORECASE)
CANONICAL_TOPIC_PREFIX = 'algo_'


CATEGORY_OPTIONS = (
    ('dsa_core', 'DSA Core'),
    ('linked_list', 'Linked List'),
    ('stack', 'Stack'),
    ('queue', 'Queue'),
    ('sorting_searching', 'Sorting & Searching'),
    ('trees_graphs', 'Trees & Graphs'),
    ('advanced_dsa', 'Advanced DSA'),
    ('dynamic_programming', 'Dynamic Programming'),
    ('greedy', 'Greedy'),
    ('ai_ml', 'AI/ML'),
)

CATEGORY_FILTER_EQUIVALENTS = {
    'sorting_searching': {'sorting_searching', 'sorting', 'searching'},
    'trees_graphs': {'trees_graphs', 'tree', 'graph'},
    'advanced_dsa': {'advanced_dsa', 'dynamic_programming', 'greedy', 'backtracking', 'bit_manipulation', 'recursion'},
    'dsa_core': {'dsa_core', 'array', 'string', 'hashing', 'linked_list', 'stack', 'queue', 'recursion', 'math', 'bit_manipulation'},
    'trees_dp_greedy': {'trees_dp_greedy', 'tree', 'dynamic_programming', 'greedy'},
    'bit_manipulation': {'bit_manipulation', 'bit_conversion'},
}

CATEGORY_ALIASES = {
    'advance_dsa': 'advanced_dsa',
    'dynamic_programmin': 'dynamic_programming',
    'bit_conversion': 'bit_manipulation',
    # Backward compatibility for older category URLs.
    'array': 'dsa_core',
    'hashing': 'dsa_core',
    'string': 'dsa_core',
    'math': 'dsa_core',
    'bit_manipulation': 'advanced_dsa',
    'sorting': 'sorting_searching',
    'searching': 'sorting_searching',
    'tree': 'trees_graphs',
    'graph': 'trees_graphs',
    'backtracking': 'advanced_dsa',
    'recursion': 'advanced_dsa',
}

CATEGORY_ICON_MAP = {
    'dsa_core': 'bi-puzzle',
    'sorting_searching': 'bi-arrow-down-up',
    'trees_graphs': 'bi-diagram-3',
    'advanced_dsa': 'bi-lightning-charge',
    'ai_ml': 'bi-cpu',
    'linked_list': 'bi-link-45deg',
    'stack': 'bi-stack',
    'queue': 'bi-collection',
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
    Challenge.AlgorithmType.LINKED_LIST: {'linked_list'},
    Challenge.AlgorithmType.DOUBLY_LINKED_LIST: {'linked_list'},
    Challenge.AlgorithmType.CIRCULAR_LINKED_LIST: {'linked_list'},
    Challenge.AlgorithmType.STACK: {'stack'},
    Challenge.AlgorithmType.QUEUE: {'queue'},
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
    'linked_list': ('linked list', 'singly linked list', 'doubly linked list', 'circular linked list', 'node'),
    'stack': ('stack', 'lifo', 'push', 'pop'),
    'queue': ('queue', 'fifo', 'enqueue', 'dequeue'),
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
SUPPORTED_ALGORITHM_TYPE_VALUES = set(ALGORITHM_TYPE_LABELS.keys())
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
    Challenge.AlgorithmType.LINKED_LIST: 'bi-link-45deg',
    Challenge.AlgorithmType.DOUBLY_LINKED_LIST: 'bi-link',
    Challenge.AlgorithmType.CIRCULAR_LINKED_LIST: 'bi-arrow-repeat',
    Challenge.AlgorithmType.STACK: 'bi-stack',
    Challenge.AlgorithmType.QUEUE: 'bi-collection',
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
    Challenge.AlgorithmType.LINKED_LIST: 'traverse linked nodes and report the required lookup/update result',
    Challenge.AlgorithmType.DOUBLY_LINKED_LIST: 'use bidirectional links and report the required node/index result',
    Challenge.AlgorithmType.CIRCULAR_LINKED_LIST: 'follow circular traversal rules and report the required node/index result',
    Challenge.AlgorithmType.STACK: 'simulate push/pop operations and report the final stack outcome',
    Challenge.AlgorithmType.QUEUE: 'simulate enqueue/dequeue operations and report the final queue outcome',
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
        queryset.filter(
            challenge_type=Challenge.ChallengeType.ALGORITHM,
            algorithm_type__in=SUPPORTED_ALGORITHM_TYPE_VALUES,
        ).values_list('algorithm_type', flat=True).distinct()
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

    query_tokens = set(normalized_query.split())

    def query_matches_term(term):
        normalized_term = _normalize_text(term)
        if not normalized_term:
            return False
        if normalized_term == normalized_query:
            return True
        if len(normalized_term) <= 1:
            # Avoid broad false positives (for example "a*" -> "a").
            return normalized_term in query_tokens
        if ' ' in normalized_term:
            return normalized_term in normalized_query or normalized_query in normalized_term
        return normalized_term in query_tokens or normalized_term in normalized_query

    matches = set()
    for value, label in Challenge.AlgorithmType.choices:
        normalized_label = _normalize_text(label)
        normalized_value = _normalize_text(value.replace('_', ' '))
        if (
            normalized_query in normalized_label
            or normalized_query in normalized_value
            or query_matches_term(label)
            or query_matches_term(value.replace('_', ' '))
        ):
            matches.add(value)

    for filter_key, keywords in FILTER_KEYWORDS.items():
        keyword_hit = query_matches_term(filter_key)
        if not keyword_hit:
            keyword_hit = any(query_matches_term(keyword) for keyword in keywords)
        if keyword_hit:
            matches.update(CATEGORY_TO_ALGORITHM_TYPES.get(filter_key, set()))

    return matches


def _search_challenge_type_values(search_query):
    normalized_query = _normalize_text(search_query)
    if not normalized_query:
        return set()

    query_tokens = set(normalized_query.split())
    matches = set()
    for value, label in Challenge.ChallengeType.choices:
        normalized_label = _normalize_text(label)
        normalized_value = _normalize_text(value.replace('_', ' '))
        if (
            normalized_query in normalized_label
            or normalized_query in normalized_value
            or normalized_value in query_tokens
        ):
            matches.add(value)
    return matches


def _search_difficulty_values(search_query):
    normalized_query = _normalize_text(search_query)
    if not normalized_query:
        return set()

    query_tokens = set(normalized_query.split())
    matches = set()
    for value, label in Challenge.Difficulty.choices:
        normalized_label = _normalize_text(label)
        normalized_value = _normalize_text(value)
        if (
            normalized_query in normalized_label
            or normalized_query in normalized_value
            or normalized_value in query_tokens
        ):
            matches.add(value)
    return matches


def _search_category_targets(search_query):
    normalized_query = _normalize_text(search_query)
    if not normalized_query:
        return set()

    query_tokens = set(normalized_query.split())
    targets = set()

    def query_matches_term(term):
        normalized_term = _normalize_text(term)
        if not normalized_term:
            return False
        if normalized_term == normalized_query:
            return True
        if len(normalized_term) <= 1:
            return normalized_term in query_tokens
        if ' ' in normalized_term:
            return normalized_term in normalized_query or normalized_query in normalized_term
        return normalized_term in query_tokens or normalized_term in normalized_query

    # Keep search mapping explicit: canonical categories + discovered categories.
    category_candidates = (set(CATEGORY_DISPLAY_LABELS.keys()) | set(CATEGORY_LABEL_MAP.keys())) - set(CATEGORY_ALIASES.keys())
    for category_code in category_candidates:
        display_label = _category_display_label(category_code)
        if not (query_matches_term(category_code) or query_matches_term(display_label)):
            continue

        # For broad canonical categories, include equivalent buckets.
        if category_code in CATEGORY_FILTER_EQUIVALENTS and category_code in CATEGORY_LABEL_MAP:
            targets.update(_category_targets(category_code))
        else:
            targets.add(category_code)

    for filter_key, keywords in FILTER_KEYWORDS.items():
        keyword_hit = query_matches_term(filter_key)
        if not keyword_hit:
            keyword_hit = any(query_matches_term(keyword) for keyword in keywords)
        if not keyword_hit:
            continue

        if filter_key in CATEGORY_FILTER_EQUIVALENTS and filter_key in CATEGORY_LABEL_MAP:
            targets.update(_category_targets(filter_key))
        else:
            targets.add(filter_key)

    return targets


def _build_search_filters(search_query):
    numeric_tokens = {int(token) for token in re.findall(r'\d+', search_query)}
    matching_algorithm_types = _search_algorithm_type_values(search_query)
    matching_challenge_types = _search_challenge_type_values(search_query)
    matching_difficulties = _search_difficulty_values(search_query)
    matching_category_targets = _search_category_targets(search_query)

    search_filters = (
        Q(title__icontains=search_query)
        | Q(description__icontains=search_query)
        | Q(prompt__icontains=search_query)
        | Q(topic__label__icontains=search_query)
        | Q(topic__stable_id__icontains=search_query)
        | Q(topic__category__icontains=search_query)
    )

    if matching_algorithm_types:
        search_filters |= Q(algorithm_type__in=matching_algorithm_types)
    if matching_challenge_types:
        search_filters |= Q(challenge_type__in=matching_challenge_types)
    if matching_difficulties:
        search_filters |= Q(difficulty__in=matching_difficulties)
    if numeric_tokens:
        search_filters |= Q(xp_reward__in=numeric_tokens) | Q(order_index__in=numeric_tokens)

    if matching_category_targets:
        mapped_algorithm_types = set()
        for target in matching_category_targets:
            mapped_algorithm_types.update(CATEGORY_TO_ALGORITHM_TYPES.get(target, set()))

        search_filters |= Q(topic__category__in=matching_category_targets)
        if mapped_algorithm_types:
            search_filters |= Q(algorithm_type__in=mapped_algorithm_types)

    return search_filters


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


def _get_locked_user_challenge_progress(user, challenge):
    """Get or create progress row and lock it for concurrent-safe attempt accounting."""
    if not user or not user.is_authenticated:
        return None

    try:
        prog, _ = UserChallengeProg.objects.get_or_create(
            user=user,
            challenge=challenge,
            defaults={'is_unlocked': False, 'is_solved': False},
        )
    except IntegrityError:
        # Concurrent create raced this request. Fetch the winner row.
        prog = UserChallengeProg.objects.get(user=user, challenge=challenge)
    return UserChallengeProg.objects.select_for_update().get(pk=prog.pk)


def _is_challenge_unlocked(user, challenge):
    """Check if user has unlocked this challenge."""
    if not user or not user.is_authenticated:
        return False

    if not challenge.topic:
        if challenge.algorithm_type:
            algorithm_challenges = Challenge.objects.filter(
                is_active=True,
                topic_id__isnull=True,
                algorithm_type=challenge.algorithm_type,
            )
            first_in_algorithm = algorithm_challenges.order_by('order_index', 'id').first()
            if first_in_algorithm and challenge.id == first_in_algorithm.id:
                return True

            prev_challenge = (
                algorithm_challenges.filter(order_index__lt=challenge.order_index)
                .order_by('-order_index', '-id')
                .first()
            )
            if prev_challenge:
                prev_prog = UserChallengeProg.objects.filter(
                    user=user,
                    challenge=prev_challenge,
                    is_solved=True,
                ).first()
                if prev_prog:
                    return True

            prog = _get_user_challenge_progress(user, challenge)
            return prog.is_unlocked if prog else False

        return True

    topic_challenges = challenge.topic.challenges.filter(is_active=True)
    first_in_topic = topic_challenges.order_by('order_index').first()
    if challenge == first_in_topic:
        return True

    if challenge.order_index > 0:
        prev_challenge = (
            topic_challenges.filter(order_index__lt=challenge.order_index).order_by('-order_index').first()
        )
        if prev_challenge:
            prev_prog = UserChallengeProg.objects.filter(
                user=user,
                challenge=prev_challenge,
                is_solved=True,
            ).first()
            return prev_prog is not None

    prog = _get_user_challenge_progress(user, challenge)
    return prog.is_unlocked if prog else False


def _build_topic_unlock_metadata(topic_ids):
    """Return topic-first and challenge-prev maps for active challenges in topics."""
    if not topic_ids:
        return {}, {}

    rows = list(
        Challenge.objects.filter(is_active=True, topic_id__in=topic_ids)
        .only('id', 'topic_id', 'order_index')
        .order_by('topic_id', 'order_index', 'id')
    )

    first_by_topic = {}
    prev_by_challenge = {}

    current_topic_id = None
    last_lower_order = None
    last_lower_id = None

    for row in rows:
        topic_id = row.topic_id
        if topic_id != current_topic_id:
            current_topic_id = topic_id
            first_by_topic[topic_id] = row.id
            last_lower_order = None
            last_lower_id = None

        prev_by_challenge[row.id] = last_lower_id

        if last_lower_order is None or row.order_index > last_lower_order:
            last_lower_order = row.order_index
            last_lower_id = row.id

    return first_by_topic, prev_by_challenge


def _build_algorithm_unlock_metadata(algorithm_types):
    """Return first/previous maps for topic-less algorithm sequences."""
    if not algorithm_types:
        return {}, {}

    rows = list(
        Challenge.objects.filter(
            is_active=True,
            topic_id__isnull=True,
            algorithm_type__in=algorithm_types,
        )
        .exclude(algorithm_type='')
        .only('id', 'algorithm_type', 'order_index')
        .order_by('algorithm_type', 'order_index', 'id')
    )

    first_by_algorithm = {}
    prev_by_challenge = {}
    current_algorithm_type = None
    last_lower_order = None
    last_lower_id = None

    for row in rows:
        algorithm_type = row.algorithm_type
        if algorithm_type != current_algorithm_type:
            current_algorithm_type = algorithm_type
            first_by_algorithm[algorithm_type] = row.id
            last_lower_order = None
            last_lower_id = None

        prev_by_challenge[row.id] = last_lower_id

        if last_lower_order is None or row.order_index > last_lower_order:
            last_lower_order = row.order_index
            last_lower_id = row.id

    return first_by_algorithm, prev_by_challenge


def _bulk_unlock_map(challenges, solved_ids, explicit_unlocked_ids):
    """Compute unlock status for a challenge list with O(1) lookups and minimal DB hits."""
    challenge_list = list(challenges)
    topic_ids = {challenge.topic_id for challenge in challenge_list if challenge.topic_id}
    first_by_topic, prev_by_challenge = _build_topic_unlock_metadata(topic_ids)
    algorithm_types = {
        challenge.algorithm_type
        for challenge in challenge_list
        if not challenge.topic_id and challenge.algorithm_type
    }
    first_by_algorithm, prev_by_algorithm_challenge = _build_algorithm_unlock_metadata(algorithm_types)

    unlock_map = {}
    for challenge in challenge_list:
        if not challenge.topic_id:
            if not challenge.algorithm_type:
                unlock_map[challenge.id] = True
                continue

            if challenge.id == first_by_algorithm.get(challenge.algorithm_type):
                unlock_map[challenge.id] = True
                continue

            prev_id = prev_by_algorithm_challenge.get(challenge.id)
            is_unlocked = bool(prev_id and prev_id in solved_ids)
            if not is_unlocked:
                is_unlocked = challenge.id in explicit_unlocked_ids

            unlock_map[challenge.id] = is_unlocked
            continue

        if challenge.id == first_by_topic.get(challenge.topic_id):
            unlock_map[challenge.id] = True
            continue

        is_unlocked = False
        if challenge.order_index > 0:
            prev_id = prev_by_challenge.get(challenge.id)
            if prev_id and prev_id in solved_ids:
                is_unlocked = True

        if not is_unlocked:
            is_unlocked = challenge.id in explicit_unlocked_ids

        unlock_map[challenge.id] = is_unlocked

    return unlock_map


def _build_preferred_variant_id_map(algorithm_level_keys):
    """
    Resolve canonical challenge ids for (algorithm_type, order_index) pairs.
    """
    if not algorithm_level_keys:
        return {}

    algorithm_types = {algorithm_type for algorithm_type, _ in algorithm_level_keys if algorithm_type}
    order_indexes = {order_index for _, order_index in algorithm_level_keys}
    rows = (
        Challenge.objects.filter(
            is_active=True,
            algorithm_type__in=algorithm_types,
            order_index__in=order_indexes,
        )
        .select_related('topic')
        .only('id', 'algorithm_type', 'order_index', 'topic__stable_id', 'topic__visualization_type')
    )

    preferred = {}
    for row in rows:
        key = (row.algorithm_type, row.order_index)
        if key not in algorithm_level_keys:
            continue
        score = _challenge_row_preference(row)
        current = preferred.get(key)
        if current is None or score > current['score']:
            preferred[key] = {'id': row.id, 'score': score}

    return {key: payload['id'] for key, payload in preferred.items()}


def _normalize_progress_rows_to_preferred_ids(user_progress_rows):
    """
    Normalize solved/unlocked ids to preferred challenge variants for deduped UI rows.
    """
    solved_ids = set()
    unlocked_ids = set()
    algorithm_level_keys = {
        (algorithm_type, order_index)
        for _, _, _, algorithm_type, order_index in user_progress_rows
        if algorithm_type
    }
    preferred_id_map = _build_preferred_variant_id_map(algorithm_level_keys)

    for challenge_id, is_solved, is_unlocked, algorithm_type, order_index in user_progress_rows:
        effective_id = challenge_id
        if algorithm_type:
            effective_id = preferred_id_map.get((algorithm_type, order_index), challenge_id)
        if is_solved:
            solved_ids.add(effective_id)
        if is_unlocked:
            unlocked_ids.add(effective_id)

    return solved_ids, unlocked_ids


def _unlock_next_challenge(user, challenge):
    """Unlock next challenge in sequence when one is solved."""
    if challenge.topic:
        next_challenge = (
            challenge.topic.challenges.filter(is_active=True, order_index__gt=challenge.order_index)
            .order_by('order_index', 'id')
            .first()
        )
    elif challenge.algorithm_type:
        # Topic-less legacy sequences unlock by algorithm type + order index.
        next_challenge = (
            Challenge.objects.filter(
                is_active=True,
                topic_id__isnull=True,
                algorithm_type=challenge.algorithm_type,
                order_index__gt=challenge.order_index,
            )
            .order_by('order_index', 'id')
            .first()
        )
    else:
        next_challenge = None

    if next_challenge:
        prog, _ = UserChallengeProg.objects.get_or_create(
            user=user,
            challenge=next_challenge,
            defaults={'is_unlocked': False},
        )
        if not prog.is_unlocked:
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


def _is_canonical_bank_topic(topic):
    stable_id = (getattr(topic, 'stable_id', '') or '').strip().lower()
    return bool(topic and stable_id.startswith(CANONICAL_TOPIC_PREFIX))


def _challenge_row_preference(challenge):
    topic = getattr(challenge, 'topic', None)
    stable_id = (getattr(topic, 'stable_id', '') or '').strip().lower()
    visualization_type = (getattr(topic, 'visualization_type', '') or '').strip().lower()
    return (
        1 if stable_id.startswith(CANONICAL_TOPIC_PREFIX) else 0,
        1 if visualization_type == 'graph' else 0,
        1 if topic else 0,
        challenge.id or 0,
    )


def _dedupe_algorithm_level_rows(challenges):
    passthrough = []
    by_level = {}

    for idx, challenge in enumerate(challenges):
        if not challenge.algorithm_type:
            passthrough.append((idx, challenge))
            continue

        key = (challenge.algorithm_type, challenge.order_index)
        candidate_score = _challenge_row_preference(challenge)
        current = by_level.get(key)
        if current is None:
            by_level[key] = {
                'first_pos': idx,
                'challenge': challenge,
                'score': candidate_score,
            }
            continue

        if candidate_score > current['score']:
            current['challenge'] = challenge
            current['score'] = candidate_score

    merged = passthrough + [
        (entry['first_pos'], entry['challenge'])
        for entry in by_level.values()
    ]
    merged.sort(key=lambda item: item[0])
    return [challenge for _, challenge in merged]


def _resolve_best_challenge_variant(challenge):
    if not challenge.algorithm_type:
        return challenge

    siblings = Challenge.objects.filter(
        is_active=True,
        algorithm_type=challenge.algorithm_type,
        order_index=challenge.order_index,
    ).select_related('topic')

    best = challenge
    best_score = _challenge_row_preference(challenge)
    for candidate in siblings:
        candidate_score = _challenge_row_preference(candidate)
        if candidate_score > best_score:
            best = candidate
            best_score = candidate_score
    return best


def _build_subtype_query_string(request_querydict, subtype):
    query_params = request_querydict.copy()
    # A subtype card click should open level listing for that type.
    # Carrying an active search term keeps list in subtype-index mode.
    query_params.pop('search', None)
    query_params['subtype'] = subtype
    encoded = query_params.urlencode()
    if encoded:
        return f'?{encoded}'
    return f'?{urlencode({"subtype": subtype})}'


def _is_placeholder_prompt(prompt):
    normalized = (prompt or '').strip()
    if not normalized:
        return True
    collapsed = re.sub(r'\s+', ' ', normalized)
    if PLACEHOLDER_PROMPT_RE.match(collapsed):
        return True
    return len(collapsed) < 12


def _build_graph_traversal_prompt(challenge):
    if challenge.algorithm_type not in {Challenge.AlgorithmType.BFS, Challenge.AlgorithmType.DFS}:
        return None

    payload = challenge.visualization_payload or {}
    raw_edges = payload.get('edges')
    start = _safe_int(payload.get('start'))
    if not isinstance(raw_edges, list) or not raw_edges or start is None or start < 0:
        return None

    edges = []
    node_set = {start}
    for edge in raw_edges:
        if not isinstance(edge, (list, tuple)) or len(edge) < 2:
            return None
        left = _safe_int(edge[0])
        right = _safe_int(edge[1])
        if left is None or right is None or left < 0 or right < 0:
            return None
        edges.append((left, right))
        node_set.add(left)
        node_set.add(right)

    if not edges:
        return None

    nodes = sorted(node_set)
    if nodes == list(range(nodes[-1] + 1)):
        node_text = f"0..{nodes[-1]}"
    else:
        node_text = ', '.join(str(node) for node in nodes)
    edge_text = ', '.join(f"({left},{right})" for left, right in edges)
    traversal_name = (
        'Breadth-First Search (BFS)'
        if challenge.algorithm_type == Challenge.AlgorithmType.BFS
        else 'Depth-First Search (DFS)'
    )
    return (
        f"Problem: Perform {traversal_name} from the given start node.\n"
        f"Input: nodes={node_text}, edges={edge_text}, start={start}\n"
        "Output: Return visitation order as space-separated node ids.\n"
        "Constraints: Traverse only reachable nodes; when choices exist, visit lower-numbered neighbors first."
    )


def _display_prompt_for_challenge(challenge):
    prompt = (challenge.prompt or '').strip()
    if prompt and not GENERIC_LEVEL_PROMPT_RE.match(prompt) and not _is_placeholder_prompt(prompt):
        return prompt

    graph_prompt = _build_graph_traversal_prompt(challenge)
    if graph_prompt:
        return graph_prompt

    level = (challenge.order_index + 1) if challenge.order_index is not None else 1
    difficulty_label = challenge.get_difficulty_display() if hasattr(challenge, 'get_difficulty_display') else challenge.difficulty
    algorithm_label = challenge.get_algorithm_type_display() if challenge.algorithm_type else 'this algorithm'
    action = ALGORITHM_PROMPT_ACTIONS.get(
        challenge.algorithm_type,
        'solve the given input carefully and provide the final computed answer',
    )
    return f"Level {level} ({difficulty_label}): Using {algorithm_label}, {action}."


def _load_action_payload(raw_payload):
    if not raw_payload:
        return None
    try:
        parsed = json.loads(raw_payload)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _build_knapsack_game_context(challenge):
    """Build safe, normalized payload for knapsack action mode."""
    if challenge.algorithm_type != Challenge.AlgorithmType.KNAPSACK:
        return None

    payload = challenge.visualization_payload or {}
    weights = payload.get('weights')
    values = payload.get('values')
    capacity = payload.get('capacity')
    if not isinstance(weights, list) or not isinstance(values, list) or len(weights) != len(values) or not weights:
        return None

    try:
        normalized_capacity = int(capacity)
        items = []
        for idx, (weight, value) in enumerate(zip(weights, values)):
            normalized_weight = int(weight)
            normalized_value = int(value)
            if normalized_weight <= 0:
                return None
            items.append(
                {
                    'index': idx,
                    'weight': normalized_weight,
                    'value': normalized_value,
                }
            )
    except (TypeError, ValueError):
        return None

    return {
        'capacity': normalized_capacity,
        'items': items,
    }


def _evaluate_knapsack_action_payload(challenge, action_payload):
    """
    Derive authoritative knapsack answer from action payload.
    Returns None when payload is unavailable/invalid.
    """
    knapsack_context = _build_knapsack_game_context(challenge)
    if not knapsack_context or not action_payload:
        return None

    selected_indices = action_payload.get('selected_indices')
    if not isinstance(selected_indices, list):
        return None

    item_count = len(knapsack_context['items'])
    normalized_indices = []
    for raw_index in selected_indices:
        try:
            idx = int(raw_index)
        except (TypeError, ValueError):
            return None
        if idx < 0 or idx >= item_count:
            return None
        normalized_indices.append(idx)

    normalized_indices = sorted(set(normalized_indices))
    total_weight = sum(knapsack_context['items'][idx]['weight'] for idx in normalized_indices)
    total_value = sum(knapsack_context['items'][idx]['value'] for idx in normalized_indices)
    is_over_capacity = total_weight > knapsack_context['capacity']

    return {
        'answer': str(total_value) if not is_over_capacity else '__knapsack_over_capacity__',
        'feedback': (
            f"Selection is overweight ({total_weight} / {knapsack_context['capacity']}). Stay within capacity to score."
            if is_over_capacity
            else None
        ),
        'diagnostics': {
            'knapsack_total_weight': total_weight,
            'knapsack_total_value': total_value,
            'knapsack_capacity': knapsack_context['capacity'],
            'knapsack_over_capacity': is_over_capacity,
            'knapsack_selected_indices': normalized_indices,
        },
    }


def _evaluate_activity_selection_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.ACTIVITY_SELECTION or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    starts = payload.get('starts')
    ends = payload.get('ends')
    if not isinstance(starts, list) or not isinstance(ends, list) or len(starts) != len(ends) or not starts:
        return None

    selected_indices = action_payload.get('selected_indices')
    if not isinstance(selected_indices, list):
        return None

    normalized_indices = []
    for raw_index in selected_indices:
        try:
            idx = int(raw_index)
        except (TypeError, ValueError):
            return None
        if idx < 0 or idx >= len(starts):
            return None
        normalized_indices.append(idx)

    normalized_indices = sorted(set(normalized_indices))
    intervals = sorted(
        [(int(starts[idx]), int(ends[idx])) for idx in normalized_indices],
        key=lambda item: (item[0], item[1]),
    )
    has_overlap = any(intervals[i][0] < intervals[i - 1][1] for i in range(1, len(intervals)))
    count = len(normalized_indices)

    return {
        'answer': str(count) if not has_overlap else '__activity_overlap__',
        'feedback': 'Selected activities overlap. Pick a non-overlapping schedule.' if has_overlap else None,
        'diagnostics': {
            'activity_selected_count': count,
            'activity_has_overlap': has_overlap,
            'activity_selected_indices': normalized_indices,
        },
    }


def _is_subsequence(subsequence, text):
    text_index = 0
    for ch in subsequence:
        text_index = text.find(ch, text_index)
        if text_index == -1:
            return False
        text_index += 1
    return True


def _evaluate_lcs_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.LCS or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    s1 = str(payload.get('s1', ''))
    s2 = str(payload.get('s2', ''))
    raw_candidate = action_payload.get('candidate_subsequence', '')
    candidate = '' if raw_candidate is None else str(raw_candidate)

    if not s1 or not s2:
        return None

    is_valid = _is_subsequence(candidate, s1) and _is_subsequence(candidate, s2)
    return {
        'answer': str(len(candidate)) if is_valid else '__invalid_lcs_subsequence__',
        'feedback': 'Candidate is not a valid subsequence in both strings.' if not is_valid else None,
        'diagnostics': {
            'lcs_candidate': candidate,
            'lcs_candidate_length': len(candidate),
            'lcs_candidate_valid': is_valid,
        },
    }


def _evaluate_backtracking_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.BACKTRACKING or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    values = payload.get('values')
    target = payload.get('target')
    if not isinstance(values, list) or not values:
        return None

    try:
        normalized_values = [int(v) for v in values]
        normalized_target = int(target)
    except (TypeError, ValueError):
        return None

    allowed = set(normalized_values)
    found_subsets = action_payload.get('found_subsets')
    if not isinstance(found_subsets, list):
        return None

    valid_unique_subsets = set()
    invalid_subset_count = 0

    for subset in found_subsets:
        if not isinstance(subset, list):
            invalid_subset_count += 1
            continue
        try:
            normalized_subset = [int(v) for v in subset]
        except (TypeError, ValueError):
            invalid_subset_count += 1
            continue
        if len(set(normalized_subset)) != len(normalized_subset):
            invalid_subset_count += 1
            continue
        if any(v not in allowed for v in normalized_subset):
            invalid_subset_count += 1
            continue
        if sum(normalized_subset) != normalized_target:
            invalid_subset_count += 1
            continue
        valid_unique_subsets.add(tuple(sorted(normalized_subset)))

    valid_count = len(valid_unique_subsets)
    return {
        'answer': str(valid_count),
        'feedback': (
            f'Ignored {invalid_subset_count} invalid subset(s). Only subsets summing to target are counted.'
            if invalid_subset_count
            else None
        ),
        'diagnostics': {
            'backtracking_valid_subset_count': valid_count,
            'backtracking_invalid_subset_count': invalid_subset_count,
        },
    }


def _evaluate_recursion_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.RECURSION or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    try:
        n_value = int(payload.get('n'))
    except (TypeError, ValueError):
        return None

    user_sequence = action_payload.get('sequence')
    if not isinstance(user_sequence, list):
        return None

    try:
        sequence = [int(v) for v in user_sequence]
    except (TypeError, ValueError):
        return None

    is_length_valid = len(sequence) == (n_value + 1)
    has_valid_base = len(sequence) >= 2 and sequence[0] == 0 and sequence[1] == 1
    follows_rule = all(sequence[idx] == sequence[idx - 1] + sequence[idx - 2] for idx in range(2, len(sequence)))
    is_valid = is_length_valid and has_valid_base and follows_rule

    return {
        'answer': str(sequence[-1]) if (sequence and is_valid) else '__invalid_fibonacci_sequence__',
        'feedback': 'Sequence does not follow Fibonacci base cases/recurrence.' if not is_valid else None,
        'diagnostics': {
            'recursion_sequence_valid': is_valid,
            'recursion_sequence_length': len(sequence),
        },
    }


def _evaluate_bit_conversion_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.BIT_CONVERSION or not action_payload:
        return None

    candidate = action_payload.get('binary')
    if isinstance(candidate, list):
        candidate = ''.join(str(bit) for bit in candidate)
    candidate = str(candidate or '').strip()

    if not candidate:
        return None
    if any(ch not in {'0', '1'} for ch in candidate):
        return None

    normalized = candidate.lstrip('0') or '0'
    return {
        'answer': normalized,
        'feedback': None,
        'diagnostics': {
            'bit_binary': normalized,
            'bit_length': len(normalized),
        },
    }


def _extract_unweighted_graph_payload(payload):
    edges = payload.get('edges')
    if not isinstance(edges, list):
        return None

    normalized_edges = []
    max_node = -1
    for edge in edges:
        if not isinstance(edge, (list, tuple)) or len(edge) != 2:
            return None
        left = _safe_int(edge[0])
        right = _safe_int(edge[1])
        if left is None or right is None or left < 0 or right < 0:
            return None
        normalized_edges.append((left, right))
        max_node = max(max_node, left, right)

    nodes = payload.get('nodes')
    if isinstance(nodes, list) and nodes:
        normalized_nodes = []
        for node in nodes:
            normalized_node = _safe_int(node)
            if normalized_node is None or normalized_node < 0:
                return None
            normalized_nodes.append(normalized_node)
        max_node = max(max_node, max(normalized_nodes))

    if max_node < 0:
        return None

    node_count = max_node + 1
    adjacency = {idx: [] for idx in range(node_count)}
    for left, right in normalized_edges:
        adjacency[left].append(right)
        adjacency[right].append(left)
    return adjacency


def _canonical_bfs_order(adjacency, start):
    if start not in adjacency:
        return None
    for node in adjacency:
        adjacency[node].sort()
    queue = deque([start])
    visited = {start}
    order = []
    while queue:
        current = queue.popleft()
        order.append(current)
        for nxt in adjacency[current]:
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)
    return order


def _canonical_dfs_order(adjacency, start):
    if start not in adjacency:
        return None
    for node in adjacency:
        adjacency[node].sort(reverse=True)
    stack = [start]
    visited = set()
    order = []
    while stack:
        current = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        order.append(current)
        for nxt in adjacency[current]:
            if nxt not in visited:
                stack.append(nxt)
    return order


def _normalize_node_sequence(raw_sequence):
    if not isinstance(raw_sequence, list):
        return None
    normalized = []
    for raw in raw_sequence:
        node = _safe_int(raw)
        if node is None:
            return None
        normalized.append(node)
    return normalized


def _evaluate_bfs_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.BFS or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    adjacency = _extract_unweighted_graph_payload(payload)
    start = _safe_int(payload.get('start'))
    candidate = _normalize_node_sequence(action_payload.get('visitation_order'))
    if adjacency is None or start is None or candidate is None:
        return None

    canonical = _canonical_bfs_order(adjacency, start)
    if canonical is None:
        return None

    valid_nodes = set(adjacency.keys())
    if any(node not in valid_nodes for node in candidate):
        return {
            'answer': '__invalid_bfs_order__',
            'feedback': 'Traversal contains node ids outside the graph.',
            'diagnostics': {'graph_algorithm': 'bfs'},
        }
    if len(set(candidate)) != len(candidate):
        return {
            'answer': '__invalid_bfs_order__',
            'feedback': 'Traversal order cannot repeat nodes.',
            'diagnostics': {'graph_algorithm': 'bfs'},
        }

    answer = ' '.join(str(node) for node in candidate)
    feedback = None
    if candidate and candidate[0] != start:
        feedback = 'BFS traversal must start from the given start node.'

    return {
        'answer': answer,
        'feedback': feedback,
        'diagnostics': {
            'graph_algorithm': 'bfs',
            'graph_selected_order': candidate,
            'graph_expected_order': canonical,
        },
    }


def _evaluate_dfs_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.DFS or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    adjacency = _extract_unweighted_graph_payload(payload)
    start = _safe_int(payload.get('start'))
    candidate = _normalize_node_sequence(action_payload.get('visitation_order'))
    if adjacency is None or start is None or candidate is None:
        return None

    canonical = _canonical_dfs_order(adjacency, start)
    if canonical is None:
        return None

    valid_nodes = set(adjacency.keys())
    if any(node not in valid_nodes for node in candidate):
        return {
            'answer': '__invalid_dfs_order__',
            'feedback': 'Traversal contains node ids outside the graph.',
            'diagnostics': {'graph_algorithm': 'dfs'},
        }
    if len(set(candidate)) != len(candidate):
        return {
            'answer': '__invalid_dfs_order__',
            'feedback': 'Traversal order cannot repeat nodes.',
            'diagnostics': {'graph_algorithm': 'dfs'},
        }

    answer = ' '.join(str(node) for node in candidate)
    feedback = None
    if candidate and candidate[0] != start:
        feedback = 'DFS traversal must start from the given start node.'

    return {
        'answer': answer,
        'feedback': feedback,
        'diagnostics': {
            'graph_algorithm': 'dfs',
            'graph_selected_order': candidate,
            'graph_expected_order': canonical,
        },
    }


def _extract_weighted_graph_payload(payload):
    weighted_edges = payload.get('weighted_edges')
    if not isinstance(weighted_edges, list) or not weighted_edges:
        return None

    normalized_edges = []
    max_node = -1
    edge_weights = {}
    for edge in weighted_edges:
        if not isinstance(edge, (list, tuple)) or len(edge) < 3:
            return None
        left = _safe_int(edge[0])
        right = _safe_int(edge[1])
        weight = _safe_int(edge[2])
        if left is None or right is None or weight is None:
            return None
        if left < 0 or right < 0 or weight <= 0:
            return None
        normalized_edges.append((left, right, weight))
        max_node = max(max_node, left, right)
        edge_weights[(left, right)] = min(weight, edge_weights.get((left, right), weight))
        edge_weights[(right, left)] = min(weight, edge_weights.get((right, left), weight))

    source = _safe_int(payload.get('source'))
    target = _safe_int(payload.get('target'))
    if source is None or target is None or source < 0 or target < 0:
        return None
    max_node = max(max_node, source, target)

    node_count = max_node + 1
    adjacency = {idx: [] for idx in range(node_count)}
    for left, right, weight in normalized_edges:
        adjacency[left].append((right, weight))
        adjacency[right].append((left, weight))

    return {
        'adjacency': adjacency,
        'edge_weights': edge_weights,
        'source': source,
        'target': target,
    }


def _shortest_weighted_distance(adjacency, source, target):
    if source not in adjacency or target not in adjacency:
        return -1
    distances = {node: math.inf for node in adjacency}
    distances[source] = 0
    heap = [(0, source)]
    while heap:
        current_distance, node = heappop(heap)
        if current_distance > distances[node]:
            continue
        if node == target:
            return int(current_distance)
        for nxt, weight in adjacency[node]:
            candidate = current_distance + weight
            if candidate < distances[nxt]:
                distances[nxt] = candidate
                heappush(heap, (candidate, nxt))
    return -1


def _evaluate_dijkstra_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.DIJKSTRA or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    graph = _extract_weighted_graph_payload(payload)
    if graph is None:
        return None

    shortest = _shortest_weighted_distance(graph['adjacency'], graph['source'], graph['target'])
    is_unreachable = action_payload.get('is_unreachable') is True
    path_nodes = _normalize_node_sequence(action_payload.get('path_nodes'))

    if is_unreachable:
        return {
            'answer': '-1',
            'feedback': None if shortest == -1 else 'A path exists. Build a valid source-to-target route.',
            'diagnostics': {
                'graph_algorithm': 'dijkstra',
                'graph_shortest_distance': shortest,
                'graph_selected_distance': -1,
            },
        }

    if not isinstance(path_nodes, list) or len(path_nodes) < 2:
        return {
            'answer': '__invalid_dijkstra_path__',
            'feedback': 'Select a path from source to target.',
            'diagnostics': {'graph_algorithm': 'dijkstra'},
        }

    if path_nodes[0] != graph['source'] or path_nodes[-1] != graph['target']:
        return {
            'answer': '__invalid_dijkstra_path__',
            'feedback': 'Path must start at source and end at target.',
            'diagnostics': {'graph_algorithm': 'dijkstra'},
        }

    path_cost = 0
    for idx in range(1, len(path_nodes)):
        left = path_nodes[idx - 1]
        right = path_nodes[idx]
        edge_weight = graph['edge_weights'].get((left, right))
        if edge_weight is None:
            return {
                'answer': '__invalid_dijkstra_path__',
                'feedback': 'Path contains an edge not present in graph.',
                'diagnostics': {'graph_algorithm': 'dijkstra'},
            }
        path_cost += edge_weight

    feedback = None
    if shortest != -1 and path_cost > shortest:
        feedback = 'Path is valid but not shortest. Try a lower total weight route.'

    return {
        'answer': str(path_cost),
        'feedback': feedback,
        'diagnostics': {
            'graph_algorithm': 'dijkstra',
            'graph_selected_path': path_nodes,
            'graph_selected_distance': path_cost,
            'graph_shortest_distance': shortest,
        },
    }


def _extract_grid_payload(payload):
    rows = _safe_int(payload.get('rows'))
    cols = _safe_int(payload.get('cols'))
    blocked_raw = payload.get('blocked')
    if rows is None or cols is None or rows <= 0 or cols <= 0:
        return None
    if not isinstance(blocked_raw, list):
        blocked_raw = []

    blocked = set()
    for cell in blocked_raw:
        if not isinstance(cell, (list, tuple)) or len(cell) != 2:
            return None
        r = _safe_int(cell[0])
        c = _safe_int(cell[1])
        if r is None or c is None:
            return None
        if r < 0 or c < 0 or r >= rows or c >= cols:
            return None
        blocked.add((r, c))
    return {'rows': rows, 'cols': cols, 'blocked': blocked}


def _grid_shortest_distance(rows, cols, blocked):
    start = (0, 0)
    goal = (rows - 1, cols - 1)
    if start in blocked or goal in blocked:
        return -1
    queue = deque([(start[0], start[1], 0)])
    visited = {start}
    directions = ((1, 0), (-1, 0), (0, 1), (0, -1))
    while queue:
        row, col, dist = queue.popleft()
        if (row, col) == goal:
            return dist
        for dr, dc in directions:
            nr = row + dr
            nc = col + dc
            nxt = (nr, nc)
            if 0 <= nr < rows and 0 <= nc < cols and nxt not in blocked and nxt not in visited:
                visited.add(nxt)
                queue.append((nr, nc, dist + 1))
    return -1


def _normalize_grid_path(raw_path):
    if not isinstance(raw_path, list):
        return None
    normalized = []
    for cell in raw_path:
        if not isinstance(cell, (list, tuple)) or len(cell) != 2:
            return None
        row = _safe_int(cell[0])
        col = _safe_int(cell[1])
        if row is None or col is None:
            return None
        normalized.append((row, col))
    return normalized


def _evaluate_astar_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.ASTAR or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    grid = _extract_grid_payload(payload)
    if grid is None:
        return None

    shortest = _grid_shortest_distance(grid['rows'], grid['cols'], grid['blocked'])
    is_unreachable = action_payload.get('is_unreachable') is True
    path = _normalize_grid_path(action_payload.get('path'))
    goal = (grid['rows'] - 1, grid['cols'] - 1)

    if is_unreachable:
        return {
            'answer': '-1',
            'feedback': None if shortest == -1 else 'A route exists. Build a valid path to the goal.',
            'diagnostics': {
                'graph_algorithm': 'astar',
                'graph_selected_moves': -1,
                'graph_shortest_moves': shortest,
            },
        }

    if not path:
        return {
            'answer': '__invalid_astar_path__',
            'feedback': 'Build a path from start to goal, or mark unreachable.',
            'diagnostics': {'graph_algorithm': 'astar'},
        }

    if path[0] != (0, 0):
        return {
            'answer': '__invalid_astar_path__',
            'feedback': 'Path must start at (0, 0).',
            'diagnostics': {'graph_algorithm': 'astar'},
        }
    if path[-1] != goal:
        return {
            'answer': '__invalid_astar_path__',
            'feedback': 'Path must end at goal cell.',
            'diagnostics': {'graph_algorithm': 'astar'},
        }

    for idx, cell in enumerate(path):
        row, col = cell
        if row < 0 or col < 0 or row >= grid['rows'] or col >= grid['cols']:
            return {
                'answer': '__invalid_astar_path__',
                'feedback': 'Path steps must stay inside grid bounds.',
                'diagnostics': {'graph_algorithm': 'astar'},
            }
        if cell in grid['blocked']:
            return {
                'answer': '__invalid_astar_path__',
                'feedback': 'Path cannot go through blocked cells.',
                'diagnostics': {'graph_algorithm': 'astar'},
            }
        if idx > 0:
            prev = path[idx - 1]
            if abs(prev[0] - row) + abs(prev[1] - col) != 1:
                return {
                    'answer': '__invalid_astar_path__',
                    'feedback': 'Use only 4-direction adjacent moves.',
                    'diagnostics': {'graph_algorithm': 'astar'},
                }

    moves = len(path) - 1
    feedback = None
    if shortest != -1 and moves > shortest:
        feedback = 'Path reaches goal but is not shortest.'

    return {
        'answer': str(moves),
        'feedback': feedback,
        'diagnostics': {
            'graph_algorithm': 'astar',
            'graph_selected_moves': moves,
            'graph_shortest_moves': shortest,
            'graph_path_length': len(path),
        },
    }


def _minimax_fold_value(leaves):
    if not leaves:
        return None
    level = list(leaves)
    maximizing = False
    while len(level) > 1:
        if len(level) % 2 != 0:
            return None
        nxt = []
        for idx in range(0, len(level), 2):
            left = level[idx]
            right = level[idx + 1]
            nxt.append(max(left, right) if maximizing else min(left, right))
        level = nxt
        maximizing = not maximizing
    return level[0]


def _evaluate_minimax_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.MINIMAX or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    leaves_raw = payload.get('leaves')
    if not isinstance(leaves_raw, list) or len(leaves_raw) < 2:
        return None

    leaves = []
    for raw in leaves_raw:
        value = _safe_int(raw)
        if value is None:
            return None
        leaves.append(value)

    expected = _minimax_fold_value(leaves)
    root_value = _safe_int(action_payload.get('root_value'))
    if expected is None or root_value is None:
        return None

    feedback = None if root_value == expected else 'Fold pair values level by level with the shown min/max turns.'
    return {
        'answer': str(root_value),
        'feedback': feedback,
        'diagnostics': {
            'graph_algorithm': 'minimax',
            'graph_root_candidate': root_value,
            'graph_root_expected': expected,
        },
    }


def _is_close_number(left, right, tolerance=1e-9):
    return abs(left - right) <= tolerance


def _resolve_selected_search_index(action_payload):
    if action_payload.get('is_not_found') is True:
        return -1
    selected_raw = action_payload.get('selected_index', action_payload.get('result_index'))
    if selected_raw is None:
        return None
    return _safe_int(selected_raw)


def _evaluate_linked_list_action_payload(challenge, action_payload):
    linked_algorithms = {
        Challenge.AlgorithmType.LINKED_LIST,
        Challenge.AlgorithmType.DOUBLY_LINKED_LIST,
        Challenge.AlgorithmType.CIRCULAR_LINKED_LIST,
    }
    if challenge.algorithm_type not in linked_algorithms or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    values, _ = _normalize_numeric_list(payload.get('values'))
    target = _safe_float(payload.get('target'))
    selected_index = _resolve_selected_search_index(action_payload)
    if not values or target is None or selected_index is None:
        return None

    if selected_index < -1 or selected_index >= len(values):
        return {
            'answer': '__invalid_linked_index__',
            'feedback': 'Selected index is out of range.',
            'diagnostics': {'linked_selection_valid': False},
        }

    expected_index = -1
    if challenge.algorithm_type == Challenge.AlgorithmType.CIRCULAR_LINKED_LIST:
        start_index = _safe_int(payload.get('start_index') or 0)
        if start_index is None or start_index < 0 or start_index >= len(values):
            start_index = 0
        for step in range(len(values)):
            idx = (start_index + step) % len(values)
            if _is_close_number(values[idx], target):
                expected_index = idx
                break
    elif challenge.algorithm_type == Challenge.AlgorithmType.DOUBLY_LINKED_LIST and payload.get('from_end') is True:
        for idx in range(len(values) - 1, -1, -1):
            if _is_close_number(values[idx], target):
                expected_index = idx
                break
    else:
        for idx, value in enumerate(values):
            if _is_close_number(value, target):
                expected_index = idx
                break

    if selected_index == -1:
        feedback = None if expected_index == -1 else 'Target exists in the list. Choose the correct node index.'
    else:
        if not _is_close_number(values[selected_index], target):
            return {
                'answer': '__invalid_linked_pick__',
                'feedback': 'Chosen node does not match target value.',
                'diagnostics': {'linked_selection_valid': False},
            }
        feedback = None if selected_index == expected_index else 'Chosen node is valid for value but not the expected traversal result.'

    return {
        'answer': str(selected_index),
        'feedback': feedback,
        'diagnostics': {
            'linked_selection_valid': True,
            'linked_selected_index': selected_index,
            'linked_expected_index': expected_index,
            'linked_target': _format_number_token(target),
        },
    }


def _normalize_operation_sequence(raw_operations):
    if not isinstance(raw_operations, list):
        return None

    normalized = []
    for entry in raw_operations:
        if isinstance(entry, str):
            op = entry.strip().lower()
            value = None
        elif isinstance(entry, dict):
            op = str(entry.get('op', '')).strip().lower()
            value = entry.get('value')
        elif isinstance(entry, (list, tuple)) and entry:
            op = str(entry[0]).strip().lower()
            value = entry[1] if len(entry) > 1 else None
        else:
            return None

        if op not in {'push', 'pop', 'enqueue', 'dequeue'}:
            return None
        if op in {'push', 'enqueue'}:
            numeric = _safe_float(value)
            if numeric is None:
                return None
            normalized.append({'op': op, 'value': numeric})
        else:
            normalized.append({'op': op, 'value': None})
    return normalized


def _simulate_stack(initial_values, operations):
    stack = list(initial_values)
    for entry in operations:
        op = entry['op']
        if op == 'push':
            stack.append(entry['value'])
        elif op == 'pop':
            if stack:
                stack.pop()
        else:
            return None
    return stack


def _simulate_queue(initial_values, operations):
    queue = deque(initial_values)
    for entry in operations:
        op = entry['op']
        if op == 'enqueue':
            queue.append(entry['value'])
        elif op == 'dequeue':
            if queue:
                queue.popleft()
        else:
            return None
    return list(queue)


def _evaluate_stack_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.STACK or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    initial_values, _ = _normalize_numeric_list(payload.get('initial') or [])
    operations = _normalize_operation_sequence(payload.get('operations'))
    if initial_values is None or operations is None:
        return None

    canonical_stack = _simulate_stack(initial_values, operations)
    if canonical_stack is None:
        return None

    applied_count = _safe_int(action_payload.get('applied_count'))
    if applied_count is None:
        applied_count = len(operations)
    if applied_count < 0 or applied_count > len(operations):
        return {
            'answer': '__invalid_stack_state__',
            'feedback': 'Applied operation count is invalid.',
            'diagnostics': {'stack_state_valid': False},
        }
    if applied_count < len(operations):
        return {
            'answer': '__stack_incomplete__',
            'feedback': 'Apply all operations before submitting.',
            'diagnostics': {'stack_state_valid': False, 'stack_applied_count': applied_count},
        }

    submitted_stack_raw = action_payload.get('final_stack')
    submitted_stack, _ = _normalize_numeric_list(
        submitted_stack_raw if isinstance(submitted_stack_raw, list) else canonical_stack,
        allow_empty=True,
    )
    if submitted_stack is None:
        return {
            'answer': '__invalid_stack_state__',
            'feedback': 'Final stack state is invalid.',
            'diagnostics': {'stack_state_valid': False},
        }
    if len(submitted_stack) != len(canonical_stack) or any(not _is_close_number(submitted_stack[i], canonical_stack[i]) for i in range(len(canonical_stack))):
        return {
            'answer': '__invalid_stack_state__',
            'feedback': 'Submitted stack state does not match operation result.',
            'diagnostics': {'stack_state_valid': False},
        }

    top_value = 'empty' if not canonical_stack else (_format_number_token(canonical_stack[-1]) or 'empty')
    return {
        'answer': top_value,
        'feedback': None,
        'diagnostics': {
            'stack_state_valid': True,
            'stack_final_size': len(canonical_stack),
            'stack_top': top_value,
        },
    }


def _evaluate_queue_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.QUEUE or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    initial_values, _ = _normalize_numeric_list(payload.get('initial') or [])
    operations = _normalize_operation_sequence(payload.get('operations'))
    if initial_values is None or operations is None:
        return None

    canonical_queue = _simulate_queue(initial_values, operations)
    if canonical_queue is None:
        return None

    applied_count = _safe_int(action_payload.get('applied_count'))
    if applied_count is None:
        applied_count = len(operations)
    if applied_count < 0 or applied_count > len(operations):
        return {
            'answer': '__invalid_queue_state__',
            'feedback': 'Applied operation count is invalid.',
            'diagnostics': {'queue_state_valid': False},
        }
    if applied_count < len(operations):
        return {
            'answer': '__queue_incomplete__',
            'feedback': 'Apply all operations before submitting.',
            'diagnostics': {'queue_state_valid': False, 'queue_applied_count': applied_count},
        }

    submitted_queue_raw = action_payload.get('final_queue')
    submitted_queue, _ = _normalize_numeric_list(
        submitted_queue_raw if isinstance(submitted_queue_raw, list) else canonical_queue,
        allow_empty=True,
    )
    if submitted_queue is None:
        return {
            'answer': '__invalid_queue_state__',
            'feedback': 'Final queue state is invalid.',
            'diagnostics': {'queue_state_valid': False},
        }
    if len(submitted_queue) != len(canonical_queue) or any(not _is_close_number(submitted_queue[i], canonical_queue[i]) for i in range(len(canonical_queue))):
        return {
            'answer': '__invalid_queue_state__',
            'feedback': 'Submitted queue state does not match operation result.',
            'diagnostics': {'queue_state_valid': False},
        }

    front_value = 'empty' if not canonical_queue else (_format_number_token(canonical_queue[0]) or 'empty')
    return {
        'answer': front_value,
        'feedback': None,
        'diagnostics': {
            'queue_state_valid': True,
            'queue_final_size': len(canonical_queue),
            'queue_front': front_value,
        },
    }


def _evaluate_linear_search_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.LINEAR_SEARCH or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    data_values, _ = _normalize_numeric_list(payload.get('data'))
    target = _safe_float(payload.get('target'))
    selected_index = _resolve_selected_search_index(action_payload)
    if not data_values or target is None or selected_index is None:
        return None

    if selected_index < -1 or selected_index >= len(data_values):
        return {
            'answer': '__invalid_linear_search_index__',
            'feedback': 'Selected index is out of range for this array.',
            'diagnostics': {'search_type': 'linear', 'search_selected_index': selected_index},
        }

    first_match_index = -1
    for idx, value in enumerate(data_values):
        if _is_close_number(value, target):
            first_match_index = idx
            break

    if selected_index == -1:
        feedback = None if first_match_index == -1 else 'Target exists in array. Choose its first occurrence index.'
    else:
        if not _is_close_number(data_values[selected_index], target):
            return {
                'answer': '__invalid_linear_search_pick__',
                'feedback': 'Chosen index does not match target value.',
                'diagnostics': {'search_type': 'linear', 'search_selected_index': selected_index},
            }
        feedback = None if first_match_index == selected_index else 'For linear search, return the first matching index.'

    return {
        'answer': str(selected_index),
        'feedback': feedback,
        'diagnostics': {
            'search_type': 'linear',
            'search_selected_index': selected_index,
            'search_expected_index': first_match_index,
            'search_target': _format_number_token(target),
        },
    }


def _evaluate_binary_search_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.BINARY_SEARCH or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    data_values, _ = _normalize_numeric_list(payload.get('data'))
    target = _safe_float(payload.get('target'))
    selected_index = _resolve_selected_search_index(action_payload)
    if not data_values or target is None or selected_index is None:
        return None

    if selected_index < -1 or selected_index >= len(data_values):
        return {
            'answer': '__invalid_binary_search_index__',
            'feedback': 'Selected index is out of range for this array.',
            'diagnostics': {'search_type': 'binary', 'search_selected_index': selected_index},
        }

    is_sorted = all(data_values[idx] <= data_values[idx + 1] for idx in range(len(data_values) - 1))
    if not is_sorted:
        return None

    expected_index = -1
    low = 0
    high = len(data_values) - 1
    while low <= high:
        mid = (low + high) // 2
        if _is_close_number(data_values[mid], target):
            expected_index = mid
            break
        if data_values[mid] < target:
            low = mid + 1
        else:
            high = mid - 1

    if selected_index == -1:
        feedback = None if expected_index == -1 else 'Target exists in array. Follow comparisons to locate its index.'
    else:
        if not _is_close_number(data_values[selected_index], target):
            return {
                'answer': '__invalid_binary_search_pick__',
                'feedback': 'Chosen index does not match target value.',
                'diagnostics': {'search_type': 'binary', 'search_selected_index': selected_index},
            }
        feedback = None

    return {
        'answer': str(selected_index),
        'feedback': feedback,
        'diagnostics': {
            'search_type': 'binary',
            'search_selected_index': selected_index,
            'search_expected_index': expected_index,
            'search_target': _format_number_token(target),
        },
    }


def _longest_common_prefix_text(words):
    if not words:
        return ''
    prefix = words[0]
    for word in words[1:]:
        while not word.startswith(prefix):
            prefix = prefix[:-1]
            if not prefix:
                return ''
    return prefix


def _evaluate_string_algorithm_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.STRING_ALGORITHM or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    raw_words = payload.get('words')
    if not isinstance(raw_words, list) or not raw_words:
        return None

    words = [str(word) for word in raw_words]
    candidate = action_payload.get('candidate_prefix', action_payload.get('prefix'))
    candidate = str(candidate if candidate is not None else '')

    is_common_prefix = all(word.startswith(candidate) for word in words)
    max_prefix = _longest_common_prefix_text(words)
    can_extend = is_common_prefix and len(candidate) < len(max_prefix)

    if not is_common_prefix:
        return {
            'answer': '__invalid_string_prefix__',
            'feedback': 'Candidate is not a common prefix for all words.',
            'diagnostics': {
                'string_candidate_prefix': candidate,
                'string_max_prefix': max_prefix,
                'string_is_common_prefix': False,
                'string_can_extend': False,
            },
        }

    return {
        'answer': candidate,
        'feedback': 'Valid prefix, but it can be extended.' if can_extend else None,
        'diagnostics': {
            'string_candidate_prefix': candidate,
            'string_max_prefix': max_prefix,
            'string_is_common_prefix': True,
            'string_can_extend': can_extend,
        },
    }


def _resolve_array_subrange(action_payload, item_count):
    start = _safe_int(action_payload.get('start_index'))
    end = _safe_int(action_payload.get('end_index'))
    if start is not None and end is not None:
        if start > end:
            start, end = end, start
        if start < 0 or end < 0 or start >= item_count or end >= item_count:
            return None
        return start, end

    selected = action_payload.get('selected_indices')
    if not isinstance(selected, list) or not selected:
        return None
    normalized = []
    for raw_index in selected:
        idx = _safe_int(raw_index)
        if idx is None or idx < 0 or idx >= item_count:
            return None
        normalized.append(idx)
    normalized = sorted(set(normalized))
    if not normalized:
        return None
    expected = list(range(normalized[0], normalized[-1] + 1))
    if normalized != expected:
        return None
    return normalized[0], normalized[-1]


def _evaluate_array_algorithm_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.ARRAY_ALGORITHM or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    values, _ = _normalize_numeric_list(payload.get('data'))
    if not values:
        return None

    bounds = _resolve_array_subrange(action_payload, len(values))
    if bounds is None:
        return {
            'answer': '__invalid_array_subrange__',
            'feedback': 'Choose one contiguous subarray range.',
            'diagnostics': {'array_selection_valid': False},
        }

    start, end = bounds
    segment = values[start:end + 1]
    total = sum(segment)
    answer_token = _format_number_token(total)
    if answer_token is None:
        return {
            'answer': '__invalid_array_subrange__',
            'feedback': 'Unable to compute selected subarray sum.',
            'diagnostics': {'array_selection_valid': False},
        }

    return {
        'answer': answer_token,
        'feedback': None,
        'diagnostics': {
            'array_selection_valid': True,
            'array_selected_start': start,
            'array_selected_end': end,
            'array_selected_sum': answer_token,
            'array_selected_length': end - start + 1,
        },
    }


def _has_pair_sum(values, target):
    seen = set()
    for value in values:
        complement = target - value
        if complement in seen:
            return True
        seen.add(value)
    return False


def _evaluate_hashing_algorithm_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.HASHING_ALGORITHM or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    values, _ = _normalize_numeric_list(payload.get('arr'))
    target = _safe_float(payload.get('target'))
    if not values or target is None:
        return None

    pair_exists = _has_pair_sum(values, target)
    declare_no_pair = action_payload.get('declare_no_pair') is True or action_payload.get('is_not_found') is True

    selected_indices = action_payload.get('selected_indices')
    if isinstance(selected_indices, list) and selected_indices:
        normalized = []
        for raw_index in selected_indices:
            idx = _safe_int(raw_index)
            if idx is None or idx < 0 or idx >= len(values):
                return {
                    'answer': '__invalid_hash_selection__',
                    'feedback': 'Selected index is out of bounds.',
                    'diagnostics': {'hashing_selection_valid': False},
                }
            normalized.append(idx)

        normalized = sorted(set(normalized))
        if len(normalized) != 2:
            return {
                'answer': '__invalid_hash_selection__',
                'feedback': 'Select exactly two distinct indices.',
                'diagnostics': {'hashing_selection_valid': False},
            }

        selected_sum = values[normalized[0]] + values[normalized[1]]
        is_pair_valid = _is_close_number(selected_sum, target)
        if not is_pair_valid:
            return {
                'answer': '__invalid_hash_pair__',
                'feedback': 'Selected pair does not sum to target.',
                'diagnostics': {
                    'hashing_selection_valid': True,
                    'hashing_selected_indices': normalized,
                    'hashing_selected_sum': _format_number_token(selected_sum),
                    'hashing_target': _format_number_token(target),
                    'hashing_pair_exists': pair_exists,
                },
            }

        return {
            'answer': 'true',
            'feedback': None,
            'diagnostics': {
                'hashing_selection_valid': True,
                'hashing_selected_indices': normalized,
                'hashing_selected_sum': _format_number_token(selected_sum),
                'hashing_target': _format_number_token(target),
                'hashing_pair_exists': pair_exists,
            },
        }

    if declare_no_pair:
        return {
            'answer': 'false',
            'feedback': None if not pair_exists else 'A valid pair exists. Try selecting two indices that sum to target.',
            'diagnostics': {
                'hashing_selection_valid': True,
                'hashing_pair_exists': pair_exists,
                'hashing_target': _format_number_token(target),
            },
        }

    has_pair = action_payload.get('has_pair')
    if isinstance(has_pair, bool):
        return {
            'answer': 'true' if has_pair else 'false',
            'feedback': None if (has_pair == pair_exists) else 'Selection does not match actual pair-sum existence.',
            'diagnostics': {
                'hashing_selection_valid': True,
                'hashing_pair_exists': pair_exists,
                'hashing_target': _format_number_token(target),
            },
        }

    return {
        'answer': '__invalid_hash_selection__',
        'feedback': 'Choose two indices or mark no pair.',
        'diagnostics': {'hashing_selection_valid': False},
    }


def _format_number_token(value):
    normalized = _safe_float(value)
    if normalized is None or not math.isfinite(normalized):
        return None
    rounded_int = round(normalized)
    if abs(normalized - rounded_int) < 1e-9:
        return str(int(rounded_int))
    return f"{normalized:.3f}".rstrip('0').rstrip('.')


def _normalize_numeric_list(raw_values, allow_empty=False):
    if not isinstance(raw_values, list):
        return None, None
    if not raw_values:
        if allow_empty:
            return [], []
        return None, None
    numeric_values = []
    tokens = []
    for raw_value in raw_values:
        numeric_value = _safe_float(raw_value)
        if numeric_value is None or not math.isfinite(numeric_value):
            return None, None
        token = _format_number_token(numeric_value)
        if token is None:
            return None, None
        numeric_values.append(numeric_value)
        tokens.append(token)
    return numeric_values, tokens


def _apply_swap_sequence(base_values, swap_sequence):
    if not isinstance(swap_sequence, list):
        return None
    working = list(base_values)
    for swap in swap_sequence:
        if not isinstance(swap, (list, tuple)) or len(swap) != 2:
            return None
        left = _safe_int(swap[0])
        right = _safe_int(swap[1])
        if left is None or right is None:
            return None
        if left < 0 or right < 0 or left >= len(working) or right >= len(working):
            return None
        working[left], working[right] = working[right], working[left]
    return working


def _evaluate_sorting_action_payload(challenge, action_payload):
    sorting_algorithms = {
        Challenge.AlgorithmType.BUBBLE_SORT,
        Challenge.AlgorithmType.SELECTION_SORT,
        Challenge.AlgorithmType.INSERTION_SORT,
        Challenge.AlgorithmType.MERGE_SORT,
        Challenge.AlgorithmType.QUICK_SORT,
        Challenge.AlgorithmType.HEAP_SORT,
    }
    if challenge.algorithm_type not in sorting_algorithms or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    source_values, source_tokens = _normalize_numeric_list(payload.get('data'))
    if not source_values:
        return None

    candidate_values = None
    candidate_tokens = None
    candidate_array = action_payload.get('array')
    if isinstance(candidate_array, list):
        candidate_values, candidate_tokens = _normalize_numeric_list(candidate_array)
    elif isinstance(action_payload.get('final_array'), list):
        candidate_values, candidate_tokens = _normalize_numeric_list(action_payload.get('final_array'))
    elif isinstance(action_payload.get('swaps'), list):
        candidate_values = _apply_swap_sequence(source_values, action_payload.get('swaps'))
        if candidate_values is not None:
            candidate_tokens = [_format_number_token(value) for value in candidate_values]

    if candidate_values is None or candidate_tokens is None:
        return {
            'answer': '__invalid_sorting_array__',
            'feedback': 'Sorting state is invalid. Submit a valid reordered array.',
            'diagnostics': {'sorting_payload_valid': False},
        }

    if len(candidate_values) != len(source_values):
        return {
            'answer': '__invalid_sorting_array__',
            'feedback': 'Sorting state has incorrect length.',
            'diagnostics': {'sorting_payload_valid': False},
        }

    if Counter(candidate_tokens) != Counter(source_tokens):
        return {
            'answer': '__invalid_sorting_array__',
            'feedback': 'Sorted array must contain exactly the same values as input.',
            'diagnostics': {'sorting_payload_valid': False},
        }

    is_sorted = all(candidate_values[idx] <= candidate_values[idx + 1] for idx in range(len(candidate_values) - 1))
    answer = ' '.join(candidate_tokens)
    swaps = action_payload.get('swaps')

    return {
        'answer': answer,
        'feedback': None if is_sorted else 'Array is not fully sorted yet. Arrange in non-decreasing order.',
        'diagnostics': {
            'sorting_payload_valid': True,
            'sorting_is_sorted': is_sorted,
            'sorting_current_answer': answer,
            'sorting_swap_count': len(swaps) if isinstance(swaps, list) else 0,
        },
    }


def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _sigmoid(value):
    return 1.0 / (1.0 + math.exp(-value))


def _evaluate_linear_regression_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.LINEAR_REGRESSION or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    points = payload.get('points')
    query_x = _safe_float(payload.get('query_x'))
    selected_indices = action_payload.get('selected_indices')

    if not isinstance(points, list) or len(points) < 2 or query_x is None or not isinstance(selected_indices, list):
        return None

    normalized_indices = []
    for raw_index in selected_indices:
        idx = _safe_int(raw_index)
        if idx is None or idx < 0 or idx >= len(points):
            return None
        normalized_indices.append(idx)
    normalized_indices = sorted(set(normalized_indices))
    if len(normalized_indices) != 2:
        return None

    p1 = points[normalized_indices[0]]
    p2 = points[normalized_indices[1]]
    if not isinstance(p1, (list, tuple)) or not isinstance(p2, (list, tuple)) or len(p1) < 2 or len(p2) < 2:
        return None

    x1, y1 = _safe_float(p1[0]), _safe_float(p1[1])
    x2, y2 = _safe_float(p2[0]), _safe_float(p2[1])
    if None in {x1, y1, x2, y2}:
        return None
    if x1 == x2:
        return {
            'answer': '__invalid_linear_points__',
            'feedback': 'Selected points have same x-value. Choose two points that define a line.',
            'diagnostics': {
                'linear_selected_indices': normalized_indices,
                'linear_vertical_line': True,
            },
        }

    slope = (y2 - y1) / (x2 - x1)
    intercept = y1 - slope * x1
    prediction = slope * query_x + intercept
    rounded_prediction = round(prediction, 3)
    if abs(rounded_prediction - round(rounded_prediction)) < 1e-9:
        answer = str(int(round(rounded_prediction)))
    else:
        answer = f"{rounded_prediction:.3f}".rstrip('0').rstrip('.')

    return {
        'answer': answer,
        'feedback': None,
        'diagnostics': {
            'linear_selected_indices': normalized_indices,
            'linear_slope': round(slope, 4),
            'linear_intercept': round(intercept, 4),
            'linear_prediction': answer,
        },
    }


def _evaluate_logistic_regression_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.LOGISTIC_REGRESSION or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    z_value = _safe_float(payload.get('z'))
    probability = _safe_float(action_payload.get('probability'))
    if z_value is None or probability is None:
        return None
    if probability < 0 or probability > 1:
        return None

    expected_probability = round(_sigmoid(z_value), 3)
    return {
        'answer': f"{round(probability, 3):.3f}",
        'feedback': None,
        'diagnostics': {
            'logistic_z': round(z_value, 4),
            'logistic_expected_probability': f"{expected_probability:.3f}",
            'logistic_probability': f"{round(probability, 3):.3f}",
        },
    }


def _evaluate_kmeans_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.KMEANS or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    points = payload.get('points')
    centroids = payload.get('centroids')
    assignments = action_payload.get('assignments')

    if not isinstance(points, list) or not points or not isinstance(centroids, list) or len(centroids) != 2:
        return None
    if not isinstance(assignments, list) or len(assignments) != len(points):
        return None

    normalized_points = []
    for point in points:
        normalized_point = _safe_float(point)
        if normalized_point is None:
            return None
        normalized_points.append(normalized_point)

    normalized_centroids = []
    for centroid in centroids:
        normalized_centroid = _safe_float(centroid)
        if normalized_centroid is None:
            return None
        normalized_centroids.append(normalized_centroid)

    groups = [[], []]
    normalized_assignments = []
    for idx, assignment in enumerate(assignments):
        normalized_assignment = _safe_int(assignment)
        if normalized_assignment not in {0, 1}:
            return None
        normalized_assignments.append(normalized_assignment)
        groups[normalized_assignment].append(normalized_points[idx])

    new_centroids = []
    for centroid_idx, group_points in enumerate(groups):
        if group_points:
            new_centroids.append(round(sum(group_points) / len(group_points), 2))
        else:
            new_centroids.append(round(normalized_centroids[centroid_idx], 2))

    answer = f"{new_centroids[0]:.2f} {new_centroids[1]:.2f}"
    return {
        'answer': answer,
        'feedback': None,
        'diagnostics': {
            'kmeans_assignments': normalized_assignments,
            'kmeans_updated_centroids': answer,
        },
    }


def _evaluate_knn_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.KNN or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    train_points = payload.get('train_points')
    query_x = _safe_float(payload.get('query_x'))
    k_value = _safe_int(payload.get('k') or 3)
    selected_indices = action_payload.get('selected_indices')

    if not isinstance(train_points, list) or not train_points or query_x is None or not isinstance(selected_indices, list):
        return None
    if k_value is None or k_value <= 0 or k_value > len(train_points):
        return None

    normalized_points = []
    for idx, row in enumerate(train_points):
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            return None
        x_value = _safe_float(row[0])
        label = str(row[1]).strip().upper()
        if x_value is None or label not in {'A', 'B'}:
            return None
        normalized_points.append({'index': idx, 'x': x_value, 'label': label})

    normalized_selected = []
    for raw_index in selected_indices:
        idx = _safe_int(raw_index)
        if idx is None or idx < 0 or idx >= len(normalized_points):
            return None
        normalized_selected.append(idx)
    normalized_selected = sorted(set(normalized_selected))
    if len(normalized_selected) != k_value:
        return {
            'answer': '__invalid_knn_neighbors__',
            'feedback': f'Select exactly {k_value} nearest neighbors.',
            'diagnostics': {
                'knn_selected_indices': normalized_selected,
                'knn_k': k_value,
            },
        }

    ranked = sorted(
        normalized_points,
        key=lambda row: (abs(row['x'] - query_x), row['x'], row['label'], row['index']),
    )
    canonical = sorted(row['index'] for row in ranked[:k_value])
    if normalized_selected != canonical:
        return {
            'answer': '__invalid_knn_neighbors__',
            'feedback': 'Selected neighbors are not the nearest points by tie-break rules.',
            'diagnostics': {
                'knn_selected_indices': normalized_selected,
                'knn_expected_indices': canonical,
                'knn_k': k_value,
            },
        }

    top_neighbors = ranked[:k_value]
    count_a = sum(1 for row in top_neighbors if row['label'] == 'A')
    prediction = 'A' if count_a >= (k_value - count_a) else 'B'
    return {
        'answer': prediction,
        'feedback': None,
        'diagnostics': {
            'knn_selected_indices': normalized_selected,
            'knn_expected_indices': canonical,
            'knn_prediction': prediction,
        },
    }


def _evaluate_decision_tree_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.DECISION_TREE or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    positive = _safe_float(payload.get('positive'))
    negative = _safe_float(payload.get('negative'))
    entropy = _safe_float(action_payload.get('entropy'))

    if positive is None or negative is None or entropy is None:
        return None
    if positive <= 0 or negative <= 0 or entropy < 0:
        return None

    total = positive + negative
    expected_entropy = 0.0
    for ratio in (positive / total, negative / total):
        if ratio > 0:
            expected_entropy -= ratio * math.log2(ratio)

    return {
        'answer': f"{round(entropy, 3):.3f}",
        'feedback': None,
        'diagnostics': {
            'decision_tree_entropy': f"{round(entropy, 3):.3f}",
            'decision_tree_expected_entropy': f"{round(expected_entropy, 3):.3f}",
        },
    }


def _evaluate_naive_bayes_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.NAIVE_BAYES or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    spam_score = _safe_float(payload.get('spam_score'))
    ham_score = _safe_float(payload.get('ham_score'))
    label = str(action_payload.get('label', '')).strip().lower()

    if spam_score is None or ham_score is None:
        return None
    if label not in {'spam', 'ham'}:
        return None

    expected_label = 'spam' if spam_score >= ham_score else 'ham'
    return {
        'answer': label,
        'feedback': None,
        'diagnostics': {
            'naive_bayes_label': label,
            'naive_bayes_expected_label': expected_label,
        },
    }


def _evaluate_neural_network_action_payload(challenge, action_payload):
    if challenge.algorithm_type != Challenge.AlgorithmType.NEURAL_NETWORK or not action_payload:
        return None

    payload = challenge.visualization_payload or {}
    x1 = _safe_float(payload.get('x1'))
    x2 = _safe_float(payload.get('x2'))
    w1 = _safe_float(payload.get('w1'))
    w2 = _safe_float(payload.get('w2'))
    bias = _safe_float(payload.get('b'))
    linear_sum = _safe_float(action_payload.get('linear_sum'))
    output = _safe_float(action_payload.get('output'))

    if None in {x1, x2, w1, w2, bias, linear_sum, output}:
        return None
    if output < 0 or output > 1:
        return None

    expected_linear_sum = x1 * w1 + x2 * w2 + bias
    if abs(linear_sum - expected_linear_sum) > 0.01:
        return {
            'answer': '__invalid_neural_linear_sum__',
            'feedback': 'Linear combination is incorrect. Recompute z = w1*x1 + w2*x2 + b.',
            'diagnostics': {
                'neural_linear_sum': round(linear_sum, 4),
                'neural_expected_linear_sum': round(expected_linear_sum, 4),
            },
        }

    expected_output = _sigmoid(expected_linear_sum)
    return {
        'answer': f"{round(output, 3):.3f}",
        'feedback': None,
        'diagnostics': {
            'neural_linear_sum': round(linear_sum, 4),
            'neural_expected_linear_sum': round(expected_linear_sum, 4),
            'neural_output': f"{round(output, 3):.3f}",
            'neural_expected_output': f"{round(expected_output, 3):.3f}",
        },
    }


def _evaluate_action_payload(challenge, raw_payload):
    action_payload = _load_action_payload(raw_payload)
    if not action_payload:
        return None

    evaluators = (
        _evaluate_knapsack_action_payload,
        _evaluate_activity_selection_action_payload,
        _evaluate_lcs_action_payload,
        _evaluate_backtracking_action_payload,
        _evaluate_recursion_action_payload,
        _evaluate_bit_conversion_action_payload,
        _evaluate_bfs_action_payload,
        _evaluate_dfs_action_payload,
        _evaluate_dijkstra_action_payload,
        _evaluate_astar_action_payload,
        _evaluate_minimax_action_payload,
        _evaluate_linked_list_action_payload,
        _evaluate_stack_action_payload,
        _evaluate_queue_action_payload,
        _evaluate_linear_search_action_payload,
        _evaluate_binary_search_action_payload,
        _evaluate_string_algorithm_action_payload,
        _evaluate_array_algorithm_action_payload,
        _evaluate_hashing_algorithm_action_payload,
        _evaluate_sorting_action_payload,
        _evaluate_linear_regression_action_payload,
        _evaluate_logistic_regression_action_payload,
        _evaluate_kmeans_action_payload,
        _evaluate_knn_action_payload,
        _evaluate_decision_tree_action_payload,
        _evaluate_naive_bayes_action_payload,
        _evaluate_neural_network_action_payload,
    )

    for evaluator in evaluators:
        result = evaluator(challenge, action_payload)
        if result is not None:
            return result
    return None


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
        'topic_id',
        'topic__id',
        'topic__label',
        'topic__category',
        'topic__stable_id',
        'topic__visualization_type',
        'topic__is_active',
    )

    solved_ids = set()
    explicit_unlocked_ids = set()
    if request.user.is_authenticated:
        user_progress_rows = list(
            UserChallengeProg.objects.filter(user=request.user, challenge__is_active=True).values_list(
                'challenge_id',
                'is_solved',
                'is_unlocked',
                'challenge__algorithm_type',
                'challenge__order_index',
            )
        )
        solved_ids, explicit_unlocked_ids = _normalize_progress_rows_to_preferred_ids(user_progress_rows)

    selected_kind = request.GET.get('kind', 'all')
    selected_difficulty = request.GET.get('difficulty', 'all')
    selected_category = _normalize_category(request.GET.get('category', 'all'))
    selected_subtype = request.GET.get('subtype', 'all').strip().lower()
    selected_topic = request.GET.get('topic', 'all')
    selected_solved = request.GET.get('solved', 'all')
    selected_unlocked = request.GET.get('unlocked', 'all')
    sort_by = request.GET.get('sort', 'difficulty')
    search_query = request.GET.get('search', '').strip()

    # Quick search should span all algorithm types for the current category.
    # If a stale subtype stays in URL, it hides other types from results.
    if search_query and selected_subtype != 'all':
        selected_subtype = 'all'

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

    # Hide invalid legacy rows that do not map to a supported algorithm subtype.
    challenges = challenges.exclude(
        Q(challenge_type=Challenge.ChallengeType.ALGORITHM)
        & ~Q(algorithm_type__in=SUPPORTED_ALGORITHM_TYPE_VALUES)
    )

    subtype_options = _build_subtype_options(selected_category, challenges)
    valid_subtypes = {option['value'] for option in subtype_options}
    if selected_subtype != 'all' and selected_subtype not in valid_subtypes:
        selected_subtype = 'all'

    # Keep list in subtype-card mode whenever no subtype is selected.
    # This ensures search like "AI/ML" lands on algorithm types first (KMeans, Naive Bayes, etc.).
    is_subtype_index_mode = selected_subtype == 'all'
    if not is_subtype_index_mode:
        if selected_subtype != 'all':
            challenges = challenges.filter(algorithm_type=selected_subtype)

    if search_query:
        challenges = challenges.filter(_build_search_filters(search_query))

    challenges = _apply_queryset_sort(challenges, sort_by, request.user)

    challenges = list(challenges)
    challenges = _dedupe_algorithm_level_rows(challenges)

    unlocked_ids = set()
    if request.user.is_authenticated:
        unlock_map = _bulk_unlock_map(challenges, solved_ids, explicit_unlocked_ids)
        if selected_unlocked != 'all':
            if selected_unlocked == 'unlocked':
                challenges = [challenge for challenge in challenges if unlock_map.get(challenge.id, False)]
            elif selected_unlocked == 'locked':
                challenges = [challenge for challenge in challenges if not unlock_map.get(challenge.id, False)]
            else:
                selected_unlocked = 'all'
        unlocked_ids = {challenge.id for challenge in challenges if unlock_map.get(challenge.id, False)}
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
            if challenge.challenge_type != Challenge.ChallengeType.ALGORITHM:
                continue
            if challenge.algorithm_type not in SUPPORTED_ALGORITHM_TYPE_VALUES:
                continue
            subtype_key = challenge.algorithm_type or f'challenge-{challenge.id}'
            subtype_counts[subtype_key] += 1
            if subtype_key not in representatives:
                representatives[subtype_key] = challenge

        display_challenges = list(representatives.values())
        for challenge in display_challenges:
            subtype_key = challenge.algorithm_type or f'challenge-{challenge.id}'
            challenge.subtype_level_count = subtype_counts[subtype_key]
            challenge.subtype_query = _build_subtype_query_string(request.GET, subtype_key)

    show_landing_placeholder = (
        selected_category == 'all'
        and selected_subtype == 'all'
        and selected_kind == 'all'
        and selected_difficulty == 'all'
        and selected_topic == 'all'
        and selected_solved == 'all'
        and selected_unlocked == 'all'
        and not search_query
    )

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
    preferred_variant = _resolve_best_challenge_variant(challenge)
    if preferred_variant.id != challenge.id:
        return redirect('challenge-detail', slug=preferred_variant.slug)

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
        can_use_hint = bool(current_prog and not current_prog.hint_used and not current_prog.is_solved)

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
    if prog.is_solved:
        return JsonResponse({'error': 'Hints are not available after solving this challenge.'}, status=400)

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
    raw_action_payload = request.POST.get('action_payload', '').strip()

    if not _is_challenge_unlocked(request.user, challenge):
        return JsonResponse(
            {'error': 'This challenge is locked', 'is_correct': False},
            status=403,
        )

    answer = request.POST.get('answer', '').strip()

    with transaction.atomic():
        prog = _get_locked_user_challenge_progress(request.user, challenge)
        hint_used = bool(prog.hint_used)
        action_eval = None
        if raw_action_payload and (hint_used or not challenge.starter_code.strip()):
            action_eval = _evaluate_action_payload(challenge, raw_action_payload)
            if action_eval:
                answer = action_eval['answer']

        expected_answer = challenge.expected_answer.strip()
        is_correct = bool(expected_answer) and expected_answer.lower() == answer.lower()
        attempt_index = prog.attempt_count + 1
        is_score_eligible = not prog.is_solved

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
        if is_correct:
            message = 'Correct, but this challenge was already solved so no additional points were awarded.'
        else:
            message = 'This challenge is already solved. No additional points are available.'
    elif is_correct and hint_used:
        message = 'Correct! Hint penalty applied (75% reduction).'
    elif is_correct:
        message = 'Correct!'
    elif hint_used:
        message = 'Try again. Hint mode is active, so reduced scoring will apply when you solve it.'
    else:
        message = 'Try again'

    if action_eval and action_eval.get('feedback') and not is_correct:
        message = action_eval['feedback']
        if not is_score_eligible:
            message = f'{message} No additional points are available.'

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
    if action_eval and action_eval.get('diagnostics'):
        response_data.update(action_eval['diagnostics'])

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
        next_challenge = (
            challenge.topic.challenges.filter(is_active=True, order_index__gt=challenge.order_index)
            .order_by('order_index', 'id')
            .first()
        )

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
    elif is_correct and challenge.algorithm_type and not challenge.topic:
        next_challenge = (
            Challenge.objects.filter(
                is_active=True,
                topic_id__isnull=True,
                algorithm_type=challenge.algorithm_type,
                order_index__gt=challenge.order_index,
            )
            .order_by('order_index', 'id')
            .first()
        )
        if next_challenge:
            if hasattr(next_challenge, 'get_absolute_url'):
                response_data['next_challenge_url'] = next_challenge.get_absolute_url()
            else:
                response_data['next_challenge_url'] = f'/challenges/{next_challenge.slug}/'

        total_rounds = Challenge.objects.filter(
            is_active=True,
            topic_id__isnull=True,
            algorithm_type=challenge.algorithm_type,
        ).count()
        response_data['next_round_index'] = challenge.order_index + 2
        response_data['current_round_index'] = challenge.order_index + 1
        response_data['total_rounds_in_topic'] = total_rounds

        label = ALGORITHM_TYPE_LABELS.get(challenge.algorithm_type, 'this type')
        if next_challenge:
            response_data['message'] = f'Round {challenge.order_index + 1} completed! Next: {next_challenge.title}'
        else:
            response_data['message'] = (
                f"Round {challenge.order_index + 1} completed! You've finished all rounds in {label}."
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
