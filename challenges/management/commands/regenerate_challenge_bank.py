import json
import math
import random
from collections import defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


def _difficulty_bounds(difficulty):
    if difficulty == 'easy':
        return 6, 40
    if difficulty == 'medium':
        return 8, 80
    return 10, 120


def _format_array(values):
    return '[' + ', '.join(str(v) for v in values) + ']'


def _build_prompt(problem, input_line, output_line, constraints, example_input, example_output):
    return (
        f"Problem: {problem}\n"
        f"Input: {input_line}\n"
        f"Output: {output_line}\n"
        f"Constraints: {constraints}\n"
        f"Example:\n"
        f"Input: {example_input}\n"
        f"Output: {example_output}"
    )


def _bfs_order(n, edges, start):
    adj = {i: [] for i in range(n)}
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
    for node in adj:
        adj[node].sort()
    queue = [start]
    seen = {start}
    out = []
    while queue:
        cur = queue.pop(0)
        out.append(cur)
        for nxt in adj[cur]:
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return out


def _dfs_order(n, edges, start):
    adj = {i: [] for i in range(n)}
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
    for node in adj:
        adj[node].sort(reverse=True)
    stack = [start]
    seen = set()
    out = []
    while stack:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        out.append(cur)
        for nxt in adj[cur]:
            if nxt not in seen:
                stack.append(nxt)
    return out


def _dijkstra_distance(n, weighted_edges, src, dst):
    graph = {i: [] for i in range(n)}
    for u, v, w in weighted_edges:
        graph[u].append((v, w))
        graph[v].append((u, w))
    dist = [10**9] * n
    dist[src] = 0
    used = [False] * n
    for _ in range(n):
        best = -1
        for i in range(n):
            if not used[i] and (best == -1 or dist[i] < dist[best]):
                best = i
        if best == -1:
            break
        used[best] = True
        for nxt, w in graph[best]:
            if dist[best] + w < dist[nxt]:
                dist[nxt] = dist[best] + w
    return dist[dst] if dist[dst] < 10**9 else -1


def _grid_shortest_path(rows, cols, blocked):
    blocked_set = set(blocked)
    start = (0, 0)
    goal = (rows - 1, cols - 1)
    if start in blocked_set or goal in blocked_set:
        return -1
    queue = [(0, 0, 0)]
    seen = {start}
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))
    while queue:
        r, c, d = queue.pop(0)
        if (r, c) == goal:
            return d
        for dr, dc in dirs:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in blocked_set and (nr, nc) not in seen:
                seen.add((nr, nc))
                queue.append((nr, nc, d + 1))
    return -1


def _minimax_value(leaves):
    level = leaves[:]
    maximizing = False
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            a, b = level[i], level[i + 1]
            nxt.append(max(a, b) if maximizing else min(a, b))
        level = nxt
        maximizing = not maximizing
    return level[0]


def _knapsack_max(weights, values, cap):
    dp = [0] * (cap + 1)
    for w, v in zip(weights, values):
        for c in range(cap, w - 1, -1):
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[cap]


def _lcs_len(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[len(a)][len(b)]


def _activity_selection_count(starts, ends):
    pairs = sorted(zip(starts, ends), key=lambda it: it[1])
    cnt = 0
    last_end = -1
    for s, e in pairs:
        if s >= last_end:
            cnt += 1
            last_end = e
    return cnt


def _sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def _gcd(a, b):
    while b:
        a, b = b, a % b
    return a


def _max_subarray(values):
    best = values[0]
    cur = values[0]
    for value in values[1:]:
        cur = max(value, cur + value)
        best = max(best, cur)
    return best


def _longest_common_prefix(words):
    prefix = words[0]
    for word in words[1:]:
        while not word.startswith(prefix):
            prefix = prefix[:-1]
            if not prefix:
                return ''
    return prefix


def _n_queens_count(n):
    cols = set()
    diag1 = set()
    diag2 = set()
    out = 0

    def backtrack(r):
        nonlocal out
        if r == n:
            out += 1
            return
        for c in range(n):
            if c in cols or (r - c) in diag1 or (r + c) in diag2:
                continue
            cols.add(c)
            diag1.add(r - c)
            diag2.add(r + c)
            backtrack(r + 1)
            cols.remove(c)
            diag1.remove(r - c)
            diag2.remove(r + c)

    backtrack(0)
    return out


def _subset_sum_count(values, target):
    count = 0
    n = len(values)

    def dfs(i, total):
        nonlocal count
        if total == target:
            count += 1
            return
        if i >= n or total > target:
            return
        dfs(i + 1, total + values[i])
        dfs(i + 1, total)

    dfs(0, 0)
    return count


def _bst_inorder(values):
    class Node:
        def __init__(self, value):
            self.value = value
            self.left = None
            self.right = None

    def insert(root, value):
        if root is None:
            return Node(value)
        if value < root.value:
            root.left = insert(root.left, value)
        else:
            root.right = insert(root.right, value)
        return root

    def inorder(node, out):
        if not node:
            return
        inorder(node.left, out)
        out.append(node.value)
        inorder(node.right, out)

    root = None
    for value in values:
        root = insert(root, value)
    result = []
    inorder(root, result)
    return result


def _algorithm_payload(algorithm_type, difficulty, level_index):
    rnd = random.Random(f"{algorithm_type}-{difficulty}-{level_index}-aq")
    n, v_max = _difficulty_bounds(difficulty)
    algo_label = algorithm_type.replace('_', ' ').title()

    if algorithm_type in {'bubble_sort', 'selection_sort', 'insertion_sort', 'merge_sort', 'quick_sort', 'heap_sort'}:
        arr = [rnd.randint(0, v_max) for _ in range(n)]
        sorted_arr = sorted(arr)
        prompt = _build_prompt(
            f"Sort the array in non-decreasing order using {algo_label}.",
            f"n={len(arr)}, arr={_format_array(arr)}",
            "Print sorted array as space-separated integers.",
            f"1 <= n <= {n}, 0 <= arr[i] <= {v_max}",
            _format_array(arr),
            ' '.join(str(v) for v in sorted_arr),
        )
        return {
            'title': f"{algo_label} Round {level_index + 1}",
            'description': f"Practice {algo_label} transitions and final ordering.",
            'prompt': prompt,
            'expected_answer': ' '.join(str(v) for v in sorted_arr),
            'starter_code': "Hint: track the invariant that holds after each pass/partition stage.",
            'visualization_payload': {'mode': 'array', 'algorithm': algorithm_type, 'data': arr, 'goal': 'sorted'},
        }

    if algorithm_type == 'linear_search':
        arr = [rnd.randint(0, v_max) for _ in range(n)]
        target = arr[rnd.randint(0, n - 1)] if rnd.random() > 0.3 else v_max + 7
        idx = arr.index(target) if target in arr else -1
        prompt = _build_prompt(
            "Find first index of target using linear scan.",
            f"arr={_format_array(arr)}, target={target}",
            "Return first index (0-based) or -1.",
            f"1 <= n <= {n}",
            f"{_format_array(arr)}, target={target}",
            str(idx),
        )
        return {
            'title': f"Linear Search Probe {level_index + 1}",
            'description': "Locate the first target match in unsorted data.",
            'prompt': prompt,
            'expected_answer': str(idx),
            'starter_code': "Hint: iterate left to right and stop on first exact match.",
            'visualization_payload': {'mode': 'array', 'algorithm': algorithm_type, 'data': arr, 'target': target},
        }

    if algorithm_type == 'binary_search':
        arr = sorted(rnd.sample(range(0, v_max + n + 5), n))
        target = arr[rnd.randint(0, n - 1)] if rnd.random() > 0.3 else v_max + n + 11
        idx = arr.index(target) if target in arr else -1
        prompt = _build_prompt(
            "Locate target in sorted array using binary search.",
            f"sorted_arr={_format_array(arr)}, target={target}",
            "Return index (0-based) or -1 if absent.",
            "Array is sorted in ascending order.",
            f"{_format_array(arr)}, target={target}",
            str(idx),
        )
        return {
            'title': f"Binary Search Probe {level_index + 1}",
            'description': "Apply midpoint elimination to reduce search space.",
            'prompt': prompt,
            'expected_answer': str(idx),
            'starter_code': "Hint: move low/high boundaries by comparing target with mid value.",
            'visualization_payload': {'mode': 'array', 'algorithm': algorithm_type, 'data': arr, 'target': target},
        }

    if algorithm_type in {'bfs', 'dfs'}:
        nodes = 6 if difficulty == 'easy' else 7 if difficulty == 'medium' else 8
        edges = {(i, i + 1) for i in range(nodes - 1)}
        candidates = [(i, j) for i in range(nodes) for j in range(i + 2, nodes)]
        rnd.shuffle(candidates)
        extra_count = 3 if difficulty == 'easy' else 4 if difficulty == 'medium' else 5
        for edge in candidates[:extra_count]:
            edges.add(edge)
        edge_list = sorted(edges)
        start_node = rnd.randint(0, nodes - 1)
        order = _bfs_order(nodes, edge_list, start_node) if algorithm_type == 'bfs' else _dfs_order(nodes, edge_list, start_node)
        edge_text = ', '.join(f"({u},{v})" for u, v in edge_list)
        prompt = _build_prompt(
            f"Traverse undirected graph using {algorithm_type.upper()} from the given start node.",
            f"nodes=0..{nodes-1}, edges={edge_text}",
            "Return visitation order as space-separated node ids.",
            "When choices exist, visit lower-numbered neighbor first.",
            f"nodes=0..{nodes-1}, edges={edge_text}, start={start_node}",
            ' '.join(str(v) for v in order),
        )
        return {
            'title': f"{algorithm_type.upper()} Traversal {level_index + 1}",
            'description': f"Compute deterministic {algorithm_type.upper()} visit sequence.",
            'prompt': prompt,
            'expected_answer': ' '.join(str(v) for v in order),
            'starter_code': "Hint: maintain visited set and deterministic neighbor order.",
            'visualization_payload': {
                'mode': 'graph',
                'algorithm': algorithm_type,
                'nodes': list(range(nodes)),
                'edges': edge_list,
                'start': start_node,
            },
        }

    if algorithm_type == 'dijkstra':
        edges = [(0, 1), (0, 2), (1, 3), (2, 3), (2, 4), (3, 5), (4, 5)]
        weighted = [(u, v, rnd.randint(1, 9)) for u, v in edges]
        dist = _dijkstra_distance(6, weighted, 0, 5)
        edge_text = ', '.join(f"({u},{v},{w})" for u, v, w in weighted)
        prompt = _build_prompt(
            "Compute shortest distance from source to target using Dijkstra.",
            f"weighted_edges={edge_text}, source=0, target=5",
            "Return minimum distance as integer.",
            "All edge weights are positive.",
            f"weighted_edges={edge_text}, source=0, target=5",
            str(dist),
        )
        return {
            'title': f"Dijkstra Distance {level_index + 1}",
            'description': "Relax weighted edges to final shortest-path distance.",
            'prompt': prompt,
            'expected_answer': str(dist),
            'starter_code': "Hint: pick smallest tentative distance node and relax its outgoing edges.",
            'visualization_payload': {'mode': 'graph', 'algorithm': algorithm_type, 'weighted_edges': weighted, 'source': 0, 'target': 5},
        }

    if algorithm_type == 'astar':
        rows = 5 if difficulty == 'easy' else 6 if difficulty == 'medium' else 7
        cols = rows
        blocked = []
        for _ in range(rows):
            r = rnd.randint(0, rows - 1)
            c = rnd.randint(0, cols - 1)
            if (r, c) not in {(0, 0), (rows - 1, cols - 1)}:
                blocked.append((r, c))
        blocked = sorted(set(blocked))
        dist = _grid_shortest_path(rows, cols, blocked)
        prompt = _build_prompt(
            "Find shortest path length from S=(0,0) to G=(R-1,C-1) on 4-direction grid.",
            f"rows={rows}, cols={cols}, blocked={blocked}",
            "Return minimum moves, or -1 if unreachable.",
            "Can move up/down/left/right only.",
            f"rows={rows}, cols={cols}, blocked={blocked}",
            str(dist),
        )
        return {
            'title': f"A* Grid Route {level_index + 1}",
            'description': "Evaluate shortest route length in blocked grid state space.",
            'prompt': prompt,
            'expected_answer': str(dist),
            'starter_code': "Hint: heuristic helps ordering, but shortest path length still obeys grid constraints.",
            'visualization_payload': {'mode': 'grid', 'algorithm': algorithm_type, 'rows': rows, 'cols': cols, 'blocked': blocked},
        }

    if algorithm_type == 'minimax':
        leaves = [rnd.randint(-9, 9) for _ in range(8)]
        value = _minimax_value(leaves)
        prompt = _build_prompt(
            "Compute root minimax value for full binary tree depth 3 (root is MAX).",
            f"leaf_values_left_to_right={leaves}",
            "Return root value as integer.",
            "Alternating levels: MAX -> MIN -> MAX(leaves).",
            str(leaves),
            str(value),
        )
        return {
            'title': f"Minimax Tree Value {level_index + 1}",
            'description': "Propagate adversarial utility values upward through alternating players.",
            'prompt': prompt,
            'expected_answer': str(value),
            'starter_code': "Hint: fold leaf pairs from bottom, alternating min and max at each level.",
            'visualization_payload': {'mode': 'tree', 'algorithm': algorithm_type, 'leaves': leaves},
        }

    if algorithm_type == 'bst':
        values = rnd.sample(list(range(10, 90)), 7)
        inorder = _bst_inorder(values)
        prompt = _build_prompt(
            "Insert sequence into BST and report inorder traversal.",
            f"insert_sequence={values}",
            "Return inorder as space-separated integers.",
            "All inserted values are unique.",
            str(values),
            ' '.join(str(v) for v in inorder),
        )
        return {
            'title': f"BST Inorder {level_index + 1}",
            'description': "Build BST then read sorted order using inorder traversal.",
            'prompt': prompt,
            'expected_answer': ' '.join(str(v) for v in inorder),
            'starter_code': "Hint: inorder traversal visits left subtree, node, then right subtree.",
            'visualization_payload': {'mode': 'tree', 'algorithm': algorithm_type, 'insert_sequence': values},
        }

    if algorithm_type == 'knapsack':
        size = 4 if difficulty == 'easy' else 5 if difficulty == 'medium' else 6
        weights = [rnd.randint(1, 10) for _ in range(size)]
        values = [rnd.randint(5, 25) for _ in range(size)]
        cap = max(8, sum(weights) // 2)
        best = _knapsack_max(weights, values, cap)
        prompt = _build_prompt(
            "Solve 0/1 knapsack maximum value.",
            f"weights={weights}, values={values}, capacity={cap}",
            "Return maximum total value.",
            "Each item may be chosen at most once.",
            f"weights={weights}, values={values}, capacity={cap}",
            str(best),
        )
        return {
            'title': f"Knapsack Value {level_index + 1}",
            'description': "Optimize value under capacity constraint using DP.",
            'prompt': prompt,
            'expected_answer': str(best),
            'starter_code': "Hint: iterate capacity backward for each item in 1D DP.",
            'visualization_payload': {'mode': 'grid', 'algorithm': algorithm_type, 'weights': weights, 'values': values, 'capacity': cap},
        }

    if algorithm_type == 'lcs':
        alphabet = 'ABCDE'
        a = ''.join(rnd.choice(alphabet) for _ in range(6))
        b = ''.join(rnd.choice(alphabet) for _ in range(7))
        length = _lcs_len(a, b)
        prompt = _build_prompt(
            "Find length of longest common subsequence.",
            f"s1=\"{a}\", s2=\"{b}\"",
            "Return LCS length as integer.",
            "1 <= len(s1), len(s2) <= 30",
            f"s1=\"{a}\", s2=\"{b}\"",
            str(length),
        )
        return {
            'title': f"LCS Length {level_index + 1}",
            'description': "Compute common subsequence depth for two strings.",
            'prompt': prompt,
            'expected_answer': str(length),
            'starter_code': "Hint: use a DP table where match extends diagonal by one.",
            'visualization_payload': {'mode': 'grid', 'algorithm': algorithm_type, 's1': a, 's2': b},
        }

    if algorithm_type == 'activity_selection':
        size = 6 if difficulty == 'easy' else 7 if difficulty == 'medium' else 8
        starts = []
        ends = []
        t = 0
        for _ in range(size):
            s = t + rnd.randint(0, 3)
            e = s + rnd.randint(1, 4)
            starts.append(s)
            ends.append(e)
            t += rnd.randint(0, 2)
        cnt = _activity_selection_count(starts, ends)
        prompt = _build_prompt(
            "Select maximum number of non-overlapping activities.",
            f"start_times={starts}, finish_times={ends}",
            "Return maximum count.",
            "Activity i occupies [start_times[i], finish_times[i]).",
            f"start_times={starts}, finish_times={ends}",
            str(cnt),
        )
        return {
            'title': f"Activity Selection {level_index + 1}",
            'description': "Apply finish-time greedy scheduling for compatible intervals.",
            'prompt': prompt,
            'expected_answer': str(cnt),
            'starter_code': "Hint: sort by earliest finish, then pick next activity starting after current finish.",
            'visualization_payload': {'mode': 'grid', 'algorithm': algorithm_type, 'starts': starts, 'ends': ends},
        }

    if algorithm_type == 'linear_regression':
        m = rnd.randint(1, 4)
        b = rnd.randint(-3, 6)
        xq = rnd.randint(3, 9)
        points = [(x, m * x + b) for x in (1, 2, 3)]
        yq = m * xq + b
        prompt = _build_prompt(
            "Infer linear relation y=m*x+b from sample points and predict y for query x.",
            f"points={points}, query_x={xq}",
            "Return predicted y as integer.",
            "Data lies exactly on one straight line.",
            f"points={points}, query_x={xq}",
            str(yq),
        )
        return {
            'title': f"Linear Regression Predict {level_index + 1}",
            'description': "Model a linear trend and infer target output.",
            'prompt': prompt,
            'expected_answer': str(yq),
            'starter_code': "Hint: compute slope/intercept from two points before evaluating query x.",
            'visualization_payload': {'mode': 'conceptual', 'algorithm': algorithm_type, 'points': points, 'query_x': xq},
        }

    if algorithm_type == 'logistic_regression':
        z = round(rnd.uniform(-4.0, 4.0), 3)
        value = round(_sigmoid(z), 3)
        prompt = _build_prompt(
            "Compute logistic probability sigma(z)=1/(1+e^-z).",
            f"z={z}",
            "Return probability rounded to 3 decimals.",
            "-6 <= z <= 6",
            f"z={z}",
            f"{value:.3f}",
        )
        return {
            'title': f"Logistic Probability {level_index + 1}",
            'description': "Convert linear score into binary-class probability.",
            'prompt': prompt,
            'expected_answer': f"{value:.3f}",
            'starter_code': "Hint: compute e^-z and apply reciprocal transform.",
            'visualization_payload': {'mode': 'conceptual', 'algorithm': algorithm_type, 'z': z},
        }

    if algorithm_type == 'kmeans':
        points = sorted(rnd.sample(range(1, 30), 6))
        c1 = rnd.choice(points[:3])
        c2 = rnd.choice(points[3:])
        g1, g2 = [], []
        for p in points:
            if abs(p - c1) <= abs(p - c2):
                g1.append(p)
            else:
                g2.append(p)
        nc1 = round(sum(g1) / len(g1), 2) if g1 else round(float(c1), 2)
        nc2 = round(sum(g2) / len(g2), 2) if g2 else round(float(c2), 2)
        prompt = _build_prompt(
            "Perform one K-Means update step in 1D with k=2.",
            f"points={points}, initial_centroids=({c1}, {c2})",
            "Return updated centroids as 'c1 c2' rounded to 2 decimals.",
            "Assign to nearest centroid; ties go to first centroid.",
            f"points={points}, initial_centroids=({c1}, {c2})",
            f"{nc1:.2f} {nc2:.2f}",
        )
        return {
            'title': f"K-Means Update {level_index + 1}",
            'description': "Reassign points and recompute centroids by cluster means.",
            'prompt': prompt,
            'expected_answer': f"{nc1:.2f} {nc2:.2f}",
            'starter_code': "Hint: assignment phase first, update phase second.",
            'visualization_payload': {'mode': 'grid', 'algorithm': algorithm_type, 'points': points, 'centroids': [c1, c2]},
        }

    if algorithm_type == 'knn':
        train = [(rnd.randint(1, 25), rnd.choice(['A', 'B'])) for _ in range(7)]
        query = rnd.randint(1, 25)
        ranked = sorted(train, key=lambda t: (abs(t[0] - query), t[0], t[1]))
        top = ranked[:3]
        a_count = sum(1 for _, label in top if label == 'A')
        b_count = 3 - a_count
        pred = 'A' if a_count >= b_count else 'B'
        prompt = _build_prompt(
            "Classify query point using KNN in 1D with k=3.",
            f"train_points={train} where tuple=(x,label), query_x={query}",
            "Return predicted label (A or B).",
            "Use absolute distance; tie-break by lower x then label.",
            f"train_points={train}, query_x={query}",
            pred,
        )
        return {
            'title': f"KNN Classification {level_index + 1}",
            'description': "Predict class by majority vote of nearest neighbors.",
            'prompt': prompt,
            'expected_answer': pred,
            'starter_code': "Hint: sort by distance and majority-vote first k labels.",
            'visualization_payload': {'mode': 'grid', 'algorithm': algorithm_type, 'train_points': train, 'query_x': query, 'k': 3},
        }

    if algorithm_type == 'decision_tree':
        pos = rnd.randint(1, 9)
        neg = rnd.randint(1, 9)
        total = pos + neg
        p_pos = pos / total
        p_neg = neg / total
        entropy = 0.0
        if p_pos > 0:
            entropy -= p_pos * math.log2(p_pos)
        if p_neg > 0:
            entropy -= p_neg * math.log2(p_neg)
        entropy = round(entropy, 3)
        prompt = _build_prompt(
            "Compute class entropy used in decision tree splitting.",
            f"class_counts=(positive={pos}, negative={neg})",
            "Return entropy rounded to 3 decimals.",
            "Entropy H = -sum(p_i * log2(p_i)).",
            f"positive={pos}, negative={neg}",
            f"{entropy:.3f}",
        )
        return {
            'title': f"Decision Tree Entropy {level_index + 1}",
            'description': "Measure impurity before evaluating split quality.",
            'prompt': prompt,
            'expected_answer': f"{entropy:.3f}",
            'starter_code': "Hint: derive probabilities from counts, then apply entropy formula.",
            'visualization_payload': {'mode': 'tree', 'algorithm': algorithm_type, 'positive': pos, 'negative': neg},
        }

    if algorithm_type == 'naive_bayes':
        prior_spam = rnd.uniform(0.2, 0.7)
        prior_ham = 1 - prior_spam
        p_word_given_spam = rnd.uniform(0.4, 0.9)
        p_word_given_ham = rnd.uniform(0.1, 0.6)
        score_spam = prior_spam * p_word_given_spam
        score_ham = prior_ham * p_word_given_ham
        label = 'spam' if score_spam >= score_ham else 'ham'
        prompt = _build_prompt(
            "Classify message with one-feature Naive Bayes.",
            (
                f"P(spam)={prior_spam:.3f}, P(ham)={prior_ham:.3f}, "
                f"P(word|spam)={p_word_given_spam:.3f}, P(word|ham)={p_word_given_ham:.3f}"
            ),
            "Return class label: spam or ham.",
            "Compare unnormalized posterior scores.",
            "Use provided priors and likelihoods directly.",
            label,
        )
        return {
            'title': f"Naive Bayes Class {level_index + 1}",
            'description': "Compare posterior scores for binary text class prediction.",
            'prompt': prompt,
            'expected_answer': label,
            'starter_code': "Hint: score = prior * likelihood, choose higher score.",
            'visualization_payload': {'mode': 'conceptual', 'algorithm': algorithm_type, 'spam_score': score_spam, 'ham_score': score_ham},
        }

    if algorithm_type == 'neural_network':
        x1, x2 = rnd.randint(-2, 3), rnd.randint(-2, 3)
        w1, w2 = rnd.uniform(-1.5, 1.5), rnd.uniform(-1.5, 1.5)
        b = rnd.uniform(-1.0, 1.0)
        z = w1 * x1 + w2 * x2 + b
        out = round(_sigmoid(z), 3)
        prompt = _build_prompt(
            "Compute output of one sigmoid neuron.",
            f"x1={x1}, x2={x2}, w1={w1:.3f}, w2={w2:.3f}, b={b:.3f}",
            "Return sigmoid(w1*x1 + w2*x2 + b) rounded to 3 decimals.",
            "-3 <= inputs <= 3",
            f"x1={x1}, x2={x2}, w1={w1:.3f}, w2={w2:.3f}, b={b:.3f}",
            f"{out:.3f}",
        )
        return {
            'title': f"Neural Output {level_index + 1}",
            'description': "Run forward pass for a single logistic unit.",
            'prompt': prompt,
            'expected_answer': f"{out:.3f}",
            'starter_code': "Hint: evaluate linear combination first, sigmoid second.",
            'visualization_payload': {'mode': 'conceptual', 'algorithm': algorithm_type, 'x1': x1, 'x2': x2, 'w1': round(w1, 3), 'w2': round(w2, 3), 'b': round(b, 3)},
        }

    if algorithm_type == 'backtracking':
        size = 6 if difficulty == 'easy' else 7 if difficulty == 'medium' else 8
        values = sorted(rnd.sample(range(1, 25), size))
        target = rnd.randint(max(5, values[0]), sum(values) // 2)
        count = _subset_sum_count(values, target)
        prompt = _build_prompt(
            "Count how many subsets sum exactly to target.",
            f"values={values}, target={target}",
            "Return number of valid subsets as integer.",
            f"1 <= len(values) <= {size}, values are unique positive integers.",
            f"values={values}, target={target}",
            str(count),
        )
        return {
            'title': f"Backtracking Subset Sum {level_index + 1}",
            'description': "Use recursive include/exclude branching to count target-sum subsets.",
            'prompt': prompt,
            'expected_answer': str(count),
            'starter_code': "Hint: at each index branch into take/skip and prune when sum exceeds target.",
            'visualization_payload': {'mode': 'tree', 'algorithm': algorithm_type, 'values': values, 'target': target},
        }

    if algorithm_type == 'recursion':
        n_f = level_index + 5
        a, b = 0, 1
        for _ in range(n_f):
            a, b = b, a + b
        prompt = _build_prompt(
            "Compute nth Fibonacci number with F0=0, F1=1.",
            f"n={n_f}",
            "Return Fn as integer.",
            "0 <= n <= 40",
            f"n={n_f}",
            str(a),
        )
        return {
            'title': f"Recursion Fibonacci {level_index + 1}",
            'description': "Apply recursive relation and base cases to derive Fibonacci term.",
            'prompt': prompt,
            'expected_answer': str(a),
            'starter_code': "Hint: Fn = F(n-1)+F(n-2), with base cases at 0 and 1.",
            'visualization_payload': {'mode': 'tree', 'algorithm': algorithm_type, 'n': n_f},
        }

    if algorithm_type == 'string_algorithm':
        root = rnd.choice(['algo', 'alpha', 'data', 'graph', 'prefix'])
        words = [root + ''.join(rnd.choice('xyzpq') for _ in range(rnd.randint(1, 3))) for _ in range(4)]
        lcp = _longest_common_prefix(words)
        prompt = _build_prompt(
            "Find longest common prefix among given strings.",
            f"words={words}",
            "Return prefix string (empty if none).",
            "1 <= number of words <= 20",
            str(words),
            lcp,
        )
        return {
            'title': f"String Prefix {level_index + 1}",
            'description': "Compare leading characters across all strings to derive common prefix.",
            'prompt': prompt,
            'expected_answer': lcp,
            'starter_code': "Hint: start with first word as candidate and shrink until all words match.",
            'visualization_payload': {'mode': 'array', 'algorithm': algorithm_type, 'words': words},
        }

    if algorithm_type == 'math_algorithm':
        a_num = rnd.randint(20, 180)
        b_num = rnd.randint(15, 160)
        g = _gcd(a_num, b_num)
        prompt = _build_prompt(
            "Compute gcd(a, b) using Euclidean idea.",
            f"a={a_num}, b={b_num}",
            "Return gcd as integer.",
            "1 <= a,b <= 200",
            f"a={a_num}, b={b_num}",
            str(g),
        )
        return {
            'title': f"Math GCD {level_index + 1}",
            'description': "Practice repeated modulo reduction for greatest common divisor.",
            'prompt': prompt,
            'expected_answer': str(g),
            'starter_code': "Hint: iterate (a,b) -> (b, a mod b) until b is 0.",
            'visualization_payload': {'mode': 'conceptual', 'algorithm': algorithm_type, 'a': a_num, 'b': b_num},
        }

    if algorithm_type == 'bit_conversion':
        value = rnd.randint(5, 255 if difficulty == 'easy' else 511 if difficulty == 'medium' else 1023)
        binary = bin(value)[2:]
        prompt = _build_prompt(
            "Convert decimal integer to binary representation.",
            f"decimal={value}",
            "Return binary string without leading zeros.",
            "0 <= decimal <= 1023",
            f"decimal={value}",
            binary,
        )
        return {
            'title': f"Bit Conversion {level_index + 1}",
            'description': "Translate base-10 value into equivalent binary digits.",
            'prompt': prompt,
            'expected_answer': binary,
            'starter_code': "Hint: divide by 2 repeatedly and read remainders in reverse order.",
            'visualization_payload': {'mode': 'array', 'algorithm': algorithm_type, 'decimal': value, 'binary': binary},
        }

    if algorithm_type == 'linked_list':
        values = [rnd.randint(1, max(12, v_max // 2)) for _ in range(max(5, n))]
        if rnd.random() < 0.75:
            target = rnd.choice(values)
            expected = values.index(target)
        else:
            target = v_max + rnd.randint(3, 25)
            expected = -1
        prompt = _build_prompt(
            "Find first index of target in a singly linked list traversal.",
            f"values={values}, target={target}",
            "Return first index (0-based) or -1 if not found.",
            f"1 <= len(values) <= {max(5, n)}",
            f"values={values}, target={target}",
            str(expected),
        )
        return {
            'title': f"Linked List Lookup {level_index + 1}",
            'description': "Traverse node-by-node and report first target position.",
            'prompt': prompt,
            'expected_answer': str(expected),
            'starter_code': "Hint: start at head and stop at the first node equal to target.",
            'visualization_payload': {'mode': 'conceptual', 'algorithm': algorithm_type, 'values': values, 'target': target},
        }

    if algorithm_type == 'doubly_linked_list':
        values = [rnd.randint(1, max(12, v_max // 2)) for _ in range(max(5, n))]
        if rnd.random() < 0.75:
            target = rnd.choice(values)
            expected = -1
            for idx in range(len(values) - 1, -1, -1):
                if values[idx] == target:
                    expected = idx
                    break
        else:
            target = v_max + rnd.randint(3, 25)
            expected = -1
        prompt = _build_prompt(
            "Traverse from tail in a doubly linked list and locate target.",
            f"values={values}, target={target}, from_end=true",
            "Return first index encountered from tail-side traversal, or -1.",
            f"1 <= len(values) <= {max(5, n)}",
            f"values={values}, target={target}, from_end=true",
            str(expected),
        )
        return {
            'title': f"Doubly Linked List Lookup {level_index + 1}",
            'description': "Use reverse traversal through prev links to find target.",
            'prompt': prompt,
            'expected_answer': str(expected),
            'starter_code': "Hint: walk from tail using prev pointers and stop on first match.",
            'visualization_payload': {
                'mode': 'conceptual',
                'algorithm': algorithm_type,
                'values': values,
                'target': target,
                'from_end': True,
            },
        }

    if algorithm_type == 'circular_linked_list':
        values = [rnd.randint(1, max(12, v_max // 2)) for _ in range(max(5, n))]
        start_index = rnd.randint(0, len(values) - 1)
        if rnd.random() < 0.75:
            target = rnd.choice(values)
            expected = -1
            for step in range(len(values)):
                idx = (start_index + step) % len(values)
                if values[idx] == target:
                    expected = idx
                    break
        else:
            target = v_max + rnd.randint(3, 25)
            expected = -1
        prompt = _build_prompt(
            "Traverse circular linked list from start index and find target.",
            f"values={values}, start_index={start_index}, target={target}",
            "Return first matching index in circular walk, or -1 if absent.",
            "Complete at most one full cycle.",
            f"values={values}, start_index={start_index}, target={target}",
            str(expected),
        )
        return {
            'title': f"Circular Linked List Lookup {level_index + 1}",
            'description': "Follow circular next pointers with wrap-around awareness.",
            'prompt': prompt,
            'expected_answer': str(expected),
            'starter_code': "Hint: stop after one full cycle to avoid infinite traversal.",
            'visualization_payload': {
                'mode': 'conceptual',
                'algorithm': algorithm_type,
                'values': values,
                'target': target,
                'start_index': start_index,
            },
        }

    if algorithm_type == 'stack':
        initial = [rnd.randint(1, v_max) for _ in range(3 if difficulty == 'easy' else 4 if difficulty == 'medium' else 5)]
        ops_total = 5 if difficulty == 'easy' else 6 if difficulty == 'medium' else 8
        state = list(initial)
        operations = []
        for _ in range(ops_total):
            choose_push = rnd.random() < 0.6 or not state
            if choose_push:
                value = rnd.randint(1, v_max)
                state.append(value)
                operations.append({'op': 'push', 'value': value})
            else:
                if state:
                    state.pop()
                operations.append({'op': 'pop'})
        top_value = 'empty' if not state else str(state[-1])
        op_text = ', '.join(
            f"push({entry['value']})" if entry['op'] == 'push' else 'pop()'
            for entry in operations
        )
        prompt = _build_prompt(
            "Simulate stack operations and report final top.",
            f"initial={initial}, operations=[{op_text}]",
            "Return final top value, or 'empty' if stack is empty.",
            "Stack is LIFO. Ignore pop on empty stack.",
            f"initial={initial}, operations=[{op_text}]",
            top_value,
        )
        return {
            'title': f"Stack Simulator {level_index + 1}",
            'description': "Apply push/pop transitions and read final stack top.",
            'prompt': prompt,
            'expected_answer': top_value,
            'starter_code': "Hint: push appends to top, pop removes top when available.",
            'visualization_payload': {
                'mode': 'conceptual',
                'algorithm': algorithm_type,
                'initial': initial,
                'operations': operations,
            },
        }

    if algorithm_type == 'queue':
        initial = [rnd.randint(1, v_max) for _ in range(3 if difficulty == 'easy' else 4 if difficulty == 'medium' else 5)]
        ops_total = 5 if difficulty == 'easy' else 6 if difficulty == 'medium' else 8
        state = list(initial)
        operations = []
        for _ in range(ops_total):
            choose_enqueue = rnd.random() < 0.6 or not state
            if choose_enqueue:
                value = rnd.randint(1, v_max)
                state.append(value)
                operations.append({'op': 'enqueue', 'value': value})
            else:
                if state:
                    state.pop(0)
                operations.append({'op': 'dequeue'})
        front_value = 'empty' if not state else str(state[0])
        op_text = ', '.join(
            f"enqueue({entry['value']})" if entry['op'] == 'enqueue' else 'dequeue()'
            for entry in operations
        )
        prompt = _build_prompt(
            "Simulate queue operations and report final front.",
            f"initial={initial}, operations=[{op_text}]",
            "Return final front value, or 'empty' if queue is empty.",
            "Queue is FIFO. Ignore dequeue on empty queue.",
            f"initial={initial}, operations=[{op_text}]",
            front_value,
        )
        return {
            'title': f"Queue Simulator {level_index + 1}",
            'description': "Apply enqueue/dequeue transitions and read final front.",
            'prompt': prompt,
            'expected_answer': front_value,
            'starter_code': "Hint: dequeue removes from front while enqueue adds at rear.",
            'visualization_payload': {
                'mode': 'conceptual',
                'algorithm': algorithm_type,
                'initial': initial,
                'operations': operations,
            },
        }

    if algorithm_type == 'array_algorithm':
        arr = [rnd.randint(-20, 20) for _ in range(n)]
        best = _max_subarray(arr)
        prompt = _build_prompt(
            "Find maximum contiguous subarray sum.",
            f"arr={_format_array(arr)}",
            "Return maximum subarray sum as integer.",
            f"1 <= n <= {n}",
            _format_array(arr),
            str(best),
        )
        return {
            'title': f"Array Max Subarray {level_index + 1}",
            'description': "Track best running segment sum using Kadane-style transitions.",
            'prompt': prompt,
            'expected_answer': str(best),
            'starter_code': "Hint: at each step choose between restarting at current value or extending previous sum.",
            'visualization_payload': {'mode': 'array', 'algorithm': algorithm_type, 'data': arr},
        }

    if algorithm_type == 'hashing_algorithm':
        arr = [rnd.randint(1, 30) for _ in range(n)]
        target = rnd.randint(10, 45)
        seen = set()
        exists = False
        for value in arr:
            if target - value in seen:
                exists = True
                break
            seen.add(value)
        answer = 'true' if exists else 'false'
        prompt = _build_prompt(
            "Determine whether any pair sums to target.",
            f"arr={_format_array(arr)}, target={target}",
            "Return true or false.",
            f"1 <= n <= {n}",
            f"arr={_format_array(arr)}, target={target}",
            answer,
        )
        return {
            'title': f"Hashing Pair Sum {level_index + 1}",
            'description': "Use hash-set complement checks to detect two-sum existence.",
            'prompt': prompt,
            'expected_answer': answer,
            'starter_code': "Hint: while scanning x, check whether target-x was already seen.",
            'visualization_payload': {'mode': 'conceptual', 'algorithm': algorithm_type, 'arr': arr, 'target': target},
        }

    raise ValueError(f'Unsupported algorithm type: {algorithm_type}')


class Command(BaseCommand):
    help = 'Regenerate challenge_bank.json with richer prompts, concrete answers, and visualization payloads.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            default='challenges/data/challenge_bank.json',
            help='Path to challenge_bank.json',
        )

    def handle(self, *args, **options):
        bank_path = Path(options['file'])
        if not bank_path.exists():
            raise CommandError(f'File not found: {bank_path}')

        with open(bank_path, 'r', encoding='utf-8') as handle:
            bank = json.load(handle)

        updated = 0
        prompt_seen = defaultdict(int)
        for topic in bank.get('topics', []):
            for challenge in topic.get('challenges', []):
                algorithm_type = challenge.get('algorithm_type', '')
                difficulty = challenge.get('difficulty', 'easy')
                level_index = int(challenge.get('order_index', 0))
                generated = _algorithm_payload(algorithm_type, difficulty, level_index)
                prompt_seen[generated['prompt']] += 1
                if prompt_seen[generated['prompt']] > 1:
                    generated['prompt'] = (
                        f"{generated['prompt']}\n"
                        f"Variant: {algorithm_type.replace('_', ' ').title()} Level {level_index + 1}"
                    )

                challenge['title'] = generated['title']
                challenge['description'] = generated['description']
                challenge['prompt'] = generated['prompt']
                challenge['expected_answer'] = generated['expected_answer']
                challenge['starter_code'] = generated['starter_code']
                challenge['tags'] = ['algorithm', algorithm_type, difficulty, f'level_{level_index + 1}']
                challenge['visualization_payload'] = generated['visualization_payload']
                updated += 1

        with open(bank_path, 'w', encoding='utf-8') as handle:
            json.dump(bank, handle, indent=2)
            handle.write('\n')

        self.stdout.write(self.style.SUCCESS(f'[OK] Regenerated {updated} challenges in {bank_path}'))
