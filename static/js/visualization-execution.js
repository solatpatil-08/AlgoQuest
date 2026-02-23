/* ============================================
   EXECUTION VISUALIZATIONS - Step-by-step replay
   (Phase 1: Advanced DSA first in quick-filter order)
   ============================================ */

(function initExecutionVisualizations() {
    const SUPPORTED_ALGORITHMS = new Set([
        'knapsack',
        'lcs',
        'activity_selection',
        'backtracking',
        'recursion',
        'bit_conversion',
        'math_algorithm',
        'linked_list',
        'doubly_linked_list',
        'circular_linked_list',
        'stack',
        'queue',
        'array_algorithm',
        'hashing_algorithm',
        'bst',
        'bubble_sort',
        'selection_sort',
        'insertion_sort',
        'merge_sort',
        'quick_sort',
        'heap_sort',
        'linear_search',
        'binary_search',
        'bfs',
        'dfs',
        'dijkstra',
        'astar',
        'minimax',
        'string_algorithm',
        'linear_regression',
        'logistic_regression',
        'kmeans',
        'knn',
        'decision_tree',
        'naive_bayes',
        'neural_network',
    ]);

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function asFiniteNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeNumberArray(raw) {
        if (!Array.isArray(raw)) {
            return [];
        }
        return raw.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }

    function normalizePointPairs(raw) {
        if (!Array.isArray(raw)) {
            return [];
        }
        return raw
            .map((row, idx) => {
                if (!Array.isArray(row) || row.length < 2) {
                    return null;
                }
                const x = Number(row[0]);
                const y = Number(row[1]);
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    return null;
                }
                return { index: idx, x, y };
            })
            .filter(Boolean);
    }

    function roundTo(value, decimals = 3) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    function formatNumber(value, decimals = 3, fixed = false) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return 'NaN';
        }
        const rounded = roundTo(numeric, decimals);
        if (fixed) {
            return rounded.toFixed(decimals);
        }
        return String(rounded.toFixed(decimals).replace(/\.?0+$/, ''));
    }

    function renderIndexedStrip(values, highlightSet = new Set()) {
        return `
            <div class="exec-strip">
                ${values.map((value, idx) => `
                    <div class="exec-cell${highlightSet.has(idx) ? ' active' : ''}">
                        <span class="exec-cell-value">${escapeHtml(value)}</span>
                        <span class="exec-cell-index">idx ${idx}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderMatrix(dp, s1, s2, activeI, activeJ) {
        const rows = dp.length;
        const cols = dp[0] ? dp[0].length : 0;
        if (!rows || !cols) {
            return '<p class="concept-muted mb-0">Matrix unavailable.</p>';
        }

        const header = [' ', ' '].concat(s2.split(''));
        return `
            <div class="table-responsive">
                <table class="table table-sm align-middle mb-0 exec-table">
                    <thead>
                        <tr>${header.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${dp.map((row, i) => {
                            const rowLabel = i === 0 ? ' ' : s1[i - 1];
                            return `
                                <tr>
                                    <th>${escapeHtml(rowLabel)}</th>
                                    ${row.map((value, j) => {
                                        const isActive = i === activeI && j === activeJ;
                                        return `<td class="${isActive ? 'exec-active-td' : ''}">${escapeHtml(value)}</td>`;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Graphical renderer for arrays with animated cells
    function renderArrayVisualization(values, highlightSet = new Set(), comparingSet = new Set()) {
        if (!values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const width = Math.max(400, values.length * 50);
        const height = 100;
        const cellWidth = Math.min(50, (width - 40) / values.length);
        const startX = 20;
        const startY = 30;

        const cells = values.map((value, idx) => {
            const x = startX + (idx * (cellWidth + 4));
            const isHighlighted = highlightSet.has(idx);
            const isComparing = comparingSet.has(idx);
            const fill = isComparing ? '#FCD34D' : isHighlighted ? '#86EFAC' : '#E2E8F0';
            const strokeWidth = isComparing ? '2.8' : isHighlighted ? '2.4' : '1.6';
            return `
                <g>
                    <rect x="${x}" y="${startY}" width="${cellWidth}" height="40" fill="${fill}" stroke="#1E293B" stroke-width="${strokeWidth}" rx="4"></rect>
                    <text x="${x + cellWidth / 2}" y="${startY + 24}" text-anchor="middle" font-size="13" font-weight="700" fill="#0F172A">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + cellWidth / 2}" y="${startY + 48}" text-anchor="middle" font-size="10" fill="#64748B">[${idx}]</text>
                </g>
            `;
        }).join('');

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Array visualization">
                    ${cells}
                </svg>
            </div>
        `;
    }

    // Stack visualization (LIFO - Last In First Out)
    function renderStackVisualization(items, topIndex = -1) {
        if (!items.length) {
            return '<p class="concept-muted mb-0">Stack unavailable.</p>';
        }
        const cellHeight = 40;
        const width = 200;
        const height = Math.max(120, items.length * (cellHeight + 2) + 20);

        const svg = items.map((item, idx) => {
            const isTop = idx === topIndex;
            const y = height - 20 - ((idx + 1) * (cellHeight + 2));
            const fill = isTop ? '#FCD34D' : '#E2E8F0';
            const stroke = isTop ? '#1E293B' : '#94A3B8';
            const strokeWidth = isTop ? '2.4' : '1.4';
            return `
                <g>
                    <rect x="40" y="${y}" width="120" height="${cellHeight}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" rx="3"></rect>
                    <text x="100" y="${y + cellHeight / 2 + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#0F172A">${escapeHtml(formatNumber(item))}</text>
                </g>
            `;
        }).join('');

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Stack visualization">
                    <line x1="40" y1="${height - 20}" x2="160" y2="${height - 20}" stroke="#1E293B" stroke-width="2"></line>
                    <text x="10" y="${height - 10}" font-size="11" fill="#64748B">base</text>
                    <text x="135" y="15" font-size="11" fill="#64748B">top</text>
                    ${svg}
                </svg>
            </div>
        `;
    }

    // Queue visualization (FIFO - First In First Out)
    function renderQueueVisualization(items, frontIndex = 0) {
        if (!items.length) {
            return '<p class="concept-muted mb-0">Queue unavailable.</p>';
        }
        const cellWidth = 50;
        const height = 100;
        const width = Math.max(300, items.length * (cellWidth + 4) + 40);

        const svg = items.map((item, idx) => {
            const isFront = idx === frontIndex;
            const x = 20 + (idx * (cellWidth + 4));
            const fill = isFront ? '#FCD34D' : '#E2E8F0';
            const strokeWidth = isFront ? '2.4' : '1.6';
            return `
                <g>
                    <rect x="${x}" y="30" width="${cellWidth}" height="40" fill="${fill}" stroke="#1E293B" stroke-width="${strokeWidth}" rx="3"></rect>
                    <text x="${x + cellWidth / 2}" y="55" text-anchor="middle" font-size="12" font-weight="700" fill="#0F172A">${escapeHtml(formatNumber(item))}</text>
                    <text x="${x + cellWidth / 2}" y="72" text-anchor="middle" font-size="9" fill="#64748B">${idx}</text>
                </g>
            `;
        }).join('');

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Queue visualization">
                    <text x="0" y="20" font-size="11" fill="#64748B">front</text>
                    <text x="${width - 42}" y="20" font-size="11" fill="#64748B">rear</text>
                    ${svg}
                </svg>
            </div>
        `;
    }

    // Binary heap visualization
    function renderHeapVisualization(heapArray, highlightIndex = -1) {
        if (!heapArray.length) {
            return '<p class="concept-muted mb-0">Heap unavailable.</p>';
        }

        // Calculate positions for binary tree
        const nodeRadius = 24;
        const levelHeight = 80;
        const width = 500;
        const height = Math.max(250, (Math.ceil(Math.log2(heapArray.length + 1)) + 1) * levelHeight);

        function getNodePosition(index) {
            const level = Math.floor(Math.log2(index + 1));
            const positionInLevel = index - (Math.pow(2, level) - 1);
            const levelWidth = Math.pow(2, level) * 60;
            const y = 30 + level * levelHeight;
            const x = (width - levelWidth) / 2 + positionInLevel * 60 + 30;
            return { x, y };
        }

        function getParentIndex(index) {
            return Math.floor((index - 1) / 2);
        }

        // Draw edges first
        const edges = [];
        for (let i = 1; i < heapArray.length; i++) {
            const parentIdx = getParentIndex(i);
            const parentPos = getNodePosition(parentIdx);
            const childPos = getNodePosition(i);
            edges.push(
                `<line x1="${parentPos.x}" y1="${parentPos.y + nodeRadius}" x2="${childPos.x}" y2="${childPos.y - nodeRadius}" stroke="#94A3B8" stroke-width="1.6"></line>`
            );
        }

        // Draw nodes
        const nodes = heapArray.map((value, idx) => {
            const pos = getNodePosition(idx);
            const isHighlighted = idx === highlightIndex;
            const fill = isHighlighted ? '#86EFAC' : '#E2E8F0';
            const strokeWidth = isHighlighted ? '2.4' : '1.6';
            return `
                <g>
                    <circle cx="${pos.x}" cy="${pos.y}" r="${nodeRadius}" fill="${fill}" stroke="#1E293B" stroke-width="${strokeWidth}"></circle>
                    <text x="${pos.x}" y="${pos.y + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#0F172A">${escapeHtml(formatNumber(value))}</text>
                </g>
            `;
        }).join('');

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Heap visualization">
                    ${edges.join('')}
                    ${nodes}
                </svg>
            </div>
        `;
    }

    // Hash table visualization with buckets
    function renderHashTableVisualization(keys, buckets, highlightKey = null) {
        if (!buckets || !buckets.length) {
            return '<p class="concept-muted mb-0">Hash table unavailable.</p>';
        }
        const bucketHeight = 30;
        const bucketWidth = 120;
        const height = buckets.length * (bucketHeight + 8) + 40;
        const width = 300;

        const bucketSVG = buckets.map((bucket, idx) => {
            const y = 20 + idx * (bucketHeight + 8);
            const items = (bucket || []).join(', ');
            const isHighlighted = highlightKey !== null && bucket && bucket.includes(highlightKey);
            const fill = isHighlighted ? '#FCD34D' : '#E2E8F0';
            const strokeWidth = isHighlighted ? '2.2' : '1.4';

            return `
                <g>
                    <rect x="30" y="${y}" width="${bucketWidth}" height="${bucketHeight}" fill="${fill}" stroke="#1E293B" stroke-width="${strokeWidth}" rx="3"></rect>
                    <text x="40" y="${y + bucketHeight / 2 + 4}" font-size="11" font-weight="600" fill="#0F172A">[${idx}]: ${items || '-'}</text>
                </g>
            `;
        }).join('');

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Hash table visualization">
                    <text x="18" y="18" font-size="10" font-weight="700" fill="#64748B">Bucket</text>
                    ${bucketSVG}
                </svg>
            </div>
        `;
    }

    function renderLinkedListDiagram(values, options = {}) {
        if (!values.length) {
            return '<p class="concept-muted mb-0">Linked list unavailable.</p>';
        }
        const mode = String(options.mode || 'singly');
        const currentIndex = Number.isInteger(options.currentIndex) ? options.currentIndex : null;
        const matchedIndex = Number.isInteger(options.matchedIndex) ? options.matchedIndex : null;
        const startIndex = Number.isInteger(options.startIndex) ? options.startIndex : null;
        const visitedSet = options.visitedSet instanceof Set ? options.visitedSet : new Set();
        const spacing = 94;
        const radius = 20;
        const pad = 32;
        const width = Math.max(360, (values.length - 1) * spacing + (pad * 2));
        const height = mode === 'circular' ? 190 : 142;
        const baselineY = mode === 'circular' ? 98 : 72;

        function nodeFill(idx) {
            if (idx === matchedIndex) return '#86EFAC';
            if (idx === currentIndex) return '#FCD34D';
            if (visitedSet.has(idx)) return '#BFDBFE';
            return '#E2E8F0';
        }

        function markerDefs(prefix) {
            return `
                <defs>
                    <marker id="${prefix}-forward" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                        <path d="M0,0 L10,5 L0,10 z" fill="#2563EB"></path>
                    </marker>
                    <marker id="${prefix}-back" markerWidth="10" markerHeight="10" refX="1" refY="5" orient="auto">
                        <path d="M10,0 L0,5 L10,10 z" fill="#10B981"></path>
                    </marker>
                </defs>
            `;
        }

        const prefix = `exec-${mode}-${values.length}`;
        const edges = [];
        for (let idx = 0; idx < values.length - 1; idx += 1) {
            const x1 = pad + (idx * spacing) + radius;
            const x2 = pad + ((idx + 1) * spacing) - radius;
            if (mode === 'doubly') {
                edges.push(`<line x1="${x1}" y1="${baselineY - 8}" x2="${x2}" y2="${baselineY - 8}" stroke="#2563EB" stroke-width="2.2" marker-end="url(#${prefix}-forward)"></line>`);
                edges.push(`<line x1="${x2}" y1="${baselineY + 8}" x2="${x1}" y2="${baselineY + 8}" stroke="#10B981" stroke-width="2.2" marker-end="url(#${prefix}-back)"></line>`);
            } else {
                edges.push(`<line x1="${x1}" y1="${baselineY}" x2="${x2}" y2="${baselineY}" stroke="#2563EB" stroke-width="2.6" marker-end="url(#${prefix}-forward)"></line>`);
            }
        }

        if (mode === 'circular' && values.length > 1) {
            const firstX = pad;
            const lastX = pad + ((values.length - 1) * spacing);
            edges.push(`
                <path
                    d="M ${lastX} ${baselineY + radius} C ${lastX + 42} ${baselineY + 62}, ${firstX - 42} ${baselineY + 62}, ${firstX} ${baselineY + radius}"
                    fill="none"
                    stroke="#9333EA"
                    stroke-width="2.4"
                    marker-end="url(#${prefix}-forward)"
                ></path>
            `);
        }

        const nodes = values.map((value, idx) => {
            const cx = pad + (idx * spacing);
            const cy = baselineY;
            return `
                <g>
                    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${nodeFill(idx)}" stroke="#1E293B" stroke-width="${idx === currentIndex ? '2.8' : '1.6'}"></circle>
                    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="#0F172A">${escapeHtml(formatNumber(value))}</text>
                    <text x="${cx}" y="${cy + 32}" text-anchor="middle" font-size="11" fill="#64748B">idx ${idx}</text>
                    ${startIndex === idx ? `<text x="${cx}" y="${cy - 34}" text-anchor="middle" font-size="11" fill="#7C3AED">start</text>` : ''}
                </g>
            `;
        }).join('');

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Linked list diagram">
                    ${markerDefs(prefix)}
                    ${edges.join('')}
                    ${nodes}
                </svg>
            </div>
            <div class="exec-legend">
                <span class="exec-legend-chip"><span class="exec-dot exec-dot-current"></span>Current</span>
                <span class="exec-legend-chip"><span class="exec-dot exec-dot-visited"></span>Visited</span>
                <span class="exec-legend-chip"><span class="exec-dot exec-dot-match"></span>Matched</span>
            </div>
        `;
    }

    function renderRecursionCallGraph(sequence, activeIndex = null) {
        if (!Array.isArray(sequence) || !sequence.length) {
            return '<p class="concept-muted mb-0">Recursion graph unavailable.</p>';
        }
        const width = Math.max(420, (sequence.length * 96) + 50);
        const height = 208;
        const stepX = 88;
        const startX = 34;
        const topY = 66;
        const lowY = 132;
        const nodeWidth = 72;
        const nodeHeight = 34;
        const nodes = [];
        const edges = [];

        for (let idx = 0; idx < sequence.length; idx += 1) {
            const x = startX + (idx * stepX);
            const y = idx % 2 === 0 ? topY : lowY;
            const isActive = idx === activeIndex;
            nodes.push(`
                <g>
                    <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="${isActive ? '#FCD34D' : '#DBEAFE'}" stroke="${isActive ? '#92400E' : '#1E3A8A'}" stroke-width="${isActive ? '2.4' : '1.4'}"></rect>
                    <text x="${x + (nodeWidth / 2)}" y="${y + 13}" text-anchor="middle" font-size="10" fill="#334155">F${idx}</text>
                    <text x="${x + (nodeWidth / 2)}" y="${y + 25}" text-anchor="middle" font-size="11" font-weight="700" fill="#0F172A">${escapeHtml(formatNumber(sequence[idx]))}</text>
                </g>
            `);
            if (idx > 0) {
                const prevX = startX + ((idx - 1) * stepX) + nodeWidth;
                const prevY = (idx - 1) % 2 === 0 ? topY + (nodeHeight / 2) : lowY + (nodeHeight / 2);
                const currentY = y + (nodeHeight / 2);
                edges.push(`
                    <path d="M ${prevX} ${prevY} C ${prevX + 22} ${prevY}, ${x - 22} ${currentY}, ${x} ${currentY}" fill="none" stroke="#2563EB" stroke-width="1.8"></path>
                `);
            }
        }

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recursion progression graph">
                    <text x="${startX}" y="24" font-size="11" font-weight="700" fill="#475569">Recursion resolve order (Fibonacci)</text>
                    ${edges.join('')}
                    ${nodes.join('')}
                </svg>
            </div>
        `;
    }

    function renderBacktrackingPathDiagram(values, decisions, currentIndex, sum, target) {
        const normalizedDecisions = Array.isArray(decisions) ? decisions : [];
        const chosenSet = new Set(
            normalizedDecisions
                .filter((entry) => entry && entry.take === true)
                .map((entry) => entry.idx)
        );
        const compareSet = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < values.length
            ? new Set([currentIndex])
            : new Set();

        let x = 36;
        let y = 95;
        const xStep = 92;
        const yStep = 24;
        const minY = 42;
        const maxY = 170;
        const points = [{ x, y, label: 'Start', edgeLabel: '' }];

        normalizedDecisions.forEach((entry) => {
            x += xStep;
            y += entry.take ? -yStep : yStep;
            y = Math.max(minY, Math.min(maxY, y));
            points.push({
                x,
                y,
                label: entry.take ? `+a[${entry.idx}]` : `skip a[${entry.idx}]`,
                edgeLabel: entry.take ? `+${formatNumber(values[entry.idx])}` : 'skip',
            });
        });

        const width = Math.max(460, x + 88);
        const pathEdges = [];
        const pathNodes = [];
        for (let idx = 0; idx < points.length; idx += 1) {
            const point = points[idx];
            if (idx > 0) {
                const prev = points[idx - 1];
                const taking = normalizedDecisions[idx - 1] && normalizedDecisions[idx - 1].take;
                pathEdges.push(`
                    <g>
                        <line x1="${prev.x + 15}" y1="${prev.y}" x2="${point.x - 15}" y2="${point.y}" stroke="${taking ? '#16A34A' : '#64748B'}" stroke-width="2"></line>
                        <text x="${(prev.x + point.x) / 2}" y="${Math.min(prev.y, point.y) - 8}" text-anchor="middle" font-size="10" fill="#475569">${escapeHtml(point.edgeLabel)}</text>
                    </g>
                `);
            }
            const isCurrent = idx === points.length - 1;
            pathNodes.push(`
                <g>
                    <circle cx="${point.x}" cy="${point.y}" r="${isCurrent ? '14' : '11'}" fill="${isCurrent ? '#FCD34D' : '#DBEAFE'}" stroke="${isCurrent ? '#92400E' : '#1E3A8A'}" stroke-width="${isCurrent ? '2.4' : '1.5'}"></circle>
                    <text x="${point.x}" y="${point.y + 4}" text-anchor="middle" font-size="9.5" fill="#0F172A">${idx}</text>
                    <text x="${point.x}" y="${point.y + 25}" text-anchor="middle" font-size="9.5" fill="#334155">${escapeHtml(point.label)}</text>
                </g>
            `);
        }

        return `
            ${renderArrayVisualization(values, chosenSet, compareSet)}
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} 215" role="img" aria-label="Backtracking branch path">
                    <text x="18" y="22" font-size="11" font-weight="700" fill="#475569">Current branch decisions</text>
                    ${pathEdges.join('')}
                    ${pathNodes.join('')}
                </svg>
            </div>
            <div class="exec-summary">Current sum: ${formatNumber(sum)} / target: ${formatNumber(target)}</div>
        `;
    }

    function renderRegressionPlot(points, slope, intercept, queryX, options = {}) {
        const highlightSet = options.highlightSet instanceof Set ? options.highlightSet : new Set();
        const showLine = options.showLine !== false;
        const showQuery = options.showQuery === true;
        const queryY = (slope * queryX) + intercept;
        const xValues = points.map((point) => point.x).concat([queryX]);
        const yValues = points.map((point) => point.y).concat([queryY]);
        let minX = Math.min(...xValues);
        let maxX = Math.max(...xValues);
        let minY = Math.min(...yValues);
        let maxY = Math.max(...yValues);
        if (minX === maxX) {
            minX -= 1;
            maxX += 1;
        }
        if (minY === maxY) {
            minY -= 1;
            maxY += 1;
        }
        const width = 470;
        const height = 250;
        const leftPad = 46;
        const rightPad = 22;
        const topPad = 18;
        const bottomPad = 34;

        const scaleX = (x) => {
            const ratio = (x - minX) / (maxX - minX);
            return leftPad + (ratio * (width - leftPad - rightPad));
        };
        const scaleY = (y) => {
            const ratio = (y - minY) / (maxY - minY);
            return height - bottomPad - (ratio * (height - topPad - bottomPad));
        };

        const lineStart = { x: minX, y: (slope * minX) + intercept };
        const lineEnd = { x: maxX, y: (slope * maxX) + intercept };

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Linear regression chart">
                    <line x1="${leftPad}" y1="${height - bottomPad}" x2="${width - rightPad}" y2="${height - bottomPad}" stroke="#94A3B8" stroke-width="1.4"></line>
                    <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${height - bottomPad}" stroke="#94A3B8" stroke-width="1.4"></line>
                    ${showLine ? `<line x1="${scaleX(lineStart.x)}" y1="${scaleY(lineStart.y)}" x2="${scaleX(lineEnd.x)}" y2="${scaleY(lineEnd.y)}" stroke="#2563EB" stroke-width="2.4"></line>` : ''}
                    ${points.map((point) => `
                        <g>
                            <circle cx="${scaleX(point.x)}" cy="${scaleY(point.y)}" r="${highlightSet.has(point.index) ? '6.4' : '4.8'}" fill="${highlightSet.has(point.index) ? '#10B981' : '#0EA5E9'}"></circle>
                            <text x="${scaleX(point.x) + 8}" y="${scaleY(point.y) - 8}" font-size="11" fill="#334155">P${point.index + 1}</text>
                        </g>
                    `).join('')}
                    ${showQuery ? `
                        <line x1="${scaleX(queryX)}" y1="${height - bottomPad}" x2="${scaleX(queryX)}" y2="${scaleY(queryY)}" stroke="#9333EA" stroke-width="1.8" stroke-dasharray="5 4"></line>
                        <circle cx="${scaleX(queryX)}" cy="${scaleY(queryY)}" r="6.2" fill="#9333EA"></circle>
                        <text x="${scaleX(queryX) + 8}" y="${scaleY(queryY) - 9}" font-size="11" fill="#6D28D9">Query</text>
                    ` : ''}
                    <text x="${leftPad}" y="${height - 9}" font-size="11" fill="#64748B">x</text>
                    <text x="${12}" y="${topPad + 2}" font-size="11" fill="#64748B">y</text>
                </svg>
            </div>
        `;
    }

    function renderLogisticCurve(z, options = {}) {
        const showPoint = options.showPoint === true;
        const probability = 1 / (1 + Math.exp(-z));
        const width = 470;
        const height = 240;
        const leftPad = 40;
        const rightPad = 20;
        const topPad = 20;
        const bottomPad = 28;
        const minX = -6;
        const maxX = 6;
        const minY = 0;
        const maxY = 1;

        const scaleX = (x) => leftPad + (((x - minX) / (maxX - minX)) * (width - leftPad - rightPad));
        const scaleY = (y) => height - bottomPad - (((y - minY) / (maxY - minY)) * (height - topPad - bottomPad));

        const curvePath = [];
        for (let x = minX; x <= maxX; x += 0.2) {
            const y = 1 / (1 + Math.exp(-x));
            curvePath.push(`${scaleX(x)} ${scaleY(y)}`);
        }

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sigmoid curve">
                    <line x1="${leftPad}" y1="${height - bottomPad}" x2="${width - rightPad}" y2="${height - bottomPad}" stroke="#94A3B8" stroke-width="1.3"></line>
                    <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${height - bottomPad}" stroke="#94A3B8" stroke-width="1.3"></line>
                    <polyline points="${curvePath.join(' ')}" fill="none" stroke="#2563EB" stroke-width="2.4"></polyline>
                    <line x1="${scaleX(0)}" y1="${topPad}" x2="${scaleX(0)}" y2="${height - bottomPad}" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="4 4"></line>
                    <line x1="${leftPad}" y1="${scaleY(0.5)}" x2="${width - rightPad}" y2="${scaleY(0.5)}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4"></line>
                    ${showPoint ? `
                        <line x1="${scaleX(z)}" y1="${height - bottomPad}" x2="${scaleX(z)}" y2="${scaleY(probability)}" stroke="#9333EA" stroke-width="1.8" stroke-dasharray="5 4"></line>
                        <circle cx="${scaleX(z)}" cy="${scaleY(probability)}" r="6.2" fill="#9333EA"></circle>
                        <text x="${scaleX(z) + 8}" y="${scaleY(probability) - 8}" font-size="11" fill="#6D28D9">sigma(z)</text>
                    ` : ''}
                    <text x="${leftPad}" y="${height - 8}" font-size="11" fill="#64748B">z</text>
                    <text x="${10}" y="${topPad + 2}" font-size="11" fill="#64748B">p</text>
                </svg>
            </div>
        `;
    }

    function renderOneDimClusterPlot(points, centroids, assignments = [], options = {}) {
        const currentIndex = Number.isInteger(options.currentIndex) ? options.currentIndex : null;
        const width = 520;
        const height = 168;
        const leftPad = 30;
        const rightPad = 24;
        const axisY = 108;
        const allValues = points.concat(centroids).filter((value) => Number.isFinite(value));
        let minValue = Math.min(...allValues);
        let maxValue = Math.max(...allValues);
        if (minValue === maxValue) {
            minValue -= 1;
            maxValue += 1;
        }
        const scaleX = (value) => leftPad + (((value - minValue) / (maxValue - minValue)) * (width - leftPad - rightPad));

        function clusterColor(clusterIndex) {
            if (clusterIndex === 0) return '#2563EB';
            if (clusterIndex === 1) return '#F97316';
            return '#94A3B8';
        }

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="K-means 1D plot">
                    <line x1="${leftPad}" y1="${axisY}" x2="${width - rightPad}" y2="${axisY}" stroke="#64748B" stroke-width="1.8"></line>
                    ${points.map((value, idx) => `
                        <g>
                            <circle cx="${scaleX(value)}" cy="${axisY}" r="${idx === currentIndex ? '7.2' : '5.1'}" fill="${clusterColor(assignments[idx])}" stroke="#0F172A" stroke-width="${idx === currentIndex ? '1.8' : '1.1'}"></circle>
                            <text x="${scaleX(value)}" y="${axisY + 20}" text-anchor="middle" font-size="10.5" fill="#334155">${formatNumber(value)}</text>
                        </g>
                    `).join('')}
                    ${centroids.map((value, idx) => `
                        <g>
                            <path d="M ${scaleX(value)} ${axisY - 26} l -8 12 h 16 z" fill="${idx === 0 ? '#1D4ED8' : '#EA580C'}"></path>
                            <text x="${scaleX(value)}" y="${axisY - 32}" text-anchor="middle" font-size="11" fill="#1E293B">C${idx + 1}</text>
                        </g>
                    `).join('')}
                </svg>
            </div>
        `;
    }

    function renderKnnPlot(train, queryX, consideredSet = new Set(), topSet = new Set()) {
        const width = 520;
        const height = 190;
        const leftPad = 30;
        const rightPad = 24;
        const axisY = 116;
        const values = train.map((row) => row.x).concat([queryX]);
        let minValue = Math.min(...values);
        let maxValue = Math.max(...values);
        if (minValue === maxValue) {
            minValue -= 1;
            maxValue += 1;
        }
        const scaleX = (value) => leftPad + (((value - minValue) / (maxValue - minValue)) * (width - leftPad - rightPad));

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="KNN neighbor plot">
                    <line x1="${leftPad}" y1="${axisY}" x2="${width - rightPad}" y2="${axisY}" stroke="#64748B" stroke-width="1.8"></line>
                    ${train.map((row) => `
                        <g>
                            <circle cx="${scaleX(row.x)}" cy="${axisY}" r="${topSet.has(row.index) ? '7.4' : '5.2'}" fill="${row.label === 'A' ? '#2563EB' : '#F97316'}" stroke="${consideredSet.has(row.index) ? '#0F172A' : 'transparent'}" stroke-width="1.8"></circle>
                            <text x="${scaleX(row.x)}" y="${axisY + 20}" text-anchor="middle" font-size="10.5" fill="#334155">${formatNumber(row.x)}</text>
                            <text x="${scaleX(row.x)}" y="${axisY - 13}" text-anchor="middle" font-size="10.5" fill="#334155">${row.label}</text>
                        </g>
                    `).join('')}
                    <g>
                        <path d="M ${scaleX(queryX)} ${axisY - 20} l 8 8 l -8 8 l -8 -8 z" fill="#9333EA"></path>
                        <text x="${scaleX(queryX)}" y="${axisY - 29}" text-anchor="middle" font-size="11" fill="#6D28D9">Query</text>
                    </g>
                </svg>
            </div>
        `;
    }

    function renderEntropyBars(positive, negative, pPos, pNeg) {
        const width = 430;
        const height = 220;
        const chartBaseY = 182;
        const barWidth = 64;
        const gap = 88;
        const firstX = 118;
        const secondX = firstX + barWidth + gap;
        const maxBarHeight = 130;
        const posH = Math.max(2, pPos * maxBarHeight);
        const negH = Math.max(2, pNeg * maxBarHeight);

        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Class distribution">
                    <line x1="62" y1="${chartBaseY}" x2="362" y2="${chartBaseY}" stroke="#64748B" stroke-width="1.6"></line>
                    <rect x="${firstX}" y="${chartBaseY - posH}" width="${barWidth}" height="${posH}" rx="8" fill="#22C55E"></rect>
                    <rect x="${secondX}" y="${chartBaseY - negH}" width="${barWidth}" height="${negH}" rx="8" fill="#F97316"></rect>
                    <text x="${firstX + (barWidth / 2)}" y="${chartBaseY + 18}" text-anchor="middle" font-size="12" fill="#334155">Positive</text>
                    <text x="${secondX + (barWidth / 2)}" y="${chartBaseY + 18}" text-anchor="middle" font-size="12" fill="#334155">Negative</text>
                    <text x="${firstX + (barWidth / 2)}" y="${chartBaseY - posH - 8}" text-anchor="middle" font-size="12" fill="#166534">${formatNumber(pPos, 3, true)}</text>
                    <text x="${secondX + (barWidth / 2)}" y="${chartBaseY - negH - 8}" text-anchor="middle" font-size="12" fill="#9A3412">${formatNumber(pNeg, 3, true)}</text>
                    <text x="12" y="24" font-size="11" fill="#64748B">counts: +${formatNumber(positive)}, -${formatNumber(negative)}</text>
                </svg>
            </div>
        `;
    }

    function renderScoreBars(spamScore, hamScore) {
        const maxScore = Math.max(spamScore, hamScore, 1e-9);
        const spamWidth = (spamScore / maxScore) * 100;
        const hamWidth = (hamScore / maxScore) * 100;
        return `
            <div class="exec-score-bars">
                <div class="exec-score-row">
                    <span class="exec-score-label">Spam</span>
                    <span class="exec-score-track">
                        <span class="exec-score-fill spam" style="width:${spamWidth}%;"></span>
                    </span>
                    <span class="exec-score-value">${formatNumber(spamScore, 6, true)}</span>
                </div>
                <div class="exec-score-row">
                    <span class="exec-score-label">Ham</span>
                    <span class="exec-score-track">
                        <span class="exec-score-fill ham" style="width:${hamWidth}%;"></span>
                    </span>
                    <span class="exec-score-value">${formatNumber(hamScore, 6, true)}</span>
                </div>
            </div>
        `;
    }

    function renderNeuronDiagram(x1, x2, w1, w2, b, z, output, stage = 'input') {
        const w1Stroke = stage === 'term1' || stage === 'linear' || stage === 'output' ? '#2563EB' : '#94A3B8';
        const w2Stroke = stage === 'term2' || stage === 'linear' || stage === 'output' ? '#10B981' : '#94A3B8';
        const zStroke = stage === 'linear' || stage === 'output' ? '#F97316' : '#94A3B8';
        const outStroke = stage === 'output' ? '#9333EA' : '#94A3B8';
        return `
            <div class="exec-diagram-wrap">
                <svg class="exec-svg" viewBox="0 0 500 210" role="img" aria-label="Single neuron network">
                    <line x1="122" y1="64" x2="250" y2="102" stroke="${w1Stroke}" stroke-width="2.4"></line>
                    <line x1="122" y1="146" x2="250" y2="102" stroke="${w2Stroke}" stroke-width="2.4"></line>
                    <line x1="286" y1="102" x2="390" y2="102" stroke="${outStroke}" stroke-width="2.4"></line>

                    <circle cx="92" cy="64" r="24" fill="#DBEAFE" stroke="#1E3A8A" stroke-width="1.8"></circle>
                    <circle cx="92" cy="146" r="24" fill="#DCFCE7" stroke="#166534" stroke-width="1.8"></circle>
                    <circle cx="268" cy="102" r="30" fill="#FFEDD5" stroke="${zStroke}" stroke-width="2.1"></circle>
                    <circle cx="414" cy="102" r="28" fill="#F3E8FF" stroke="${outStroke}" stroke-width="2.1"></circle>

                    <text x="92" y="64" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#0F172A">x1=${formatNumber(x1)}</text>
                    <text x="92" y="146" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#0F172A">x2=${formatNumber(x2)}</text>
                    <text x="268" y="102" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#0F172A">z=${formatNumber(z, 3, true)}</text>
                    <text x="414" y="102" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#0F172A">${formatNumber(output, 3, true)}</text>

                    <text x="168" y="74" font-size="11" fill="#1D4ED8">w1=${formatNumber(w1, 3, true)}</text>
                    <text x="168" y="144" font-size="11" fill="#047857">w2=${formatNumber(w2, 3, true)}</text>
                    <text x="236" y="52" font-size="11" fill="#9A3412">b=${formatNumber(b, 3, true)}</text>
                    <text x="396" y="64" font-size="11" fill="#6D28D9">sigma(z)</text>
                </svg>
            </div>
        `;
    }

    function buildVisualizationPrompt(algorithmType, payload) {
        const prompts = {
            // Dynamic Programming
            knapsack: 'Watch the DP table evolve as each item is evaluated. See how capacity constraints limit value gains at each fill level.',
            lcs: 'Track the matrix as we fill diagonals for matching characters. Diagonal moves show LCS growth; horizontal/vertical show mismatches.',
            activity_selection: 'View activities sorted by finish time, then watch the greedy selector pick compatible intervals without overlaps.',
            // Backtracking & Recursion
            backtracking: 'Explore the decision tree as we include/exclude elements. Watch the tree prune branches that exceed target.',
            recursion: 'Build the sequence step-by-step as recursive calls resolve. See Fibonacci numbers emerge from base cases upward.',
            // Bit & Math
            bit_conversion: 'Perform repeated division by 2 and collect remainders. Read them in reverse to get the binary representation.',
            math_algorithm: 'Apply Euclidean GCD: repeatedly replace (a,b) with (b, a mod b) until b becomes zero.',
            // Linked List Variants
            linked_list: 'Visualize each node connected by forward pointers. Animate traversal from head until the target node is found.',
            doubly_linked_list: 'Show bidirectional links (forward and backward arrows). Traverse from chosen direction to find target.',
            circular_linked_list: 'Display the circular connection: last node wraps back to first. Traverse one full cycle to find target.',
            // Linear Data Structures
            stack: 'Watch elements push onto the stack and pop in LIFO order. See the top pointer move as operations proceed.',
            queue: 'Track elements enqueued at the tail and dequeued at the head. Observe FIFO behavior throughout.',
            array_algorithm: 'See the array transform through each operation: shifts, rotations, or insertions at specific indices.',
            // Searching & Sorting
            linear_search: 'Scan the array left-to-right. Watch the pointer advance and stop at the first match.',
            binary_search: 'Halve the search space at each step. See midpoint comparisons narrow the window until target is found.',
            bubble_sort: 'Watch adjacent pairs bubble larger values rightward. Each pass moves the next-largest element into position.',
            selection_sort: 'Find the minimum in the unsorted region each round. Swap it into place at the boundary.',
            insertion_sort: 'Build the sorted portion left-to-right. Insert each new element into its correct position via shifts.',
            merge_sort: 'Divide array in half recursively, then merge sorted subarrays. Observe the merging process combine smaller arrays.',
            quick_sort: 'Pick a pivot and partition: smaller left, larger right. Recursively sort partitions around pivot.',
            heap_sort: 'Build a max-heap, then repeatedly extract the root. Watch elements sink after each extraction.',
            // Trees & Graphs
            bst: 'Insert values and maintain binary search property. Show left subtree < root < right subtree.',
            bfs: 'Traverse neighbors level-by-level using a queue. Watch the frontier expand uniformly outward.',
            dfs: 'Traverse depth-first using a stack. Push unvisited neighbors and backtrack when blocked.',
            dijkstra: 'Relax edges from the smallest distance node. Update tentative distances and build shortest paths.',
            astar: 'Use heuristic + actual distance to guide pathfinding on a grid. Expand nodes with lowest f-cost.',
            minimax: 'Evaluate the game tree recursively: maximize at AI nodes, minimize at opponent nodes.',
            // Hashing
            hashing_algorithm: 'Distribute keys into hash table buckets. Show collisions and how chaining or probing resolves them.',
            // Searching (string)
            string_algorithm: 'Find pattern occurrences in text. Use sliding window or pattern-shift to scan efficiently.',
            // Machine Learning
            linear_regression: 'Plot training points. Compute slope and intercept, then project the query x onto the fitted line.',
            logistic_regression: 'Evaluate the sigmoid curve: as z increases, probability approaches 1. Read probability at query z.',
            kmeans: 'Assign points to nearest centroid. Update centroids as cluster means. Repeat until convergence.',
            knn: 'Rank all training samples by distance. Select the k nearest neighbors and vote by their class.',
            decision_tree: 'Compute information gain (entropy change) for each split. Build the tree by choosing the best split.',
            naive_bayes: 'Compare posterior scores for each class given features. Predict the class with higher score.',
            neural_network: 'Forward pass through neuron: multiply inputs by weights, add bias, apply sigmoid to get output.',
        };
        const key = String(algorithmType || '').trim().toLowerCase();
        if (prompts[key]) {
            return prompts[key];
        }
        const payloadKeys = Object.keys(payload || {}).filter((field) => field !== 'mode' && field !== 'algorithm');
        return payloadKeys.length
            ? `Observe how state evolves using payload fields: ${payloadKeys.join(', ')}.`
            : 'Watch the algorithm state transform step by step with explicit structure and rule updates.';
    }

    function makeStep(step, details, stateHtml, formulaHtml) {
        return { step, details, stateHtml, formulaHtml };
    }

    function buildKnapsackModel(payload) {
        const weights = normalizeNumberArray(payload.weights);
        const values = normalizeNumberArray(payload.values);
        const capacity = asFiniteNumber(payload.capacity, 0);
        if (!weights.length || !values.length || weights.length !== values.length || capacity <= 0) {
            return null;
        }

        const cap = Math.floor(capacity);
        const dp = new Array(cap + 1).fill(0);
        const steps = [
            makeStep(
                'Initialize DP',
                `Capacity ${cap}, ${weights.length} items. Start with zero value at all capacities.`,
                renderIndexedStrip(dp),
                '<code>dp[c] = 0</code> for all <code>c in [0..capacity]</code>'
            ),
        ];

        for (let i = 0; i < weights.length; i += 1) {
            const w = Math.floor(weights[i]);
            const v = Math.floor(values[i]);
            for (let c = cap; c >= w; c -= 1) {
                const keep = dp[c];
                const take = dp[c - w] + v;
                const best = Math.max(keep, take);
                dp[c] = best;
                const changed = best !== keep;
                if (changed || i < 2) {
                    steps.push(
                        makeStep(
                            `Item ${i + 1}, capacity ${c}`,
                            changed
                                ? `Taking item improves value: ${keep} -> ${best}.`
                                : `Skipping item keeps best value at ${keep}.`,
                            renderIndexedStrip(dp, new Set([c])),
                            `
                                <code>dp[${c}] = max(dp[${c}], dp[${c - w}] + ${v})</code><br>
                                <code>max(${keep}, ${take}) = ${best}</code>
                            `
                        )
                    );
                }
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                `Maximum value at capacity ${cap} is ${dp[cap]}.`,
                renderIndexedStrip(dp, new Set([cap])),
                '<code>Answer = dp[capacity]</code>'
            )
        );

        return {
            title: 'Execution Visualization - Knapsack',
            subtitle: 'Replay how DP states evolve under 0/1 transition rules.',
            steps,
        };
    }

    function buildLcsModel(payload) {
        const s1 = String(payload.s1 || '');
        const s2 = String(payload.s2 || '');
        if (!s1 || !s2) {
            return null;
        }

        const m = s1.length;
        const n = s2.length;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        const steps = [
            makeStep(
                'Initialize Matrix',
                `Build (${m + 1} x ${n + 1}) matrix with zeros.`,
                renderMatrix(dp, s1, s2, 0, 0),
                '<code>dp[0][*] = dp[*][0] = 0</code>'
            ),
        ];

        for (let i = 1; i <= m; i += 1) {
            for (let j = 1; j <= n; j += 1) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                    steps.push(
                        makeStep(
                            `Match at (${i}, ${j})`,
                            `'${s1[i - 1]}' matches '${s2[j - 1]}', take diagonal + 1.`,
                            renderMatrix(dp, s1, s2, i, j),
                            `<code>dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1 = ${dp[i][j]}</code>`
                        )
                    );
                } else {
                    const up = dp[i - 1][j];
                    const left = dp[i][j - 1];
                    dp[i][j] = Math.max(up, left);
                    steps.push(
                        makeStep(
                            `Mismatch at (${i}, ${j})`,
                            `'${s1[i - 1]}' != '${s2[j - 1]}', take max(up, left).`,
                            renderMatrix(dp, s1, s2, i, j),
                            `<code>dp[${i}][${j}] = max(dp[${i - 1}][${j}], dp[${i}][${j - 1}]) = max(${up}, ${left}) = ${dp[i][j]}</code>`
                        )
                    );
                }
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                `LCS length is ${dp[m][n]}.`,
                renderMatrix(dp, s1, s2, m, n),
                `<code>Answer = dp[${m}][${n}]</code>`
            )
        );

        return {
            title: 'Execution Visualization - LCS',
            subtitle: 'Cell-by-cell DP fill using match/mismatch recurrence.',
            steps,
        };
    }

    function buildActivitySelectionModel(payload) {
        const starts = normalizeNumberArray(payload.starts);
        const ends = normalizeNumberArray(payload.ends);
        if (!starts.length || starts.length !== ends.length) {
            return null;
        }

        const intervals = starts.map((start, idx) => ({
            index: idx,
            start,
            end: ends[idx],
        }));
        const sorted = intervals.slice().sort((a, b) => (a.end - b.end) || (a.start - b.start));
        const steps = [
            makeStep(
                'Sort by Finish Time',
                'Greedy starts by earliest finishing activity.',
                `
                    <div class="exec-list">
                        ${sorted.map((item) => `<div class="exec-list-row">A${item.index + 1}: [${item.start}, ${item.end})</div>`).join('')}
                    </div>
                `,
                '<code>Sort activities by end ascending</code>'
            ),
        ];

        const selected = [];
        let lastEnd = -Infinity;
        sorted.forEach((item) => {
            const compatible = item.start >= lastEnd;
            if (compatible) {
                selected.push(item);
                lastEnd = item.end;
            }
            steps.push(
                makeStep(
                    `Check A${item.index + 1}`,
                    compatible
                        ? `Compatible (${item.start} >= ${selected.length > 1 ? selected[selected.length - 2].end : '-inf'}), select it.`
                        : `Overlaps with last selected finish (${lastEnd}), skip.`,
                    `
                        <div class="exec-list">
                            ${selected.length
                                ? selected.map((it) => `<div class="exec-list-row active">A${it.index + 1}: [${it.start}, ${it.end})</div>`).join('')
                                : '<div class="concept-muted">No selected activity yet.</div>'}
                        </div>
                    `,
                    `<code>Select if start >= last_end</code>`
                )
            );
        });

        steps.push(
            makeStep(
                'Final Answer',
                `Maximum non-overlapping activities selected: ${selected.length}.`,
                `
                    <div class="exec-list">
                        ${selected.map((it) => `<div class="exec-list-row active">A${it.index + 1}: [${it.start}, ${it.end})</div>`).join('')}
                    </div>
                `,
                '<code>Greedy by earliest finish gives optimal count</code>'
            )
        );

        return {
            title: 'Execution Visualization - Activity Selection',
            subtitle: 'Greedy decisions based on finish-time ordering.',
            steps,
        };
    }

    function buildBacktrackingModel(payload) {
        const values = normalizeNumberArray(payload.values);
        const target = asFiniteNumber(payload.target, Number.NaN);
        if (!values.length || !Number.isFinite(target)) {
            return null;
        }

        const steps = [];
        const validKeys = new Set();
        const stepLimit = 140;

        function pushStep(step) {
            if (steps.length < stepLimit) {
                steps.push(step);
            }
        }

        function dfs(index, sum, chosen) {
            if (steps.length >= stepLimit) {
                return;
            }

            pushStep(
                makeStep(
                    `Explore index ${index}`,
                    `Current subset [${chosen.join(', ')}], sum=${sum}.`,
                    `
                        ${renderIndexedStrip(values, new Set(chosen.map((v) => values.indexOf(v))))}
                        <div class="exec-summary">Chosen: [${chosen.join(', ')}] | Sum: ${sum} | Target: ${target}</div>
                    `,
                    '<code>branch(i, sum) => include(values[i]) or exclude(values[i])</code>'
                )
            );

            if (sum === target) {
                validKeys.add(chosen.slice().sort((a, b) => a - b).join(','));
                pushStep(
                    makeStep(
                        'Valid subset found',
                        `[${chosen.join(', ')}] hits target ${target}.`,
                        `<div class="exec-summary success">Valid subsets found: ${validKeys.size}</div>`,
                        '<code>if sum == target: count += 1</code>'
                    )
                );
                return;
            }
            if (index >= values.length || sum > target) {
                return;
            }

            dfs(index + 1, sum + values[index], chosen.concat(values[index]));
            dfs(index + 1, sum, chosen);
        }

        dfs(0, 0, []);
        pushStep(
            makeStep(
                'Final Answer',
                `Unique valid subsets counted: ${validKeys.size}.`,
                `<div class="exec-summary">Total valid subsets: ${validKeys.size}</div>`,
                '<code>Count all unique subsets with sum == target</code>'
            )
        );

        return {
            title: 'Execution Visualization - Backtracking',
            subtitle: 'Search tree exploration with include/exclude branching.',
            steps,
        };
    }

    function buildRecursionModel(payload) {
        const n = Math.floor(asFiniteNumber(payload.n, 0));
        if (!Number.isInteger(n) || n < 1) {
            return null;
        }

        const steps = [
            makeStep(
                'Base Cases',
                'Start with F0=0 and F1=1.',
                `<div class="exec-summary">Sequence: [0, 1]</div>`,
                '<code>F(0)=0, F(1)=1</code>'
            ),
        ];
        const seq = [0, 1];
        for (let i = 2; i <= n; i += 1) {
            const next = seq[i - 1] + seq[i - 2];
            seq.push(next);
            steps.push(
                makeStep(
                    `Compute F${i}`,
                    `F${i} = F${i - 1} + F${i - 2} = ${seq[i - 1]} + ${seq[i - 2]} = ${next}`,
                    renderIndexedStrip(seq, new Set([i])),
                    `<code>F(${i}) = F(${i - 1}) + F(${i - 2})</code>`
                )
            );
        }
        steps.push(
            makeStep(
                'Final Answer',
                `F${n} = ${seq[n]}`,
                renderIndexedStrip(seq, new Set([n])),
                '<code>Answer is final sequence element</code>'
            )
        );

        return {
            title: 'Execution Visualization - Recursion (Fibonacci)',
            subtitle: 'Build the recurrence result step by step.',
            steps,
        };
    }

    function buildBitConversionModel(payload) {
        const decimal = Math.floor(asFiniteNumber(payload.decimal, Number.NaN));
        if (!Number.isInteger(decimal) || decimal < 0) {
            return null;
        }

        if (decimal === 0) {
            return {
                title: 'Execution Visualization - Bit Conversion',
                subtitle: 'Repeated division by 2 to construct binary digits.',
                steps: [
                    makeStep(
                        'Special Case',
                        'Decimal 0 directly maps to binary 0.',
                        '<div class="exec-summary">Binary: 0</div>',
                        '<code>0 -> 0</code>'
                    ),
                ],
            };
        }

        const remainders = [];
        const steps = [];
        let current = decimal;
        while (current > 0) {
            const quotient = Math.floor(current / 2);
            const remainder = current % 2;
            remainders.push(remainder);
            steps.push(
                makeStep(
                    `Divide ${current} by 2`,
                    `Quotient=${quotient}, remainder=${remainder}.`,
                    `<div class="exec-summary">Remainders so far (LSB->MSB): [${remainders.join(', ')}]</div>`,
                    `<code>${current} = 2 * ${quotient} + ${remainder}</code>`
                )
            );
            current = quotient;
        }
        const binary = remainders.slice().reverse().join('');
        steps.push(
            makeStep(
                'Reverse remainders',
                `Binary result is ${binary}.`,
                `<div class="exec-summary success">Binary: ${binary}</div>`,
                '<code>Read remainders in reverse order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Bit Conversion',
            subtitle: 'Repeated division by 2 to construct binary digits.',
            steps,
        };
    }

    function buildMathModel(payload) {
        let a = Math.abs(Math.floor(asFiniteNumber(payload.a, Number.NaN)));
        let b = Math.abs(Math.floor(asFiniteNumber(payload.b, Number.NaN)));
        if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) {
            return null;
        }

        const steps = [
            makeStep(
                'Initialize',
                `Find gcd(${a}, ${b}) using Euclid algorithm.`,
                `<div class="exec-summary">Start: a=${a}, b=${b}</div>`,
                '<code>while b != 0: (a, b) = (b, a % b)</code>'
            ),
        ];

        while (b !== 0) {
            const r = a % b;
            steps.push(
                makeStep(
                    `Euclid Step`,
                    `a=${a}, b=${b}, remainder=${r}`,
                    `<div class="exec-summary">Next pair: (${b}, ${r})</div>`,
                    `<code>${a} = ${b} * floor(${a}/${b}) + ${r}</code>`
                )
            );
            a = b;
            b = r;
        }

        steps.push(
            makeStep(
                'Final Answer',
                `gcd is ${a}.`,
                `<div class="exec-summary success">GCD: ${a}</div>`,
                '<code>When b=0, gcd=a</code>'
            )
        );

        return {
            title: 'Execution Visualization - Euclidean GCD',
            subtitle: 'Modulo reduction until remainder becomes zero.',
            steps,
        };
    }

    function buildLinkedListModel(payload) {
        const values = normalizeNumberArray(payload.values);
        const target = asFiniteNumber(payload.target, Number.NaN);
        if (!values.length || !Number.isFinite(target)) {
            return null;
        }

        const visited = new Set();
        const steps = [
            makeStep(
                'Start at Head',
                `Traverse nodes left-to-right to find target ${formatNumber(target)}.`,
                renderLinkedListDiagram(values, { mode: 'singly', currentIndex: 0, visitedSet: visited }),
                '<code>idx = 0; while idx &lt; n: check node[idx], idx += 1</code>'
            ),
        ];

        let answerIndex = -1;
        for (let idx = 0; idx < values.length; idx += 1) {
            visited.add(idx);
            const matched = values[idx] === target;
            steps.push(
                makeStep(
                    `Visit Node ${idx}`,
                    matched
                        ? `Node value ${formatNumber(values[idx])} matches target.`
                        : `Node value ${formatNumber(values[idx])} does not match target.`,
                    `
                        ${renderLinkedListDiagram(values, {
                            mode: 'singly',
                            currentIndex: idx,
                            matchedIndex: matched ? idx : null,
                            visitedSet: visited,
                        })}
                        <div class="exec-summary">Visited: [${Array.from(visited).join(', ')}]</div>
                    `,
                    `<code>compare node[${idx}] (${formatNumber(values[idx])}) with target (${formatNumber(target)})</code>`
                )
            );
            if (matched) {
                answerIndex = idx;
                break;
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                answerIndex >= 0
                    ? `First matching index is ${answerIndex}.`
                    : 'Target not found in list, answer is -1.',
                answerIndex >= 0
                    ? renderLinkedListDiagram(values, {
                        mode: 'singly',
                        currentIndex: answerIndex,
                        matchedIndex: answerIndex,
                        visitedSet: visited,
                    })
                    : renderLinkedListDiagram(values, { mode: 'singly', visitedSet: visited }),
                `<code>answer = ${answerIndex}</code>`
            )
        );

        return {
            title: 'Execution Visualization - Linked List Lookup',
            subtitle: 'Head-to-tail traversal until first match.',
            steps,
        };
    }

    function buildDoublyLinkedListModel(payload) {
        const values = normalizeNumberArray(payload.values);
        const target = asFiniteNumber(payload.target, Number.NaN);
        if (!values.length || !Number.isFinite(target)) {
            return null;
        }

        const traverseFromTail = payload.from_end === true;
        const order = [];
        if (traverseFromTail) {
            for (let idx = values.length - 1; idx >= 0; idx -= 1) {
                order.push(idx);
            }
        } else {
            for (let idx = 0; idx < values.length; idx += 1) {
                order.push(idx);
            }
        }

        const visited = new Set();
        const steps = [
            makeStep(
                traverseFromTail ? 'Start at Tail' : 'Start at Head',
                traverseFromTail
                    ? `Use prev pointers from tail to find target ${formatNumber(target)}.`
                    : `Use next pointers from head to find target ${formatNumber(target)}.`,
                renderLinkedListDiagram(values, {
                    mode: 'doubly',
                    currentIndex: order[0],
                    visitedSet: visited,
                }),
                traverseFromTail
                    ? '<code>idx = n-1; while idx &gt;= 0: check node[idx], idx -= 1</code>'
                    : '<code>idx = 0; while idx &lt; n: check node[idx], idx += 1</code>'
            ),
        ];

        let answerIndex = -1;
        for (let position = 0; position < order.length; position += 1) {
            const idx = order[position];
            visited.add(idx);
            const matched = values[idx] === target;
            steps.push(
                makeStep(
                    `Visit Node ${idx}`,
                    matched
                        ? `Node value ${formatNumber(values[idx])} matches target.`
                        : `Node value ${formatNumber(values[idx])} does not match target.`,
                    `
                        ${renderLinkedListDiagram(values, {
                            mode: 'doubly',
                            currentIndex: idx,
                            matchedIndex: matched ? idx : null,
                            visitedSet: visited,
                        })}
                        <div class="exec-summary">Visited in order: [${Array.from(visited).join(', ')}]</div>
                    `,
                    `<code>compare node[${idx}] (${formatNumber(values[idx])}) with target (${formatNumber(target)})</code>`
                )
            );
            if (matched) {
                answerIndex = idx;
                break;
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                answerIndex >= 0
                    ? `Traversal result index is ${answerIndex}.`
                    : 'Target not found, answer is -1.',
                answerIndex >= 0
                    ? renderLinkedListDiagram(values, {
                        mode: 'doubly',
                        currentIndex: answerIndex,
                        matchedIndex: answerIndex,
                        visitedSet: visited,
                    })
                    : renderLinkedListDiagram(values, { mode: 'doubly', visitedSet: visited }),
                `<code>answer = ${answerIndex}</code>`
            )
        );

        return {
            title: 'Execution Visualization - Doubly Linked List Lookup',
            subtitle: traverseFromTail
                ? 'Tail-to-head traversal using prev links.'
                : 'Bidirectional list traversed from head.',
            steps,
        };
    }

    function buildCircularLinkedListModel(payload) {
        const values = normalizeNumberArray(payload.values);
        const target = asFiniteNumber(payload.target, Number.NaN);
        if (!values.length || !Number.isFinite(target)) {
            return null;
        }

        let startIndex = Math.floor(asFiniteNumber(payload.start_index, 0));
        if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= values.length) {
            startIndex = 0;
        }

        const order = [];
        for (let step = 0; step < values.length; step += 1) {
            order.push((startIndex + step) % values.length);
        }

        const visited = new Set();
        const steps = [
            makeStep(
                'Start Circular Walk',
                `Begin at index ${startIndex}, stop after one full cycle, target ${formatNumber(target)}.`,
                renderLinkedListDiagram(values, {
                    mode: 'circular',
                    currentIndex: startIndex,
                    visitedSet: visited,
                    startIndex,
                }),
                '<code>idx = (start + step) % n, for step in [0..n-1]</code>'
            ),
        ];

        let answerIndex = -1;
        for (let step = 0; step < order.length; step += 1) {
            const idx = order[step];
            visited.add(idx);
            const matched = values[idx] === target;
            steps.push(
                makeStep(
                    `Step ${step + 1}: Node ${idx}`,
                    matched
                        ? `Node value ${formatNumber(values[idx])} matches target.`
                        : `Node value ${formatNumber(values[idx])} does not match target.`,
                    `
                        ${renderLinkedListDiagram(values, {
                            mode: 'circular',
                            currentIndex: idx,
                            matchedIndex: matched ? idx : null,
                            visitedSet: visited,
                            startIndex,
                        })}
                        <div class="exec-summary">Visited this cycle: [${Array.from(visited).join(', ')}]</div>
                    `,
                    `<code>idx = (${startIndex} + ${step}) mod ${values.length} = ${idx}</code>`
                )
            );
            if (matched) {
                answerIndex = idx;
                break;
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                answerIndex >= 0
                    ? `First match in circular traversal is index ${answerIndex}.`
                    : 'Completed one cycle with no match, answer is -1.',
                answerIndex >= 0
                    ? renderLinkedListDiagram(values, {
                        mode: 'circular',
                        currentIndex: answerIndex,
                        matchedIndex: answerIndex,
                        visitedSet: visited,
                        startIndex,
                    })
                    : renderLinkedListDiagram(values, { mode: 'circular', visitedSet: visited, startIndex }),
                `<code>answer = ${answerIndex}</code>`
            )
        );

        return {
            title: 'Execution Visualization - Circular Linked List Lookup',
            subtitle: 'Wrap-around traversal with one-cycle stop rule.',
            steps,
        };
    }

    function buildStackModel(payload) {
        const initial = normalizeNumberArray(payload.initial);
        const rawOps = Array.isArray(payload.operations) ? payload.operations : [];
        const operations = rawOps.map((entry) => {
            if (typeof entry === 'string') {
                const op = entry.trim().toLowerCase();
                return { op, value: null };
            }
            if (entry && typeof entry === 'object') {
                const op = String(entry.op || '').trim().toLowerCase();
                const value = Number(entry.value);
                return { op, value: Number.isFinite(value) ? value : null };
            }
            return { op: '', value: null };
        }).filter((entry) => ['push', 'pop'].includes(entry.op));

        if (!operations.length) {
            return null;
        }

        function renderStackState(state, activeIndex = null) {
            if (!state.length) {
                return '<div class="exec-summary">Stack: [empty]</div>';
            }
            const rows = state
                .map((value, idx) => ({ value, idx }))
                .reverse()
                .map((entry) => {
                    const isActive = activeIndex !== null && activeIndex === entry.idx;
                    return `<div class="exec-list-row${isActive ? ' active' : ''}">${entry.idx === state.length - 1 ? 'TOP -> ' : ''}${formatNumber(entry.value)}</div>`;
                })
                .join('');
            return `<div class="exec-list">${rows}</div>`;
        }

        const state = initial.slice();
        const steps = [
            makeStep(
                'Initialize Stack',
                'Load initial stack state before applying operations.',
                `
                    ${renderStackState(state, state.length ? state.length - 1 : null)}
                    <div class="exec-summary">Bottom -> Top order in memory.</div>
                `,
                '<code>stack = initial</code>'
            ),
        ];

        operations.forEach((entry, opIdx) => {
            if (entry.op === 'push' && entry.value !== null) {
                state.push(entry.value);
                steps.push(
                    makeStep(
                        `Operation ${opIdx + 1}: push(${formatNumber(entry.value)})`,
                        `Push places ${formatNumber(entry.value)} at the top.`,
                        `
                            ${renderStackState(state, state.length - 1)}
                            <div class="exec-summary">Size: ${state.length}</div>
                        `,
                        `<code>stack.append(${formatNumber(entry.value)})</code>`
                    )
                );
                return;
            }

            if (entry.op === 'pop') {
                if (state.length) {
                    const removed = state.pop();
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: pop()`,
                            `Remove top value ${formatNumber(removed)}.`,
                            `
                                ${renderStackState(state, state.length ? state.length - 1 : null)}
                                <div class="exec-summary">Size: ${state.length}</div>
                            `,
                            '<code>if stack: stack.pop()</code>'
                        )
                    );
                } else {
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: pop()`,
                            'Pop on empty stack is ignored.',
                            `${renderStackState(state)}`,
                            '<code>if stack empty: ignore pop</code>'
                        )
                    );
                }
            }
        });

        const top = state.length ? formatNumber(state[state.length - 1]) : 'empty';
        steps.push(
            makeStep(
                'Final Answer',
                state.length
                    ? `Final top is ${top}.`
                    : 'Stack is empty after all operations.',
                `
                    ${renderStackState(state, state.length ? state.length - 1 : null)}
                    <div class="exec-summary success">Answer: ${top}</div>
                `,
                '<code>answer = stack[-1] if stack else "empty"</code>'
            )
        );

        return {
            title: 'Execution Visualization - Stack Simulator',
            subtitle: 'Replay LIFO push/pop transitions to final top.',
            steps,
        };
    }

    function buildQueueModel(payload) {
        const initial = normalizeNumberArray(payload.initial);
        const rawOps = Array.isArray(payload.operations) ? payload.operations : [];
        const operations = rawOps.map((entry) => {
            if (typeof entry === 'string') {
                const op = entry.trim().toLowerCase();
                return { op, value: null };
            }
            if (entry && typeof entry === 'object') {
                const op = String(entry.op || '').trim().toLowerCase();
                const value = Number(entry.value);
                return { op, value: Number.isFinite(value) ? value : null };
            }
            return { op: '', value: null };
        }).filter((entry) => ['enqueue', 'dequeue'].includes(entry.op));

        if (!operations.length) {
            return null;
        }

        function renderQueueState(state, activeIndex = null) {
            if (!state.length) {
                return '<div class="exec-summary">Queue: [empty]</div>';
            }
            const rows = state
                .map((value, idx) => {
                    const isActive = activeIndex !== null && activeIndex === idx;
                    const front = idx === 0 ? 'FRONT -> ' : '';
                    const rear = idx === state.length - 1 ? ' <- REAR' : '';
                    return `<div class="exec-list-row${isActive ? ' active' : ''}">${front}${formatNumber(value)}${rear}</div>`;
                })
                .join('');
            return `<div class="exec-list">${rows}</div>`;
        }

        const state = initial.slice();
        const steps = [
            makeStep(
                'Initialize Queue',
                'Load initial queue state before applying operations.',
                `
                    ${renderQueueState(state, state.length ? 0 : null)}
                    <div class="exec-summary">Front at index 0, rear at last index.</div>
                `,
                '<code>queue = initial</code>'
            ),
        ];

        operations.forEach((entry, opIdx) => {
            if (entry.op === 'enqueue' && entry.value !== null) {
                state.push(entry.value);
                steps.push(
                    makeStep(
                        `Operation ${opIdx + 1}: enqueue(${formatNumber(entry.value)})`,
                        `Enqueue adds ${formatNumber(entry.value)} to the rear.`,
                        `
                            ${renderQueueState(state, state.length - 1)}
                            <div class="exec-summary">Size: ${state.length}</div>
                        `,
                        `<code>queue.append(${formatNumber(entry.value)})</code>`
                    )
                );
                return;
            }

            if (entry.op === 'dequeue') {
                if (state.length) {
                    const removed = state.shift();
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: dequeue()`,
                            `Remove front value ${formatNumber(removed)}.`,
                            `
                                ${renderQueueState(state, state.length ? 0 : null)}
                                <div class="exec-summary">Size: ${state.length}</div>
                            `,
                            '<code>if queue: queue.pop(0)</code>'
                        )
                    );
                } else {
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: dequeue()`,
                            'Dequeue on empty queue is ignored.',
                            `${renderQueueState(state)}`,
                            '<code>if queue empty: ignore dequeue</code>'
                        )
                    );
                }
            }
        });

        const front = state.length ? formatNumber(state[0]) : 'empty';
        steps.push(
            makeStep(
                'Final Answer',
                state.length
                    ? `Final front is ${front}.`
                    : 'Queue is empty after all operations.',
                `
                    ${renderQueueState(state, state.length ? 0 : null)}
                    <div class="exec-summary success">Answer: ${front}</div>
                `,
                '<code>answer = queue[0] if queue else "empty"</code>'
            )
        );

        return {
            title: 'Execution Visualization - Queue Simulator',
            subtitle: 'Replay FIFO enqueue/dequeue transitions to final front.',
            steps,
        };
    }

    function buildArrayAlgorithmModel(payload) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        let currentSum = values[0];
        let bestSum = values[0];
        let currentStart = 0;
        let bestStart = 0;
        let bestEnd = 0;

        const steps = [
            makeStep(
                'Initialize Kadane State',
                `Start with first value ${formatNumber(values[0])}.`,
                `
                    ${renderIndexedStrip(values, new Set([0]))}
                    <div class="exec-summary">current=${formatNumber(currentSum)}, best=${formatNumber(bestSum)}</div>
                `,
                '<code>current = best = arr[0]</code>'
            ),
        ];

        for (let idx = 1; idx < values.length; idx += 1) {
            const value = values[idx];
            const extend = currentSum + value;
            const restart = value;
            const shouldRestart = restart > extend;

            if (shouldRestart) {
                currentSum = restart;
                currentStart = idx;
            } else {
                currentSum = extend;
            }

            if (currentSum > bestSum) {
                bestSum = currentSum;
                bestStart = currentStart;
                bestEnd = idx;
            }

            const currentIndices = new Set();
            for (let i = currentStart; i <= idx; i += 1) {
                currentIndices.add(i);
            }
            const bestIndices = [];
            for (let i = bestStart; i <= bestEnd; i += 1) {
                bestIndices.push(i);
            }

            steps.push(
                makeStep(
                    `Process index ${idx}`,
                    shouldRestart
                        ? `Restart at arr[${idx}] = ${formatNumber(value)}.`
                        : `Extend previous segment with arr[${idx}] = ${formatNumber(value)}.`,
                    `
                        ${renderIndexedStrip(values, currentIndices)}
                        <div class="exec-summary">current range: [${currentStart}..${idx}] sum=${formatNumber(currentSum)}</div>
                        <div class="exec-summary">best range: [${bestStart}..${bestEnd}] sum=${formatNumber(bestSum)} (idx: ${bestIndices.join(', ')})</div>
                    `,
                    `<code>current = max(arr[i], current + arr[i]) = max(${formatNumber(restart)}, ${formatNumber(extend)}) = ${formatNumber(currentSum)}</code><br><code>best = max(best, current) = ${formatNumber(bestSum)}</code>`
                )
            );
        }

        steps.push(
            makeStep(
                'Final Answer',
                `Maximum contiguous subarray sum is ${formatNumber(bestSum)}.`,
                `
                    ${renderIndexedStrip(values, new Set(Array.from({ length: bestEnd - bestStart + 1 }, (_, offset) => bestStart + offset)))}
                    <div class="exec-summary success">Best range: [${bestStart}..${bestEnd}], sum=${formatNumber(bestSum)}</div>
                `,
                '<code>answer = best</code>'
            )
        );

        return {
            title: 'Execution Visualization - Array Max Subarray',
            subtitle: 'Kadane transitions: restart or extend at each index.',
            steps,
        };
    }

    function buildHashingAlgorithmModel(payload) {
        const values = normalizeNumberArray(payload.arr);
        const target = asFiniteNumber(payload.target, Number.NaN);
        if (!values.length || !Number.isFinite(target)) {
            return null;
        }

        const seenIndexByValue = new Map();
        let discoveredPair = null;
        const steps = [
            makeStep(
                'Initialize Hash Set',
                `Scan values once and check if complement (target - value) was seen before. Target=${formatNumber(target)}.`,
                `${renderIndexedStrip(values)}<div class="exec-summary">Seen set: []</div>`,
                '<code>for x in arr: if (target-x) in seen -> pair exists; else add x to seen</code>'
            ),
        ];

        for (let idx = 0; idx < values.length; idx += 1) {
            const value = values[idx];
            const complement = target - value;
            const complementSeen = seenIndexByValue.has(complement);
            const complementIndex = complementSeen ? seenIndexByValue.get(complement) : null;

            if (complementSeen && discoveredPair === null) {
                discoveredPair = [complementIndex, idx];
            }

            const seenValues = Array.from(seenIndexByValue.keys());
            const seenTokens = seenValues.length ? seenValues.map((entry) => formatNumber(entry)).join(', ') : '';
            const statusText = complementSeen
                ? `Found complement ${formatNumber(complement)} at idx ${complementIndex}.`
                : `Complement ${formatNumber(complement)} not seen yet.`;

            steps.push(
                makeStep(
                    `Process index ${idx}`,
                    `x=${formatNumber(value)}. ${statusText}`,
                    `
                        ${renderIndexedStrip(values, new Set([idx]))}
                        <div class="exec-summary">Need: ${formatNumber(complement)} | Seen before step: [${seenTokens}]</div>
                        ${complementSeen ? `<div class="exec-summary success">Pair candidate: (${complementIndex}, ${idx}) -> ${formatNumber(values[complementIndex])} + ${formatNumber(value)} = ${formatNumber(target)}</div>` : ''}
                    `,
                    `<code>complement = ${formatNumber(target)} - ${formatNumber(value)} = ${formatNumber(complement)}</code>`
                )
            );

            if (!seenIndexByValue.has(value)) {
                seenIndexByValue.set(value, idx);
            }

            if (discoveredPair !== null) {
                break;
            }
        }

        const hasPair = discoveredPair !== null;
        const finalSeenValues = Array.from(seenIndexByValue.keys()).map((entry) => formatNumber(entry)).join(', ');
        steps.push(
            makeStep(
                'Final Answer',
                hasPair
                    ? `Pair exists. Answer is true.`
                    : 'No valid pair found. Answer is false.',
                `
                    ${renderIndexedStrip(values, hasPair ? new Set(discoveredPair) : new Set())}
                    <div class="exec-summary">Seen set: [${finalSeenValues}]</div>
                    <div class="exec-summary success">Answer: ${hasPair ? 'true' : 'false'}</div>
                `,
                hasPair
                    ? `<code>arr[${discoveredPair[0]}] + arr[${discoveredPair[1]}] = ${formatNumber(target)} -> true</code>`
                    : '<code>No complement hit during scan -> false</code>'
            )
        );

        return {
            title: 'Execution Visualization - Hashing Pair Sum',
            subtitle: 'One-pass complement lookup with hash set.',
            steps,
        };
    }

    function buildBstModel(payload) {
        const insertSequence = normalizeNumberArray(payload.insert_sequence);
        if (!insertSequence.length) {
            return null;
        }

        function createNode(value) {
            return { value, left: null, right: null };
        }

        function inorderTraversal(root, result) {
            if (!root) return;
            inorderTraversal(root.left, result);
            result.push(root.value);
            inorderTraversal(root.right, result);
        }

        function describeTree(root) {
            if (!root) {
                return '<div class="exec-summary">Tree: [empty]</div>';
            }
            const queue = [root];
            const rows = [];
            while (queue.length) {
                const node = queue.shift();
                const left = node.left ? formatNumber(node.left.value) : 'null';
                const right = node.right ? formatNumber(node.right.value) : 'null';
                rows.push(`<div class="exec-list-row">Node ${formatNumber(node.value)} -> L:${left}, R:${right}</div>`);
                if (node.left) queue.push(node.left);
                if (node.right) queue.push(node.right);
            }
            return `<div class="exec-list">${rows.join('')}</div>`;
        }

        function insertWithTrace(root, value) {
            const trace = [];
            if (!root) {
                trace.push(`Tree is empty. ${formatNumber(value)} becomes root.`);
                return { root: createNode(value), trace };
            }

            let current = root;
            while (current) {
                if (value < current.value) {
                    trace.push(`${formatNumber(value)} < ${formatNumber(current.value)} -> go left`);
                    if (!current.left) {
                        current.left = createNode(value);
                        trace.push(`Insert ${formatNumber(value)} as left child of ${formatNumber(current.value)}.`);
                        break;
                    }
                    current = current.left;
                } else if (value > current.value) {
                    trace.push(`${formatNumber(value)} > ${formatNumber(current.value)} -> go right`);
                    if (!current.right) {
                        current.right = createNode(value);
                        trace.push(`Insert ${formatNumber(value)} as right child of ${formatNumber(current.value)}.`);
                        break;
                    }
                    current = current.right;
                } else {
                    trace.push(`${formatNumber(value)} equals existing node ${formatNumber(current.value)} -> ignore duplicate.`);
                    break;
                }
            }
            return { root, trace };
        }

        let root = null;
        const steps = [
            makeStep(
                'Initialize BST',
                'Start with an empty BST and insert values one by one.',
                `
                    ${renderIndexedStrip(insertSequence)}
                    <div class="exec-summary">BST is empty.</div>
                `,
                '<code>For each value: if value &lt; node go left, else go right</code>'
            ),
        ];

        insertSequence.forEach((value, idx) => {
            const result = insertWithTrace(root, value);
            root = result.root;
            const inorder = [];
            inorderTraversal(root, inorder);
            steps.push(
                makeStep(
                    `Insert ${formatNumber(value)}`,
                    result.trace.join(' '),
                    `
                        ${renderIndexedStrip(insertSequence, new Set([idx]))}
                        ${describeTree(root)}
                        <div class="exec-summary">Inorder so far: ${inorder.map((entry) => formatNumber(entry)).join(' ')}</div>
                    `,
                    `<code>Insertion rule applied at each comparison for ${formatNumber(value)}</code>`
                )
            );
        });

        const finalInorder = [];
        inorderTraversal(root, finalInorder);
        const answer = finalInorder.map((value) => formatNumber(value)).join(' ');
        steps.push(
            makeStep(
                'Final Answer',
                `Inorder traversal yields sorted order: ${answer}.`,
                `
                    ${describeTree(root)}
                    <div class="exec-summary success">Answer: ${answer}</div>
                `,
                '<code>inorder(node) = inorder(left), node, inorder(right)</code>'
            )
        );

        return {
            title: 'Execution Visualization - BST Inorder',
            subtitle: 'Insert sequence replay with final inorder traversal.',
            steps,
        };
    }

    function buildSortingModel(payload, algorithmType) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        const labels = {
            bubble_sort: 'Bubble Sort',
            selection_sort: 'Selection Sort',
            insertion_sort: 'Insertion Sort',
            merge_sort: 'Merge Sort',
            quick_sort: 'Quick Sort',
            heap_sort: 'Heap Sort',
        };

        const arr = values.slice();
        const steps = [
            makeStep(
                'Load Array',
                `Run ${labels[algorithmType] || 'Sorting'} in non-decreasing order.`,
                renderIndexedStrip(arr),
                '<code>Goal: arr[i] <= arr[i+1] for all i</code>'
            ),
        ];

        function pushStep(title, details, highlights, formula) {
            steps.push(
                makeStep(
                    title,
                    details,
                    renderIndexedStrip(arr, highlights || new Set()),
                    formula
                )
            );
        }

        function swap(i, j) {
            const temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }

        function runBubbleSort() {
            const n = arr.length;
            for (let i = 0; i < n - 1; i += 1) {
                let swapped = false;
                for (let j = 0; j < n - i - 1; j += 1) {
                    const shouldSwap = arr[j] > arr[j + 1];
                    pushStep(
                        `Pass ${i + 1}, compare (${j}, ${j + 1})`,
                        shouldSwap
                            ? `${formatNumber(arr[j])} > ${formatNumber(arr[j + 1])}, swap.`
                            : `${formatNumber(arr[j])} <= ${formatNumber(arr[j + 1])}, keep order.`,
                        new Set([j, j + 1]),
                        '<code>if arr[j] > arr[j+1]: swap</code>'
                    );
                    if (shouldSwap) {
                        swap(j, j + 1);
                        swapped = true;
                        pushStep(
                            `Swap ${j} <-> ${j + 1}`,
                            'Larger value bubbles right.',
                            new Set([j, j + 1]),
                            '<code>adjacent swap</code>'
                        );
                    }
                }
                if (!swapped) {
                    pushStep(
                        `Pass ${i + 1} done`,
                        'No swaps this pass, array is already sorted.',
                        new Set(),
                        '<code>early stop when pass has 0 swaps</code>'
                    );
                    break;
                }
            }
        }

        function runSelectionSort() {
            const n = arr.length;
            for (let i = 0; i < n - 1; i += 1) {
                let minIndex = i;
                for (let j = i + 1; j < n; j += 1) {
                    if (arr[j] < arr[minIndex]) {
                        minIndex = j;
                    }
                    pushStep(
                        `Select min for position ${i}`,
                        `Current min index: ${minIndex} (value ${formatNumber(arr[minIndex])}).`,
                        new Set([i, j, minIndex]),
                        '<code>scan suffix and track min index</code>'
                    );
                }
                if (minIndex !== i) {
                    swap(i, minIndex);
                    pushStep(
                        `Place minimum at ${i}`,
                        `Swap index ${i} with min index ${minIndex}.`,
                        new Set([i, minIndex]),
                        '<code>swap(arr[i], arr[minIndex])</code>'
                    );
                }
            }
        }

        function runInsertionSort() {
            for (let i = 1; i < arr.length; i += 1) {
                const key = arr[i];
                let j = i - 1;
                pushStep(
                    `Insert index ${i}`,
                    `Key = ${formatNumber(key)}.`,
                    new Set([i]),
                    '<code>shift larger elements right, insert key</code>'
                );
                while (j >= 0 && arr[j] > key) {
                    arr[j + 1] = arr[j];
                    pushStep(
                        `Shift index ${j}`,
                        `${formatNumber(arr[j + 1])} moved to index ${j + 1}.`,
                        new Set([j, j + 1]),
                        '<code>while arr[j] > key: arr[j+1] = arr[j]</code>'
                    );
                    j -= 1;
                }
                arr[j + 1] = key;
                pushStep(
                    `Insert key at ${j + 1}`,
                    `Placed ${formatNumber(key)} at correct position.`,
                    new Set([j + 1]),
                    '<code>arr[j+1] = key</code>'
                );
            }
        }

        function runMergeSort() {
            const n = arr.length;
            for (let width = 1; width < n; width *= 2) {
                for (let left = 0; left < n; left += 2 * width) {
                    const mid = Math.min(left + width, n);
                    const right = Math.min(left + 2 * width, n);
                    if (mid >= right) {
                        continue;
                    }
                    const leftPart = arr.slice(left, mid);
                    const rightPart = arr.slice(mid, right);
                    const merged = [];
                    let i = 0;
                    let j = 0;
                    while (i < leftPart.length && j < rightPart.length) {
                        if (leftPart[i] <= rightPart[j]) {
                            merged.push(leftPart[i]);
                            i += 1;
                        } else {
                            merged.push(rightPart[j]);
                            j += 1;
                        }
                    }
                    while (i < leftPart.length) {
                        merged.push(leftPart[i]);
                        i += 1;
                    }
                    while (j < rightPart.length) {
                        merged.push(rightPart[j]);
                        j += 1;
                    }
                    for (let k = 0; k < merged.length; k += 1) {
                        arr[left + k] = merged[k];
                    }
                    const highlight = new Set();
                    for (let idx = left; idx < right; idx += 1) {
                        highlight.add(idx);
                    }
                    pushStep(
                        `Merge [${left}..${mid - 1}] & [${mid}..${right - 1}]`,
                        `Merged block: ${merged.map((v) => formatNumber(v)).join(' ')}.`,
                        highlight,
                        '<code>merge two sorted halves into one sorted block</code>'
                    );
                }
            }
        }

        function runQuickSort() {
            const stack = [[0, arr.length - 1]];

            while (stack.length) {
                const segment = stack.pop();
                if (!segment) {
                    continue;
                }
                const [low, high] = segment;
                if (low >= high) {
                    continue;
                }

                const pivot = arr[high];
                let i = low - 1;
                pushStep(
                    `Partition [${low}..${high}]`,
                    `Pivot = arr[${high}] = ${formatNumber(pivot)}.`,
                    new Set([high]),
                    '<code>Lomuto partition around pivot</code>'
                );

                for (let j = low; j < high; j += 1) {
                    const moveLeft = arr[j] <= pivot;
                    pushStep(
                        `Compare arr[${j}] with pivot`,
                        moveLeft
                            ? `${formatNumber(arr[j])} <= ${formatNumber(pivot)}; move to left partition.`
                            : `${formatNumber(arr[j])} > ${formatNumber(pivot)}; keep on right side.`,
                        new Set([j, high]),
                        '<code>if arr[j] <= pivot: i++, swap(arr[i], arr[j])</code>'
                    );
                    if (moveLeft) {
                        i += 1;
                        if (i !== j) {
                            swap(i, j);
                            pushStep(
                                `Swap ${i} <-> ${j}`,
                                'Keep smaller/equal values before pivot boundary.',
                                new Set([i, j]),
                                '<code>partition swap</code>'
                            );
                        }
                    }
                }

                const pivotIndex = i + 1;
                swap(pivotIndex, high);
                pushStep(
                    `Place pivot at ${pivotIndex}`,
                    `Pivot fixed at final position ${pivotIndex}.`,
                    new Set([pivotIndex]),
                    '<code>swap(arr[i+1], arr[high])</code>'
                );

                stack.push([low, pivotIndex - 1]);
                stack.push([pivotIndex + 1, high]);
            }
        }

        function runHeapSort() {
            function siftDown(start, endExclusive) {
                let root = start;
                while (true) {
                    const left = (2 * root) + 1;
                    const right = left + 1;
                    let largest = root;

                    if (left < endExclusive && arr[left] > arr[largest]) {
                        largest = left;
                    }
                    if (right < endExclusive && arr[right] > arr[largest]) {
                        largest = right;
                    }
                    if (largest === root) {
                        return;
                    }
                    swap(root, largest);
                    pushStep(
                        `Heapify swap ${root} <-> ${largest}`,
                        'Restore max-heap property.',
                        new Set([root, largest]),
                        '<code>if child > parent: swap and continue</code>'
                    );
                    root = largest;
                }
            }

            for (let i = Math.floor(arr.length / 2) - 1; i >= 0; i -= 1) {
                siftDown(i, arr.length);
            }
            pushStep(
                'Max heap built',
                'Array represents a valid max heap.',
                new Set([0]),
                '<code>build-heap in O(n)</code>'
            );

            for (let end = arr.length - 1; end > 0; end -= 1) {
                swap(0, end);
                pushStep(
                    `Extract max to index ${end}`,
                    `Move current max ${formatNumber(arr[end])} to final position.`,
                    new Set([0, end]),
                    '<code>swap root with last element of heap</code>'
                );
                siftDown(0, end);
            }
        }

        const runners = {
            bubble_sort: runBubbleSort,
            selection_sort: runSelectionSort,
            insertion_sort: runInsertionSort,
            merge_sort: runMergeSort,
            quick_sort: runQuickSort,
            heap_sort: runHeapSort,
        };

        const run = runners[algorithmType];
        if (!run) {
            return null;
        }
        run();

        steps.push(
            makeStep(
                'Final Answer',
                `Sorted array: ${arr.map((value) => formatNumber(value)).join(' ')}.`,
                renderIndexedStrip(arr),
                '<code>array is sorted in non-decreasing order</code>'
            )
        );

        return {
            title: `Execution Visualization - ${labels[algorithmType] || 'Sorting'}`,
            subtitle: 'Algorithm-specific transitions to final sorted order.',
            steps,
        };
    }

    function buildGraphTraversalModel(payload, mode) {
        const rawEdges = Array.isArray(payload.edges) ? payload.edges : [];
        const parsedEdges = rawEdges
            .map((edge) => {
                if (!Array.isArray(edge) || edge.length < 2) {
                    return null;
                }
                const left = Math.floor(asFiniteNumber(edge[0], Number.NaN));
                const right = Math.floor(asFiniteNumber(edge[1], Number.NaN));
                if (!Number.isInteger(left) || !Number.isInteger(right) || left < 0 || right < 0) {
                    return null;
                }
                return [left, right];
            })
            .filter(Boolean);
        if (!parsedEdges.length) {
            return null;
        }

        const nodeSet = new Set();
        const rawNodes = Array.isArray(payload.nodes) ? payload.nodes : [];
        rawNodes.forEach((node) => {
            const normalized = Math.floor(asFiniteNumber(node, Number.NaN));
            if (Number.isInteger(normalized) && normalized >= 0) {
                nodeSet.add(normalized);
            }
        });
        parsedEdges.forEach(([left, right]) => {
            nodeSet.add(left);
            nodeSet.add(right);
        });
        const nodes = Array.from(nodeSet).sort((a, b) => a - b);
        const start = Math.floor(asFiniteNumber(payload.start, Number.NaN));
        if (!Number.isInteger(start) || !nodeSet.has(start)) {
            return null;
        }

        const adjacency = new Map(nodes.map((node) => [node, []]));
        parsedEdges.forEach(([left, right]) => {
            adjacency.get(left).push(right);
            adjacency.get(right).push(left);
        });
        adjacency.forEach((neighbors) => neighbors.sort((a, b) => a - b));

        const nodeIndex = new Map(nodes.map((node, idx) => [node, idx]));
        const steps = [
            makeStep(
                `${mode.toUpperCase()} Setup`,
                `Start traversal from node ${start}.`,
                `
                    ${renderIndexedStrip(nodes, new Set([nodeIndex.get(start)]))}
                    <div class="exec-summary">Edges: ${parsedEdges.map(([u, v]) => `(${u}-${v})`).join(', ')}</div>
                `,
                mode === 'bfs'
                    ? '<code>Queue-based level traversal, lower neighbors first</code>'
                    : '<code>Stack-based depth traversal, lower neighbors first</code>'
            ),
        ];

        const order = [];
        if (mode === 'bfs') {
            const queue = [start];
            const visited = new Set([start]);
            while (queue.length) {
                const current = queue.shift();
                order.push(current);
                const enqueued = [];
                (adjacency.get(current) || []).forEach((nextNode) => {
                    if (!visited.has(nextNode)) {
                        visited.add(nextNode);
                        queue.push(nextNode);
                        enqueued.push(nextNode);
                    }
                });
                steps.push(
                    makeStep(
                        `Visit ${current}`,
                        `Enqueue new neighbors: [${enqueued.join(', ') || '-'}].`,
                        `
                            ${renderIndexedStrip(nodes, new Set([nodeIndex.get(current)]))}
                            <div class="exec-summary">Order: ${order.join(' -> ')}</div>
                            <div class="exec-summary">Queue: [${queue.join(', ')}]</div>
                        `,
                        '<code>pop front, enqueue unvisited neighbors in ascending order</code>'
                    )
                );
            }
        } else {
            const stack = [start];
            const visited = new Set();
            while (stack.length) {
                const current = stack.pop();
                if (visited.has(current)) {
                    continue;
                }
                visited.add(current);
                order.push(current);
                const pushed = [];
                const neighbors = (adjacency.get(current) || []).slice().sort((a, b) => b - a);
                neighbors.forEach((nextNode) => {
                    if (!visited.has(nextNode)) {
                        stack.push(nextNode);
                        pushed.push(nextNode);
                    }
                });
                steps.push(
                    makeStep(
                        `Visit ${current}`,
                        `Push neighbors (reverse order for deterministic DFS): [${pushed.join(', ') || '-'}].`,
                        `
                            ${renderIndexedStrip(nodes, new Set([nodeIndex.get(current)]))}
                            <div class="exec-summary">Order: ${order.join(' -> ')}</div>
                            <div class="exec-summary">Stack: [${stack.join(', ')}]</div>
                        `,
                        '<code>pop stack; push unvisited neighbors in descending order</code>'
                    )
                );
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                `${mode.toUpperCase()} traversal order: ${order.join(' ')}.`,
                renderIndexedStrip(nodes),
                `<code>answer = "${order.join(' ')}"</code>`
            )
        );

        return {
            title: `Execution Visualization - ${mode.toUpperCase()} Traversal`,
            subtitle: 'Deterministic graph traversal replay.',
            steps,
        };
    }

    function buildDijkstraModel(payload) {
        const rawEdges = Array.isArray(payload.weighted_edges) ? payload.weighted_edges : [];
        const weightedEdges = rawEdges
            .map((edge) => {
                if (!Array.isArray(edge) || edge.length < 3) {
                    return null;
                }
                const left = Math.floor(asFiniteNumber(edge[0], Number.NaN));
                const right = Math.floor(asFiniteNumber(edge[1], Number.NaN));
                const weight = Math.floor(asFiniteNumber(edge[2], Number.NaN));
                if (!Number.isInteger(left) || !Number.isInteger(right) || !Number.isInteger(weight) || left < 0 || right < 0 || weight <= 0) {
                    return null;
                }
                return [left, right, weight];
            })
            .filter(Boolean);
        const source = Math.floor(asFiniteNumber(payload.source, Number.NaN));
        const target = Math.floor(asFiniteNumber(payload.target, Number.NaN));
        if (!weightedEdges.length || !Number.isInteger(source) || !Number.isInteger(target) || source < 0 || target < 0) {
            return null;
        }

        const nodeSet = new Set([source, target]);
        weightedEdges.forEach(([left, right]) => {
            nodeSet.add(left);
            nodeSet.add(right);
        });
        const nodes = Array.from(nodeSet).sort((a, b) => a - b);
        const adjacency = new Map(nodes.map((node) => [node, []]));
        weightedEdges.forEach(([left, right, weight]) => {
            adjacency.get(left).push([right, weight]);
            adjacency.get(right).push([left, weight]);
        });
        adjacency.forEach((neighbors) => neighbors.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1])));

        const dist = new Map(nodes.map((node) => [node, Number.POSITIVE_INFINITY]));
        const prev = new Map();
        dist.set(source, 0);
        const frontier = [[0, source]];
        const settled = new Set();

        function distanceTable(activeNode = null) {
            return `
                <div class="exec-list">
                    ${nodes.map((node) => {
                        const d = dist.get(node);
                        const token = Number.isFinite(d) ? formatNumber(d) : 'inf';
                        const cls = activeNode === node ? ' active' : '';
                        return `<div class="exec-list-row${cls}">node ${node}: dist=${token}</div>`;
                    }).join('')}
                </div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Distances',
                `Source=${source}, Target=${target}.`,
                `
                    ${distanceTable(source)}
                    <div class="exec-summary">Frontier: [(${source}, 0)]</div>
                `,
                '<code>dist[source]=0, all others=inf; relax edges from smallest tentative node</code>'
            ),
        ];

        while (frontier.length) {
            frontier.sort((left, right) => (left[0] - right[0]) || (left[1] - right[1]));
            const [currentDist, node] = frontier.shift();
            if (currentDist > dist.get(node) || settled.has(node)) {
                continue;
            }
            settled.add(node);

            steps.push(
                makeStep(
                    `Extract node ${node}`,
                    `Current shortest settled distance: ${formatNumber(currentDist)}.`,
                    `
                        ${distanceTable(node)}
                        <div class="exec-summary">Settled: [${Array.from(settled).sort((a, b) => a - b).join(', ')}]</div>
                    `,
                    '<code>pick node with minimum tentative distance</code>'
                )
            );

            if (node === target) {
                break;
            }

            (adjacency.get(node) || []).forEach(([nextNode, weight]) => {
                const candidate = currentDist + weight;
                const prior = dist.get(nextNode);
                if (candidate < prior) {
                    dist.set(nextNode, candidate);
                    prev.set(nextNode, node);
                    frontier.push([candidate, nextNode]);
                    steps.push(
                        makeStep(
                            `Relax edge ${node} -> ${nextNode}`,
                            `Improve distance ${prior === Number.POSITIVE_INFINITY ? 'inf' : formatNumber(prior)} -> ${formatNumber(candidate)}.`,
                            distanceTable(nextNode),
                            `<code>dist[${nextNode}] = min(dist[${nextNode}], dist[${node}] + ${weight})</code>`
                        )
                    );
                }
            });
        }

        const shortest = dist.get(target);
        const reachable = Number.isFinite(shortest);
        const path = [];
        if (reachable) {
            let current = target;
            while (current !== undefined) {
                path.push(current);
                if (current === source) {
                    break;
                }
                current = prev.get(current);
            }
            path.reverse();
        }

        steps.push(
            makeStep(
                'Final Answer',
                reachable
                    ? `Shortest distance is ${formatNumber(shortest)} via path ${path.join(' -> ')}.`
                    : 'Target is unreachable, answer is -1.',
                `
                    ${distanceTable(target)}
                    <div class="exec-summary success">Answer: ${reachable ? formatNumber(shortest) : '-1'}</div>
                `,
                reachable
                    ? `<code>answer = ${formatNumber(shortest)}</code>`
                    : '<code>no path from source to target -> -1</code>'
            )
        );

        return {
            title: 'Execution Visualization - Dijkstra',
            subtitle: 'Shortest path by repeated edge relaxation.',
            steps,
        };
    }

    function buildAstarModel(payload) {
        const rows = Math.floor(asFiniteNumber(payload.rows, Number.NaN));
        const cols = Math.floor(asFiniteNumber(payload.cols, Number.NaN));
        const blockedRaw = Array.isArray(payload.blocked) ? payload.blocked : [];
        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
            return null;
        }

        const blocked = new Set();
        for (let i = 0; i < blockedRaw.length; i += 1) {
            const cell = blockedRaw[i];
            if (!Array.isArray(cell) || cell.length < 2) {
                return null;
            }
            const row = Math.floor(asFiniteNumber(cell[0], Number.NaN));
            const col = Math.floor(asFiniteNumber(cell[1], Number.NaN));
            if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= rows || col >= cols) {
                return null;
            }
            blocked.add(`${row},${col}`);
        }

        const start = [0, 0];
        const goal = [rows - 1, cols - 1];
        const startKey = `${start[0]},${start[1]}`;
        const goalKey = `${goal[0]},${goal[1]}`;
        if (blocked.has(startKey) || blocked.has(goalKey)) {
            return {
                title: 'Execution Visualization - A* Grid Search',
                subtitle: 'Grid pathfinding with heuristic guidance.',
                steps: [
                    makeStep(
                        'Invalid Grid',
                        'Start or goal is blocked, so route is unreachable.',
                        `<div class="exec-summary">Answer: -1</div>`,
                        '<code>if start/goal blocked -> unreachable</code>'
                    ),
                ],
            };
        }

        function heuristic(row, col) {
            return Math.abs(goal[0] - row) + Math.abs(goal[1] - col);
        }

        function renderGrid(currentKey = null, pathSet = new Set()) {
            const lines = [];
            for (let row = 0; row < rows; row += 1) {
                const tokens = [];
                for (let col = 0; col < cols; col += 1) {
                    const key = `${row},${col}`;
                    if (key === startKey) {
                        tokens.push('S');
                    } else if (key === goalKey) {
                        tokens.push('G');
                    } else if (key === currentKey) {
                        tokens.push('C');
                    } else if (pathSet.has(key)) {
                        tokens.push('*');
                    } else if (blocked.has(key)) {
                        tokens.push('#');
                    } else {
                        tokens.push('.');
                    }
                }
                lines.push(tokens.join(' '));
            }
            return `<pre class="exec-summary">${lines.join('\n')}</pre>`;
        }

        const open = [{ row: 0, col: 0, g: 0, f: heuristic(0, 0) }];
        const gScore = new Map([[startKey, 0]]);
        const cameFrom = new Map();
        const closed = new Set();

        const steps = [
            makeStep(
                'Initialize A*',
                `Grid ${rows}x${cols}, start=(0,0), goal=(${goal[0]},${goal[1]}).`,
                renderGrid(startKey),
                '<code>f(n)=g(n)+h(n), h=Manhattan distance</code>'
            ),
        ];

        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let found = false;

        while (open.length) {
            open.sort((left, right) => (left.f - right.f) || (left.g - right.g) || (left.row - right.row) || (left.col - right.col));
            const current = open.shift();
            const currentKey = `${current.row},${current.col}`;
            if (closed.has(currentKey)) {
                continue;
            }
            closed.add(currentKey);

            steps.push(
                makeStep(
                    `Expand (${current.row},${current.col})`,
                    `g=${formatNumber(current.g)}, h=${formatNumber(heuristic(current.row, current.col))}, f=${formatNumber(current.f)}.`,
                    `
                        ${renderGrid(currentKey)}
                        <div class="exec-summary">Open size: ${open.length}, Closed size: ${closed.size}</div>
                    `,
                    '<code>pop node with smallest f from open set</code>'
                )
            );

            if (currentKey === goalKey) {
                found = true;
                break;
            }

            for (let i = 0; i < directions.length; i += 1) {
                const [dr, dc] = directions[i];
                const nextRow = current.row + dr;
                const nextCol = current.col + dc;
                if (nextRow < 0 || nextCol < 0 || nextRow >= rows || nextCol >= cols) {
                    continue;
                }
                const nextKey = `${nextRow},${nextCol}`;
                if (blocked.has(nextKey) || closed.has(nextKey)) {
                    continue;
                }

                const candidateG = current.g + 1;
                const priorG = gScore.has(nextKey) ? gScore.get(nextKey) : Number.POSITIVE_INFINITY;
                if (candidateG < priorG) {
                    cameFrom.set(nextKey, currentKey);
                    gScore.set(nextKey, candidateG);
                    const f = candidateG + heuristic(nextRow, nextCol);
                    open.push({ row: nextRow, col: nextCol, g: candidateG, f });
                    steps.push(
                        makeStep(
                            `Update neighbor (${nextRow},${nextCol})`,
                            `Better path found: g ${priorG === Number.POSITIVE_INFINITY ? 'inf' : formatNumber(priorG)} -> ${formatNumber(candidateG)}.`,
                            renderGrid(currentKey),
                            `<code>tentative_g = ${formatNumber(current.g)} + 1 = ${formatNumber(candidateG)}, f = g + h</code>`
                        )
                    );
                }
            }
        }

        let path = [];
        if (found) {
            let cursor = goalKey;
            while (cursor) {
                path.push(cursor);
                if (cursor === startKey) {
                    break;
                }
                cursor = cameFrom.get(cursor);
            }
            path.reverse();
        }

        const pathSet = new Set(path);
        const moves = found ? path.length - 1 : -1;
        steps.push(
            makeStep(
                'Final Answer',
                found
                    ? `Reached goal in ${moves} moves.`
                    : 'Goal unreachable, answer is -1.',
                `
                    ${renderGrid(null, pathSet)}
                    <div class="exec-summary success">Answer: ${moves}</div>
                `,
                found
                    ? `<code>moves = path_length - 1 = ${moves}</code>`
                    : '<code>no valid route to goal -> -1</code>'
            )
        );

        return {
            title: 'Execution Visualization - A* Grid Search',
            subtitle: 'Heuristic-guided shortest path exploration.',
            steps,
        };
    }

    function buildMinimaxModel(payload) {
        const leaves = normalizeNumberArray(payload.leaves);
        if (!leaves.length || leaves.length % 2 !== 0) {
            return null;
        }

        let level = leaves.slice();
        let maximizing = false;
        let depth = 0;
        const steps = [
            makeStep(
                'Load Leaf Utilities',
                `Start fold with ${level.length} leaf values.`,
                `
                    ${renderIndexedStrip(level)}
                    <div class="exec-summary">Fold rule starts with MIN level.</div>
                `,
                '<code>Fold pairs bottom-up, toggling MIN/MAX each level</code>'
            ),
        ];

        while (level.length > 1) {
            if (level.length % 2 !== 0) {
                return null;
            }
            const nextLevel = [];
            for (let idx = 0; idx < level.length; idx += 2) {
                const left = level[idx];
                const right = level[idx + 1];
                const chosen = maximizing ? Math.max(left, right) : Math.min(left, right);
                nextLevel.push(chosen);
                steps.push(
                    makeStep(
                        `Depth ${depth + 1} pair (${idx}, ${idx + 1})`,
                        `${maximizing ? 'MAX' : 'MIN'}(${formatNumber(left)}, ${formatNumber(right)}) = ${formatNumber(chosen)}.`,
                        renderIndexedStrip(level, new Set([idx, idx + 1])),
                        `<code>${maximizing ? 'max' : 'min'}(${formatNumber(left)}, ${formatNumber(right)})</code>`
                    )
                );
            }
            level = nextLevel;
            maximizing = !maximizing;
            depth += 1;

            steps.push(
                makeStep(
                    `Level ${depth} Fold Result`,
                    `Collapsed to ${level.length} node values.`,
                    renderIndexedStrip(level),
                    '<code>repeat until one root value remains</code>'
                )
            );
        }

        const answer = level[0];
        steps.push(
            makeStep(
                'Final Answer',
                `Root minimax value is ${formatNumber(answer)}.`,
                `<div class="exec-summary success">Answer: ${formatNumber(answer)}</div>`,
                `<code>root = ${formatNumber(answer)}</code>`
            )
        );

        return {
            title: 'Execution Visualization - Minimax Fold',
            subtitle: 'Bottom-up pair folding with alternating MIN/MAX.',
            steps,
        };
    }

    function buildStringAlgorithmModel(payload) {
        const words = (Array.isArray(payload.words) ? payload.words : [])
            .map((word) => String(word || ''));
        if (!words.length) {
            return null;
        }

        let prefix = words[0];
        const steps = [
            makeStep(
                'Initialize Candidate Prefix',
                `Start with first word as candidate: "${prefix}".`,
                `
                    <div class="exec-list">
                        ${words.map((word, idx) => `<div class="exec-list-row${idx === 0 ? ' active' : ''}">W${idx + 1}: ${escapeHtml(word)}</div>`).join('')}
                    </div>
                    <div class="exec-summary">Candidate prefix: "${escapeHtml(prefix)}"</div>
                `,
                '<code>prefix = words[0]</code>'
            ),
        ];

        for (let idx = 1; idx < words.length; idx += 1) {
            const word = words[idx];
            steps.push(
                makeStep(
                    `Compare with W${idx + 1}`,
                    `Check whether "${escapeHtml(word)}" starts with current prefix.`,
                    `
                        <div class="exec-list">
                            ${words.map((entry, entryIdx) => `<div class="exec-list-row${entryIdx === idx ? ' active' : ''}">W${entryIdx + 1}: ${escapeHtml(entry)}</div>`).join('')}
                        </div>
                        <div class="exec-summary">Current prefix: "${escapeHtml(prefix)}"</div>
                    `,
                    '<code>while !word.startsWith(prefix): shrink prefix by 1 char</code>'
                )
            );

            while (prefix && !word.startsWith(prefix)) {
                const before = prefix;
                prefix = prefix.slice(0, -1);
                steps.push(
                    makeStep(
                        `Shrink Prefix`,
                        `"${escapeHtml(word)}" does not match "${escapeHtml(before)}", shrink to "${escapeHtml(prefix)}".`,
                        `
                            <div class="exec-list">
                                ${words.map((entry, entryIdx) => `<div class="exec-list-row${entryIdx === idx ? ' active' : ''}">W${entryIdx + 1}: ${escapeHtml(entry)}</div>`).join('')}
                            </div>
                            <div class="exec-summary">Current prefix: "${escapeHtml(prefix)}"</div>
                        `,
                        '<code>prefix = prefix.slice(0, -1)</code>'
                    )
                );
            }

            if (!prefix) {
                steps.push(
                    makeStep(
                        'Prefix Exhausted',
                        'No common prefix remains.',
                        `<div class="exec-summary">Current prefix: ""</div>`,
                        '<code>if prefix == "": stop early</code>'
                    )
                );
                break;
            }
        }

        const answerLabel = prefix || '(empty)';
        steps.push(
            makeStep(
                'Final Answer',
                `Longest common prefix is ${answerLabel}.`,
                `
                    <div class="exec-list">
                        ${words.map((word, idx) => `<div class="exec-list-row">W${idx + 1}: ${escapeHtml(word)}</div>`).join('')}
                    </div>
                    <div class="exec-summary success">Answer: ${escapeHtml(answerLabel)}</div>
                `,
                '<code>answer = prefix</code>'
            )
        );

        return {
            title: 'Execution Visualization - Longest Common Prefix',
            subtitle: 'Shrink candidate prefix until every word matches.',
            steps,
        };
    }

    function buildLinearSearchModel(payload) {
        const data = normalizeNumberArray(payload.data);
        const target = asFiniteNumber(payload.target, Number.NaN);
        if (!data.length || !Number.isFinite(target)) {
            return null;
        }

        const steps = [
            makeStep(
                'Initialize Search',
                `Scan left-to-right for first target occurrence (${formatNumber(target)}).`,
                renderIndexedStrip(data),
                '<code>for i in [0..n-1]: if arr[i] == target return i</code>'
            ),
        ];

        const visited = new Set();
        let answerIndex = -1;
        for (let idx = 0; idx < data.length; idx += 1) {
            visited.add(idx);
            const matched = Math.abs(data[idx] - target) <= 1e-9;
            steps.push(
                makeStep(
                    `Check index ${idx}`,
                    matched
                        ? `arr[${idx}] = ${formatNumber(data[idx])} matches target. Stop at first match.`
                        : `arr[${idx}] = ${formatNumber(data[idx])} does not match target.`,
                    `
                        ${renderIndexedStrip(data, new Set([idx]))}
                        <div class="exec-summary">Visited: [${Array.from(visited).join(', ')}]</div>
                    `,
                    `<code>compare ${formatNumber(data[idx])} with ${formatNumber(target)}</code>`
                )
            );
            if (matched) {
                answerIndex = idx;
                break;
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                answerIndex >= 0
                    ? `First matching index is ${answerIndex}.`
                    : 'Target not found, answer is -1.',
                answerIndex >= 0
                    ? renderIndexedStrip(data, new Set([answerIndex]))
                    : renderIndexedStrip(data),
                `<code>answer = ${answerIndex}</code>`
            )
        );

        return {
            title: 'Execution Visualization - Linear Search',
            subtitle: 'Sequential scan until first match.',
            steps,
        };
    }

    function buildBinarySearchModel(payload) {
        const data = normalizeNumberArray(payload.data);
        const target = asFiniteNumber(payload.target, Number.NaN);
        if (!data.length || !Number.isFinite(target)) {
            return null;
        }

        for (let i = 0; i < data.length - 1; i += 1) {
            if (data[i] > data[i + 1]) {
                return null;
            }
        }

        const steps = [
            makeStep(
                'Initialize Search Window',
                `Binary search on sorted array for target ${formatNumber(target)}.`,
                renderIndexedStrip(data),
                '<code>while low <= high: mid=(low+high)//2</code>'
            ),
        ];

        let low = 0;
        let high = data.length - 1;
        let answerIndex = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midValue = data[mid];
            const highlight = new Set([low, mid, high]);

            steps.push(
                makeStep(
                    `Window [${low}..${high}], mid=${mid}`,
                    `Compare target ${formatNumber(target)} with arr[${mid}] = ${formatNumber(midValue)}.`,
                    `
                        ${renderIndexedStrip(data, highlight)}
                        <div class="exec-summary">low=${low}, mid=${mid}, high=${high}</div>
                    `,
                    `<code>mid = floor((${low}+${high})/2)</code>`
                )
            );

            if (Math.abs(midValue - target) <= 1e-9) {
                answerIndex = mid;
                steps.push(
                    makeStep(
                        'Target Found',
                        `arr[${mid}] equals target.`,
                        renderIndexedStrip(data, new Set([mid])),
                        `<code>return ${mid}</code>`
                    )
                );
                break;
            }

            if (midValue < target) {
                const nextLow = mid + 1;
                steps.push(
                    makeStep(
                        'Move Right',
                        `${formatNumber(midValue)} < ${formatNumber(target)} so discard left half.`,
                        renderIndexedStrip(data, highlight),
                        `<code>low = mid + 1 = ${nextLow}</code>`
                    )
                );
                low = nextLow;
            } else {
                const nextHigh = mid - 1;
                steps.push(
                    makeStep(
                        'Move Left',
                        `${formatNumber(midValue)} > ${formatNumber(target)} so discard right half.`,
                        renderIndexedStrip(data, highlight),
                        `<code>high = mid - 1 = ${nextHigh}</code>`
                    )
                );
                high = nextHigh;
            }
        }

        if (answerIndex === -1) {
            steps.push(
                makeStep(
                    'Window Exhausted',
                    'low crossed high, target is absent.',
                    renderIndexedStrip(data),
                    '<code>if low > high: return -1</code>'
                )
            );
        }

        steps.push(
            makeStep(
                'Final Answer',
                answerIndex >= 0
                    ? `Target index is ${answerIndex}.`
                    : 'Target not found, answer is -1.',
                answerIndex >= 0
                    ? renderIndexedStrip(data, new Set([answerIndex]))
                    : renderIndexedStrip(data),
                `<code>answer = ${answerIndex}</code>`
            )
        );

        return {
            title: 'Execution Visualization - Binary Search',
            subtitle: 'Halve search space using midpoint comparisons.',
            steps,
        };
    }

    function buildLinearRegressionModel(payload) {
        const points = normalizePointPairs(payload.points);
        const queryX = asFiniteNumber(payload.query_x, Number.NaN);
        if (points.length < 2 || !Number.isFinite(queryX)) {
            return null;
        }

        const p1 = points[0];
        const p2 = points[1];
        if (p1.x === p2.x) {
            return null;
        }

        const slope = (p2.y - p1.y) / (p2.x - p1.x);
        const intercept = p1.y - (slope * p1.x);
        const prediction = (slope * queryX) + intercept;
        const steps = [
            makeStep(
                'Load Training Points',
                `Use sample points to infer y = m*x + b, then predict for x=${formatNumber(queryX)}.`,
                renderRegressionPlot(points, slope, intercept, queryX, {
                    showLine: false,
                    showQuery: false,
                    highlightSet: new Set([p1.index, p2.index]),
                }),
                '<code>Linear model: y = m*x + b</code>'
            ),
            makeStep(
                'Compute Slope (m)',
                `From P1 and P2: (${formatNumber(p1.x)}, ${formatNumber(p1.y)}) and (${formatNumber(p2.x)}, ${formatNumber(p2.y)}).`,
                `
                    ${renderRegressionPlot(points, slope, intercept, queryX, {
                        showLine: true,
                        showQuery: false,
                        highlightSet: new Set([p1.index, p2.index]),
                    })}
                    <div class="exec-summary">m = ${formatNumber(slope, 4)}</div>
                `,
                `<code>m = (y2 - y1) / (x2 - x1) = (${formatNumber(p2.y)} - ${formatNumber(p1.y)}) / (${formatNumber(p2.x)} - ${formatNumber(p1.x)}) = ${formatNumber(slope, 4)}</code>`
            ),
            makeStep(
                'Compute Intercept (b)',
                `Substitute any known point into y = m*x + b.`,
                `
                    ${renderRegressionPlot(points, slope, intercept, queryX, {
                        showLine: true,
                        showQuery: false,
                        highlightSet: new Set([p1.index]),
                    })}
                    <div class="exec-summary">b = ${formatNumber(intercept, 4)}</div>
                `,
                `<code>b = y1 - m*x1 = ${formatNumber(p1.y)} - (${formatNumber(slope, 4)} * ${formatNumber(p1.x)}) = ${formatNumber(intercept, 4)}</code>`
            ),
            makeStep(
                'Predict Query',
                `Evaluate model at x=${formatNumber(queryX)}.`,
                `
                    ${renderRegressionPlot(points, slope, intercept, queryX, {
                        showLine: true,
                        showQuery: true,
                        highlightSet: new Set([p1.index, p2.index]),
                    })}
                    <div class="exec-summary success">Predicted y = ${formatNumber(prediction, 3)}</div>
                `,
                `<code>y = m*x + b = (${formatNumber(slope, 4)} * ${formatNumber(queryX)}) + ${formatNumber(intercept, 4)} = ${formatNumber(prediction, 3)}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Linear Regression',
            subtitle: 'Derive slope/intercept and run one prediction.',
            steps,
        };
    }

    function buildLogisticRegressionModel(payload) {
        const z = asFiniteNumber(payload.z, Number.NaN);
        if (!Number.isFinite(z)) {
            return null;
        }

        const expTerm = Math.exp(-z);
        const denominator = 1 + expTerm;
        const probability = 1 / denominator;
        const steps = [
            makeStep(
                'Start with Logit',
                `Given z = ${formatNumber(z, 4)}.`,
                `
                    ${renderLogisticCurve(z, { showPoint: false })}
                    <div class="exec-summary">Target: sigma(z)</div>
                `,
                '<code>sigma(z) = 1 / (1 + e^-z)</code>'
            ),
            makeStep(
                'Compute Exponential Term',
                `Evaluate e^-z.`,
                `
                    ${renderLogisticCurve(z, { showPoint: true })}
                    <div class="exec-summary">e^(-z) = ${formatNumber(expTerm, 6, true)}</div>
                `,
                `<code>e^-z = e^(-${formatNumber(z, 4)}) = ${formatNumber(expTerm, 6, true)}</code>`
            ),
            makeStep(
                'Build Denominator',
                'Add 1 to exponential term.',
                `
                    ${renderLogisticCurve(z, { showPoint: true })}
                    <div class="exec-summary">1 + e^-z = ${formatNumber(denominator, 6, true)}</div>
                `,
                `<code>denominator = 1 + ${formatNumber(expTerm, 6, true)} = ${formatNumber(denominator, 6, true)}</code>`
            ),
            makeStep(
                'Final Probability',
                'Invert denominator to get class probability.',
                `
                    ${renderLogisticCurve(z, { showPoint: true })}
                    <div class="exec-summary success">sigma(z) = ${formatNumber(probability, 3, true)}</div>
                `,
                `<code>sigma(z) = 1 / ${formatNumber(denominator, 6, true)} = ${formatNumber(probability, 3, true)}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Logistic Regression',
            subtitle: 'Transform linear score to probability with sigmoid.',
            steps,
        };
    }

    function buildKmeansModel(payload) {
        const points = normalizeNumberArray(payload.points);
        const centroids = normalizeNumberArray(payload.centroids);
        if (!points.length || centroids.length !== 2) {
            return null;
        }

        const c1 = centroids[0];
        const c2 = centroids[1];
        const assignments = [];
        const groupOne = [];
        const groupTwo = [];
        const steps = [
            makeStep(
                'Initialize Centroids',
                `Start with C1=${formatNumber(c1, 2, true)} and C2=${formatNumber(c2, 2, true)}.`,
                renderOneDimClusterPlot(points, [c1, c2], assignments),
                `<code>centroids = [${formatNumber(c1, 2, true)}, ${formatNumber(c2, 2, true)}]</code>`
            ),
        ];

        points.forEach((point, idx) => {
            const d1 = Math.abs(point - c1);
            const d2 = Math.abs(point - c2);
            const cluster = d1 <= d2 ? 0 : 1;
            assignments[idx] = cluster;
            if (cluster === 0) {
                groupOne.push(point);
            } else {
                groupTwo.push(point);
            }

            steps.push(
                makeStep(
                    `Assign Point ${idx + 1}`,
                    `Point ${formatNumber(point)} -> ${cluster === 0 ? 'C1' : 'C2'} (nearest centroid).`,
                    `
                        ${renderOneDimClusterPlot(points, [c1, c2], assignments, { currentIndex: idx })}
                        <div class="exec-list">
                            ${points.map((value, pointIdx) => {
                                const currentCluster = assignments[pointIdx];
                                const label = currentCluster === 0 ? 'C1' : currentCluster === 1 ? 'C2' : '-';
                                const rowClass = pointIdx === idx ? ' active' : '';
                                return `<div class="exec-list-row${rowClass}">Point ${formatNumber(value)} => ${label}</div>`;
                            }).join('')}
                        </div>
                    `,
                    `<code>|${formatNumber(point)} - C1|=${formatNumber(d1, 2, true)}, |${formatNumber(point)} - C2|=${formatNumber(d2, 2, true)}</code>`
                )
            );
        });

        const nextC1 = groupOne.length
            ? roundTo(groupOne.reduce((sum, value) => sum + value, 0) / groupOne.length, 2)
            : roundTo(c1, 2);
        const nextC2 = groupTwo.length
            ? roundTo(groupTwo.reduce((sum, value) => sum + value, 0) / groupTwo.length, 2)
            : roundTo(c2, 2);

        steps.push(
            makeStep(
                'Update Centroids',
                'Recompute each centroid as mean of assigned points.',
                `
                    ${renderOneDimClusterPlot(points, [nextC1, nextC2], assignments)}
                    <div class="exec-list">
                        <div class="exec-list-row active">C1 points: [${groupOne.map((value) => formatNumber(value)).join(', ') || '-'}]</div>
                        <div class="exec-list-row active">C2 points: [${groupTwo.map((value) => formatNumber(value)).join(', ') || '-'}]</div>
                    </div>
                    <div class="exec-summary success">New centroids: ${formatNumber(nextC1, 2, true)} ${formatNumber(nextC2, 2, true)}</div>
                `,
                `<code>C1' = mean(C1 points), C2' = mean(C2 points)</code>`
            )
        );

        return {
            title: 'Execution Visualization - K-Means (1 Iteration)',
            subtitle: 'Assignment phase then centroid update in 1D.',
            steps,
        };
    }

    function buildKnnModel(payload) {
        const rawTrain = Array.isArray(payload.train_points) ? payload.train_points : [];
        const queryX = asFiniteNumber(payload.query_x, Number.NaN);
        const k = Math.floor(asFiniteNumber(payload.k || 3, 3));
        const train = rawTrain
            .map((row, idx) => {
                if (!Array.isArray(row) || row.length < 2) {
                    return null;
                }
                const x = Number(row[0]);
                const label = String(row[1] || '').trim().toUpperCase();
                if (!Number.isFinite(x) || !['A', 'B'].includes(label)) {
                    return null;
                }
                return { index: idx, x, label, distance: Math.abs(x - queryX) };
            })
            .filter(Boolean);
        if (!train.length || !Number.isFinite(queryX) || !Number.isInteger(k) || k <= 0 || k > train.length) {
            return null;
        }

        const ranked = train.slice().sort((left, right) => {
            if (left.distance !== right.distance) return left.distance - right.distance;
            if (left.x !== right.x) return left.x - right.x;
            if (left.label !== right.label) return left.label.localeCompare(right.label);
            return left.index - right.index;
        });
        const topK = ranked.slice(0, k);
        const countA = topK.filter((row) => row.label === 'A').length;
        const prediction = countA >= (k - countA) ? 'A' : 'B';

        const steps = [
            makeStep(
                'Load Query',
                `Classify query x=${formatNumber(queryX)} with k=${k}.`,
                `
                    ${renderKnnPlot(train, queryX)}
                    <div class="exec-list">
                        ${train.map((row) => `<div class="exec-list-row">x=${formatNumber(row.x)}, label=${row.label}</div>`).join('')}
                    </div>
                `,
                '<code>distance = |x_train - x_query|</code>'
            ),
        ];

        const considered = new Set();
        ranked.forEach((row, rankIdx) => {
            considered.add(row.index);
            steps.push(
                makeStep(
                    `Rank Neighbor ${rankIdx + 1}`,
                    `Candidate x=${formatNumber(row.x)} (${row.label}) has distance ${formatNumber(row.distance)}.`,
                    `
                        ${renderKnnPlot(train, queryX, considered)}
                        <div class="exec-list">
                            ${ranked.map((entry, idx) => `<div class="exec-list-row${idx <= rankIdx ? ' active' : ''}">#${idx + 1}: x=${formatNumber(entry.x)}, label=${entry.label}, d=${formatNumber(entry.distance)}</div>`).join('')}
                        </div>
                    `,
                    '<code>Sort by (distance, x, label)</code>'
                )
            );
        });

        steps.push(
            makeStep(
                `Take Top ${k}`,
                `Majority vote among nearest neighbors gives class ${prediction}.`,
                `
                    ${renderKnnPlot(train, queryX, considered, new Set(topK.map((row) => row.index)))}
                    <div class="exec-list">
                        ${topK.map((row) => `<div class="exec-list-row active">x=${formatNumber(row.x)}, label=${row.label}, d=${formatNumber(row.distance)}</div>`).join('')}
                    </div>
                    <div class="exec-summary success">Prediction: ${prediction}</div>
                `,
                `<code>count(A)=${countA}, count(B)=${k - countA}, answer=${prediction}</code>`
            )
        );

        return {
            title: 'Execution Visualization - KNN Classification',
            subtitle: 'Distance ranking with deterministic tie-break.',
            steps,
        };
    }

    function buildDecisionTreeModel(payload) {
        const positive = asFiniteNumber(payload.positive, Number.NaN);
        const negative = asFiniteNumber(payload.negative, Number.NaN);
        if (!Number.isFinite(positive) || !Number.isFinite(negative) || positive <= 0 || negative <= 0) {
            return null;
        }

        const total = positive + negative;
        const pPos = positive / total;
        const pNeg = negative / total;
        const posTerm = pPos > 0 ? -(pPos * (Math.log(pPos) / Math.log(2))) : 0;
        const negTerm = pNeg > 0 ? -(pNeg * (Math.log(pNeg) / Math.log(2))) : 0;
        const entropy = posTerm + negTerm;
        const steps = [
            makeStep(
                'Class Distribution',
                `Positive=${formatNumber(positive)}, Negative=${formatNumber(negative)}, Total=${formatNumber(total)}.`,
                `
                    ${renderEntropyBars(positive, negative, pPos, pNeg)}
                    <div class="exec-summary">Counts -> (+): ${formatNumber(positive)}, (-): ${formatNumber(negative)}</div>
                `,
                '<code>H = -sum(p_i * log2(p_i))</code>'
            ),
            makeStep(
                'Convert to Probabilities',
                'Compute class probabilities.',
                `
                    ${renderEntropyBars(positive, negative, pPos, pNeg)}
                    <div class="exec-summary">p(+)=${formatNumber(pPos, 4, true)}, p(-)=${formatNumber(pNeg, 4, true)}</div>
                `,
                `<code>p(+)=${formatNumber(positive)}/${formatNumber(total)}, p(-)=${formatNumber(negative)}/${formatNumber(total)}</code>`
            ),
            makeStep(
                'Compute Entropy Terms',
                'Evaluate each class contribution.',
                `
                    ${renderEntropyBars(positive, negative, pPos, pNeg)}
                    <div class="exec-list">
                        <div class="exec-list-row active">-(p+)log2(p+) = ${formatNumber(posTerm, 6, true)}</div>
                        <div class="exec-list-row active">-(p-)log2(p-) = ${formatNumber(negTerm, 6, true)}</div>
                    </div>
                `,
                `<code>H = ${formatNumber(posTerm, 6, true)} + ${formatNumber(negTerm, 6, true)}</code>`
            ),
            makeStep(
                'Final Entropy',
                'Sum both contributions and round to 3 decimals.',
                `
                    ${renderEntropyBars(positive, negative, pPos, pNeg)}
                    <div class="exec-summary success">Entropy = ${formatNumber(entropy, 3, true)}</div>
                `,
                `<code>H = ${formatNumber(entropy, 3, true)}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Decision Tree Entropy',
            subtitle: 'Quantify impurity before splitting.',
            steps,
        };
    }

    function buildNaiveBayesModel(payload) {
        const spamScore = asFiniteNumber(payload.spam_score, Number.NaN);
        const hamScore = asFiniteNumber(payload.ham_score, Number.NaN);
        if (!Number.isFinite(spamScore) || !Number.isFinite(hamScore)) {
            return null;
        }

        const predicted = spamScore >= hamScore ? 'spam' : 'ham';
        const steps = [
            makeStep(
                'Load Posterior Scores',
                'Compare unnormalized posteriors for each label.',
                `
                    ${renderScoreBars(spamScore, hamScore)}
                    <div class="exec-list">
                        <div class="exec-list-row">Spam score: ${formatNumber(spamScore, 6, true)}</div>
                        <div class="exec-list-row">Ham score: ${formatNumber(hamScore, 6, true)}</div>
                    </div>
                `,
                '<code>score(label) = prior(label) * likelihood(features|label)</code>'
            ),
            makeStep(
                'Choose Maximum Score',
                `Higher score decides class (${predicted}).`,
                `
                    ${renderScoreBars(spamScore, hamScore)}
                    <div class="exec-summary success">Prediction: ${predicted}</div>
                `,
                `<code>argmax(score_spam, score_ham) -> ${predicted}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Naive Bayes',
            subtitle: 'Posterior comparison for binary text label.',
            steps,
        };
    }

    function buildNeuralNetworkModel(payload) {
        const x1 = asFiniteNumber(payload.x1, Number.NaN);
        const x2 = asFiniteNumber(payload.x2, Number.NaN);
        const w1 = asFiniteNumber(payload.w1, Number.NaN);
        const w2 = asFiniteNumber(payload.w2, Number.NaN);
        const b = asFiniteNumber(payload.b, Number.NaN);
        if (![x1, x2, w1, w2, b].every((value) => Number.isFinite(value))) {
            return null;
        }

        const termOne = w1 * x1;
        const termTwo = w2 * x2;
        const z = termOne + termTwo + b;
        const output = 1 / (1 + Math.exp(-z));
        const steps = [
            makeStep(
                'Load Neuron Inputs',
                `x1=${formatNumber(x1)}, x2=${formatNumber(x2)}, w1=${formatNumber(w1, 3, true)}, w2=${formatNumber(w2, 3, true)}, b=${formatNumber(b, 3, true)}.`,
                `
                    ${renderNeuronDiagram(x1, x2, w1, w2, b, z, output, 'input')}
                    <div class="exec-summary">Forward pass target: sigma(w1*x1 + w2*x2 + b)</div>
                `,
                '<code>z = w1*x1 + w2*x2 + b</code>'
            ),
            makeStep(
                'Weighted Term 1',
                `Compute w1*x1.`,
                `
                    ${renderNeuronDiagram(x1, x2, w1, w2, b, z, output, 'term1')}
                    <div class="exec-summary">w1*x1 = ${formatNumber(termOne, 4, true)}</div>
                `,
                `<code>${formatNumber(w1, 3, true)} * ${formatNumber(x1)} = ${formatNumber(termOne, 4, true)}</code>`
            ),
            makeStep(
                'Weighted Term 2',
                `Compute w2*x2.`,
                `
                    ${renderNeuronDiagram(x1, x2, w1, w2, b, z, output, 'term2')}
                    <div class="exec-summary">w2*x2 = ${formatNumber(termTwo, 4, true)}</div>
                `,
                `<code>${formatNumber(w2, 3, true)} * ${formatNumber(x2)} = ${formatNumber(termTwo, 4, true)}</code>`
            ),
            makeStep(
                'Linear Combination',
                'Add weighted terms and bias.',
                `
                    ${renderNeuronDiagram(x1, x2, w1, w2, b, z, output, 'linear')}
                    <div class="exec-summary">z = ${formatNumber(z, 4, true)}</div>
                `,
                `<code>z = ${formatNumber(termOne, 4, true)} + ${formatNumber(termTwo, 4, true)} + ${formatNumber(b, 3, true)} = ${formatNumber(z, 4, true)}</code>`
            ),
            makeStep(
                'Sigmoid Activation',
                'Map z to probability.',
                `
                    ${renderNeuronDiagram(x1, x2, w1, w2, b, z, output, 'output')}
                    <div class="exec-summary success">sigma(z) = ${formatNumber(output, 3, true)}</div>
                `,
                `<code>sigma(z) = 1/(1+e^-z) = ${formatNumber(output, 3, true)}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Neural Network (1 Neuron)',
            subtitle: 'Single-neuron forward pass with sigmoid activation.',
            steps,
        };
    }

    function buildModel(algorithmType, payload) {
        const normalized = String(algorithmType || '').trim().toLowerCase();
        if (!SUPPORTED_ALGORITHMS.has(normalized)) {
            return null;
        }

        const builders = {
            knapsack: buildKnapsackModel,
            lcs: buildLcsModel,
            activity_selection: buildActivitySelectionModel,
            backtracking: buildBacktrackingModel,
            recursion: buildRecursionModel,
            bit_conversion: buildBitConversionModel,
            math_algorithm: buildMathModel,
            linked_list: buildLinkedListModel,
            doubly_linked_list: buildDoublyLinkedListModel,
            circular_linked_list: buildCircularLinkedListModel,
            stack: buildStackModel,
            queue: buildQueueModel,
            array_algorithm: buildArrayAlgorithmModel,
            hashing_algorithm: buildHashingAlgorithmModel,
            bst: buildBstModel,
            bubble_sort: (payload) => buildSortingModel(payload, 'bubble_sort'),
            selection_sort: (payload) => buildSortingModel(payload, 'selection_sort'),
            insertion_sort: (payload) => buildSortingModel(payload, 'insertion_sort'),
            merge_sort: (payload) => buildSortingModel(payload, 'merge_sort'),
            quick_sort: (payload) => buildSortingModel(payload, 'quick_sort'),
            heap_sort: (payload) => buildSortingModel(payload, 'heap_sort'),
            linear_search: buildLinearSearchModel,
            binary_search: buildBinarySearchModel,
            bfs: (payload) => buildGraphTraversalModel(payload, 'bfs'),
            dfs: (payload) => buildGraphTraversalModel(payload, 'dfs'),
            dijkstra: buildDijkstraModel,
            astar: buildAstarModel,
            minimax: buildMinimaxModel,
            string_algorithm: buildStringAlgorithmModel,
            linear_regression: buildLinearRegressionModel,
            logistic_regression: buildLogisticRegressionModel,
            kmeans: buildKmeansModel,
            knn: buildKnnModel,
            decision_tree: buildDecisionTreeModel,
            naive_bayes: buildNaiveBayesModel,
            neural_network: buildNeuralNetworkModel,
        };
        const builder = builders[normalized];
        const model = builder ? builder(payload || {}) : null;
        if (!model) {
            return null;
        }
        model.visualPrompt = buildVisualizationPrompt(normalized, payload || {});
        return model;
    }

    function renderPlayer(container, model) {
        const steps = Array.isArray(model.steps) ? model.steps : [];
        if (!steps.length) {
            return false;
        }

        container.innerHTML = `
            <section class="exec-shell mb-3">
                <header class="exec-header">
                    <div>
                        <h5 class="exec-title mb-1">${escapeHtml(model.title || 'Execution Visualization')}</h5>
                        <p class="exec-subtitle mb-0">${escapeHtml(model.subtitle || '')}</p>
                    </div>
                    <div class="exec-badge" id="execProgressBadge">Step 1 / ${steps.length}</div>
                </header>
                ${model.visualPrompt ? `
                    <section class="exec-prompt-box">
                        <h6 class="concept-section-title mb-1">Visualization Prompt</h6>
                        <p class="exec-prompt-text mb-0">${escapeHtml(model.visualPrompt)}</p>
                    </section>
                ` : ''}
                <section class="exec-hud">
                    <div class="exec-hud-row">
                        <div class="exec-stat">
                            <span class="exec-stat-label">XP</span>
                            <strong class="exec-stat-value" id="execXpValue">0</strong>
                        </div>
                        <div class="exec-stat">
                            <span class="exec-stat-label">Streak</span>
                            <strong class="exec-stat-value" id="execStreakValue">x0</strong>
                        </div>
                        <div class="exec-stat">
                            <span class="exec-stat-label">Rank</span>
                            <strong class="exec-stat-value" id="execRankValue">Rookie</strong>
                        </div>
                    </div>
                    <div class="exec-xp-track" aria-label="Progress">
                        <span class="exec-xp-fill" id="execXpFill" style="width: 0%;"></span>
                    </div>
                    <div class="exec-mission" id="execMissionText">Mission: Complete all steps to master this algorithm.</div>
                    <div class="exec-achievements" id="execAchievements"></div>
                </section>
                <div class="visualization-controls exec-controls">
                    <div class="control-group">
                        <button type="button" class="viz-btn viz-btn-start" id="execPlayBtn"><i class="bi bi-play-fill"></i> Play</button>
                        <button type="button" class="viz-btn viz-btn-pause" id="execPauseBtn" disabled><i class="bi bi-pause-fill"></i> Pause</button>
                        <button type="button" class="viz-btn viz-btn-reset" id="execPrevBtn"><i class="bi bi-chevron-left"></i> Prev</button>
                        <button type="button" class="viz-btn viz-btn-reset" id="execNextBtn">Next <i class="bi bi-chevron-right"></i></button>
                        <button type="button" class="viz-btn viz-btn-reset" id="execResetBtn"><i class="bi bi-arrow-clockwise"></i> Reset</button>
                    </div>
                    <div class="control-group ms-auto">
                        <label for="execSpeedControl"><i class="bi bi-speedometer2 me-1"></i> Speed:</label>
                        <input type="range" id="execSpeedControl" min="200" max="1400" value="800" step="100">
                        <span class="speed-indicator" id="execSpeedIndicator">Normal</span>
                    </div>
                </div>
                <div class="exec-body">
                    <div class="exec-step-title" id="execStepTitle"></div>
                    <div class="exec-step-details" id="execStepDetails"></div>
                    <div class="exec-panels">
                        <section class="exec-panel">
                            <h6 class="concept-section-title">State Snapshot</h6>
                            <div id="execStatePanel"></div>
                        </section>
                        <section class="exec-panel">
                            <h6 class="concept-section-title">Formula / Rule</h6>
                            <div id="execFormulaPanel"></div>
                        </section>
                    </div>
                </div>
            </section>
        `;

        const playBtn = container.querySelector('#execPlayBtn');
        const pauseBtn = container.querySelector('#execPauseBtn');
        const prevBtn = container.querySelector('#execPrevBtn');
        const nextBtn = container.querySelector('#execNextBtn');
        const resetBtn = container.querySelector('#execResetBtn');
        const speedControl = container.querySelector('#execSpeedControl');
        const speedIndicator = container.querySelector('#execSpeedIndicator');
        const progressBadge = container.querySelector('#execProgressBadge');
        const stepTitle = container.querySelector('#execStepTitle');
        const stepDetails = container.querySelector('#execStepDetails');
        const statePanel = container.querySelector('#execStatePanel');
        const formulaPanel = container.querySelector('#execFormulaPanel');
        const xpValue = container.querySelector('#execXpValue');
        const streakValue = container.querySelector('#execStreakValue');
        const rankValue = container.querySelector('#execRankValue');
        const xpFill = container.querySelector('#execXpFill');
        const missionText = container.querySelector('#execMissionText');
        const achievements = container.querySelector('#execAchievements');

        let stepIndex = 0;
        let autoplayTimer = null;
        let intervalMs = 800;
        let score = 0;
        let streak = 0;
        let maxReached = 0;
        let completed = false;
        const unlocked = new Set();

        function speedLabel(ms) {
            if (ms <= 400) return 'Fast';
            if (ms <= 900) return 'Normal';
            return 'Slow';
        }

        function clamp01(value) {
            return Math.max(0, Math.min(1, value));
        }

        function progressRatio() {
            return clamp01((stepIndex + 1) / steps.length);
        }

        function rankByProgress() {
            const ratio = progressRatio();
            if (ratio >= 1) return 'Grandmaster';
            if (ratio >= 0.75) return 'Expert';
            if (ratio >= 0.5) return 'Challenger';
            if (ratio >= 0.25) return 'Apprentice';
            return 'Rookie';
        }

        function addAchievement(code, label) {
            if (!unlocked.has(code)) {
                unlocked.add(code);
                if (achievements) {
                    const chip = document.createElement('span');
                    chip.className = 'exec-achievement';
                    chip.textContent = label;
                    achievements.appendChild(chip);
                }
            }
        }

        function awardForNewProgress() {
            if (stepIndex > maxReached) {
                maxReached = stepIndex;
                streak += 1;
                const base = 10;
                const comboBonus = Math.min(20, streak * 2);
                score += base + comboBonus;
                if (stepIndex >= steps.length - 1) {
                    completed = true;
                    score += 50;
                }
            }
        }

        function refreshHud() {
            const ratio = progressRatio();
            const rank = rankByProgress();
            if (xpValue) xpValue.textContent = String(score);
            if (streakValue) streakValue.textContent = `x${streak}`;
            if (rankValue) rankValue.textContent = rank;
            if (xpFill) xpFill.style.width = `${Math.round(ratio * 100)}%`;
            if (missionText) {
                if (completed) {
                    missionText.textContent = 'Mission Complete: You cleared every execution step.';
                } else if (streak >= 5) {
                    missionText.textContent = 'Combo Active: Keep momentum and finish the trace.';
                } else {
                    missionText.textContent = `Mission: Reach step ${steps.length} and unlock Grandmaster rank.`;
                }
            }

            if (ratio >= 0.25) addAchievement('q1', 'Quarter Done');
            if (ratio >= 0.5) addAchievement('q2', 'Halfway Hero');
            if (ratio >= 0.75) addAchievement('q3', 'Final Stretch');
            if (ratio >= 1) addAchievement('q4', 'Execution Master');
            if (streak >= 3) addAchievement('combo3', 'Combo x3');
            if (streak >= 6) addAchievement('combo6', 'Combo x6');
        }

        function stopAutoplay() {
            if (autoplayTimer) {
                window.clearInterval(autoplayTimer);
                autoplayTimer = null;
            }
            if (playBtn) playBtn.disabled = false;
            if (pauseBtn) pauseBtn.disabled = true;
        }

        function renderStep() {
            const current = steps[stepIndex];
            if (!current) {
                return;
            }
            awardForNewProgress();
            if (progressBadge) {
                progressBadge.textContent = `Step ${stepIndex + 1} / ${steps.length}`;
            }
            if (stepTitle) {
                stepTitle.textContent = current.step || `Step ${stepIndex + 1}`;
            }
            if (stepDetails) {
                stepDetails.textContent = current.details || '';
            }
            if (statePanel) {
                statePanel.innerHTML = current.stateHtml || '<p class="concept-muted mb-0">No state data.</p>';
            }
            if (formulaPanel) {
                formulaPanel.innerHTML = current.formulaHtml || '<p class="concept-muted mb-0">No formula for this step.</p>';
            }
            refreshHud();
        }

        function nextStep() {
            if (stepIndex >= steps.length - 1) {
                stopAutoplay();
                return;
            }
            stepIndex += 1;
            renderStep();
        }

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (autoplayTimer) {
                    return;
                }
                autoplayTimer = window.setInterval(nextStep, intervalMs);
                playBtn.disabled = true;
                if (pauseBtn) pauseBtn.disabled = false;
            });
        }
        if (pauseBtn) {
            pauseBtn.addEventListener('click', stopAutoplay);
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                stopAutoplay();
                stepIndex = Math.max(0, stepIndex - 1);
                renderStep();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                stopAutoplay();
                nextStep();
            });
        }
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                stopAutoplay();
                stepIndex = 0;
                streak = 0;
                renderStep();
            });
        }
        if (speedControl) {
            speedControl.addEventListener('input', () => {
                intervalMs = Number(speedControl.value);
                if (speedIndicator) {
                    speedIndicator.textContent = speedLabel(intervalMs);
                }
                if (autoplayTimer) {
                    stopAutoplay();
                    autoplayTimer = window.setInterval(nextStep, intervalMs);
                    if (playBtn) playBtn.disabled = true;
                    if (pauseBtn) pauseBtn.disabled = false;
                }
            });
        }
        if (speedIndicator) {
            speedIndicator.textContent = speedLabel(intervalMs);
        }
        addAchievement('start', 'Mission Started');

        renderStep();
        return true;
    }

    function renderExecutionVisualization(containerId, algorithmType, payload) {
        const container = document.getElementById(containerId);
        if (!container) {
            return false;
        }
        const model = buildModel(algorithmType, payload);
        if (!model) {
            return false;
        }
        return renderPlayer(container, model);
    }

    window.hasExecutionVisualizationSupport = function hasExecutionVisualizationSupport(algorithmType) {
        const normalized = String(algorithmType || '').trim().toLowerCase();
        return SUPPORTED_ALGORITHMS.has(normalized);
    };
    window.renderExecutionVisualization = renderExecutionVisualization;
})();
