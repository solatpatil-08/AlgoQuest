/* ============================================
   CONCEPTUAL VISUALIZATIONS - Payload-aware teaching view
   ============================================ */

const AlgorithmVizTypeMap = {
    bubble_sort: 'sorting_process',
    selection_sort: 'sorting_process',
    insertion_sort: 'sorting_process',
    merge_sort: 'sorting_process',
    quick_sort: 'sorting_process',
    heap_sort: 'sorting_process',
    linear_search: 'array',
    binary_search: 'array',
    linked_list: 'linked_list',
    doubly_linked_list: 'linked_list',
    circular_linked_list: 'linked_list',
    stack: 'stack',
    queue: 'queue',
    bfs: 'binary_tree',
    dfs: 'binary_tree',
    astar: 'binary_tree',
    dijkstra: 'binary_tree',
    minimax: 'binary_tree',
    bst: 'binary_tree',
    knapsack: 'array',
    lcs: 'array',
    activity_selection: 'sorting_process',
    linear_regression: 'ml_concept',
    logistic_regression: 'ml_concept',
    kmeans: 'ml_concept',
    knn: 'ml_concept',
    decision_tree: 'binary_tree',
    naive_bayes: 'ml_concept',
    neural_network: 'ml_concept',
    backtracking: 'binary_tree',
    recursion: 'binary_tree',
    string_algorithm: 'array',
    math_algorithm: 'array',
    bit_conversion: 'array',
    array_algorithm: 'array',
    hashing_algorithm: 'hash_map',
};

const AlgorithmComplexityMap = {
    linear_search: 'O(n)',
    binary_search: 'O(log n)',
    linked_list: 'O(n) traversal / O(1) insert-at-head',
    doubly_linked_list: 'O(n) traversal / O(1) local splice',
    circular_linked_list: 'O(n) traversal / O(1) cyclic next',
    stack: 'O(1) push/pop',
    queue: 'O(1) enqueue/dequeue',
    bubble_sort: 'O(n^2)',
    selection_sort: 'O(n^2)',
    insertion_sort: 'O(n^2)',
    merge_sort: 'O(n log n)',
    quick_sort: 'O(n log n) avg',
    heap_sort: 'O(n log n)',
    bst: 'O(log n) avg',
    knapsack: 'O(n * capacity)',
    lcs: 'O(n * m)',
    activity_selection: 'O(n log n)',
    linear_regression: 'O(n)',
    logistic_regression: 'O(1) per prediction',
    kmeans: 'O(n * k * iterations)',
    knn: 'O(n)',
    decision_tree: 'O(n log n) typical',
    naive_bayes: 'O(features)',
    neural_network: 'O(weights)',
    backtracking: 'Exponential (pruned)',
    recursion: 'Varies by recurrence',
    string_algorithm: 'Varies by operation',
    math_algorithm: 'O(log min(a,b)) for gcd',
    bit_conversion: 'O(log n)',
    array_algorithm: 'O(n)',
    hashing_algorithm: 'O(n) scan / O(1) lookup avg',
};

const AlgorithmTipsMap = {
    knapsack: [
        'State = best value at each capacity.',
        'For 0/1 knapsack, iterate capacities in reverse.',
    ],
    lcs: [
        'Match => diagonal + 1; mismatch => max(left, up).',
        'Final cell stores LCS length.',
    ],
    activity_selection: [
        'Sort by earliest finish time first.',
        'Always pick next compatible activity.',
    ],
    linear_regression: [
        'Use two points to derive slope m.',
        'Then compute b and evaluate y = m*x + b at query x.',
    ],
    logistic_regression: [
        'Compute z first from the linear model.',
        'Apply sigma(z)=1/(1+e^-z) and round at the end.',
    ],
    decision_tree: [
        'Convert counts to probabilities first.',
        'Entropy drops as class purity increases.',
    ],
    naive_bayes: [
        'Posterior score = prior * likelihood.',
        'Pick the class with larger score.',
    ],
    neural_network: [
        'Compute z = w1*x1 + w2*x2 + b.',
        'Apply sigmoid only after the linear sum.',
    ],
    backtracking: [
        'At each index: include or skip.',
        'Prune branches that already exceed target.',
    ],
    recursion: [
        'Define base cases first.',
        'Then express answer via smaller subproblems.',
    ],
    hashing_algorithm: [
        'While scanning x, check if (target - x) already exists.',
        'Hash set gives expected O(1) lookup.',
    ],
    linked_list: [
        'Traverse node by node until the target condition is met.',
        'Pointer updates must preserve list connectivity.',
    ],
    doubly_linked_list: [
        'Use prev/next links to move in either direction.',
        'When removing/inserting, update both neighboring pointers.',
    ],
    circular_linked_list: [
        'There is no null tail; traversal can wrap to head.',
        'Stop after a full cycle to avoid infinite loops.',
    ],
    stack: [
        'Last-In-First-Out: only top is directly accessible.',
        'Push adds to top, pop removes from top.',
    ],
    queue: [
        'First-In-First-Out ordering is mandatory.',
        'Enqueue at rear, dequeue from front.',
    ],
};

const ConceptualVisualizations = {
    array: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('array', algorithmType, payload));
    },
    linked_list: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('linked_list', algorithmType, payload));
    },
    stack: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('stack', algorithmType, payload));
    },
    queue: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('queue', algorithmType, payload));
    },
    hash_map: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('hash_map', algorithmType, payload));
    },
    binary_tree: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('binary_tree', algorithmType, payload));
    },
    sorting_process: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('sorting_process', algorithmType, payload));
    },
    ml_concept: function(containerId = 'visualizationOutput', payload = {}, algorithmType = '') {
        renderConcept(containerId, buildConceptModel('ml_concept', algorithmType, payload));
    },
};

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function asArray(payload, key, fallback) {
    const raw = payload && payload[key];
    return Array.isArray(raw) && raw.length ? raw : fallback;
}

function formatValue(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => formatValue(item)).join(', ')}]`;
    }
    if (value && typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (_err) {
            return String(value);
        }
    }
    return String(value);
}

function metricChip(label, value) {
    return `<span class="concept-chip"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`;
}

function renderNumberStrip(values, emphasizeIndex = -1) {
    return `
        <div class="concept-strip">
            ${values.map((item, idx) => `
                <span class="concept-cell${idx === emphasizeIndex ? ' active' : ''}">${escapeHtml(item)}</span>
            `).join('')}
        </div>
    `;
}

function renderTimeline(starts, ends) {
    const rows = starts.map((s, idx) => ({ start: Number(s), end: Number(ends[idx] || s) }))
        .filter((row) => Number.isFinite(row.start) && Number.isFinite(row.end));
    if (!rows.length) {
        return '<p class="concept-muted mb-0">Timeline data is not available for this challenge.</p>';
    }

    const minStart = Math.min(...rows.map((row) => row.start));
    const maxEnd = Math.max(...rows.map((row) => row.end));
    const span = Math.max(1, maxEnd - minStart);

    return `
        <div class="concept-timeline">
            ${rows.map((row, idx) => {
                const left = ((row.start - minStart) / span) * 100;
                const width = Math.max(8, ((row.end - row.start) / span) * 100);
                return `
                    <div class="concept-timeline-row">
                        <span class="concept-timeline-label">A${idx + 1}</span>
                        <div class="concept-timeline-track">
                            <span class="concept-timeline-bar" style="left:${left}%;width:${width}%;">
                                [${row.start}, ${row.end})
                            </span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderPairsTable(headers, rows) {
    return `
        <div class="table-responsive">
            <table class="table table-sm align-middle mb-0 concept-table">
                <thead>
                    <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderConcept(containerId, model) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const steps = (model.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('');
    const tips = (model.tips || []).map((tip) => `<li>${escapeHtml(tip)}</li>`).join('');

    container.innerHTML = `
        <section class="concept-shell">
            <header class="concept-header">
                <div>
                    <h5 class="concept-title mb-1">${escapeHtml(model.title)}</h5>
                    <p class="concept-subtitle mb-0">${escapeHtml(model.subtitle)}</p>
                </div>
                <div class="concept-metrics">
                    ${(model.metrics || []).join('')}
                </div>
            </header>
            <div class="concept-grid">
                <div class="concept-panel">
                    ${model.visual}
                </div>
                <div class="concept-panel">
                    <h6 class="concept-section-title">How to think about it</h6>
                    <ol class="concept-steps mb-0">${steps}</ol>
                </div>
            </div>
            <div class="concept-panel concept-panel-soft">
                <h6 class="concept-section-title">Concept checkpoints</h6>
                <ul class="concept-list mb-0">${tips}</ul>
            </div>
        </section>
    `;
}

function buildConceptModel(vizType, algorithmType, payload) {
    const normalizedAlgorithm = (algorithmType || '').trim().toLowerCase();
    const titleMap = {
        array: 'Array View',
        linked_list: 'Linked List View',
        stack: 'Stack View',
        queue: 'Queue View',
        hash_map: 'Hash Map View',
        binary_tree: 'Tree View',
        sorting_process: 'Sorting Flow',
        ml_concept: 'Machine Learning Concept',
    };

    const baseSteps = {
        array: ['Read input values carefully.', 'Track index movement and state updates.', 'Return only requested output format.'],
        linked_list: ['Follow next pointers node by node.', 'Track insertion/deletion impact.', 'Confirm final structure before answer.'],
        stack: ['Use push/pop order strictly.', 'Top element changes after every operation.', 'Validate final top/size.'],
        queue: ['Use FIFO ordering always.', 'Front leaves first, back enters last.', 'Check final queue state.'],
        hash_map: ['Hash key to bucket.', 'Handle collisions consistently.', 'Return value/boolean exactly as asked.'],
        binary_tree: ['Identify root and children relationships.', 'Apply traversal/rule sequence carefully.', 'Validate final output ordering.'],
        sorting_process: ['Compare/select according to algorithm rule.', 'Update sequence after each pass.', 'Return final sorted output only.'],
        ml_concept: ['Identify inputs/features.', 'Apply the core formula/update step.', 'Interpret final prediction or metric.'],
    };

    let visual = '<p class="concept-muted mb-0">Visualization data will appear here.</p>';
    const metrics = [];
    const tips = AlgorithmTipsMap[normalizedAlgorithm] || [
        'Keep track of current state after each operation.',
        'Double-check final output format before submission.',
    ];

    if (normalizedAlgorithm === 'knapsack') {
        const weights = asArray(payload, 'weights', [2, 3, 4]);
        const values = asArray(payload, 'values', [6, 7, 8]);
        const capacity = Number(payload.capacity ?? 5);
        visual = renderPairsTable(
            ['Item', 'Weight', 'Value'],
            weights.map((w, idx) => [`#${idx + 1}`, String(w), String(values[idx] ?? '-')])
        );
        metrics.push(metricChip('Capacity', String(capacity)));
        metrics.push(metricChip('Items', String(weights.length)));
    } else if (normalizedAlgorithm === 'lcs') {
        const s1 = String(payload.s1 || 'ABCBA');
        const s2 = String(payload.s2 || 'BACAB');
        visual = `
            <p class="concept-muted mb-2">DP grid compares prefixes of two strings.</p>
            <div class="d-flex flex-column gap-2">
                <div><strong>s1:</strong> ${escapeHtml(s1)}</div>
                <div><strong>s2:</strong> ${escapeHtml(s2)}</div>
                ${renderNumberStrip(['rows', s1.length + 1, 'cols', s2.length + 1])}
            </div>
        `;
        metrics.push(metricChip('Grid', `${s1.length + 1} x ${s2.length + 1}`));
    } else if (normalizedAlgorithm === 'activity_selection') {
        const starts = asArray(payload, 'starts', [1, 3, 0, 5, 8]);
        const ends = asArray(payload, 'ends', [2, 4, 6, 7, 9]);
        visual = renderTimeline(starts, ends);
        metrics.push(metricChip('Activities', String(Math.min(starts.length, ends.length))));
    } else if (normalizedAlgorithm === 'hashing_algorithm') {
        const arr = asArray(payload, 'arr', [3, 7, 11, 5]);
        const target = Number(payload.target ?? 12);
        visual = `
            <p class="concept-muted mb-2">Scan once and check complement in hash set.</p>
            ${renderNumberStrip(arr)}
            <p class="mb-0 mt-2"><strong>Target:</strong> ${escapeHtml(target)}</p>
        `;
        metrics.push(metricChip('Target', String(target)));
    } else if (normalizedAlgorithm === 'backtracking') {
        const values = asArray(payload, 'values', [2, 3, 5, 6, 8]);
        const target = Number(payload.target ?? 10);
        visual = `
            <p class="concept-muted mb-2">Each level branches into include / skip.</p>
            ${renderNumberStrip(values)}
            <p class="mb-0 mt-2"><strong>Target sum:</strong> ${escapeHtml(target)}</p>
        `;
        metrics.push(metricChip('Branch factor', '2'));
        metrics.push(metricChip('Target', String(target)));
    } else if (normalizedAlgorithm === 'recursion') {
        const n = Number(payload.n ?? 8);
        visual = `
            <p class="concept-muted mb-2">Break problem into smaller calls until base case.</p>
            ${renderNumberStrip([`f(${n})`, `f(${Math.max(0, n - 1)})`, `f(${Math.max(0, n - 2)})`], 0)}
        `;
        metrics.push(metricChip('Input n', String(n)));
    } else if (normalizedAlgorithm === 'bit_conversion') {
        const decimal = Number(payload.decimal ?? 42);
        const binary = String(payload.binary || decimal.toString(2));
        visual = `
            <div class="d-flex flex-column gap-2">
                <div><strong>Decimal:</strong> ${escapeHtml(decimal)}</div>
                <div><strong>Binary:</strong> ${escapeHtml(binary)}</div>
                ${renderNumberStrip(binary.split(''))}
            </div>
        `;
        metrics.push(metricChip('Digits', String(binary.length)));
    } else if (normalizedAlgorithm === 'linear_regression') {
        const points = asArray(payload, 'points', [[1, 3], [2, 5], [3, 7]]);
        const query = Number(payload.query_x ?? 6);
        visual = `
            <p class="concept-muted mb-2">Fit line through sample points, then predict at query x.</p>
            ${renderPairsTable(
                ['x', 'y'],
                points.map((point) => [String(Array.isArray(point) ? point[0] : '?'), String(Array.isArray(point) ? point[1] : '?')])
            )}
            <p class="mb-0 mt-2"><strong>Query x:</strong> ${escapeHtml(query)}</p>
        `;
        metrics.push(metricChip('Points', String(points.length)));
    } else if (normalizedAlgorithm === 'logistic_regression') {
        const z = Number(payload.z ?? 0.85);
        const sigma = 1 / (1 + Math.exp(-z));
        visual = `
            <p class="concept-muted mb-2">Map linear score z to probability with sigmoid.</p>
            <div class="concept-score-row">
                <span>z</span>
                <strong>${escapeHtml(z.toFixed(3))}</strong>
            </div>
            <div class="concept-score-row">
                <span>sigma(z)</span>
                <strong>${escapeHtml(sigma.toFixed(3))}</strong>
            </div>
        `;
    } else if (normalizedAlgorithm === 'decision_tree') {
        const positive = Number(payload.positive ?? 6);
        const negative = Number(payload.negative ?? 4);
        const total = Math.max(1, positive + negative);
        const pPos = positive / total;
        const pNeg = negative / total;
        let entropy = 0;
        if (pPos > 0) entropy -= pPos * Math.log2(pPos);
        if (pNeg > 0) entropy -= pNeg * Math.log2(pNeg);
        visual = `
            <p class="concept-muted mb-2">Entropy measures impurity before split.</p>
            ${renderPairsTable(
                ['Class', 'Count', 'Probability'],
                [
                    ['Positive', String(positive), pPos.toFixed(3)],
                    ['Negative', String(negative), pNeg.toFixed(3)],
                ]
            )}
            <p class="mb-0 mt-2"><strong>Entropy:</strong> ${escapeHtml(entropy.toFixed(3))}</p>
        `;
    } else if (normalizedAlgorithm === 'neural_network') {
        const x1 = Number(payload.x1 ?? 2);
        const x2 = Number(payload.x2 ?? -1);
        const w1 = Number(payload.w1 ?? 0.8);
        const w2 = Number(payload.w2 ?? -0.4);
        const b = Number(payload.b ?? 0.1);
        const z = (w1 * x1) + (w2 * x2) + b;
        const out = 1 / (1 + Math.exp(-z));
        visual = `
            <p class="concept-muted mb-2">Single-neuron forward pass: linear sum then sigmoid.</p>
            ${renderPairsTable(
                ['Term', 'Value'],
                [
                    ['x1, x2', `${x1}, ${x2}`],
                    ['w1, w2', `${w1.toFixed(3)}, ${w2.toFixed(3)}`],
                    ['bias', b.toFixed(3)],
                    ['z', z.toFixed(3)],
                    ['sigma(z)', out.toFixed(3)],
                ]
            )}
        `;
    } else if (normalizedAlgorithm === 'kmeans') {
        const points = asArray(payload, 'points', [2, 4, 8, 12, 17, 21]);
        const centroids = asArray(payload, 'centroids', [5, 18]);
        visual = `
            <p class="concept-muted mb-2">Assign points to nearest centroid, then recompute means.</p>
            <div class="mb-2">${renderNumberStrip(points)}</div>
            <div>${renderNumberStrip(centroids.map((c) => `C:${c}`))}</div>
        `;
        metrics.push(metricChip('k', String(centroids.length)));
    } else if (normalizedAlgorithm === 'knn') {
        const train = asArray(payload, 'train_points', [[2, 'A'], [4, 'A'], [9, 'B'], [12, 'B']]);
        const query = Number(payload.query_x ?? 7);
        const k = Number(payload.k ?? 3);
        visual = renderPairsTable(
            ['Point', 'Label', 'Distance to query'],
            train.map((row) => {
                const x = Number(Array.isArray(row) ? row[0] : row);
                const label = Array.isArray(row) ? row[1] : '?';
                return [String(x), String(label), String(Math.abs(x - query))];
            })
        );
        metrics.push(metricChip('Query', String(query)));
        metrics.push(metricChip('k', String(k)));
    } else if (normalizedAlgorithm === 'naive_bayes') {
        const spamScore = Number(payload.spam_score ?? 0.42);
        const hamScore = Number(payload.ham_score ?? 0.31);
        visual = `
            <p class="concept-muted mb-2">Compare unnormalized posterior scores.</p>
            <div class="concept-score-row">
                <span>Spam score</span>
                <strong>${escapeHtml(spamScore.toFixed(4))}</strong>
            </div>
            <div class="concept-score-row">
                <span>Ham score</span>
                <strong>${escapeHtml(hamScore.toFixed(4))}</strong>
            </div>
        `;
    } else if (vizType === 'sorting_process') {
        const arr = asArray(payload, 'data', [9, 3, 5, 8]);
        const sorted = arr.slice().sort((a, b) => Number(a) - Number(b));
        visual = `
            <p class="concept-muted mb-2">Watch data transform from unsorted to sorted order.</p>
            <div class="mb-2"><strong>Input</strong>${renderNumberStrip(arr)}</div>
            <div><strong>Output</strong>${renderNumberStrip(sorted)}</div>
        `;
    } else if (vizType === 'hash_map') {
        visual = renderPairsTable(
            ['Bucket', 'Key', 'Value'],
            [['0', 'name', 'Alice'], ['1', 'age', '30'], ['2', '-', '-'], ['3', 'city', 'NYC']]
        );
    } else if (vizType === 'binary_tree') {
        const sequence = asArray(payload, 'insert_sequence', [4, 2, 6, 1, 3, 5, 7]);
        visual = `
            <p class="concept-muted mb-2">Insert sequence drives tree shape and traversal output.</p>
            ${renderNumberStrip(sequence)}
        `;
    } else {
        const data = asArray(payload, 'data', [3, 7, 2, 9, 1]);
        visual = renderNumberStrip(data);
    }

    const complexity = AlgorithmComplexityMap[normalizedAlgorithm];
    if (complexity) {
        metrics.push(metricChip('Complexity', complexity));
    }

    return {
        title: `${titleMap[vizType] || 'Concept View'}${normalizedAlgorithm ? ` - ${normalizedAlgorithm.replace(/_/g, ' ')}` : ''}`,
        subtitle: 'Interactive conceptual map built from this challenge input.',
        visual: visual,
        steps: baseSteps[vizType] || baseSteps.array,
        tips: tips,
        metrics: metrics,
    };
}

function renderPayloadSummary(container, payload) {
    if (!container || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return;
    }

    const keys = Object.keys(payload).filter((key) => key !== 'mode' && key !== 'algorithm');
    if (!keys.length) {
        return;
    }

    const rows = keys.slice(0, 8).map((key) => `
        <div class="concept-kv-row">
            <span class="concept-kv-key">${escapeHtml(key)}</span>
            <span class="concept-kv-value">${escapeHtml(formatValue(payload[key]))}</span>
        </div>
    `).join('');

    container.insertAdjacentHTML(
        'beforeend',
        `<section class="concept-shell concept-shell-compact mt-3">
            <h6 class="concept-section-title mb-2">Challenge Data Snapshot</h6>
            <div>${rows}</div>
        </section>`
    );
}

// Helper to select visualization type
function showConceptualVisualization(topicId, containerId = 'visualizationOutput', algorithmType = '', visualizationType = 'conceptual', payload = {}) {
    const vizTypeMap = {
        dsa_arrays: 'array',
        dsa_linked_lists: 'linked_list',
        dsa_stacks: 'stack',
        dsa_queues: 'queue',
        dsa_hash_maps: 'hash_map',
        advanced_trees: 'binary_tree',
        sort_bubble: 'sorting_process',
        sort_quick: 'sorting_process',
        sort_merge: 'sorting_process',
        ml_linear_regression: 'ml_concept',
        ml_knn: 'ml_concept',
        ml_kmeans: 'ml_concept',
        ml_decision_tree: 'ml_concept',
    };

    const visualizationTypeMap = {
        array: 'array',
        tree: 'binary_tree',
        graph: 'binary_tree',
        grid: 'sorting_process',
        matrix: 'sorting_process',
        conceptual: 'ml_concept',
        none: 'ml_concept',
    };

    const vizType =
        vizTypeMap[topicId] ||
        AlgorithmVizTypeMap[(algorithmType || '').toLowerCase()] ||
        visualizationTypeMap[visualizationType] ||
        'ml_concept';

    const vizFunc = ConceptualVisualizations[vizType] || ConceptualVisualizations.ml_concept;
    vizFunc(containerId, payload, (algorithmType || '').toLowerCase(), visualizationType, topicId);

    const container = document.getElementById(containerId);
    renderPayloadSummary(container, payload);
}
