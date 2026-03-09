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

    function render3DScene(svgBody, width, height, ariaLabel, sceneClass = '', svgInlineStyle = '') {
        const extraClass = sceneClass ? ` ${sceneClass}` : '';
        const svgStyleAttr = svgInlineStyle ? ` style="${escapeHtml(svgInlineStyle)}"` : '';
        const safeLabel = escapeHtml(ariaLabel || '3D execution visualization');
        return `
            <div class="exec-diagram-wrap exec-3d-scene${extraClass}">
                <div class="exec-3d-chrome">
                    <div class="exec-3d-chrome-head" aria-hidden="true">
                        <span class="exec-3d-kicker">MISSION CONTROL</span>
                        <span class="exec-3d-caption">${safeLabel}</span>
                    </div>
                    <svg class="exec-svg exec-svg-3d" viewBox="0 0 ${width} ${height}" role="img" aria-label="${safeLabel}"${svgStyleAttr}>
                        ${svgBody}
                    </svg>
                </div>
            </div>
        `;
    }

    function renderIndexedStrip3D(values, highlightSet = new Set(), currentSet = new Set(), indexLabel = 'idx') {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 164 : 176;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execStrip${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.05)"></stop>
                    <stop offset="45%" stop-color="rgba(59,130,246,0.2)"></stop>
                    <stop offset="100%" stop-color="rgba(16,185,129,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.85"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.7"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const isHighlight = highlightSet.has(idx);
            const isCurrent = currentSet.has(idx);
            const front = isCurrent ? '#fde047' : (isHighlight ? '#86efac' : '#dbeafe');
            const top = isCurrent ? '#fef3c7' : (isHighlight ? '#dcfce7' : '#eff6ff');
            const side = isCurrent ? '#d97706' : (isHighlight ? '#16a34a' : '#2563eb');
            const stroke = isCurrent ? '#92400e' : (isHighlight ? '#166534' : '#1e3a8a');
            const tag = isCurrent ? 'focus' : (isHighlight ? 'window' : '');
            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${front}" stroke="${stroke}" stroke-width="${isCurrent ? '2.9' : (isHighlight ? '2.1' : '1.7')}"></rect>
                    ${tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${isCurrent ? '#f59e0b' : '#22c55e'}"></rect>` : ''}
                    ${tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${escapeHtml(tag.toUpperCase())}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text class="exec-3d-index-text" x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">${escapeHtml(indexLabel)} ${idx}</text>
                </g>
            `;
        }).join('');

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D State Board</text>
                <rect x="${width - 186}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 172}" y="${topPad - 5}" font-size="9.5" fill="#334155">Node</text>
                <rect x="${width - 126}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#86efac" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 112}" y="${topPad - 5}" font-size="9.5" fill="#334155">Window</text>
                <rect x="${width - 62}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde047" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 48}" y="${topPad - 5}" font-size="9.5" fill="#334155">Focus</text>
            </g>
        `;

        return render3DScene(`${defs}${floor}${legend}${cells}`, width, height, '3D array strip', 'exec-3d-strip');
    }

    function renderEuclidState3D(a, b, remainder = null) {
        const values = [a, b];
        const labels = ['a', 'b'];
        if (Number.isFinite(remainder)) {
            values.push(remainder);
            labels.push('r');
        }
        const cardWidth = 98;
        const gap = 16;
        const left = 36;
        const top = 36;
        const depth = 12;
        const width = Math.max(420, left * 2 + (values.length * (cardWidth + gap)) - gap);
        const height = 164;
        const cards = values.map((value, idx) => {
            const x = left + (idx * (cardWidth + gap));
            const palette = idx === 2
                ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e' }
                : idx === 1
                    ? { front: '#bfdbfe', top: '#dbeafe', side: '#2563eb', stroke: '#1e3a8a' }
                    : { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534' };
            return `
                <g>
                    <polygon points="${x},${top} ${x + depth},${top - depth} ${x + cardWidth + depth},${top - depth} ${x + cardWidth},${top}" fill="${palette.top}"></polygon>
                    <polygon points="${x + cardWidth},${top} ${x + cardWidth + depth},${top - depth} ${x + cardWidth + depth},${top + 64 - depth} ${x + cardWidth},${top + 64}" fill="${palette.side}" opacity="0.94"></polygon>
                    <rect x="${x}" y="${top}" width="${cardWidth}" height="64" rx="12" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="2"></rect>
                    <text x="${x + (cardWidth / 2)}" y="${top + 22}" text-anchor="middle" font-size="11" fill="#334155">${labels[idx]}</text>
                    <text x="${x + (cardWidth / 2)}" y="${top + 44}" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                </g>
            `;
        }).join('');
        return render3DScene(cards, width, height, 'Euclidean algorithm state');
    }

    function renderWordRail3D(words, activeIndex = -1, prefix = '') {
        if (!Array.isArray(words) || !words.length) {
            return '<p class="concept-muted mb-0">Words unavailable.</p>';
        }

        const normalizedWords = words.map((word) => String(word || ''));
        const probe = String(prefix || '');
        const maxWordLength = Math.max(1, probe.length, ...normalizedWords.map((word) => word.length));
        const charStep = 12;
        const cardWidth = Math.max(220, Math.min(560, 92 + (maxWordLength * charStep)));
        const rowHeight = 58;
        const left = 24;
        const top = 44;
        const depth = 8;
        const sidePanelWidth = 250;
        const width = Math.max(640, left * 2 + cardWidth + sidePanelWidth);
        const height = Math.max(218, top + 28 + (normalizedWords.length * (rowHeight + 10)) + 34);

        function sharedPrefixLength(word, candidate) {
            let idx = 0;
            const limit = Math.min(word.length, candidate.length);
            while (idx < limit && word.charAt(idx) === candidate.charAt(idx)) {
                idx += 1;
            }
            return idx;
        }

        const rulerCount = Math.min(maxWordLength, 30);
        const ruler = `
            <g>
                <text x="${left + 6}" y="${top - 14}" font-size="10.2" fill="#475569">char idx</text>
                ${Array.from({ length: rulerCount }, (_, idx) => `
                    <text x="${left + 56 + (idx * charStep)}" y="${top - 14}" font-size="9.8" fill="#64748b">${idx}</text>
                `).join('')}
            </g>
        `;

        const rows = normalizedWords.map((word, idx) => {
            const y = top + (idx * (rowHeight + 10));
            const isActive = idx === activeIndex;
            const matchedLength = sharedPrefixLength(word, probe);
            const fullyMatches = probe.length === 0 ? false : matchedLength === probe.length;

            const base = isActive ? '#fef3c7' : (fullyMatches ? '#dcfce7' : '#e2e8f0');
            const side = isActive ? '#d97706' : (fullyMatches ? '#16a34a' : '#64748b');
            const topColor = isActive ? '#fde68a' : (fullyMatches ? '#bbf7d0' : '#f8fafc');
            const stroke = isActive ? '#92400e' : (fullyMatches ? '#166534' : '#334155');
            const statusLabel = probe.length === 0
                ? 'await candidate'
                : (fullyMatches ? `match ${matchedLength}/${probe.length}` : `break @ ${matchedLength}`);

            return `
                <g>
                    <polygon points="${left},${y} ${left + depth},${y - depth} ${left + cardWidth + depth},${y - depth} ${left + cardWidth},${y}" fill="${topColor}"></polygon>
                    <polygon points="${left + cardWidth},${y} ${left + cardWidth + depth},${y - depth} ${left + cardWidth + depth},${y + rowHeight - depth} ${left + cardWidth},${y + rowHeight}" fill="${side}" opacity="0.95"></polygon>
                    <rect x="${left}" y="${y}" width="${cardWidth}" height="${rowHeight}" rx="10" fill="${base}" stroke="${stroke}" stroke-width="${isActive ? '2.5' : '1.7'}"></rect>
                    <text x="${left + 10}" y="${y + 20}" font-size="10.8" fill="#475569">W${idx + 1}</text>
                    ${probe.length
                        ? `
                            <text x="${left + 56}" y="${y + 24}" font-size="12.7" font-weight="700">
                                <tspan fill="#0f172a">${escapeHtml(word.slice(0, matchedLength))}</tspan>
                                <tspan fill="${fullyMatches ? '#64748b' : '#b91c1c'}">${escapeHtml(word.slice(matchedLength))}</tspan>
                            </text>
                        `
                        : `<text x="${left + 56}" y="${y + 24}" font-size="12.7" font-weight="700" fill="#0f172a">${escapeHtml(word)}</text>`
                    }
                    <text x="${left + 56}" y="${y + 44}" font-size="10.6" fill="${fullyMatches ? '#166534' : '#64748b'}">${escapeHtml(statusLabel)}</text>
                </g>
            `;
        }).join('');

        const prefixBadge = `
            <g>
                <rect x="${left + cardWidth + 32}" y="${top + 2}" width="220" height="64" rx="12" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.8"></rect>
                <text x="${left + cardWidth + 46}" y="${top + 24}" font-size="11" fill="#1e3a8a">Candidate Prefix</text>
                <text x="${left + cardWidth + 46}" y="${top + 42}" font-size="14" font-weight="700" fill="#0f172a">${escapeHtml(probe || '(empty)')}</text>
                <text x="${left + cardWidth + 46}" y="${top + 56}" font-size="10.2" fill="#1e3a8a">len = ${probe.length}</text>
            </g>
        `;

        const axes = `
            <g>
                <text x="${left + cardWidth + 32}" y="${top + 92}" font-size="10.6" fill="#475569">X: character index</text>
                <text x="${left + cardWidth + 32}" y="${top + 108}" font-size="10.6" fill="#475569">Y: word row (W1..Wn)</text>
                <text x="${left + cardWidth + 32}" y="${top + 124}" font-size="10.6" fill="#475569">Z: depth cue (3D tilt)</text>
            </g>
        `;

        return render3DScene(`${ruler}${rows}${prefixBadge}${axes}`, width, height, 'Word comparison rail');
    }

    function renderStackState3D(state, activeIndex = null) {
        const values = Array.isArray(state) ? state : [];
        const cardWidth = 146;
        const cardHeight = 34;
        const depth = 8;
        const gap = 8;
        const left = 120;
        const width = 420;
        const levelCount = Math.max(1, values.length);
        const height = Math.max(236, 50 + (levelCount * (cardHeight + gap)) + 62);
        const baseY = height - 42;
        const frameTop = baseY - Math.max(cardHeight + 14, (values.length * (cardHeight + gap)) + 14);
        const frameHeight = baseY - frameTop + 8;
        const frame = `
            <g>
                <rect x="${left - 10}" y="${frameTop}" width="${cardWidth + 20}" height="${frameHeight}" rx="12" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"></rect>
                <rect x="${left - 14}" y="${baseY + 5}" width="${cardWidth + 28}" height="10" rx="5" fill="#cbd5e1"></rect>
                <text x="${left + (cardWidth / 2)}" y="${frameTop - 10}" text-anchor="middle" font-size="10.5" fill="#475569">STACK FRAME</text>
            </g>
        `;

        const cards = values.map((value, idx) => {
            const visualOrder = values.length - 1 - idx;
            const y = baseY - ((visualOrder + 1) * (cardHeight + gap));
            const isTop = idx === values.length - 1;
            const isActive = activeIndex === idx;
            const front = isActive ? '#fde68a' : (isTop ? '#bbf7d0' : '#dbeafe');
            const top = isActive ? '#fef3c7' : (isTop ? '#dcfce7' : '#eff6ff');
            const side = isActive ? '#ca8a04' : (isTop ? '#16a34a' : '#2563eb');
            const stroke = isActive ? '#92400e' : (isTop ? '#166534' : '#1e3a8a');
            return `
                <g>
                    <polygon points="${left},${y} ${left + depth},${y - depth} ${left + cardWidth + depth},${y - depth} ${left + cardWidth},${y}" fill="${top}"></polygon>
                    <polygon points="${left + cardWidth},${y} ${left + cardWidth + depth},${y - depth} ${left + cardWidth + depth},${y + cardHeight - depth} ${left + cardWidth},${y + cardHeight}" fill="${side}" opacity="0.95"></polygon>
                    <rect x="${left}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="9" fill="${front}" stroke="${stroke}" stroke-width="${isActive ? '2.5' : '1.7'}"></rect>
                    <text x="${left + 10}" y="${y + 20}" font-size="10.5" fill="#475569">${isTop ? 'TOP' : `idx ${idx}`}</text>
                    <text x="${left + (cardWidth / 2)}" y="${y + 22}" text-anchor="middle" font-size="12.8" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                </g>
            `;
        }).join('');

        const labels = `
            <text x="${left + cardWidth + 24}" y="${frameTop + 16}" font-size="10.5" fill="#64748b">Top grows upward</text>
            <text x="${left + cardWidth + 24}" y="${baseY - 2}" font-size="10.5" fill="#64748b">Bottom (idx 0)</text>
            ${!values.length
                ? `<text x="${left + (cardWidth / 2)}" y="${baseY - 18}" text-anchor="middle" font-size="12" fill="#64748b">EMPTY STACK</text>`
                : ''}
        `;
        return render3DScene(`${frame}${cards}${labels}`, width, height, '3D stack state', 'exec-3d-strip');
    }

    function renderQueueState3D(state, activeIndex = null) {
        const values = Array.isArray(state) ? state : [];
        const cellWidth = 86;
        const cellHeight = 40;
        const gap = 12;
        const depth = 8;
        const left = 28;
        const top = 68;
        const cellSpan = Math.max(1, values.length);
        const trackWidth = (cellSpan * (cellWidth + gap)) - gap;
        const width = Math.max(460, left * 2 + trackWidth + 8);
        const height = 182;
        const rail = `
            <g>
                <rect x="${left - 10}" y="${top + cellHeight + 10}" width="${trackWidth + 20}" height="12" rx="6" fill="#cbd5e1"></rect>
                <text x="${left - 2}" y="${top - 22}" font-size="10.8" fill="#64748b">FRONT</text>
                <text x="${left + trackWidth - 34}" y="${top - 22}" font-size="10.8" fill="#64748b">REAR</text>
            </g>
        `;
        const cells = values.map((value, idx) => {
            const x = left + (idx * (cellWidth + gap));
            const isActive = activeIndex === idx;
            const isFront = idx === 0;
            const isRear = idx === values.length - 1;
            const front = isActive
                ? '#fde68a'
                : (isFront ? '#bbf7d0' : (isRear ? '#ede9fe' : '#dbeafe'));
            const topColor = isActive
                ? '#fef3c7'
                : (isFront ? '#dcfce7' : (isRear ? '#f5f3ff' : '#eff6ff'));
            const side = isActive
                ? '#ca8a04'
                : (isFront ? '#16a34a' : (isRear ? '#7c3aed' : '#2563eb'));
            const stroke = isActive
                ? '#92400e'
                : (isFront ? '#166534' : (isRear ? '#5b21b6' : '#1e3a8a'));
            const tag = isFront ? 'FRONT' : (isRear ? 'REAR' : `idx ${idx}`);
            return `
                <g>
                    <polygon points="${x},${top} ${x + depth},${top - depth} ${x + cellWidth + depth},${top - depth} ${x + cellWidth},${top}" fill="${topColor}"></polygon>
                    <polygon points="${x + cellWidth},${top} ${x + cellWidth + depth},${top - depth} ${x + cellWidth + depth},${top + cellHeight - depth} ${x + cellWidth},${top + cellHeight}" fill="${side}" opacity="0.95"></polygon>
                    <rect x="${x}" y="${top}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${front}" stroke="${stroke}" stroke-width="${isActive ? '2.4' : '1.7'}"></rect>
                    <text x="${x + (cellWidth / 2)}" y="${top + 23}" text-anchor="middle" font-size="12.8" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${top + 56}" text-anchor="middle" font-size="10.4" fill="#64748b">${tag}</text>
                </g>
            `;
        }).join('');
        const emptyState = !values.length
            ? `<text x="${Math.round(width / 2)}" y="${top + 22}" text-anchor="middle" font-size="12" fill="#64748b">EMPTY QUEUE</text>`
            : '';
        return render3DScene(`${rail}${cells}${emptyState}`, width, height, '3D queue state', 'exec-3d-strip');
    }

    function renderHashBuckets3D(seenMap, highlightArg = null) {
        const options = highlightArg && typeof highlightArg === 'object'
            ? highlightArg
            : { highlightValue: highlightArg };
        const highlightValue = Object.prototype.hasOwnProperty.call(options, 'highlightValue')
            ? options.highlightValue
            : null;
        const probeValue = Number.isFinite(Number(options.probeValue)) ? Number(options.probeValue) : null;
        const complementValue = Number.isFinite(Number(options.complementValue)) ? Number(options.complementValue) : null;
        const bucketFor = (value, bucketCount) => Math.abs(Math.floor(Number(value))) % bucketCount;

        const buckets = Array.from({ length: 6 }, () => []);
        if (seenMap instanceof Map) {
            seenMap.forEach((idx, value) => {
                const bucketIndex = bucketFor(value, buckets.length);
                buckets[bucketIndex].push({ value, idx });
            });
        }
        const bucketWidth = 214;
        const bucketHeight = 34;
        const left = 24;
        const top = 28;
        const gapY = 14;
        const depth = 8;
        const rightPanelWidth = 246;
        const width = 560;
        const height = 330;
        const rows = buckets.map((bucket, bucketIndex) => {
            const y = top + (bucketIndex * (bucketHeight + gapY));
            const line = bucket.length
                ? bucket.map((entry, chainIdx) => `[#${chainIdx}]${formatNumber(entry.value)}@${entry.idx}`).join('  ')
                : '-';
            const hasHighlightValue = highlightValue !== null && bucket.some((entry) => entry.value === highlightValue);
            const probeBucket = probeValue === null ? null : bucketFor(probeValue, buckets.length);
            const complementBucket = complementValue === null ? null : bucketFor(complementValue, buckets.length);
            const hasProbeBucket = probeBucket !== null && probeBucket === bucketIndex;
            const hasComplementBucket = complementBucket !== null && complementBucket === bucketIndex;
            const hasHighlight = hasHighlightValue || hasProbeBucket || hasComplementBucket;
            const front = hasHighlight ? '#fde68a' : '#e2e8f0';
            const topColor = hasHighlight ? '#fef3c7' : '#f8fafc';
            const side = hasHighlight ? '#ca8a04' : '#64748b';
            const stroke = hasHighlight ? '#92400e' : '#334155';
            const countLabel = `${bucket.length} item${bucket.length === 1 ? '' : 's'}`;
            return `
                <g>
                    <polygon points="${left},${y} ${left + depth},${y - depth} ${left + bucketWidth + depth},${y - depth} ${left + bucketWidth},${y}" fill="${topColor}"></polygon>
                    <polygon points="${left + bucketWidth},${y} ${left + bucketWidth + depth},${y - depth} ${left + bucketWidth + depth},${y + bucketHeight - depth} ${left + bucketWidth},${y + bucketHeight}" fill="${side}"></polygon>
                    <rect x="${left}" y="${y}" width="${bucketWidth}" height="${bucketHeight}" rx="8" fill="${front}" stroke="${stroke}" stroke-width="${hasHighlight ? '2.2' : '1.5'}"></rect>
                    <text x="${left + 10}" y="${y + 21}" font-size="11" fill="#334155">b${bucketIndex}</text>
                    <text x="${left + 34}" y="${y + 21}" font-size="10.4" fill="#475569">${escapeHtml(countLabel)}</text>
                    <text x="${left + 102}" y="${y + 21}" font-size="11.2" fill="#0f172a">${escapeHtml(line)}</text>
                </g>
            `;
        }).join('');

        const infoX = left + bucketWidth + 36;
        const probeBucketLabel = probeValue === null ? '-' : `b${bucketFor(probeValue, buckets.length)}`;
        const complementBucketLabel = complementValue === null ? '-' : `b${bucketFor(complementValue, buckets.length)}`;
        const infoPanel = `
            <g>
                <rect x="${infoX}" y="${top + 2}" width="${rightPanelWidth}" height="118" rx="11" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.6"></rect>
                <text x="${infoX + 12}" y="${top + 24}" font-size="10.6" fill="#1e3a8a">Hash Rule</text>
                <text x="${infoX + 12}" y="${top + 42}" font-size="11.4" font-weight="700" fill="#0f172a">bucket = |floor(value)| mod 6</text>
                <text x="${infoX + 12}" y="${top + 62}" font-size="10.8" fill="#1e3a8a">probe value: ${probeValue === null ? '-' : formatNumber(probeValue)} -> ${probeBucketLabel}</text>
                <text x="${infoX + 12}" y="${top + 80}" font-size="10.8" fill="#1e3a8a">complement: ${complementValue === null ? '-' : formatNumber(complementValue)} -> ${complementBucketLabel}</text>
                <text x="${infoX + 12}" y="${top + 98}" font-size="10.2" fill="#334155">X: bucket id | Y: chain slots | Z: depth cue</text>
            </g>
        `;

        return render3DScene(`${rows}${infoPanel}`, width, height, 'Hash bucket state');
    }

    function renderIndexedStrip(values, highlightSet = new Set()) {
        return renderIndexedStrip3D(values, highlightSet, new Set());
    }

    function renderLinkedListDiagram3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Linked list unavailable.</p>';
        }
        const mode = String(options.mode || 'singly');
        const currentIndex = Number.isInteger(options.currentIndex) ? options.currentIndex : null;
        const matchedIndex = Number.isInteger(options.matchedIndex) ? options.matchedIndex : null;
        const startIndex = Number.isInteger(options.startIndex) ? options.startIndex : null;
        const visitedSet = options.visitedSet instanceof Set ? options.visitedSet : new Set();
        const spacing = values.length > 9 ? 122 : (mode === 'doubly' ? 142 : 132);
        const nodeWidth = mode === 'doubly' ? 94 : 92;
        const nodeHeight = 52;
        const pointerSlotWidth = mode === 'doubly' ? 28 : 26;
        const depth = 10;
        const pad = mode === 'doubly' ? 76 : 44;
        const trailingScenePad = mode === 'circular' ? 212 : 152;
        const width = Math.max(560, (pad * 2) + ((values.length - 1) * spacing) + nodeWidth + trailingScenePad);
        const baseY = mode === 'circular' ? 96 : 78;
        const height = mode === 'circular' ? 268 : 216;
        const pointerDivider = nodeWidth - pointerSlotWidth;
        const nextPortY = mode === 'doubly' ? baseY + 16 : baseY + 26;
        const prevPortY = baseY + 40;
        const linkCurveX = Math.max(36, Math.floor(spacing * 0.38));
        const linkCurveUp = mode === 'doubly' ? 24 : 22;
        const linkCurveDown = 24;
        const markerNonce = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000000).toString(36)}`;
        const markerScope = `${mode}-${values.length}-${currentIndex ?? 'n'}-${matchedIndex ?? 'n'}-${startIndex ?? 'n'}-${markerNonce}`
            .replace(/[^a-z0-9_-]/gi, '');
        const nextMarkerId = `exec3d-next-${markerScope}`;
        const prevMarkerId = `exec3d-prev-${markerScope}`;

        function paletteFor(idx) {
            if (idx === matchedIndex) {
                return { front: '#86efac', top: '#bbf7d0', side: '#16a34a', stroke: '#166534' };
            }
            if (idx === currentIndex) {
                return { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e' };
            }
            if (visitedSet.has(idx)) {
                return { front: '#bfdbfe', top: '#dbeafe', side: '#2563eb', stroke: '#1e3a8a' };
            }
            return { front: '#e2e8f0', top: '#f8fafc', side: '#64748b', stroke: '#334155' };
        }

        const deckTop = baseY + nodeHeight + 24;
        const deck = `
            <ellipse cx="${width / 2}" cy="${deckTop + 15}" rx="${Math.max(140, (width / 2) - 52)}" ry="14" fill="var(--exec-ll-shadow)" opacity="0.48"></ellipse>
            <polygon
                points="${pad - 24},${deckTop} ${pad - 12},${deckTop - depth} ${width - pad + 22},${deckTop - depth} ${width - pad + 10},${deckTop}"
                fill="var(--exec-ll-floor)"
                stroke="var(--exec-ll-floor-stroke)"
                stroke-width="1.2"
            ></polygon>
        `;

        const markers = `
            <defs>
                <marker id="${nextMarkerId}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                    <path d="M0,0 L10,5 L0,10 z" fill="#1D4ED8"></path>
                </marker>
                <marker id="${prevMarkerId}" markerWidth="10" markerHeight="10" refX="1" refY="5" orient="auto">
                    <path d="M10,0 L0,5 L10,10 z" fill="#0D9488"></path>
                </marker>
            </defs>
        `;

        const edges = [];
        for (let idx = 0; idx < values.length - 1; idx += 1) {
            const currentNodeX = pad + (idx * spacing);
            const nextNodeX = pad + ((idx + 1) * spacing);
            const nextStartX = currentNodeX + nodeWidth - 1.5;
            const nextEndX = nextNodeX + 1.5;
            edges.push(`
                <path class="exec-ll-next-path" d="M ${nextStartX} ${nextPortY} C ${nextStartX + linkCurveX} ${nextPortY - linkCurveUp}, ${nextEndX - linkCurveX} ${nextPortY - linkCurveUp}, ${nextEndX} ${nextPortY}"
                    fill="none" stroke="#1D4ED8" stroke-width="${mode === 'doubly' ? '2.35' : '2.5'}" marker-end="url(#${nextMarkerId})"></path>
            `);
            if (mode === 'doubly') {
                const prevStartX = nextNodeX + 1.5;
                const prevEndX = currentNodeX + 1.5;
                edges.push(`
                    <path class="exec-ll-prev-path" d="M ${prevStartX} ${prevPortY} C ${prevStartX - linkCurveX} ${prevPortY + linkCurveDown}, ${prevEndX + linkCurveX} ${prevPortY + linkCurveDown}, ${prevEndX} ${prevPortY}"
                        fill="none" stroke="#0D9488" stroke-width="2.35" marker-end="url(#${prevMarkerId})"></path>
                `);
            }
        }

        const nullNodes = [];
        if (mode !== 'circular') {
            const rightNullX = pad + ((values.length - 1) * spacing) + nodeWidth + 46;
            const rightNullEntryX = rightNullX + 1;
            const rightNullEntryY = baseY + 26;
            nullNodes.push(`
                <g>
                    <rect x="${rightNullX}" y="${baseY + 14}" width="52" height="24" rx="7" fill="var(--exec-ll-null-bg)" stroke="var(--exec-ll-null-stroke)" stroke-width="1.3"></rect>
                    <text x="${rightNullX + 26}" y="${baseY + 30}" text-anchor="middle" font-size="10.5" class="exec-ll-text exec-ll-label">NULL</text>
                </g>
            `);
            edges.push(`
                <path class="exec-ll-next-path" d="M ${pad + ((values.length - 1) * spacing) + nodeWidth - 1.5} ${nextPortY} C ${pad + ((values.length - 1) * spacing) + nodeWidth + (linkCurveX - 6)} ${nextPortY - (linkCurveUp - 3)}, ${rightNullEntryX - (linkCurveX - 10)} ${rightNullEntryY - (linkCurveUp - 8)}, ${rightNullEntryX} ${rightNullEntryY}"
                    fill="none" stroke="#1D4ED8" stroke-width="2.35" marker-end="url(#${nextMarkerId})"></path>
            `);

            if (mode === 'doubly') {
                const leftNullX = Math.max(12, pad - 62);
                const leftNullEntryX = leftNullX + 51;
                nullNodes.push(`
                    <g>
                        <rect x="${leftNullX}" y="${baseY + 14}" width="52" height="24" rx="7" fill="var(--exec-ll-null-bg)" stroke="var(--exec-ll-null-stroke)" stroke-width="1.3"></rect>
                        <text x="${leftNullX + 26}" y="${baseY + 30}" text-anchor="middle" font-size="10.5" class="exec-ll-text exec-ll-label">NULL</text>
                    </g>
                `);
                edges.push(`
                    <path class="exec-ll-prev-path" d="M ${pad + 1.5} ${prevPortY} C ${pad - (linkCurveX - 12)} ${prevPortY + (linkCurveDown - 6)}, ${leftNullEntryX + (linkCurveX - 14)} ${prevPortY + (linkCurveDown - 6)}, ${leftNullEntryX} ${prevPortY}"
                        fill="none" stroke="#0D9488" stroke-width="2.3" marker-end="url(#${prevMarkerId})"></path>
                `);
            }
        }

        if (mode === 'circular' && values.length > 1) {
            const headEntryX = pad + 1.5;
            const tailExitX = pad + ((values.length - 1) * spacing) + nodeWidth - 1.5;
            const wrapLaneY = baseY + nodeHeight + 94;
            edges.push(`
                <path class="exec-ll-wrap-path" d="M ${tailExitX} ${nextPortY} C ${tailExitX + (linkCurveX + 20)} ${wrapLaneY}, ${headEntryX - (linkCurveX + 20)} ${wrapLaneY}, ${headEntryX} ${nextPortY}"
                    fill="none" stroke="#7C3AED" stroke-width="2.55" marker-end="url(#${nextMarkerId})"></path>
            `);
            edges.push(`
                <text x="${(headEntryX + tailExitX) / 2}" y="${wrapLaneY + 12}" text-anchor="middle" font-size="10.7" class="exec-ll-text exec-ll-badge">wrap to head</text>
            `);
        }

        const nodes = values.map((value, idx) => {
            const x = pad + (idx * spacing);
            const y = baseY;
            const palette = paletteFor(idx);
            const rawValue = formatNumber(value);
            const compactValue = rawValue.length > 7 ? Number(value).toExponential(1).replace('+', '') : rawValue;
            const valueFontSize = compactValue.length > 7 ? 11.2 : (compactValue.length > 5 ? 12.6 : 14);
            const valueWidth = nodeWidth - pointerSlotWidth - 14;
            const valueFitAttrs = compactValue.length > 5
                ? ` textLength="${valueWidth}" lengthAdjust="spacingAndGlyphs"`
                : '';
            const isHead = idx === 0;
            const isTail = idx === values.length - 1;
            const badges = [];
            if (startIndex === idx) {
                badges.push({ label: 'START', color: '#7c3aed' });
            } else if (isHead) {
                badges.push({ label: 'HEAD', color: '#2563eb' });
            }
            if (isTail && mode !== 'circular') {
                badges.push({ label: 'TAIL', color: '#0f766e' });
            }

            return `
                <g>
                    <polygon points="${x},${y} ${x + depth},${y - depth} ${x + nodeWidth + depth},${y - depth} ${x + nodeWidth},${y}" fill="${palette.top}"></polygon>
                    <polygon points="${x + nodeWidth},${y} ${x + nodeWidth + depth},${y - depth} ${x + nodeWidth + depth},${y + nodeHeight - depth} ${x + nodeWidth},${y + nodeHeight}" fill="${palette.side}"></polygon>
                    <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${idx === currentIndex ? '2.7' : '1.6'}"></rect>
                    <rect x="${x + pointerDivider}" y="${y + 1}" width="${pointerSlotWidth - 1}" height="${nodeHeight - 2}" rx="8" fill="var(--exec-ll-slot-bg)" stroke="${palette.stroke}" stroke-width="0.8" opacity="0.58"></rect>
                    <line x1="${x + pointerDivider}" y1="${y + 2}" x2="${x + pointerDivider}" y2="${y + nodeHeight - 2}" stroke="${palette.stroke}" stroke-width="1.15" opacity="0.55"></line>
                    <circle cx="${x + nodeWidth - 1.5}" cy="${mode === 'doubly' ? y + 16 : y + 26}" r="2.2" fill="#1D4ED8"></circle>
                    ${mode === 'doubly'
                        ? `<circle cx="${x + 1.5}" cy="${y + 40}" r="2.2" fill="#0D9488"></circle>`
                        : ''}
                    <text x="${x + ((nodeWidth - pointerSlotWidth) / 2)}" y="${y + 31}" text-anchor="middle" font-size="${valueFontSize}" font-weight="700"${valueFitAttrs} class="exec-ll-text exec-ll-value">${escapeHtml(compactValue)}</text>
                    <rect x="${x + 12}" y="${y + nodeHeight + 8}" width="${nodeWidth - pointerSlotWidth - 16}" height="16" rx="8" fill="var(--exec-ll-index-bg)" stroke="var(--exec-ll-index-stroke)" stroke-width="1"></rect>
                    <text x="${x + ((nodeWidth - pointerSlotWidth) / 2)}" y="${y + nodeHeight + 20}" text-anchor="middle" font-size="10.5" class="exec-ll-text exec-ll-label exec-ll-index">idx ${idx}</text>
                    ${mode === 'doubly'
                        ? `
                            <text x="${x + pointerDivider + (pointerSlotWidth / 2)}" y="${y + 20}" text-anchor="middle" font-size="9.2" class="exec-ll-text exec-ll-label">N</text>
                            <text x="${x + pointerDivider + (pointerSlotWidth / 2)}" y="${y + 39}" text-anchor="middle" font-size="9.2" class="exec-ll-text exec-ll-label">P</text>
                        `
                        : `<text x="${x + pointerDivider + (pointerSlotWidth / 2)}" y="${y + 30}" text-anchor="middle" font-size="9.4" class="exec-ll-text exec-ll-label">next</text>`}
                    ${badges.map((badge, badgeIndex) => `
                        <g>
                            <rect x="${x + (badgeIndex * 46)}" y="${y - 20}" width="42" height="15" rx="7" fill="${badge.color}" opacity="0.94"></rect>
                            <text x="${x + 21 + (badgeIndex * 46)}" y="${y - 9}" text-anchor="middle" font-size="9.4" class="exec-ll-text exec-ll-badge">${badge.label}</text>
                        </g>
                    `).join('')}
                </g>
            `;
        }).join('');

        const structureLegend = mode === 'doubly'
            ? `
                <span class="exec-legend-chip"><span class="exec-dot" style="background:#2563eb"></span>next link</span>
                <span class="exec-legend-chip"><span class="exec-dot" style="background:#10b981"></span>prev link</span>
            `
            : (mode === 'circular'
                ? `<span class="exec-legend-chip"><span class="exec-dot" style="background:#7c3aed"></span>circular wrap</span>`
                : `<span class="exec-legend-chip"><span class="exec-dot" style="background:#2563eb"></span>next link</span>`);

        return `
            ${render3DScene(
                `${deck}${markers}${edges.join('')}${nullNodes.join('')}${nodes}`,
                width,
                height,
                '3D linked list diagram',
                `exec-3d-linked${mode === 'circular' ? ' exec-3d-linked-circular' : ''}`,
                `width:${width}px;max-width:none;height:auto;`
            )}
            <div class="exec-legend">
                <span class="exec-legend-chip"><span class="exec-dot exec-dot-current"></span>Current</span>
                <span class="exec-legend-chip"><span class="exec-dot exec-dot-visited"></span>Visited</span>
                <span class="exec-legend-chip"><span class="exec-dot exec-dot-match"></span>Matched</span>
                ${structureLegend}
            </div>
        `;
    }

    function renderMatrix(dp, s1, s2, activeI, activeJ) {
        const rows = dp.length;
        const cols = dp[0] ? dp[0].length : 0;
        if (!rows || !cols) {
            return '<p class="concept-muted mb-0">Matrix unavailable.</p>';
        }
        const cell = 42;
        const gap = 8;
        const depth = 7;
        const left = 128;
        const top = 62;
        const width = Math.max(520, left + (cols * (cell + gap)) + 34);
        const height = Math.max(264, top + (rows * (cell + gap)) + 52);

        const colLabels = [''].concat(s2.split(''));
        const rowLabels = [''].concat(s1.split(''));

        const colIndexLabels = colLabels
            .map((label, col) => {
                const x = left + (col * (cell + gap)) + (cell / 2);
                return `<text x="${x}" y="18" text-anchor="middle" font-size="10.4" fill="#475569">j=${col}</text>`;
            })
            .join('');

        const colCharLabels = colLabels
            .map((label, col) => {
                const x = left + (col * (cell + gap)) + (cell / 2);
                const printable = col === 0 ? 'empty' : label;
                return `<text x="${x}" y="33" text-anchor="middle" font-size="11.4" font-weight="700" fill="#334155">${escapeHtml(printable)}</text>`;
            })
            .join('');

        const rowIndexLabels = rowLabels
            .map((label, row) => {
                const y = top + (row * (cell + gap)) + (cell / 2) + 4;
                return `<text x="${left - 58}" y="${y}" text-anchor="middle" font-size="10.4" fill="#475569">i=${row}</text>`;
            })
            .join('');

        const rowCharLabels = rowLabels
            .map((label, row) => {
                const y = top + (row * (cell + gap)) + (cell / 2) + 4;
                const printable = row === 0 ? 'empty' : label;
                return `<text x="${left - 26}" y="${y}" text-anchor="middle" font-size="11.4" font-weight="700" fill="#334155">${escapeHtml(printable)}</text>`;
            })
            .join('');

        const cells = dp
            .map((row, i) =>
                row
                    .map((value, j) => {
                        const x = left + (j * (cell + gap));
                        const y = top + (i * (cell + gap));
                        const isActive = i === activeI && j === activeJ;
                        const isBoundary = i === 0 || j === 0;
                        const front = isActive ? '#fde68a' : (isBoundary ? '#e2e8f0' : '#dbeafe');
                        const topColor = isActive ? '#fef3c7' : (isBoundary ? '#f8fafc' : '#eff6ff');
                        const side = isActive ? '#ca8a04' : (isBoundary ? '#64748b' : '#2563eb');
                        const stroke = isActive ? '#92400e' : (isBoundary ? '#475569' : '#1e3a8a');
                        return `
                            <g>
                                <polygon points="${x},${y} ${x + depth},${y - depth} ${x + cell + depth},${y - depth} ${x + cell},${y}" fill="${topColor}"></polygon>
                                <polygon points="${x + cell},${y} ${x + cell + depth},${y - depth} ${x + cell + depth},${y + cell - depth} ${x + cell},${y + cell}" fill="${side}" opacity="0.93"></polygon>
                                <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="8" fill="${front}" stroke="${stroke}" stroke-width="${isActive ? '2.2' : '1.4'}"></rect>
                                <text x="${x + (cell / 2)}" y="${y + 24}" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">${escapeHtml(value)}</text>
                            </g>
                        `;
                    })
                    .join('')
            )
            .join('');

        return render3DScene(`
            <text x="${left}" y="48" font-size="11" fill="#475569">Columns: s2 prefixes (j)</text>
            <text x="20" y="${top - 14}" font-size="11" fill="#475569">Rows: s1 prefixes (i)</text>
            ${colIndexLabels}
            ${colCharLabels}
            ${rowIndexLabels}
            ${rowCharLabels}
            ${cells}
            <text x="${left}" y="${height - 18}" font-size="10.6" fill="#475569">dp[i][j] = LCS length of s1[0..i-1] and s2[0..j-1]</text>
        `, width, height, '3D dynamic programming matrix');
    }

    function renderActivityTimeline3D(intervals, selectedSet = new Set(), currentRow = -1) {
        if (!Array.isArray(intervals) || !intervals.length) {
            return '<p class="concept-muted mb-0">Activity timeline unavailable.</p>';
        }

        const starts = intervals.map((entry) => asFiniteNumber(entry.start, 0));
        const ends = intervals.map((entry) => asFiniteNumber(entry.end, 0));
        const minStart = Math.min(...starts);
        const maxEnd = Math.max(...ends);
        const range = Math.max(1, maxEnd - minStart);

        const left = 96;
        const right = 24;
        const top = 28;
        const rowHeight = 34;
        const barHeight = 18;
        const depth = 7;
        const width = 560;
        const height = Math.max(220, top + (intervals.length * rowHeight) + 20);
        const chartWidth = width - left - right;

        const bars = intervals
            .map((entry, row) => {
                const start = asFiniteNumber(entry.start, 0);
                const end = asFiniteNumber(entry.end, start);
                const x = left + (((start - minStart) / range) * chartWidth);
                const w = Math.max(22, ((Math.max(start, end) - minStart) / range) * chartWidth - ((start - minStart) / range) * chartWidth);
                const y = top + (row * rowHeight);
                const isCurrent = row === currentRow;
                const isSelected = selectedSet.has(row);
                const front = isCurrent ? '#fde68a' : isSelected ? '#86efac' : '#dbeafe';
                const topColor = isCurrent ? '#fef3c7' : isSelected ? '#bbf7d0' : '#eff6ff';
                const side = isCurrent ? '#ca8a04' : isSelected ? '#16a34a' : '#2563eb';
                const stroke = isCurrent ? '#92400e' : '#1e3a8a';
                return `
                    <g>
                        <text x="18" y="${y + 13}" font-size="10.5" fill="#475569">A${entry.index + 1}</text>
                        <text x="36" y="${y + 26}" font-size="10.5" fill="#64748b">[${formatNumber(start)}, ${formatNumber(end)})</text>
                        <polygon points="${x},${y} ${x + depth},${y - depth} ${x + w + depth},${y - depth} ${x + w},${y}" fill="${topColor}"></polygon>
                        <polygon points="${x + w},${y} ${x + w + depth},${y - depth} ${x + w + depth},${y + barHeight - depth} ${x + w},${y + barHeight}" fill="${side}" opacity="0.94"></polygon>
                        <rect x="${x}" y="${y}" width="${w}" height="${barHeight}" rx="7" fill="${front}" stroke="${stroke}" stroke-width="${isCurrent ? '2.1' : '1.3'}"></rect>
                    </g>
                `;
            })
            .join('');

        return render3DScene(`
            <line x1="${left}" y1="${height - 20}" x2="${width - right}" y2="${height - 20}" stroke="#94a3b8" stroke-width="1.2"></line>
            <text x="${left}" y="${height - 6}" font-size="10.5" fill="#64748b">${formatNumber(minStart)}</text>
            <text x="${width - right - 12}" y="${height - 6}" text-anchor="end" font-size="10.5" fill="#64748b">${formatNumber(maxEnd)}</text>
            ${bars}
        `, width, height, '3D activity selection timeline');
    }

    // Graphical renderer for arrays with animated cells
    function renderArrayVisualization(values, highlightSet = new Set(), comparingSet = new Set()) {
        if (!values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        let minVal = Math.min(...values);
        let maxVal = Math.max(...values);
        if (minVal === maxVal) {
            minVal -= 1;
            maxVal += 1;
        }
        const width = Math.max(440, values.length * 58);
        const height = 188;
        const chartTop = 28;
        const chartBottom = 126;
        const axisY = chartBottom + 12;
        const barWidth = Math.min(36, ((width - 54) / Math.max(1, values.length)) - 8);
        const gap = 14;
        const left = 28;
        const depth = 8;

        function scaleY(value) {
            const ratio = (value - minVal) / (maxVal - minVal);
            return chartBottom - (ratio * (chartBottom - chartTop));
        }

        const zeroY = (minVal <= 0 && maxVal >= 0) ? scaleY(0) : chartBottom;
        const bars = values.map((value, idx) => {
            const x = left + (idx * (barWidth + gap));
            const yValue = scaleY(value);
            const y = Math.min(yValue, zeroY);
            const barHeight = Math.max(3, Math.abs(zeroY - yValue));
            const isHighlighted = highlightSet.has(idx);
            const isComparing = comparingSet.has(idx);
            const front = isComparing ? '#fde68a' : isHighlighted ? '#86efac' : '#dbeafe';
            const top = isComparing ? '#fef3c7' : isHighlighted ? '#bbf7d0' : '#eff6ff';
            const side = isComparing ? '#ca8a04' : isHighlighted ? '#16a34a' : '#2563eb';
            const stroke = isComparing ? '#92400e' : '#1e3a8a';
            return `
                <g>
                    <polygon points="${x},${y} ${x + depth},${y - depth} ${x + barWidth + depth},${y - depth} ${x + barWidth},${y}" fill="${top}"></polygon>
                    <polygon points="${x + barWidth},${y} ${x + barWidth + depth},${y - depth} ${x + barWidth + depth},${y + barHeight - depth} ${x + barWidth},${y + barHeight}" fill="${side}" opacity="0.95"></polygon>
                    <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${front}" stroke="${stroke}" stroke-width="${isComparing ? '2.6' : '1.7'}"></rect>
                    <text class="exec-3d-index-text" x="${x + (barWidth / 2)}" y="${axisY + 17}" text-anchor="middle" font-size="10.8" font-weight="700" fill="#334155">${idx}</text>
                    <text class="exec-3d-value-text" x="${x + (barWidth / 2)}" y="${Math.max(18, y - 6)}" text-anchor="middle" font-size="12" font-weight="700" fill="#e2e8f0" style="paint-order:stroke;stroke:rgba(15,23,42,0.62);stroke-width:1.7px;stroke-linejoin:round;">${escapeHtml(formatNumber(value))}</text>
                </g>
            `;
        }).join('');

        const axis = `
            <line x1="${left - 8}" y1="${zeroY}" x2="${width - 20}" y2="${zeroY}" stroke="#94a3b8" stroke-width="1.4"></line>
            <text x="${left - 12}" y="${zeroY - 6}" font-size="10.4" font-weight="700" fill="#334155" style="paint-order:stroke;stroke:rgba(248,250,252,0.94);stroke-width:1.4px;stroke-linejoin:round;">0</text>
        `;

        return render3DScene(`${axis}${bars}`, width, height, '3D array bar visualization');
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
        const nodeWidth = 46;
        const nodeHeight = 30;
        const depth = 7;
        const levelHeight = 84;
        const width = 500;
        const height = Math.max(260, (Math.ceil(Math.log2(heapArray.length + 1)) + 1) * levelHeight);

        function getNodePosition(index) {
            const level = Math.floor(Math.log2(index + 1));
            const positionInLevel = index - (Math.pow(2, level) - 1);
            const levelWidth = Math.pow(2, level) * 60;
            const y = 34 + level * levelHeight;
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
                `<line x1="${parentPos.x + (nodeWidth / 2)}" y1="${parentPos.y + nodeHeight}" x2="${childPos.x + (nodeWidth / 2)}" y2="${childPos.y}" stroke="#94A3B8" stroke-width="1.6"></line>`
            );
        }

        // Draw nodes
        const nodes = heapArray.map((value, idx) => {
            const pos = getNodePosition(idx);
            const isHighlighted = idx === highlightIndex;
            const fill = isHighlighted ? '#fde68a' : '#dbeafe';
            const top = isHighlighted ? '#fef3c7' : '#eff6ff';
            const side = isHighlighted ? '#ca8a04' : '#2563eb';
            const stroke = isHighlighted ? '#92400e' : '#1e3a8a';
            const strokeWidth = isHighlighted ? '2.4' : '1.5';
            return `
                <g>
                    <polygon points="${pos.x},${pos.y} ${pos.x + depth},${pos.y - depth} ${pos.x + nodeWidth + depth},${pos.y - depth} ${pos.x + nodeWidth},${pos.y}" fill="${top}"></polygon>
                    <polygon points="${pos.x + nodeWidth},${pos.y} ${pos.x + nodeWidth + depth},${pos.y - depth} ${pos.x + nodeWidth + depth},${pos.y + nodeHeight - depth} ${pos.x + nodeWidth},${pos.y + nodeHeight}" fill="${side}" opacity="0.96"></polygon>
                    <rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"></rect>
                    <text x="${pos.x + (nodeWidth / 2)}" y="${pos.y + 20}" text-anchor="middle" font-size="12" font-weight="700" fill="#0F172A">${escapeHtml(formatNumber(value))}</text>
                </g>
            `;
        }).join('');

        return render3DScene(`${edges.join('')}${nodes}`, width, height, '3D heap visualization');
    }

    function renderBstTree3D(root, options = {}) {
        if (!root) {
            return '<p class="concept-muted mb-0">BST unavailable.</p>';
        }

        const focusValue = Number.isFinite(Number(options.focusValue)) ? Number(options.focusValue) : null;
        const nodeWidth = 54;
        const nodeHeight = 34;
        const depth = 8;
        const hGap = 80;
        const vGap = 76;
        const leftPad = 32;
        const topPad = 26;
        const floorPad = 18;

        const nodes = [];
        const edges = [];
        const nodeIdByRef = new Map();
        let maxDepth = 0;

        function collect(node, depthLevel, parentId = null) {
            if (!node) {
                return;
            }
            const id = nodes.length;
            nodeIdByRef.set(node, id);
            nodes.push({
                id,
                value: node.value,
                depth: depthLevel,
                hasLeft: Boolean(node.left),
                hasRight: Boolean(node.right),
                xOrder: 0,
            });
            if (parentId !== null) {
                edges.push([parentId, id]);
            }
            if (depthLevel > maxDepth) {
                maxDepth = depthLevel;
            }
            collect(node.left, depthLevel + 1, id);
            collect(node.right, depthLevel + 1, id);
        }

        let inorderOrder = 0;
        function assignInorderX(node) {
            if (!node) {
                return;
            }
            assignInorderX(node.left);
            const id = nodeIdByRef.get(node);
            if (Number.isInteger(id) && nodes[id]) {
                nodes[id].xOrder = inorderOrder;
                inorderOrder += 1;
            }
            assignInorderX(node.right);
        }

        collect(root, 0, null);
        assignInorderX(root);

        const width = Math.max(460, leftPad * 2 + Math.max(1, inorderOrder - 1) * hGap + nodeWidth + depth + 10);
        const height = Math.max(220, topPad + ((maxDepth + 1) * vGap) + nodeHeight + 28);
        const uniqueId = `execBst${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="4.8" stdDeviation="4" flood-color="#1e293b" flood-opacity="0.24"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <rect x="${leftPad - floorPad}" y="${height - 24}" width="${width - (leftPad - floorPad) * 2}" height="16" rx="8" fill="url(#${uniqueId}Floor)" opacity="0.84"></rect>
        `;

        const edgeSvg = edges.map(([fromId, toId]) => {
            const from = nodes[fromId];
            const to = nodes[toId];
            if (!from || !to) {
                return '';
            }
            const x1 = leftPad + (from.xOrder * hGap) + (nodeWidth / 2);
            const y1 = topPad + (from.depth * vGap) + nodeHeight;
            const x2 = leftPad + (to.xOrder * hGap) + (nodeWidth / 2);
            const y2 = topPad + (to.depth * vGap);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="1.8"></line>`;
        }).join('');

        const nodeSvg = nodes.map((entry) => {
            const x = leftPad + (entry.xOrder * hGap);
            const y = topPad + (entry.depth * vGap);
            const isFocus = focusValue !== null && Number(entry.value) === focusValue;
            const isLeaf = !entry.hasLeft && !entry.hasRight;
            const palette = isFocus
                ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e' }
                : isLeaf
                    ? { front: '#dcfce7', top: '#ecfdf5', side: '#16a34a', stroke: '#166534' }
                    : { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a' };
            const tag = isFocus ? `<rect x="${x + 7}" y="${y - 13}" width="${nodeWidth - 14}" height="11" rx="5" fill="#f59e0b"></rect>
                <text x="${x + (nodeWidth / 2)}" y="${y - 4}" text-anchor="middle" font-size="8.6" font-weight="700" fill="#ffffff">NEXT</text>` : '';
            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (nodeWidth / 2) + (depth / 2)}" cy="${y + nodeHeight + 9}" rx="${(nodeWidth / 2) + 8}" ry="5.4" fill="rgba(15,23,42,0.22)"></ellipse>
                    <polygon points="${x},${y} ${x + depth},${y - depth} ${x + nodeWidth + depth},${y - depth} ${x + nodeWidth},${y}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + nodeWidth},${y} ${x + nodeWidth + depth},${y - depth} ${x + nodeWidth + depth},${y + nodeHeight - depth} ${x + nodeWidth},${y + nodeHeight}" fill="${palette.side}" opacity="0.92"></polygon>
                    <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isFocus ? '2.7' : '1.8'}"></rect>
                    ${tag}
                    <text x="${x + (nodeWidth / 2)}" y="${y + 21}" text-anchor="middle" font-size="12.2" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(entry.value))}</text>
                    <text x="${x + (nodeWidth / 2)}" y="${y + nodeHeight + 14}" text-anchor="middle" font-size="9.5" fill="#475569">d${entry.depth}</text>
                </g>
            `;
        }).join('');

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D BST Tree</text>
                <rect x="${width - 186}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 172}" y="${topPad - 5}" font-size="9.5" fill="#334155">Node</text>
                <rect x="${width - 126}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dcfce7" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 112}" y="${topPad - 5}" font-size="9.5" fill="#334155">Leaf</text>
                <rect x="${width - 62}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 48}" y="${topPad - 5}" font-size="9.5" fill="#334155">Next</text>
            </g>
        `;

        return render3DScene(`${defs}${floor}${edgeSvg}${legend}${nodeSvg}`, width, height, '3D BST tree visualization', 'exec-3d-bst');
    }

    function renderLinearSearchTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const visitedSet = options.visitedSet instanceof Set ? options.visitedSet : new Set();
        const currentIndex = Number.isInteger(options.currentIndex) ? options.currentIndex : null;
        const matchIndex = Number.isInteger(options.matchIndex) ? options.matchIndex : null;
        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 164 : 176;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execLinear${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bbf7d0"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(34,197,94,0.07)"></stop>
                    <stop offset="50%" stop-color="rgba(59,130,246,0.18)"></stop>
                    <stop offset="100%" stop-color="rgba(249,115,22,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const isMatch = matchIndex === idx;
            const isCurrent = currentIndex === idx;
            const isVisited = visitedSet.has(idx);
            const palette = isMatch
                ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'MATCH', tagColor: '#16a34a' }
                : isCurrent
                    ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'CHECK', tagColor: '#f59e0b' }
                    : isVisited
                        ? { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: 'SEEN', tagColor: '#2563eb' }
                        : { front: '#e2e8f0', top: '#f8fafc', side: '#64748b', stroke: '#475569', tag: '', tagColor: '#64748b' };
            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isCurrent || isMatch ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}</text>
                </g>
            `;
        }).join('');

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Linear Search Board</text>
                <rect x="${width - 236}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e2e8f0" stroke="#475569" stroke-width="1"></rect>
                <text x="${width - 222}" y="${topPad - 5}" font-size="9.5" fill="#334155">Pending</text>
                <rect x="${width - 172}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 158}" y="${topPad - 5}" font-size="9.5" fill="#334155">Visited</text>
                <rect x="${width - 112}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 98}" y="${topPad - 5}" font-size="9.5" fill="#334155">Current</text>
                <rect x="${width - 52}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 38}" y="${topPad - 5}" font-size="9.5" fill="#334155">Match</text>
            </g>
        `;

        return render3DScene(`${defs}${floor}${legend}${cells}`, width, height, '3D linear search visualization', 'exec-3d-bst');
    }

    function renderBinarySearchTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const low = Number.isInteger(options.low) ? options.low : null;
        const high = Number.isInteger(options.high) ? options.high : null;
        const mid = Number.isInteger(options.mid) ? options.mid : null;
        const foundIndex = Number.isInteger(options.foundIndex) ? options.foundIndex : null;
        const visitedMidSet = options.visitedMids instanceof Set
            ? options.visitedMids
            : new Set(Array.isArray(options.visitedMids) ? options.visitedMids.filter((idx) => Number.isInteger(idx)) : []);
        const stepDepth = Number.isInteger(options.stepDepth) ? Math.max(0, options.stepDepth) : 0;
        const hasWindow = Number.isInteger(low) && Number.isInteger(high) && low <= high;

        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 176 : 188;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execBinary${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.07)"></stop>
                    <stop offset="50%" stop-color="rgba(14,165,233,0.18)"></stop>
                    <stop offset="100%" stop-color="rgba(249,115,22,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const inWindow = hasWindow ? idx >= low && idx <= high : false;
            const isFound = foundIndex === idx;
            const isMid = !isFound && mid === idx;
            const wasMid = !isFound && !isMid && visitedMidSet.has(idx);
            const isLow = Number.isInteger(low) && idx === low;
            const isHigh = Number.isInteger(high) && idx === high;
            const palette = isFound
                ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'FOUND', tagColor: '#16a34a' }
                : isMid
                    ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'MID', tagColor: '#f59e0b' }
                    : wasMid
                        ? { front: '#ede9fe', top: '#f5f3ff', side: '#7c3aed', stroke: '#5b21b6', tag: 'CHECKED', tagColor: '#7c3aed' }
                    : inWindow
                        ? { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: 'WINDOW', tagColor: '#2563eb' }
                        : { front: '#e2e8f0', top: '#f8fafc', side: '#64748b', stroke: '#475569', tag: '', tagColor: '#64748b' };
            const tags = [];
            if (isLow && isHigh) {
                tags.push('L/H');
            } else if (isLow) {
                tags.push('L');
            } else if (isHigh) {
                tags.push('H');
            }
            if (wasMid) {
                tags.push('C');
            }
            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isFound || isMid ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}${tags.length ? ` | ${tags.join('/')}` : ''}</text>
                </g>
            `;
        }).join('');

        const windowOverlay = hasWindow
            ? (() => {
                const startX = leftPad + (low * (cellWidth + gap));
                const endX = leftPad + (high * (cellWidth + gap)) + cellWidth;
                const y = baseY - 24;
                return `
                    <g>
                        <line x1="${startX}" y1="${y}" x2="${endX}" y2="${y}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${startX}" y1="${y - 6}" x2="${startX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${endX}" y1="${y - 6}" x2="${endX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        <text x="${startX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">L=${low}</text>
                        <text x="${endX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">H=${high}</text>
                        <text x="${Math.round((startX + endX) / 2)}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0369a1">Active Window</text>
                    </g>
                `;
            })()
            : '';

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Binary Search Board</text>
                <rect x="${width - 296}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e2e8f0" stroke="#475569" stroke-width="1"></rect>
                <text x="${width - 282}" y="${topPad - 5}" font-size="9.5" fill="#334155">Discarded</text>
                <rect x="${width - 232}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 218}" y="${topPad - 5}" font-size="9.5" fill="#334155">Window</text>
                <rect x="${width - 176}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#ede9fe" stroke="#5b21b6" stroke-width="1"></rect>
                <text x="${width - 162}" y="${topPad - 5}" font-size="9.5" fill="#334155">Checked</text>
                <rect x="${width - 118}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 104}" y="${topPad - 5}" font-size="9.5" fill="#334155">Mid</text>
                <rect x="${width - 58}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 44}" y="${topPad - 5}" font-size="9.5" fill="#334155">Found</text>
                ${stepDepth > 0 ? `<text x="${leftPad}" y="${topPad + 12}" font-size="9.5" fill="#0369a1">Step Depth: ${stepDepth}</text>` : ''}
            </g>
        `;

        return render3DScene(`${defs}${floor}${windowOverlay}${legend}${cells}`, width, height, '3D binary search visualization', 'exec-3d-bst');
    }

    function renderBubbleSortTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const compareLeft = Number.isInteger(options.compareLeft) ? options.compareLeft : null;
        const compareRight = Number.isInteger(options.compareRight) ? options.compareRight : null;
        const sortedFrom = Number.isInteger(options.sortedFrom) ? options.sortedFrom : values.length;
        const swappedPair = Array.isArray(options.swappedPair) ? options.swappedPair : [];
        const stepDepth = Number.isInteger(options.stepDepth) ? Math.max(0, options.stepDepth) : 0;

        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 176 : 188;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execBubble${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.07)"></stop>
                    <stop offset="48%" stop-color="rgba(14,165,233,0.17)"></stop>
                    <stop offset="100%" stop-color="rgba(34,197,94,0.11)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const isFixed = idx >= sortedFrom;
            const isPair = idx === compareLeft || idx === compareRight;
            const isSwapped = swappedPair.includes(idx);
            const palette = isSwapped
                ? { front: '#fce7f3', top: '#fdf2f8', side: '#db2777', stroke: '#9d174d', tag: 'SWAP', tagColor: '#db2777' }
                : isPair
                    ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'PAIR', tagColor: '#f59e0b' }
                    : isFixed
                        ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'FIXED', tagColor: '#16a34a' }
                        : { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: '', tagColor: '#2563eb' };
            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isPair || isSwapped ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}</text>
                </g>
            `;
        }).join('');

        const pairOverlay = Number.isInteger(compareLeft) && Number.isInteger(compareRight)
            ? (() => {
                const start = Math.min(compareLeft, compareRight);
                const end = Math.max(compareLeft, compareRight);
                const startX = leftPad + (start * (cellWidth + gap));
                const endX = leftPad + (end * (cellWidth + gap)) + cellWidth;
                const y = baseY - 24;
                return `
                    <g>
                        <line x1="${startX}" y1="${y}" x2="${endX}" y2="${y}" stroke="#d97706" stroke-width="2.2"></line>
                        <line x1="${startX}" y1="${y - 6}" x2="${startX}" y2="${y + 6}" stroke="#d97706" stroke-width="2.2"></line>
                        <line x1="${endX}" y1="${y - 6}" x2="${endX}" y2="${y + 6}" stroke="#d97706" stroke-width="2.2"></line>
                        <text x="${Math.round((startX + endX) / 2)}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#92400e">Compare Pair</text>
                    </g>
                `;
            })()
            : '';

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Bubble Sort Board</text>
                <rect x="${width - 250}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 236}" y="${topPad - 5}" font-size="9.5" fill="#334155">Unsorted</text>
                <rect x="${width - 184}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 170}" y="${topPad - 5}" font-size="9.5" fill="#334155">Pair</text>
                <rect x="${width - 130}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fce7f3" stroke="#9d174d" stroke-width="1"></rect>
                <text x="${width - 116}" y="${topPad - 5}" font-size="9.5" fill="#334155">Swapped</text>
                <rect x="${width - 68}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 54}" y="${topPad - 5}" font-size="9.5" fill="#334155">Fixed</text>
                ${stepDepth > 0 ? `<text x="${leftPad}" y="${topPad + 12}" font-size="9.5" fill="#0369a1">Pass Depth: ${stepDepth}</text>` : ''}
            </g>
        `;

        return render3DScene(`${defs}${floor}${pairOverlay}${legend}${cells}`, width, height, '3D bubble sort visualization', 'exec-3d-bst');
    }

    function renderSelectionSortTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const fixedUntil = Number.isInteger(options.fixedUntil) ? options.fixedUntil : 0;
        const scanIndex = Number.isInteger(options.scanIndex) ? options.scanIndex : null;
        const minIndex = Number.isInteger(options.minIndex) ? options.minIndex : null;
        const slotIndex = Number.isInteger(options.slotIndex) ? options.slotIndex : null;
        const placedIndex = Number.isInteger(options.placedIndex) ? options.placedIndex : null;
        const stepDepth = Number.isInteger(options.stepDepth) ? Math.max(0, options.stepDepth) : 0;

        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 176 : 188;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execSelect${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.07)"></stop>
                    <stop offset="45%" stop-color="rgba(14,165,233,0.16)"></stop>
                    <stop offset="100%" stop-color="rgba(34,197,94,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const isFixed = idx < fixedUntil;
            const isPlaced = Number.isInteger(placedIndex) && idx === placedIndex;
            const isMin = Number.isInteger(minIndex) && idx === minIndex;
            const isScan = Number.isInteger(scanIndex) && idx === scanIndex;
            const isSlot = Number.isInteger(slotIndex) && idx === slotIndex;

            const palette = isPlaced
                ? { front: '#fce7f3', top: '#fdf2f8', side: '#db2777', stroke: '#9d174d', tag: 'PLACE', tagColor: '#db2777' }
                : isMin
                    ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'MIN', tagColor: '#f59e0b' }
                    : isScan
                        ? { front: '#e0f2fe', top: '#f0f9ff', side: '#0284c7', stroke: '#0c4a6e', tag: 'SCAN', tagColor: '#0284c7' }
                        : isFixed
                            ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'FIXED', tagColor: '#16a34a' }
                            : { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: isSlot ? 'SLOT' : '', tagColor: '#2563eb' };

            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isMin || isScan || isPlaced ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}</text>
                </g>
            `;
        }).join('');

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Selection Sort Board</text>
                <rect x="${width - 308}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 294}" y="${topPad - 5}" font-size="9.5" fill="#334155">Unsorted</text>
                <rect x="${width - 244}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="1"></rect>
                <text x="${width - 230}" y="${topPad - 5}" font-size="9.5" fill="#334155">Scan</text>
                <rect x="${width - 192}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 178}" y="${topPad - 5}" font-size="9.5" fill="#334155">Min</text>
                <rect x="${width - 136}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fce7f3" stroke="#9d174d" stroke-width="1"></rect>
                <text x="${width - 122}" y="${topPad - 5}" font-size="9.5" fill="#334155">Placed</text>
                <rect x="${width - 74}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 60}" y="${topPad - 5}" font-size="9.5" fill="#334155">Fixed</text>
                ${stepDepth > 0 ? `<text x="${leftPad}" y="${topPad + 12}" font-size="9.5" fill="#0369a1">Pass Depth: ${stepDepth}</text>` : ''}
            </g>
        `;

        return render3DScene(`${defs}${floor}${legend}${cells}`, width, height, '3D selection sort visualization', 'exec-3d-bst');
    }

    function renderInsertionSortTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const sortedUntil = Number.isInteger(options.sortedUntil) ? options.sortedUntil : 1;
        const keyIndex = Number.isInteger(options.keyIndex) ? options.keyIndex : null;
        const scanIndex = Number.isInteger(options.scanIndex) ? options.scanIndex : null;
        const insertedIndex = Number.isInteger(options.insertedIndex) ? options.insertedIndex : null;
        const shiftedIndex = Number.isInteger(options.shiftedIndex) ? options.shiftedIndex : null;
        const stepDepth = Number.isInteger(options.stepDepth) ? Math.max(0, options.stepDepth) : 0;

        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 176 : 188;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execInsert${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.07)"></stop>
                    <stop offset="45%" stop-color="rgba(14,165,233,0.16)"></stop>
                    <stop offset="100%" stop-color="rgba(34,197,94,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const inSortedPrefix = idx < sortedUntil;
            const isKey = Number.isInteger(keyIndex) && idx === keyIndex;
            const isScan = Number.isInteger(scanIndex) && idx === scanIndex;
            const isInserted = Number.isInteger(insertedIndex) && idx === insertedIndex;
            const isShifted = Number.isInteger(shiftedIndex) && idx === shiftedIndex;

            const palette = isInserted
                ? { front: '#fce7f3', top: '#fdf2f8', side: '#db2777', stroke: '#9d174d', tag: 'INSERT', tagColor: '#db2777' }
                : isShifted
                    ? { front: '#e0f2fe', top: '#f0f9ff', side: '#0284c7', stroke: '#0c4a6e', tag: 'SHIFT', tagColor: '#0284c7' }
                    : isKey
                        ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'KEY', tagColor: '#f59e0b' }
                        : isScan
                            ? { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: 'SCAN', tagColor: '#2563eb' }
                            : inSortedPrefix
                                ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'SORTED', tagColor: '#16a34a' }
                                : { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: '', tagColor: '#2563eb' };

            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isInserted || isShifted || isKey || isScan ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}</text>
                </g>
            `;
        }).join('');

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Insertion Sort Board</text>
                <rect x="${width - 304}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 290}" y="${topPad - 5}" font-size="9.5" fill="#334155">Sorted Prefix</text>
                <rect x="${width - 220}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 206}" y="${topPad - 5}" font-size="9.5" fill="#334155">Key</text>
                <rect x="${width - 172}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 158}" y="${topPad - 5}" font-size="9.5" fill="#334155">Scan</text>
                <rect x="${width - 120}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="1"></rect>
                <text x="${width - 106}" y="${topPad - 5}" font-size="9.5" fill="#334155">Shift</text>
                <rect x="${width - 66}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fce7f3" stroke="#9d174d" stroke-width="1"></rect>
                <text x="${width - 52}" y="${topPad - 5}" font-size="9.5" fill="#334155">Insert</text>
                ${stepDepth > 0 ? `<text x="${leftPad}" y="${topPad + 12}" font-size="9.5" fill="#0369a1">Pass Depth: ${stepDepth}</text>` : ''}
            </g>
        `;

        return render3DScene(`${defs}${floor}${legend}${cells}`, width, height, '3D insertion sort visualization', 'exec-3d-bst');
    }

    function renderMergeSortTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const left = Number.isInteger(options.left) ? options.left : 0;
        const mid = Number.isInteger(options.mid) ? options.mid : 0;
        const right = Number.isInteger(options.right) ? options.right : values.length;
        const headLeft = Number.isInteger(options.headLeft) ? options.headLeft : null;
        const headRight = Number.isInteger(options.headRight) ? options.headRight : null;
        const writtenUntil = Number.isInteger(options.writtenUntil) ? options.writtenUntil : left;
        const mergedSet = options.mergedSet instanceof Set ? options.mergedSet : new Set();
        const stepDepth = Number.isInteger(options.stepDepth) ? Math.max(0, options.stepDepth) : 0;

        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 176 : 188;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execMerge${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.07)"></stop>
                    <stop offset="45%" stop-color="rgba(14,165,233,0.16)"></stop>
                    <stop offset="100%" stop-color="rgba(34,197,94,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const segmentActive = left < right;
        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const inLeftRun = segmentActive && idx >= left && idx < mid;
            const inRightRun = segmentActive && idx >= mid && idx < right;
            const isHeadLeft = headLeft === idx;
            const isHeadRight = headRight === idx;
            const isWritten = mergedSet.has(idx) || (segmentActive && idx < writtenUntil && idx >= left);

            const palette = isWritten
                ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'MERGED', tagColor: '#16a34a' }
                : isHeadLeft || isHeadRight
                    ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'HEAD', tagColor: '#f59e0b' }
                    : inLeftRun
                        ? { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: 'LEFT', tagColor: '#2563eb' }
                        : inRightRun
                            ? { front: '#e0f2fe', top: '#f0f9ff', side: '#0284c7', stroke: '#0c4a6e', tag: 'RIGHT', tagColor: '#0284c7' }
                            : { front: '#e2e8f0', top: '#f8fafc', side: '#64748b', stroke: '#475569', tag: '', tagColor: '#64748b' };

            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isHeadLeft || isHeadRight ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}</text>
                </g>
            `;
        }).join('');

        const bandOverlay = segmentActive
            ? (() => {
                const startX = leftPad + (left * (cellWidth + gap));
                const midX = leftPad + (mid * (cellWidth + gap));
                const endX = leftPad + ((right - 1) * (cellWidth + gap)) + cellWidth;
                const y = baseY - 24;
                return `
                    <g>
                        <line x1="${startX}" y1="${y}" x2="${endX}" y2="${y}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${startX}" y1="${y - 6}" x2="${startX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${endX}" y1="${y - 6}" x2="${endX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        ${mid > left && mid < right ? `<line x1="${midX}" y1="${y - 8}" x2="${midX}" y2="${y + 8}" stroke="#f59e0b" stroke-width="2"></line>` : ''}
                        <text x="${startX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">L=${left}</text>
                        <text x="${endX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">R=${right - 1}</text>
                    </g>
                `;
            })()
            : '';

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Merge Sort Board</text>
                <rect x="${width - 300}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 286}" y="${topPad - 5}" font-size="9.5" fill="#334155">Left Run</text>
                <rect x="${width - 240}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="1"></rect>
                <text x="${width - 226}" y="${topPad - 5}" font-size="9.5" fill="#334155">Right Run</text>
                <rect x="${width - 180}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 166}" y="${topPad - 5}" font-size="9.5" fill="#334155">Head</text>
                <rect x="${width - 126}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 112}" y="${topPad - 5}" font-size="9.5" fill="#334155">Merged</text>
                <rect x="${width - 68}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e2e8f0" stroke="#475569" stroke-width="1"></rect>
                <text x="${width - 54}" y="${topPad - 5}" font-size="9.5" fill="#334155">Other</text>
                ${stepDepth > 0 ? `<text x="${leftPad}" y="${topPad + 12}" font-size="9.5" fill="#0369a1">Merge Depth: ${stepDepth}</text>` : ''}
            </g>
        `;

        return render3DScene(`${defs}${floor}${bandOverlay}${legend}${cells}`, width, height, '3D merge sort visualization', 'exec-3d-bst');
    }

    function renderQuickSortTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const low = Number.isInteger(options.low) ? options.low : 0;
        const high = Number.isInteger(options.high) ? options.high : values.length - 1;
        const scanIndex = Number.isInteger(options.scanIndex) ? options.scanIndex : null;
        const boundaryIndex = Number.isInteger(options.boundaryIndex) ? options.boundaryIndex : null;
        const pivotIndex = Number.isInteger(options.pivotIndex) ? options.pivotIndex : null;
        const stepDepth = Number.isInteger(options.stepDepth) ? Math.max(0, options.stepDepth) : 0;
        const swappedPair = Array.isArray(options.swappedPair) ? options.swappedPair : [];
        const fixedSet = options.fixedSet instanceof Set ? options.fixedSet : new Set();
        const hasActiveSegment = low >= 0 && high >= 0 && low <= high && high < values.length;

        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 178 : 190;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execQuick${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.07)"></stop>
                    <stop offset="45%" stop-color="rgba(14,165,233,0.16)"></stop>
                    <stop offset="100%" stop-color="rgba(34,197,94,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const inSegment = hasActiveSegment && idx >= low && idx <= high;
            const inLeftZone = hasActiveSegment && Number.isInteger(boundaryIndex) && idx >= low && idx <= boundaryIndex;
            const isScan = Number.isInteger(scanIndex) && idx === scanIndex;
            const isPivot = Number.isInteger(pivotIndex) && idx === pivotIndex;
            const isFixed = fixedSet.has(idx);
            const isSwapped = swappedPair.includes(idx);

            const palette = isSwapped
                ? { front: '#fce7f3', top: '#fdf2f8', side: '#db2777', stroke: '#9d174d', tag: 'SWAP', tagColor: '#db2777' }
                : isFixed
                    ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'FIXED', tagColor: '#16a34a' }
                    : isPivot
                        ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'PIVOT', tagColor: '#f59e0b' }
                        : isScan
                            ? { front: '#e0f2fe', top: '#f0f9ff', side: '#0284c7', stroke: '#0c4a6e', tag: 'SCAN', tagColor: '#0284c7' }
                            : inLeftZone
                                ? { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: 'LEFT', tagColor: '#2563eb' }
                                : inSegment
                                    ? { front: '#e2e8f0', top: '#f8fafc', side: '#64748b', stroke: '#475569', tag: 'RIGHT', tagColor: '#64748b' }
                                    : { front: '#f1f5f9', top: '#f8fafc', side: '#94a3b8', stroke: '#64748b', tag: '', tagColor: '#64748b' };

            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isPivot || isScan || isSwapped ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}</text>
                </g>
            `;
        }).join('');

        const segmentOverlay = hasActiveSegment
            ? (() => {
                const startX = leftPad + (low * (cellWidth + gap));
                const endX = leftPad + (high * (cellWidth + gap)) + cellWidth;
                const y = baseY - 24;
                const boundaryX = Number.isInteger(boundaryIndex) && boundaryIndex >= low && boundaryIndex <= high
                    ? leftPad + (boundaryIndex * (cellWidth + gap)) + cellWidth
                    : null;
                return `
                    <g>
                        <line x1="${startX}" y1="${y}" x2="${endX}" y2="${y}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${startX}" y1="${y - 6}" x2="${startX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${endX}" y1="${y - 6}" x2="${endX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        ${boundaryX ? `<line x1="${boundaryX}" y1="${y - 8}" x2="${boundaryX}" y2="${y + 8}" stroke="#2563eb" stroke-width="2"></line>` : ''}
                        <text x="${startX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">L=${low}</text>
                        <text x="${endX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">R=${high}</text>
                    </g>
                `;
            })()
            : '';

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Quick Sort Board</text>
                <rect x="${width - 332}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 318}" y="${topPad - 5}" font-size="9.5" fill="#334155">Left Zone</text>
                <rect x="${width - 266}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e2e8f0" stroke="#475569" stroke-width="1"></rect>
                <text x="${width - 252}" y="${topPad - 5}" font-size="9.5" fill="#334155">Right Zone</text>
                <rect x="${width - 196}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="1"></rect>
                <text x="${width - 182}" y="${topPad - 5}" font-size="9.5" fill="#334155">Scan</text>
                <rect x="${width - 140}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 126}" y="${topPad - 5}" font-size="9.5" fill="#334155">Pivot</text>
                <rect x="${width - 86}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 72}" y="${topPad - 5}" font-size="9.5" fill="#334155">Fixed</text>
                ${stepDepth > 0 ? `<text x="${leftPad}" y="${topPad + 12}" font-size="9.5" fill="#0369a1">Partition Depth: ${stepDepth}</text>` : ''}
            </g>
        `;

        return render3DScene(`${defs}${floor}${segmentOverlay}${legend}${cells}`, width, height, '3D quick sort visualization', 'exec-3d-bst');
    }

    function renderHeapSortTrack3D(values, options = {}) {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const heapSize = Number.isInteger(options.heapSize) ? Math.max(0, Math.min(values.length, options.heapSize)) : values.length;
        const rootIndex = Number.isInteger(options.rootIndex) ? options.rootIndex : null;
        const leftIndex = Number.isInteger(options.leftIndex) ? options.leftIndex : null;
        const rightIndex = Number.isInteger(options.rightIndex) ? options.rightIndex : null;
        const candidateIndex = Number.isInteger(options.candidateIndex) ? options.candidateIndex : null;
        const stepDepth = Number.isInteger(options.stepDepth) ? Math.max(0, options.stepDepth) : 0;
        const swappedPair = Array.isArray(options.swappedPair) ? options.swappedPair : [];
        const fixedSet = options.fixedSet instanceof Set ? options.fixedSet : new Set();
        const hasActiveHeap = heapSize > 0;

        const compact = values.length >= 14;
        const cellWidth = compact ? 56 : 66;
        const cellHeight = compact ? 34 : 38;
        const gap = compact ? 8 : 10;
        const leftPad = 26;
        const topPad = 24;
        const baseY = compact ? 76 : 80;
        const depth = compact ? 8 : 10;
        const stageHeight = compact ? 178 : 190;
        const width = Math.max(440, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const height = stageHeight;
        const uniqueId = `execHeap${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

        const defs = `
            <defs>
                <linearGradient id="${uniqueId}Floor" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"></stop>
                    <stop offset="100%" stop-color="#bfdbfe"></stop>
                </linearGradient>
                <linearGradient id="${uniqueId}BackGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="rgba(59,130,246,0.07)"></stop>
                    <stop offset="45%" stop-color="rgba(14,165,233,0.16)"></stop>
                    <stop offset="100%" stop-color="rgba(34,197,94,0.1)"></stop>
                </linearGradient>
                <filter id="${uniqueId}SoftShadow" x="-40%" y="-40%" width="180%" height="220%">
                    <feDropShadow dx="0" dy="5" stdDeviation="4.2" flood-color="#1e293b" flood-opacity="0.26"></feDropShadow>
                </filter>
            </defs>
        `;

        const floor = `
            <g>
                <rect x="${leftPad - 14}" y="${baseY + cellHeight + 10}" width="${Math.max(220, values.length * (cellWidth + gap) - gap + 28)}" height="20" rx="10" fill="url(#${uniqueId}Floor)" opacity="0.86"></rect>
                <polygon points="${leftPad - 8},${baseY + 6} ${leftPad + 24},${baseY - 18} ${width - leftPad + 8},${baseY - 18} ${width - leftPad - 24},${baseY + 6}" fill="url(#${uniqueId}BackGlow)" opacity="0.72"></polygon>
            </g>
        `;

        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const inHeap = idx < heapSize;
            const isRoot = Number.isInteger(rootIndex) && idx === rootIndex;
            const isChild = idx === leftIndex || idx === rightIndex;
            const isCandidate = Number.isInteger(candidateIndex) && idx === candidateIndex;
            const isSwapped = swappedPair.includes(idx);
            const isFixed = fixedSet.has(idx) || (!inHeap && heapSize < values.length);

            const palette = isSwapped
                ? { front: '#fce7f3', top: '#fdf2f8', side: '#db2777', stroke: '#9d174d', tag: 'SWAP', tagColor: '#db2777' }
                : isFixed
                    ? { front: '#bbf7d0', top: '#dcfce7', side: '#16a34a', stroke: '#166534', tag: 'FIXED', tagColor: '#16a34a' }
                    : isRoot
                        ? { front: '#fde68a', top: '#fef3c7', side: '#ca8a04', stroke: '#92400e', tag: 'ROOT', tagColor: '#f59e0b' }
                        : isCandidate
                            ? { front: '#dbeafe', top: '#eff6ff', side: '#2563eb', stroke: '#1e3a8a', tag: 'BEST', tagColor: '#2563eb' }
                            : isChild
                                ? { front: '#e0f2fe', top: '#f0f9ff', side: '#0284c7', stroke: '#0c4a6e', tag: 'CHILD', tagColor: '#0284c7' }
                                : inHeap
                                    ? { front: '#e2e8f0', top: '#f8fafc', side: '#64748b', stroke: '#475569', tag: 'HEAP', tagColor: '#64748b' }
                                    : { front: '#f1f5f9', top: '#f8fafc', side: '#94a3b8', stroke: '#64748b', tag: '', tagColor: '#64748b' };

            return `
                <g filter="url(#${uniqueId}SoftShadow)">
                    <ellipse cx="${x + (cellWidth / 2) + (depth / 2)}" cy="${baseY + cellHeight + 12}" rx="${(cellWidth / 2) + 8}" ry="5.8" fill="rgba(15,23,42,0.24)"></ellipse>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${palette.top}" opacity="0.96"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + cellHeight - depth} ${x + cellWidth},${baseY + cellHeight}" fill="${palette.side}" opacity="0.9"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${isRoot || isCandidate || isSwapped ? '2.8' : '1.8'}"></rect>
                    ${palette.tag ? `<rect x="${x + 6}" y="${baseY - 12}" width="${cellWidth - 12}" height="11" rx="5" fill="${palette.tagColor}"></rect>` : ''}
                    ${palette.tag ? `<text x="${x + (cellWidth / 2)}" y="${baseY - 4}" text-anchor="middle" font-size="8.8" font-weight="700" fill="#ffffff">${palette.tag}</text>` : ''}
                    <text x="${x + (cellWidth / 2)}" y="${baseY + Math.round(cellHeight * 0.62)}" text-anchor="middle" font-size="${compact ? '12' : '13.2'}" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + cellHeight + 17}" text-anchor="middle" font-size="10.2" fill="#475569">idx ${idx}</text>
                </g>
            `;
        }).join('');

        const heapOverlay = hasActiveHeap
            ? (() => {
                const startX = leftPad;
                const endX = leftPad + ((heapSize - 1) * (cellWidth + gap)) + cellWidth;
                const y = baseY - 24;
                return `
                    <g>
                        <line x1="${startX}" y1="${y}" x2="${endX}" y2="${y}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${startX}" y1="${y - 6}" x2="${startX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        <line x1="${endX}" y1="${y - 6}" x2="${endX}" y2="${y + 6}" stroke="#0284c7" stroke-width="2.2"></line>
                        <text x="${startX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">heap[0]</text>
                        <text x="${endX}" y="${y - 8}" text-anchor="middle" font-size="9.4" font-weight="700" fill="#0c4a6e">heap[${heapSize - 1}]</text>
                    </g>
                `;
            })()
            : '';

        const legend = `
            <g>
                <text x="${leftPad}" y="${topPad - 2}" font-size="11" font-weight="700" fill="#334155">3D Heap Sort Board</text>
                <rect x="${width - 324}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e2e8f0" stroke="#475569" stroke-width="1"></rect>
                <text x="${width - 310}" y="${topPad - 5}" font-size="9.5" fill="#334155">Heap</text>
                <rect x="${width - 278}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"></rect>
                <text x="${width - 264}" y="${topPad - 5}" font-size="9.5" fill="#334155">Root</text>
                <rect x="${width - 224}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#e0f2fe" stroke="#0c4a6e" stroke-width="1"></rect>
                <text x="${width - 210}" y="${topPad - 5}" font-size="9.5" fill="#334155">Child</text>
                <rect x="${width - 168}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#dbeafe" stroke="#1e3a8a" stroke-width="1"></rect>
                <text x="${width - 154}" y="${topPad - 5}" font-size="9.5" fill="#334155">Best</text>
                <rect x="${width - 116}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#fce7f3" stroke="#9d174d" stroke-width="1"></rect>
                <text x="${width - 102}" y="${topPad - 5}" font-size="9.5" fill="#334155">Swap</text>
                <rect x="${width - 62}" y="${topPad - 14}" width="10" height="10" rx="2" fill="#bbf7d0" stroke="#166534" stroke-width="1"></rect>
                <text x="${width - 48}" y="${topPad - 5}" font-size="9.5" fill="#334155">Fixed</text>
                ${stepDepth > 0 ? `<text x="${leftPad}" y="${topPad + 12}" font-size="9.5" fill="#0369a1">Heapify Depth: ${stepDepth}</text>` : ''}
            </g>
        `;

        return render3DScene(`${defs}${floor}${heapOverlay}${legend}${cells}`, width, height, '3D heap sort visualization', 'exec-3d-bst');
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
        const width = 500;
        const height = 264;
        const leftPad = 56;
        const rightPad = 24;
        const topPad = 24;
        const bottomPad = 40;
        const depth = 10;

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

        const floor = `
            <polygon
                points="${leftPad},${height - bottomPad} ${leftPad + depth},${height - bottomPad - depth} ${width - rightPad + depth},${height - bottomPad - depth} ${width - rightPad},${height - bottomPad}"
                fill="var(--exec-ml-floor)"
                stroke="var(--exec-ml-floor-stroke)"
                stroke-width="1"
            ></polygon>
        `;

        const grid = Array.from({ length: 5 }, (_, idx) => {
            const ratio = idx / 4;
            const y = topPad + (ratio * (height - topPad - bottomPad));
            return `<line x1="${leftPad}" y1="${y}" x2="${width - rightPad}" y2="${y}" stroke="var(--exec-ml-grid)" stroke-width="1"></line>`;
        }).join('');

        const pointsSvg = points.map((point) => {
            const cx = scaleX(point.x);
            const cy = scaleY(point.y);
            const active = highlightSet.has(point.index);
            const radius = active ? 7 : 5.2;
            const fill = active ? '#34d399' : '#38bdf8';
            const side = active ? '#059669' : '#0284c7';
            return `
                <g>
                    <circle cx="${cx + (depth * 0.35)}" cy="${cy - (depth * 0.35)}" r="${radius}" fill="${side}" opacity="0.94"></circle>
                    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="#0f172a" stroke-width="${active ? '1.6' : '1.2'}"></circle>
                    <text x="${cx + 10}" y="${cy - 12}" font-size="11.5" class="exec-ml-text exec-ml-text-muted">P${point.index + 1}</text>
                </g>
            `;
        }).join('');

        return render3DScene(`
            ${floor}
            ${grid}
            <line x1="${leftPad}" y1="${height - bottomPad}" x2="${width - rightPad}" y2="${height - bottomPad}" stroke="var(--exec-ml-axis-line)" stroke-width="1.9"></line>
            <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${height - bottomPad}" stroke="var(--exec-ml-axis-line)" stroke-width="1.9"></line>
            ${showLine ? `
                <line x1="${scaleX(lineStart.x)}" y1="${scaleY(lineStart.y)}" x2="${scaleX(lineEnd.x)}" y2="${scaleY(lineEnd.y)}" stroke="#bfdbfe" stroke-width="5" opacity="0.42"></line>
                <line x1="${scaleX(lineStart.x)}" y1="${scaleY(lineStart.y)}" x2="${scaleX(lineEnd.x)}" y2="${scaleY(lineEnd.y)}" stroke="#2563eb" stroke-width="2.7"></line>
            ` : ''}
            ${pointsSvg}
            ${showQuery ? `
                <line x1="${scaleX(queryX)}" y1="${height - bottomPad}" x2="${scaleX(queryX)}" y2="${scaleY(queryY)}" stroke="#9333ea" stroke-width="1.8" stroke-dasharray="5 4"></line>
                <circle cx="${scaleX(queryX)}" cy="${scaleY(queryY)}" r="6.7" fill="#c084fc" stroke="#6b21a8" stroke-width="1.4"></circle>
                <text x="${scaleX(queryX) + 11}" y="${scaleY(queryY) - 11}" font-size="11.5" class="exec-ml-text exec-ml-text-query">Query</text>
            ` : ''}
            <text x="${leftPad}" y="${height - 10}" font-size="11" class="exec-ml-text exec-ml-text-axis">x</text>
            <text x="16" y="${topPad + 2}" font-size="11" class="exec-ml-text exec-ml-text-axis">y</text>
        `, width, height, '3D linear regression chart', 'exec-3d-ml');
    }

    function renderLogisticCurve(z, options = {}) {
        const showPoint = options.showPoint === true;
        const probability = 1 / (1 + Math.exp(-z));
        const width = 500;
        const height = 252;
        const leftPad = 48;
        const rightPad = 22;
        const topPad = 22;
        const bottomPad = 34;
        const minX = -6;
        const maxX = 6;
        const minY = 0;
        const maxY = 1;
        const depth = 10;

        const scaleX = (x) => leftPad + (((x - minX) / (maxX - minX)) * (width - leftPad - rightPad));
        const scaleY = (y) => height - bottomPad - (((y - minY) / (maxY - minY)) * (height - topPad - bottomPad));

        const curvePath = [];
        for (let x = minX; x <= maxX; x += 0.2) {
            const y = 1 / (1 + Math.exp(-x));
            curvePath.push(`${scaleX(x)} ${scaleY(y)}`);
        }

        return render3DScene(`
            <polygon
                points="${leftPad},${height - bottomPad} ${leftPad + depth},${height - bottomPad - depth} ${width - rightPad + depth},${height - bottomPad - depth} ${width - rightPad},${height - bottomPad}"
                fill="var(--exec-ml-floor)"
                stroke="var(--exec-ml-floor-stroke)"
                stroke-width="1"
            ></polygon>
            <line x1="${leftPad}" y1="${height - bottomPad}" x2="${width - rightPad}" y2="${height - bottomPad}" stroke="var(--exec-ml-axis-line)" stroke-width="1.8"></line>
            <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${height - bottomPad}" stroke="var(--exec-ml-axis-line)" stroke-width="1.8"></line>
            <polyline points="${curvePath.join(' ')}" fill="none" stroke="#bfdbfe" stroke-width="5" opacity="0.5"></polyline>
            <polyline points="${curvePath.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2.7"></polyline>
            <line x1="${scaleX(0)}" y1="${topPad}" x2="${scaleX(0)}" y2="${height - bottomPad}" stroke="var(--exec-ml-grid)" stroke-width="1" stroke-dasharray="4 4"></line>
            <line x1="${leftPad}" y1="${scaleY(0.5)}" x2="${width - rightPad}" y2="${scaleY(0.5)}" stroke="var(--exec-ml-grid)" stroke-width="1" stroke-dasharray="4 4"></line>
            ${showPoint ? `
                <line x1="${scaleX(z)}" y1="${height - bottomPad}" x2="${scaleX(z)}" y2="${scaleY(probability)}" stroke="#9333ea" stroke-width="1.8" stroke-dasharray="5 4"></line>
                <circle cx="${scaleX(z)}" cy="${scaleY(probability)}" r="6.6" fill="#d8b4fe" stroke="#6b21a8" stroke-width="1.3"></circle>
                <text x="${scaleX(z) + 9}" y="${scaleY(probability) - 10}" font-size="11.5" class="exec-ml-text exec-ml-text-query">sigma(z)</text>
            ` : ''}
            <text x="${leftPad}" y="${height - 10}" font-size="11" class="exec-ml-text exec-ml-text-axis">z</text>
            <text x="14" y="${topPad + 2}" font-size="11" class="exec-ml-text exec-ml-text-axis">p</text>
        `, width, height, '3D sigmoid curve', 'exec-3d-ml');
    }

    function renderOneDimClusterPlot(points, centroids, assignments = [], options = {}) {
        const currentIndex = Number.isInteger(options.currentIndex) ? options.currentIndex : null;
        const width = 540;
        const height = 186;
        const leftPad = 34;
        const rightPad = 26;
        const axisY = 118;
        const depth = 8;
        const allValues = points.concat(centroids).filter((value) => Number.isFinite(value));
        let minValue = Math.min(...allValues);
        let maxValue = Math.max(...allValues);
        if (minValue === maxValue) {
            minValue -= 1;
            maxValue += 1;
        }
        const scaleX = (value) => leftPad + (((value - minValue) / (maxValue - minValue)) * (width - leftPad - rightPad));

        function clusterColor(clusterIndex) {
            if (clusterIndex === 0) return { top: '#93c5fd', side: '#2563eb', stroke: '#1d4ed8' };
            if (clusterIndex === 1) return { top: '#fdba74', side: '#ea580c', stroke: '#c2410c' };
            return { top: '#cbd5e1', side: '#64748b', stroke: '#475569' };
        }

        const pointMarks = points.map((value, idx) => {
            const x = scaleX(value);
            const palette = clusterColor(assignments[idx]);
            const r = idx === currentIndex ? 7.4 : 5.4;
            return `
                <g>
                    <circle cx="${x + (depth * 0.42)}" cy="${axisY - (depth * 0.42)}" r="${r}" fill="${palette.side}" opacity="0.95"></circle>
                    <circle cx="${x}" cy="${axisY}" r="${r}" fill="${palette.top}" stroke="${idx === currentIndex ? '#0f172a' : palette.stroke}" stroke-width="${idx === currentIndex ? '1.8' : '1.1'}"></circle>
                    <text x="${x}" y="${axisY + 23}" text-anchor="middle" font-size="11" class="exec-ml-text exec-ml-text-muted">${formatNumber(value)}</text>
                </g>
            `;
        }).join('');

        const centroidMarks = centroids.map((value, idx) => {
            const x = scaleX(value);
            const front = idx === 0 ? '#bfdbfe' : '#fed7aa';
            const side = idx === 0 ? '#2563eb' : '#ea580c';
            const stroke = idx === 0 ? '#1d4ed8' : '#c2410c';
            return `
                <g>
                    <polygon points="${x - 7},${axisY - 30} ${x + 4},${axisY - 38} ${x + 18},${axisY - 38} ${x + 7},${axisY - 30}" fill="${front}" stroke="${stroke}" stroke-width="1"></polygon>
                    <polygon points="${x + 7},${axisY - 30} ${x + 18},${axisY - 38} ${x + 18},${axisY - 18} ${x + 7},${axisY - 10}" fill="${side}" opacity="0.9"></polygon>
                    <rect x="${x - 7}" y="${axisY - 30}" width="14" height="20" rx="3" fill="${front}" stroke="${stroke}" stroke-width="1.4"></rect>
                    <text x="${x + 22}" y="${axisY - 31}" font-size="11.5" class="exec-ml-text exec-ml-text-muted">C${idx + 1}</text>
                </g>
            `;
        }).join('');

        return render3DScene(`
            <polygon points="${leftPad},${axisY} ${leftPad + depth},${axisY - depth} ${width - rightPad + depth},${axisY - depth} ${width - rightPad},${axisY}" fill="var(--exec-ml-floor)" stroke="var(--exec-ml-floor-stroke)" stroke-width="1"></polygon>
            <line x1="${leftPad}" y1="${axisY}" x2="${width - rightPad}" y2="${axisY}" stroke="var(--exec-ml-axis-line)" stroke-width="2"></line>
            ${pointMarks}
            ${centroidMarks}
        `, width, height, '3D K-means 1D plot', 'exec-3d-ml');
    }

    function renderKnnPlot(train, queryX, consideredSet = new Set(), topSet = new Set()) {
        const width = 540;
        const height = 206;
        const leftPad = 34;
        const rightPad = 26;
        const axisY = 124;
        const depth = 8;
        const values = train.map((row) => row.x).concat([queryX]);
        let minValue = Math.min(...values);
        let maxValue = Math.max(...values);
        if (minValue === maxValue) {
            minValue -= 1;
            maxValue += 1;
        }
        const scaleX = (value) => leftPad + (((value - minValue) / (maxValue - minValue)) * (width - leftPad - rightPad));

        const pointMarks = train.map((row) => {
            const x = scaleX(row.x);
            const isTop = topSet.has(row.index);
            const side = row.label === 'A' ? '#1d4ed8' : '#c2410c';
            const top = row.label === 'A' ? '#93c5fd' : '#fdba74';
            const stroke = consideredSet.has(row.index) ? '#0f172a' : 'transparent';
            return `
                <g>
                    <circle cx="${x + (depth * 0.42)}" cy="${axisY - (depth * 0.42)}" r="${isTop ? '7.7' : '5.6'}" fill="${side}" opacity="0.95"></circle>
                    <circle cx="${x}" cy="${axisY}" r="${isTop ? '7.7' : '5.6'}" fill="${top}" stroke="${stroke}" stroke-width="${consideredSet.has(row.index) ? '1.8' : '0'}"></circle>
                    <text x="${x}" y="${axisY + 22}" text-anchor="middle" font-size="11" class="exec-ml-text exec-ml-text-muted">${formatNumber(row.x)}</text>
                    <text x="${x}" y="${axisY - 13}" text-anchor="middle" font-size="11" class="exec-ml-text exec-ml-text-muted">${row.label}</text>
                </g>
            `;
        }).join('');

        return render3DScene(`
            <polygon points="${leftPad},${axisY} ${leftPad + depth},${axisY - depth} ${width - rightPad + depth},${axisY - depth} ${width - rightPad},${axisY}" fill="var(--exec-ml-floor)" stroke="var(--exec-ml-floor-stroke)" stroke-width="1"></polygon>
            <line x1="${leftPad}" y1="${axisY}" x2="${width - rightPad}" y2="${axisY}" stroke="var(--exec-ml-axis-line)" stroke-width="2"></line>
            ${pointMarks}
            <g>
                <path d="M ${scaleX(queryX)} ${axisY - 22} l 9 9 l -9 9 l -9 -9 z" fill="#d8b4fe" stroke="#6b21a8" stroke-width="1.3"></path>
                <text x="${scaleX(queryX)}" y="${axisY - 33}" text-anchor="middle" font-size="11.5" class="exec-ml-text exec-ml-text-query">Query</text>
            </g>
        `, width, height, '3D KNN neighbor plot', 'exec-3d-ml');
    }

    function renderEntropyBars(positive, negative, pPos, pNeg) {
        const width = 450;
        const height = 232;
        const chartBaseY = 188;
        const barWidth = 66;
        const gap = 92;
        const firstX = 120;
        const secondX = firstX + barWidth + gap;
        const maxBarHeight = 132;
        const depth = 9;
        const posH = Math.max(2, pPos * maxBarHeight);
        const negH = Math.max(2, pNeg * maxBarHeight);

        function bar3D(x, h, front, side, top, label, valueColor, valueText) {
            return `
                <g>
                    <polygon points="${x},${chartBaseY - h} ${x + depth},${chartBaseY - h - depth} ${x + barWidth + depth},${chartBaseY - h - depth} ${x + barWidth},${chartBaseY - h}" fill="${top}"></polygon>
                    <polygon points="${x + barWidth},${chartBaseY - h} ${x + barWidth + depth},${chartBaseY - h - depth} ${x + barWidth + depth},${chartBaseY - depth} ${x + barWidth},${chartBaseY}" fill="${side}" opacity="0.92"></polygon>
                    <rect x="${x}" y="${chartBaseY - h}" width="${barWidth}" height="${h}" rx="8" fill="${front}" stroke="#334155" stroke-width="1.1"></rect>
                    <text x="${x + (barWidth / 2)}" y="${chartBaseY + 18}" text-anchor="middle" font-size="12.5" class="exec-ml-text exec-ml-text-muted">${label}</text>
                    <text x="${x + (barWidth / 2)}" y="${chartBaseY - h - 10}" text-anchor="middle" font-size="12.5" class="exec-ml-text ${valueColor}">${valueText}</text>
                </g>
            `;
        }

        return render3DScene(`
            <polygon points="62,${chartBaseY} 71,${chartBaseY - depth} 370,${chartBaseY - depth} 362,${chartBaseY}" fill="var(--exec-ml-floor)" stroke="var(--exec-ml-floor-stroke)" stroke-width="1"></polygon>
            <line x1="62" y1="${chartBaseY}" x2="362" y2="${chartBaseY}" stroke="var(--exec-ml-axis-line)" stroke-width="1.8"></line>
            ${bar3D(firstX, posH, '#86efac', '#16a34a', '#bbf7d0', 'Positive', 'exec-ml-text-positive', formatNumber(pPos, 3, true))}
            ${bar3D(secondX, negH, '#fdba74', '#ea580c', '#fed7aa', 'Negative', 'exec-ml-text-negative', formatNumber(pNeg, 3, true))}
            <text x="12" y="24" font-size="11.5" class="exec-ml-text exec-ml-text-axis">counts: +${formatNumber(positive)}, -${formatNumber(negative)}</text>
        `, width, height, '3D class distribution', 'exec-3d-ml');
    }

    function renderScoreBars(spamScore, hamScore) {
        const width = 500;
        const height = 190;
        const trackX = 116;
        const trackWidth = 292;
        const trackHeight = 18;
        const topY = 58;
        const rowGap = 58;
        const depth = 7;
        const maxScore = Math.max(spamScore, hamScore, 1e-9);
        const spamWidth = Math.max(8, (spamScore / maxScore) * trackWidth);
        const hamWidth = Math.max(8, (hamScore / maxScore) * trackWidth);

        function scoreRow(label, y, widthValue, front, side, top, score) {
            return `
                <g>
                    <text x="32" y="${y + 12}" font-size="12.5" class="exec-ml-text exec-ml-text-muted">${label}</text>
                    <rect x="${trackX}" y="${y}" width="${trackWidth}" height="${trackHeight}" rx="8" fill="var(--exec-ml-floor)"></rect>
                    <polygon points="${trackX},${y} ${trackX + depth},${y - depth} ${trackX + widthValue + depth},${y - depth} ${trackX + widthValue},${y}" fill="${top}"></polygon>
                    <polygon points="${trackX + widthValue},${y} ${trackX + widthValue + depth},${y - depth} ${trackX + widthValue + depth},${y + trackHeight - depth} ${trackX + widthValue},${y + trackHeight}" fill="${side}" opacity="0.9"></polygon>
                    <rect x="${trackX}" y="${y}" width="${widthValue}" height="${trackHeight}" rx="8" fill="${front}"></rect>
                    <text x="${trackX + trackWidth + 14}" y="${y + 12}" font-size="12.5" class="exec-ml-text">${formatNumber(score, 6, true)}</text>
                </g>
            `;
        }

        return render3DScene(`
            ${scoreRow('Spam', topY, spamWidth, '#fda4af', '#e11d48', '#fecdd3', spamScore)}
            ${scoreRow('Ham', topY + rowGap, hamWidth, '#93c5fd', '#2563eb', '#bfdbfe', hamScore)}
        `, width, height, '3D posterior score bars', 'exec-3d-ml');
    }

    function renderNeuronDiagram(x1, x2, w1, w2, b, z, output, stage = 'input') {
        const isW1Active = stage === 'term1' || stage === 'linear' || stage === 'output';
        const isW2Active = stage === 'term2' || stage === 'linear' || stage === 'output';
        const isLinearActive = stage === 'linear' || stage === 'output';
        const isOutputActive = stage === 'output';
        const width = 640;
        const height = 286;
        const depth = 9;

        function linkWithArrow(x1Pos, y1Pos, x2Pos, y2Pos, color, isActive) {
            const strokeColor = isActive ? color : '#94a3b8';
            const glowOpacity = isActive ? '0.55' : '0.18';
            return `
                <g>
                    <line x1="${x1Pos}" y1="${y1Pos}" x2="${x2Pos}" y2="${y2Pos}" stroke="${strokeColor}" stroke-width="6.8" opacity="${glowOpacity}"></line>
                    <line x1="${x1Pos}" y1="${y1Pos}" x2="${x2Pos}" y2="${y2Pos}" stroke="${strokeColor}" stroke-width="${isActive ? '3.2' : '2'}" stroke-linecap="round"></line>
                    <path d="M ${x2Pos - 10} ${y2Pos - 6} L ${x2Pos + 2} ${y2Pos} L ${x2Pos - 10} ${y2Pos + 6} Z" fill="${strokeColor}" opacity="${isActive ? '0.98' : '0.66'}"></path>
                </g>
            `;
        }

        function nodeCard(cx, cy, r, palette, title, value, isActive) {
            const strokeWidth = isActive ? '2.8' : '1.8';
            return `
                <g>
                    <circle cx="${cx + (depth * 0.45)}" cy="${cy - (depth * 0.45)}" r="${r}" fill="${palette.side}" opacity="${isActive ? '0.98' : '0.84'}"></circle>
                    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${palette.front}" stroke="${palette.stroke}" stroke-width="${strokeWidth}"></circle>
                    <circle cx="${cx}" cy="${cy}" r="${r - 4.2}" fill="none" stroke="${palette.ring}" stroke-width="${isActive ? '1.8' : '1.1'}" opacity="${isActive ? '0.9' : '0.55'}"></circle>
                    <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="10.2" class="exec-ml-text exec-ml-text-muted">${title}</text>
                    <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="13.3" class="exec-ml-text">${value}</text>
                </g>
            `;
        }

        function metricPill(x, y, text, activeColor, isActive) {
            const fill = isActive ? activeColor : 'var(--exec-ml-floor)';
            const textClass = isActive ? 'exec-ml-text-query' : 'exec-ml-text-muted';
            return `
                <g>
                    <rect x="${x}" y="${y}" width="132" height="20" rx="8" fill="${fill}" opacity="${isActive ? '0.34' : '0.9'}"></rect>
                    <text x="${x + 10}" y="${y + 14}" font-size="11.2" class="exec-ml-text ${textClass}">${text}</text>
                </g>
            `;
        }

        return render3DScene(`
            <polygon points="42,235 58,222 616,222 600,235" fill="var(--exec-ml-floor)" opacity="0.7"></polygon>
            <rect x="48" y="52" width="568" height="170" rx="18" fill="rgba(15,23,42,0.1)" stroke="var(--exec-ml-floor-stroke)" stroke-width="1.1"></rect>

            <text x="72" y="42" font-size="10.5" class="exec-ml-text exec-ml-text-axis">Input Layer</text>
            <text x="290" y="42" font-size="10.5" class="exec-ml-text exec-ml-text-axis">Linear Unit</text>
            <text x="502" y="42" font-size="10.5" class="exec-ml-text exec-ml-text-axis">Activation</text>

            ${linkWithArrow(140, 88, 286, 128, '#2563eb', isW1Active)}
            ${linkWithArrow(140, 182, 286, 132, '#10b981', isW2Active)}
            ${linkWithArrow(366, 130, 488, 130, '#9333ea', isOutputActive)}

            ${nodeCard(
                106, 84, 30,
                { front: '#dbeafe', side: '#2563eb', stroke: '#1d4ed8', ring: '#60a5fa' },
                'x1',
                formatNumber(x1),
                isW1Active
            )}
            ${nodeCard(
                106, 186, 30,
                { front: '#dcfce7', side: '#10b981', stroke: '#15803d', ring: '#34d399' },
                'x2',
                formatNumber(x2),
                isW2Active
            )}
            ${nodeCard(
                328, 130, 38,
                { front: '#ffedd5', side: '#f97316', stroke: '#c2410c', ring: '#fb923c' },
                'z',
                formatNumber(z, 3, true),
                isLinearActive
            )}
            ${nodeCard(
                524, 130, 34,
                { front: '#f3e8ff', side: '#a855f7', stroke: '#7c3aed', ring: '#c084fc' },
                'sigma(z)',
                formatNumber(output, 3, true),
                isOutputActive
            )}

            ${metricPill(166, 70, `w1=${formatNumber(w1, 3, true)}`, '#60a5fa', isW1Active)}
            ${metricPill(166, 168, `w2=${formatNumber(w2, 3, true)}`, '#34d399', isW2Active)}
            ${metricPill(258, 58, `b=${formatNumber(b, 3, true)}`, '#fb923c', isLinearActive)}
        `, width, height, '3D single neuron network', 'exec-3d-ml');
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
        const rawWeights = normalizeNumberArray(payload.weights);
        const rawValues = normalizeNumberArray(payload.values);
        const capacity = asFiniteNumber(payload.capacity, 0);
        const pairCount = Math.min(rawWeights.length, rawValues.length);
        const items = [];
        for (let idx = 0; idx < pairCount; idx += 1) {
            const weight = Math.floor(rawWeights[idx]);
            const value = Math.floor(rawValues[idx]);
            if (!Number.isFinite(weight) || !Number.isFinite(value) || weight <= 0) {
                continue;
            }
            items.push({ index: idx, weight, value });
        }
        if (!items.length || capacity <= 0) {
            return null;
        }

        const cap = Math.floor(capacity);
        if (cap <= 0) {
            return null;
        }

        const dp = new Array(cap + 1).fill(0);
        const totalTransitions = items.reduce(
            (sum, item) => sum + Math.max(0, cap - item.weight + 1),
            0
        );
        let transitionsDone = 0;
        let improvementCount = 0;

        function renderKnapsackStatus(options = {}) {
            const focusCap = Number.isInteger(options.focusCap) ? options.focusCap : null;
            const currentItem = Number.isInteger(options.itemIndex) ? items[options.itemIndex] : null;
            const improvedCaps = options.improvedCaps instanceof Set ? options.improvedCaps : new Set();
            const keepLabel = Number.isFinite(options.keep) ? formatNumber(options.keep) : '-';
            const takeLabel = Number.isFinite(options.take) ? formatNumber(options.take) : '-';
            const bestLabel = Number.isFinite(options.best) ? formatNumber(options.best) : '-';
            const progress = totalTransitions > 0
                ? Math.round((transitionsDone / totalTransitions) * 100)
                : 100;
            const processedItems = Number.isInteger(options.processedItems) ? options.processedItems : 0;
            const currentSet = Number.isInteger(focusCap) ? new Set([focusCap]) : new Set();
            const decisionLabel = options.decisionLabel || 'Pending';

            return `
                ${renderIndexedStrip3D(dp, improvedCaps, currentSet, 'cap')}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Current item:</strong> ${currentItem ? `I${options.itemIndex + 1} (w=${formatNumber(currentItem.weight)}, v=${formatNumber(currentItem.value)})` : '-'}</div>
                    <div class="binary-search-status-line"><strong>Capacity slot:</strong> ${Number.isInteger(focusCap) ? focusCap : '-'} | <strong>keep:</strong> ${keepLabel} | <strong>take:</strong> ${takeLabel} | <strong>best:</strong> ${bestLabel}</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)}</div>
                    <div class="binary-search-status-line"><strong>Processed items:</strong> ${processedItems}/${items.length} | <strong>Improved slots:</strong> ${improvedCaps.size} | <strong>Total improvements:</strong> ${improvementCount}</div>
                    <div class="binary-search-status-line"><strong>Best @ capacity ${cap}:</strong> ${formatNumber(dp[cap])}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Transitions ${transitionsDone}/${totalTransitions}</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = capacity index, Y = DP value lane, Z = item-step depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize DP',
                `Capacity ${cap}, ${items.length} valid items. Start with zero value at all capacities.`,
                renderKnapsackStatus({
                    itemIndex: null,
                    focusCap: null,
                    keep: null,
                    take: null,
                    best: null,
                    improvedCaps: new Set(),
                    processedItems: 0,
                    decisionLabel: 'Ready',
                }),
                '<code>dp[c] = 0</code> for all <code>c in [0..capacity]</code>'
            ),
        ];

        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            const improvedCaps = new Set();

            steps.push(
                makeStep(
                    `Activate item I${i + 1}`,
                    `Item weight=${formatNumber(item.weight)}, value=${formatNumber(item.value)}. Traverse capacities from ${cap} down to ${item.weight}.`,
                    renderKnapsackStatus({
                        itemIndex: i,
                        focusCap: cap,
                        keep: dp[cap],
                        take: cap >= item.weight ? dp[cap - item.weight] + item.value : null,
                        best: dp[cap],
                        improvedCaps: new Set(improvedCaps),
                        processedItems: i,
                        decisionLabel: 'Item activated',
                    }),
                    `<code>for c from ${cap} downto ${item.weight}: dp[c] = max(dp[c], dp[c-${item.weight}] + ${item.value})</code>`
                )
            );

            for (let c = cap; c >= item.weight; c -= 1) {
                const keep = dp[c];
                const take = dp[c - item.weight] + item.value;
                const best = Math.max(keep, take);
                const changed = best !== keep;
                dp[c] = best;
                transitionsDone += 1;
                if (changed) {
                    improvedCaps.add(c);
                    improvementCount += 1;
                }

                if (changed || i < 2 || c === cap || c === item.weight) {
                    steps.push(
                        makeStep(
                            `Item I${i + 1}, capacity ${c}`,
                            changed
                                ? `Take item: value improves ${formatNumber(keep)} -> ${formatNumber(best)}.`
                                : `Skip item: keep current best ${formatNumber(keep)}.`,
                            renderKnapsackStatus({
                                itemIndex: i,
                                focusCap: c,
                                keep,
                                take,
                                best,
                                improvedCaps: new Set(improvedCaps),
                                processedItems: i + 1,
                                decisionLabel: changed ? 'take item' : 'skip item',
                            }),
                            `
                                <code>dp[${c}] = max(dp[${c}], dp[${c - item.weight}] + ${item.value})</code><br>
                                <code>max(${formatNumber(keep)}, ${formatNumber(take)}) = ${formatNumber(best)}</code>
                            `
                        )
                    );
                }
            }

            steps.push(
                makeStep(
                    `Item I${i + 1} complete`,
                    `After item I${i + 1}, improved capacities: ${improvedCaps.size ? `[${Array.from(improvedCaps).sort((a, b) => a - b).join(', ')}]` : 'none'}.`,
                    renderKnapsackStatus({
                        itemIndex: i,
                        focusCap: cap,
                        keep: dp[cap],
                        take: null,
                        best: dp[cap],
                        improvedCaps: new Set(improvedCaps),
                        processedItems: i + 1,
                        decisionLabel: 'Item pass complete',
                    }),
                    `<code>item ${i + 1} pass finalized</code>`
                )
            );
        }

        steps.push(
            makeStep(
                'Final Answer',
                `Maximum value at capacity ${cap} is ${formatNumber(dp[cap])}.`,
                `
                    ${renderKnapsackStatus({
                        itemIndex: items.length - 1,
                        focusCap: cap,
                        keep: dp[cap],
                        take: null,
                        best: dp[cap],
                        improvedCaps: new Set([cap]),
                        processedItems: items.length,
                        decisionLabel: 'Optimal value ready',
                    })}
                    <div class="exec-summary success">Answer: ${formatNumber(dp[cap])}</div>
                `,
                '<code>answer = dp[capacity]</code>'
            )
        );

        return {
            title: 'Execution Visualization - Knapsack',
            subtitle: 'Replay 0/1 DP transitions with capacity-index telemetry and 3D state board.',
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
        const totalCells = m * n;
        let processedCells = 0;
        let matchCount = 0;

        function renderLcsStatus(activeI = 0, activeJ = 0, decisionLabel = 'Ready', done = false) {
            const i = Number.isInteger(activeI) ? activeI : 0;
            const j = Number.isInteger(activeJ) ? activeJ : 0;
            const charOne = i > 0 ? s1[i - 1] : '-';
            const charTwo = j > 0 ? s2[j - 1] : '-';
            const prefixOne = s1.slice(0, Math.max(0, i));
            const prefixTwo = s2.slice(0, Math.max(0, j));
            const progress = totalCells > 0
                ? Math.round((processedCells / totalCells) * 100)
                : 100;
            return `
                ${renderMatrix(dp, s1, s2, i, j)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Comparing:</strong> s1[${Math.max(0, i - 1)}]='${escapeHtml(charOne)}' vs s2[${Math.max(0, j - 1)}]='${escapeHtml(charTwo)}'</div>
                    <div class="binary-search-status-line"><strong>Cell:</strong> (${i}, ${j}) | <strong>Decision:</strong> ${escapeHtml(decisionLabel)}</div>
                    <div class="binary-search-status-line"><strong>Prefixes:</strong> "${escapeHtml(prefixOne || 'empty')}" vs "${escapeHtml(prefixTwo || 'empty')}"</div>
                    <div class="binary-search-status-line"><strong>Value meaning:</strong> Numbers like 0/1/2 are LCS lengths for the two prefixes.</div>
                    <div class="binary-search-status-line"><strong>Processed:</strong> ${processedCells}/${totalCells} | <strong>Matches:</strong> ${matchCount}</div>
                    <div class="binary-search-status-line"><strong>LCS length so far:</strong> ${formatNumber(dp[m][n])}${done ? ' (final)' : ''}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">DP matrix fill progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = s2 index, Y = s1 index, Z = DP value depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Matrix',
                `Build (${m + 1} x ${n + 1}) matrix with zeros.`,
                renderLcsStatus(0, 0, 'Matrix initialized', false),
                '<code>dp[0][*] = dp[*][0] = 0</code>'
            ),
        ];

        for (let i = 1; i <= m; i += 1) {
            for (let j = 1; j <= n; j += 1) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                    processedCells += 1;
                    matchCount += 1;
                    steps.push(
                        makeStep(
                            `Match at (${i}, ${j})`,
                            `'${s1[i - 1]}' matches '${s2[j - 1]}', take diagonal + 1.`,
                            renderLcsStatus(i, j, 'Diagonal + 1', false),
                            `<code>dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1 = ${dp[i][j]}</code>`
                        )
                    );
                } else {
                    const up = dp[i - 1][j];
                    const left = dp[i][j - 1];
                    dp[i][j] = Math.max(up, left);
                    processedCells += 1;
                    steps.push(
                        makeStep(
                            `Mismatch at (${i}, ${j})`,
                            `'${s1[i - 1]}' != '${s2[j - 1]}', take max(up, left).`,
                            renderLcsStatus(i, j, up >= left ? 'Take up cell' : 'Take left cell', false),
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
                `
                    ${renderLcsStatus(m, n, 'LCS length finalized', true)}
                    <div class="exec-summary success">Answer: ${formatNumber(dp[m][n])}</div>
                `,
                `<code>Answer = dp[${m}][${n}]</code>`
            )
        );

        return {
            title: 'Execution Visualization - LCS',
            subtitle: 'Cell-by-cell DP fill with live matrix telemetry and decision tracking.',
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
        const selectedRows = new Set();
        const selected = [];
        let lastEnd = -Infinity;
        let processedCount = 0;

        function renderActivityStatus(currentRow = -1, decisionLabel = 'Ready', detailLabel = 'Pending', done = false) {
            const current = Number.isInteger(currentRow) && currentRow >= 0 && currentRow < sorted.length
                ? sorted[currentRow]
                : null;
            const selectedLabel = selected.length
                ? selected.map((item) => `A${item.index + 1}[${formatNumber(item.start)},${formatNumber(item.end)})`).join(', ')
                : '-';
            const progress = sorted.length ? Math.round((processedCount / sorted.length) * 100) : 100;
            return `
                ${renderActivityTimeline3D(sorted, selectedRows, currentRow)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Current:</strong> ${current ? `A${current.index + 1} [${formatNumber(current.start)}, ${formatNumber(current.end)})` : '-'}</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Selected activities:</strong> ${selectedLabel}</div>
                    <div class="binary-search-status-line"><strong>Selected count:</strong> ${selected.length}${done ? ' (final)' : ''}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Checked ${processedCount}/${sorted.length} activities</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = timeline span, Y = sorted activity rows, Z = decision depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Sort by Finish Time',
                'Greedy starts by earliest finishing activity.',
                renderActivityStatus(-1, 'Sort by end time', 'Ready to scan from earliest finish', false),
                '<code>Sort activities by end ascending</code>'
            ),
        ];

        sorted.forEach((item, rowIdx) => {
            const previousLastEnd = lastEnd;
            const compatible = item.start >= previousLastEnd;
            if (compatible) {
                selected.push(item);
                selectedRows.add(rowIdx);
                lastEnd = item.end;
            }
            processedCount += 1;
            steps.push(
                makeStep(
                    `Check A${item.index + 1}`,
                    compatible
                        ? `Compatible (${formatNumber(item.start)} >= ${Number.isFinite(previousLastEnd) ? formatNumber(previousLastEnd) : '-inf'}), select it.`
                        : `Overlaps (${formatNumber(item.start)} < ${formatNumber(previousLastEnd)}), skip.`,
                    renderActivityStatus(
                        rowIdx,
                        compatible ? 'Select activity' : 'Skip activity',
                        compatible ? `Update last_end to ${formatNumber(item.end)}` : `Keep last_end as ${formatNumber(previousLastEnd)}`,
                        false
                    ),
                    `<code>Select if start >= last_end</code>`
                )
            );
        });

        steps.push(
            makeStep(
                'Final Answer',
                `Maximum non-overlapping activities selected: ${selected.length}.`,
                `
                    ${renderActivityStatus(-1, 'Greedy complete', 'Earliest-finish rule finalized', true)}
                    <div class="exec-summary">Chosen activities: [${selected.map((it) => `A${it.index + 1}`).join(', ') || '-'}]</div>
                    <div class="exec-summary success">Answer: ${selected.length}</div>
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
        const stepLimit = 180;
        const allNonNegative = values.every((value) => value >= 0);
        const indexLegend = values.map((value, idx) => `i${idx}=${formatNumber(value)}`).join(' | ');
        let expandedNodes = 0;
        let prunedNodes = 0;
        let maxDepth = 0;
        let lastSnapshot = { index: 0, sum: 0, chosenIndices: [] };

        function pushStep(step) {
            if (steps.length < stepLimit) {
                steps.push(step);
            }
        }

        function formatChosen(indices) {
            if (!indices.length) {
                return '(empty)';
            }
            return indices.map((idx) => `i${idx}(${formatNumber(values[idx])})`).join(', ');
        }

        function formatFoundSubsets() {
            if (!validKeys.size) {
                return '-';
            }
            return Array.from(validKeys)
                .map((key) => `[${key}]`)
                .join(', ');
        }

        function hasZeroFrom(startIndex) {
            for (let i = Math.max(0, startIndex); i < values.length; i += 1) {
                if (values[i] === 0) {
                    return true;
                }
            }
            return false;
        }

        function renderBacktrackingStatus(index, sum, chosenIndices, decisionLabel = 'Explore', detailLabel = 'Branching', done = false) {
            const highlightSet = new Set(chosenIndices);
            const activeSet = index < values.length ? new Set([index]) : new Set();
            const depth = chosenIndices.length;
            const theoreticalNodes = Math.max(1, (2 ** Math.min(values.length, 12)) - 1);
            const progress = Math.min(100, Math.round((expandedNodes / theoreticalNodes) * 100));
            const nextValueLabel = index < values.length ? formatNumber(values[index]) : '-';
            const remaining = formatNumber(target - sum);
            return `
                ${renderIndexedStrip3D(values, highlightSet, activeSet)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Index map:</strong> ${escapeHtml(indexLegend)}</div>
                    <div class="binary-search-status-line"><strong>Node:</strong> i=${index} | <strong>Next value:</strong> ${nextValueLabel} | <strong>Depth:</strong> ${depth}${done ? ' (final)' : ''}</div>
                    <div class="binary-search-status-line"><strong>Subset path:</strong> ${escapeHtml(formatChosen(chosenIndices))}</div>
                    <div class="binary-search-status-line"><strong>Sum:</strong> ${formatNumber(sum)} | <strong>Target:</strong> ${formatNumber(target)} | <strong>Remaining:</strong> ${remaining}</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Expanded:</strong> ${expandedNodes} | <strong>Pruned:</strong> ${prunedNodes} | <strong>Max depth:</strong> ${maxDepth}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Search exploration ${progress}% (capped view)</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = item index, Y = single state row, Z = recursion depth cue.</em></div>
            `;
        }

        function dfs(index, sum, chosenIndices) {
            if (steps.length >= stepLimit) {
                return;
            }
            expandedNodes += 1;
            maxDepth = Math.max(maxDepth, chosenIndices.length);
            lastSnapshot = { index, sum, chosenIndices: chosenIndices.slice() };
            const chosenValues = chosenIndices.map((entry) => values[entry]);

            pushStep(
                makeStep(
                    `Visit node i=${index}`,
                    `Current subset [${chosenValues.join(', ')}], running sum=${formatNumber(sum)}.`,
                    renderBacktrackingStatus(index, sum, chosenIndices, 'Visit node', index < values.length ? 'Try include/exclude branches' : 'No next item', false),
                    '<code>branch(i, sum) => include(values[i]) or exclude(values[i])</code>'
                )
            );

            if (sum === target) {
                validKeys.add(chosenValues.slice().sort((a, b) => a - b).join(','));
                pushStep(
                    makeStep(
                        'Target hit',
                        `[${chosenValues.join(', ')}] reaches target ${formatNumber(target)}.`,
                        `
                            ${renderBacktrackingStatus(index, sum, chosenIndices, 'Record subset', 'Count this subset as valid', false)}
                            <div class="exec-summary success">Valid subsets found: ${validKeys.size}</div>
                        `,
                        '<code>if sum == target: store normalized subset</code>'
                    )
                );
                const shouldStopAfterHit = allNonNegative && !hasZeroFrom(index);
                if (shouldStopAfterHit) {
                    prunedNodes += 1;
                    pushStep(
                        makeStep(
                            'Prune after target',
                            'Target already reached and all remaining values are positive, so further includes cannot create a new valid sum.',
                            renderBacktrackingStatus(index, sum, chosenIndices, 'Prune', 'Positive-only tail after exact target hit', false),
                            '<code>if sum == target and remaining values > 0: return</code>'
                        )
                    );
                    return;
                }
            }

            if (index >= values.length) {
                prunedNodes += 1;
                pushStep(
                    makeStep(
                        'Dead end',
                        `Reached end of values with sum=${formatNumber(sum)} (target=${formatNumber(target)}).`,
                        renderBacktrackingStatus(index, sum, chosenIndices, 'Stop branch', 'No items left to explore', false),
                        '<code>if i == n and sum != target: return</code>'
                    )
                );
                return;
            }

            if (allNonNegative && sum > target) {
                prunedNodes += 1;
                pushStep(
                    makeStep(
                        'Prune branch',
                        `Sum ${formatNumber(sum)} exceeded target ${formatNumber(target)} with non-negative values.`,
                        renderBacktrackingStatus(index, sum, chosenIndices, 'Prune', 'Further includes cannot decrease sum', false),
                        '<code>if values are non-negative and sum > target: prune</code>'
                    )
                );
                return;
            }

            dfs(index + 1, sum + values[index], chosenIndices.concat(index));
            dfs(index + 1, sum, chosenIndices);
        }

        dfs(0, 0, []);
        pushStep(
            makeStep(
                'Final Answer',
                `Unique valid subsets counted: ${validKeys.size}.`,
                `
                    ${renderBacktrackingStatus(lastSnapshot.index, lastSnapshot.sum, lastSnapshot.chosenIndices, 'Search complete', 'All reachable branches explored', true)}
                    <div class="exec-summary">Valid subsets: ${formatFoundSubsets()}</div>
                    <div class="exec-summary success">Answer: ${validKeys.size}</div>
                `,
                '<code>Count all unique subsets with sum == target</code>'
            )
        );

        return {
            title: 'Execution Visualization - Backtracking',
            subtitle: 'Subset-sum backtracking with branch pruning, index mapping, and recursion-depth telemetry.',
            steps,
        };
    }

    function buildRecursionModel(payload) {
        const n = Math.floor(asFiniteNumber(payload.n, 0));
        if (!Number.isInteger(n) || n < 1) {
            return null;
        }

        const seq = [0, 1];
        let computedCount = 0;
        const totalTerms = n + 1;

        function renderRecursionStatus(activeIndex = 1, decisionLabel = 'Ready', detailLabel = 'Pending', done = false) {
            const activeSet = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < seq.length
                ? new Set([activeIndex])
                : new Set();
            const knownSet = new Set(Array.from({ length: seq.length }, (_, idx) => idx));
            const knownTerms = Math.min(seq.length, totalTerms);
            const progress = totalTerms > 0 ? Math.round((knownTerms / totalTerms) * 100) : 100;
            const activeValue = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < seq.length
                ? formatNumber(seq[activeIndex])
                : '-';
            const baseLabel = 'F0=0, F1=1';
            const recurrenceLabel = Number.isInteger(activeIndex) && activeIndex >= 2 && activeIndex < seq.length
                ? `F${activeIndex - 1} + F${activeIndex - 2} = ${formatNumber(seq[activeIndex - 1])} + ${formatNumber(seq[activeIndex - 2])}`
                : 'Fi = F(i-1) + F(i-2)';
            return `
                ${renderIndexedStrip3D(seq, knownSet, activeSet)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Base cases:</strong> ${baseLabel}</div>
                    <div class="binary-search-status-line"><strong>Active term:</strong> ${Number.isInteger(activeIndex) ? `F${activeIndex}` : '-'} = ${activeValue}${done ? ' (final)' : ''}</div>
                    <div class="binary-search-status-line"><strong>Recurrence:</strong> ${escapeHtml(recurrenceLabel)}</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Known terms:</strong> ${knownTerms}/${totalTerms} | <strong>Computed terms:</strong> ${computedCount}/${Math.max(0, n - 1)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Sequence coverage ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = Fibonacci index, Y = single sequence row, Z = recurrence-step depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Base Cases',
                'Start with F0=0 and F1=1.',
                renderRecursionStatus(1, 'Initialize base cases', 'Seed sequence with two fixed values', false),
                '<code>F(0)=0, F(1)=1</code>'
            ),
        ];

        for (let i = 2; i <= n; i += 1) {
            const next = seq[i - 1] + seq[i - 2];
            computedCount += 1;
            seq.push(next);
            steps.push(
                makeStep(
                    `Compute F${i}`,
                    `F${i} = F${i - 1} + F${i - 2} = ${seq[i - 1]} + ${seq[i - 2]} = ${next}`,
                    renderRecursionStatus(i, `Compute F${i}`, `Use F${i - 1} and F${i - 2} to derive next term`, false),
                    `<code>F(${i}) = F(${i - 1}) + F(${i - 2})</code>`
                )
            );
        }
        steps.push(
            makeStep(
                'Final Answer',
                `F${n} = ${seq[n]}`,
                `
                    ${renderRecursionStatus(n, 'Sequence complete', 'All required terms computed', true)}
                    <div class="exec-summary">Sequence: [${seq.join(', ')}]</div>
                    <div class="exec-summary success">Answer: ${formatNumber(seq[n])}</div>
                `,
                '<code>Answer is final sequence element</code>'
            )
        );

        return {
            title: 'Execution Visualization - Recursion (Fibonacci)',
            subtitle: 'Build Fibonacci terms from base cases with recurrence telemetry and 3D sequence mapping.',
            steps,
        };
    }

    function buildBitConversionModel(payload) {
        const decimal = Math.floor(asFiniteNumber(payload.decimal, Number.NaN));
        if (!Number.isInteger(decimal) || decimal < 0) {
            return null;
        }

        const targetBinary = decimal.toString(2);
        const expectedDivisions = Math.max(1, targetBinary.length);

        function renderBitStatus(bitsLsbToMsb, options = {}) {
            const safeBits = Array.isArray(bitsLsbToMsb) ? bitsLsbToMsb.slice() : [];
            const currentDividend = Number.isFinite(options.currentDividend) ? options.currentDividend : null;
            const quotient = Number.isFinite(options.quotient) ? options.quotient : null;
            const remainder = Number.isFinite(options.remainder) ? options.remainder : null;
            const done = Boolean(options.done);
            const decisionLabel = options.decisionLabel || 'Update bits';
            const detailLabel = options.detailLabel || 'Track quotient and remainder';
            const divisionsDone = Number.isInteger(options.divisionsDone) ? options.divisionsDone : safeBits.length;
            const activeIndex = Number.isInteger(options.activeIndex) ? options.activeIndex : (safeBits.length ? safeBits.length - 1 : -1);
            const bitSequence = safeBits.length ? safeBits.join(', ') : '-';
            const currentBinary = safeBits.length ? safeBits.slice().reverse().join('') : '0';
            const progress = expectedDivisions > 0
                ? Math.min(100, Math.round((divisionsDone / expectedDivisions) * 100))
                : 100;
            const highlightSet = safeBits.length
                ? new Set(Array.from({ length: safeBits.length }, (_, idx) => idx))
                : new Set();
            const activeSet = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < safeBits.length
                ? new Set([activeIndex])
                : new Set();

            return `
                ${renderIndexedStrip3D(safeBits.length ? safeBits : [0], highlightSet, activeSet, 'bit')}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Decimal target:</strong> ${formatNumber(decimal)} | <strong>Binary target:</strong> ${targetBinary}</div>
                    <div class="binary-search-status-line"><strong>Current value:</strong> ${currentDividend === null ? '-' : formatNumber(currentDividend)} | <strong>Quotient:</strong> ${quotient === null ? '-' : formatNumber(quotient)} | <strong>Remainder:</strong> ${remainder === null ? '-' : formatNumber(remainder)}</div>
                    <div class="binary-search-status-line"><strong>Remainders (LSB->MSB):</strong> [${bitSequence}]</div>
                    <div class="binary-search-status-line"><strong>Binary so far (MSB->LSB):</strong> ${currentBinary}${done ? ' (final)' : ''}</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Division progress ${progress}% (${Math.min(divisionsDone, expectedDivisions)}/${expectedDivisions})</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = bit position capture order, Y = single bit row, Z = division-step depth cue.</em></div>
            `;
        }

        if (decimal === 0) {
            return {
                title: 'Execution Visualization - Bit Conversion',
                subtitle: 'Repeated division by 2 to construct binary digits.',
                steps: [
                    makeStep(
                        'Special Case',
                        'Decimal 0 directly maps to binary 0.',
                        `
                            ${renderBitStatus([0], {
                                currentDividend: 0,
                                quotient: 0,
                                remainder: 0,
                                decisionLabel: 'Special case',
                                detailLabel: 'Zero has binary representation 0',
                                divisionsDone: 1,
                                activeIndex: 0,
                                done: true,
                            })}
                            <div class="exec-summary success">Answer: 0</div>
                        `,
                        '<code>0 -> 0</code>'
                    ),
                ],
            };
        }

        const remainders = [];
        const steps = [];
        let current = decimal;
        let divisionsDone = 0;
        while (current > 0) {
            const dividend = current;
            const quotient = Math.floor(current / 2);
            const remainder = current % 2;
            remainders.push(remainder);
            divisionsDone += 1;
            steps.push(
                makeStep(
                    `Divide ${dividend} by 2`,
                    `Quotient=${quotient}, remainder=${remainder}.`,
                    renderBitStatus(remainders, {
                        currentDividend: dividend,
                        quotient,
                        remainder,
                        decisionLabel: `Store remainder ${remainder}`,
                        detailLabel: 'Push remainder, continue with quotient',
                        divisionsDone,
                        activeIndex: remainders.length - 1,
                        done: false,
                    }),
                    `<code>${dividend} = 2 * ${quotient} + ${remainder}</code>`
                )
            );
            current = quotient;
        }
        const binary = remainders.slice().reverse().join('');
        const finalBits = remainders.slice().reverse();
        steps.push(
            makeStep(
                'Reverse remainders',
                `Binary result is ${binary}.`,
                `
                    ${renderBitStatus(finalBits, {
                        currentDividend: 0,
                        quotient: 0,
                        remainder: null,
                        decisionLabel: 'Reverse order',
                        detailLabel: 'Read bits from last remainder to first',
                        divisionsDone: expectedDivisions,
                        activeIndex: 0,
                        done: true,
                    })}
                    <div class="exec-summary success">Answer: ${binary}</div>
                `,
                '<code>Read remainders in reverse order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Bit Conversion',
            subtitle: 'Convert decimal to binary by repeated division with bit-position telemetry and 3D mapping.',
            steps,
        };
    }

    function buildMathModel(payload) {
        let a = Math.abs(Math.floor(asFiniteNumber(payload.a, Number.NaN)));
        let b = Math.abs(Math.floor(asFiniteNumber(payload.b, Number.NaN)));
        if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) {
            return null;
        }

        const initialA = a;
        const initialB = b;
        let iterationCount = 0;

        function renderMathStatus(currentA, currentB, remainder = null, decisionLabel = 'Ready', detailLabel = 'Pending', done = false) {
            const hasRemainder = Number.isFinite(remainder);
            const progressBase = Math.max(initialA, initialB);
            const progress = currentB === 0
                ? 100
                : Math.max(8, Math.min(95, Math.round((1 - (currentB / progressBase)) * 100)));
            const equationLabel = hasRemainder
                ? `${formatNumber(currentA)} = ${formatNumber(currentB)} * floor(${formatNumber(currentA)}/${formatNumber(currentB)}) + ${formatNumber(remainder)}`
                : '-';
            return `
                ${renderEuclidState3D(currentA, currentB, hasRemainder ? remainder : null)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Current pair:</strong> a=${formatNumber(currentA)}, b=${formatNumber(currentB)}${done ? ' (final)' : ''}</div>
                    <div class="binary-search-status-line"><strong>Remainder:</strong> ${hasRemainder ? formatNumber(remainder) : '-'} | <strong>Equation:</strong> ${equationLabel}</div>
                    <div class="binary-search-status-line"><strong>Invariant:</strong> gcd(a,b) is unchanged by (a,b) -> (b, a mod b)</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Iterations:</strong> ${iterationCount}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">${done ? 'Euclid reduction complete' : `Reduction progress ${progress}% (until b = 0)`}</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = variable slot (a,b,r), Y = single state row, Z = Euclid-step depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize',
                `Find gcd(${a}, ${b}) using Euclid algorithm.`,
                renderMathStatus(a, b, null, 'Initialize pair', 'Start Euclid reductions', false),
                '<code>while b != 0: (a, b) = (b, a % b)</code>'
            ),
        ];

        while (b !== 0) {
            const r = a % b;
            const prevA = a;
            const prevB = b;
            iterationCount += 1;
            steps.push(
                makeStep(
                    `Euclid Step ${iterationCount}`,
                    `Compute remainder r = ${prevA} mod ${prevB} = ${r}.`,
                    renderMathStatus(prevA, prevB, r, 'Compute remainder', `Set next pair to (${formatNumber(prevB)}, ${formatNumber(r)})`, false),
                    `<code>${prevA} = ${prevB} * floor(${prevA}/${prevB}) + ${r}</code>`
                )
            );
            a = b;
            b = r;
        }

        steps.push(
            makeStep(
                'Final Answer',
                `gcd is ${a}.`,
                `
                    ${renderMathStatus(a, 0, null, 'Stop condition', 'b is zero, so a is gcd', true)}
                    <div class="exec-summary success">GCD: ${a}</div>
                `,
                '<code>When b=0, gcd=a</code>'
            )
        );

        return {
            title: 'Execution Visualization - Euclidean GCD',
            subtitle: 'Modulo-based pair reduction with live invariant tracking and 3D Euclid state board.',
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
        const visitedOrder = [];
        let comparisons = 0;

        function renderLinkedStatus(currentIndex, resultLabel = 'Pending') {
            const visitedCount = visited.size;
            const progress = values.length ? Math.round((visitedCount / values.length) * 100) : 100;
            const currentLabel = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < values.length
                ? `${currentIndex} (${formatNumber(values[currentIndex])})`
                : '-';
            const visitedLabel = visitedOrder.length ? visitedOrder.join(' -> ') : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Target:</strong> ${formatNumber(target)}</div>
                    <div class="binary-search-status-line"><strong>Current node:</strong> ${currentLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons}</div>
                    <div class="binary-search-status-line"><strong>Visited order:</strong> ${visitedLabel}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Visited ${visitedCount}/${values.length} nodes</div>
                </div>
            `;
        }

        const steps = [
            makeStep(
                'Start at Head',
                `Traverse nodes left-to-right to find target ${formatNumber(target)}.`,
                `
                    ${renderLinkedListDiagram3D(values, { mode: 'singly', currentIndex: 0, visitedSet: visited })}
                    ${renderLinkedStatus(0, 'Start')}
                `,
                '<code>idx = 0; while idx &lt; n: check node[idx], idx += 1</code>'
            ),
        ];

        let answerIndex = -1;
        for (let idx = 0; idx < values.length; idx += 1) {
            visited.add(idx);
            visitedOrder.push(idx);
            comparisons += 1;
            const matched = values[idx] === target;
            steps.push(
                makeStep(
                    `Visit Node ${idx}`,
                    matched
                        ? `Node value ${formatNumber(values[idx])} matches target.`
                        : `Node value ${formatNumber(values[idx])} does not match target.`,
                    `
                        ${renderLinkedListDiagram3D(values, {
                            mode: 'singly',
                            currentIndex: idx,
                            matchedIndex: matched ? idx : null,
                            visitedSet: visited,
                        })}
                        ${renderLinkedStatus(idx, matched ? 'Match found' : 'No match, move next')}
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
                `
                    ${answerIndex >= 0
                        ? renderLinkedListDiagram3D(values, {
                        mode: 'singly',
                        currentIndex: answerIndex,
                        matchedIndex: answerIndex,
                        visitedSet: visited,
                    })
                        : renderLinkedListDiagram3D(values, { mode: 'singly', visitedSet: visited })}
                    ${renderLinkedStatus(answerIndex >= 0 ? answerIndex : null, answerIndex >= 0 ? `Found at idx ${answerIndex}` : 'Not found')}
                `,
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
        const visitedOrder = [];
        let comparisons = 0;

        function renderDoublyStatus(currentIndex, resultLabel = 'Pending') {
            const visitedCount = visited.size;
            const progress = values.length ? Math.round((visitedCount / values.length) * 100) : 100;
            const currentLabel = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < values.length
                ? `${currentIndex} (${formatNumber(values[currentIndex])})`
                : '-';
            const visitedLabel = visitedOrder.length ? visitedOrder.join(' -> ') : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Direction:</strong> ${traverseFromTail ? 'tail -> head (prev)' : 'head -> tail (next)'}</div>
                    <div class="binary-search-status-line"><strong>Target:</strong> ${formatNumber(target)}</div>
                    <div class="binary-search-status-line"><strong>Current node:</strong> ${currentLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons}</div>
                    <div class="binary-search-status-line"><strong>Visited order:</strong> ${visitedLabel}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Visited ${visitedCount}/${values.length} nodes</div>
                </div>
            `;
        }

        const steps = [
            makeStep(
                traverseFromTail ? 'Start at Tail' : 'Start at Head',
                traverseFromTail
                    ? `Use prev pointers from tail to find target ${formatNumber(target)}.`
                    : `Use next pointers from head to find target ${formatNumber(target)}.`,
                `
                    ${renderLinkedListDiagram3D(values, {
                        mode: 'doubly',
                        currentIndex: order[0],
                        visitedSet: visited,
                    })}
                    ${renderDoublyStatus(order[0], 'Start')}
                `,
                traverseFromTail
                    ? '<code>idx = n-1; while idx &gt;= 0: check node[idx], idx -= 1</code>'
                    : '<code>idx = 0; while idx &lt; n: check node[idx], idx += 1</code>'
            ),
        ];

        let answerIndex = -1;
        for (let position = 0; position < order.length; position += 1) {
            const idx = order[position];
            visited.add(idx);
            visitedOrder.push(idx);
            comparisons += 1;
            const matched = values[idx] === target;
            steps.push(
                makeStep(
                    `Visit Node ${idx}`,
                    matched
                        ? `Node value ${formatNumber(values[idx])} matches target.`
                        : `Node value ${formatNumber(values[idx])} does not match target.`,
                    `
                        ${renderLinkedListDiagram3D(values, {
                            mode: 'doubly',
                            currentIndex: idx,
                            matchedIndex: matched ? idx : null,
                            visitedSet: visited,
                        })}
                        ${renderDoublyStatus(idx, matched ? 'Match found' : 'No match, follow pointer')}
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
                `
                    ${answerIndex >= 0
                        ? renderLinkedListDiagram3D(values, {
                            mode: 'doubly',
                            currentIndex: answerIndex,
                            matchedIndex: answerIndex,
                            visitedSet: visited,
                        })
                        : renderLinkedListDiagram3D(values, { mode: 'doubly', visitedSet: visited })}
                    ${renderDoublyStatus(answerIndex >= 0 ? answerIndex : null, answerIndex >= 0 ? `Found at idx ${answerIndex}` : 'Not found')}
                `,
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
        const visitedOrder = [];
        let comparisons = 0;

        function renderCircularStatus(currentIndex, resultLabel = 'Pending') {
            const visitedCount = visited.size;
            const progress = values.length ? Math.round((visitedCount / values.length) * 100) : 100;
            const currentLabel = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < values.length
                ? `${currentIndex} (${formatNumber(values[currentIndex])})`
                : '-';
            const visitedLabel = visitedOrder.length ? visitedOrder.join(' -> ') : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Direction:</strong> head follows next (circular)</div>
                    <div class="binary-search-status-line"><strong>Start index:</strong> ${startIndex}</div>
                    <div class="binary-search-status-line"><strong>Target:</strong> ${formatNumber(target)}</div>
                    <div class="binary-search-status-line"><strong>Current node:</strong> ${currentLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons}</div>
                    <div class="binary-search-status-line"><strong>Visited order:</strong> ${visitedLabel}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Visited ${visitedCount}/${values.length} nodes</div>
                </div>
            `;
        }

        const steps = [
            makeStep(
                'Start Circular Walk',
                `Begin at index ${startIndex}, stop after one full cycle, target ${formatNumber(target)}.`,
                `
                    ${renderLinkedListDiagram3D(values, {
                        mode: 'circular',
                        currentIndex: startIndex,
                        visitedSet: visited,
                        startIndex,
                    })}
                    ${renderCircularStatus(startIndex, 'Start')}
                `,
                '<code>idx = (start + step) % n, for step in [0..n-1]</code>'
            ),
        ];

        let answerIndex = -1;
        for (let step = 0; step < order.length; step += 1) {
            const idx = order[step];
            visited.add(idx);
            visitedOrder.push(idx);
            comparisons += 1;
            const matched = values[idx] === target;
            steps.push(
                makeStep(
                    `Step ${step + 1}: Node ${idx}`,
                    matched
                        ? `Node value ${formatNumber(values[idx])} matches target.`
                        : `Node value ${formatNumber(values[idx])} does not match target.`,
                    `
                        ${renderLinkedListDiagram3D(values, {
                            mode: 'circular',
                            currentIndex: idx,
                            matchedIndex: matched ? idx : null,
                            visitedSet: visited,
                            startIndex,
                        })}
                        ${renderCircularStatus(idx, matched ? 'Match found' : 'No match, move next (wrap if needed)')}
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
                `
                    ${answerIndex >= 0
                        ? renderLinkedListDiagram3D(values, {
                            mode: 'circular',
                            currentIndex: answerIndex,
                            matchedIndex: answerIndex,
                            visitedSet: visited,
                            startIndex,
                        })
                        : renderLinkedListDiagram3D(values, { mode: 'circular', visitedSet: visited, startIndex })}
                    ${renderCircularStatus(answerIndex >= 0 ? answerIndex : null, answerIndex >= 0 ? `Found at idx ${answerIndex}` : 'Not found')}
                `,
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
            return renderStackState3D(state, activeIndex);
        }

        function operationLabel(entry) {
            if (!entry) {
                return '-';
            }
            if (entry.op === 'push') {
                return `push(${entry.value !== null ? formatNumber(entry.value) : '?'})`;
            }
            return 'pop()';
        }

        const state = initial.slice();
        let appliedCount = 0;
        let pushCount = 0;
        let popCount = 0;
        let ignoredPopCount = 0;

        function renderStackStatus(currentOp, resultLabel = 'Pending') {
            const topLabel = state.length ? formatNumber(state[state.length - 1]) : 'empty';
            const stackLabel = state.length ? `[${state.map((value) => formatNumber(value)).join(', ')}]` : '[]';
            const progress = operations.length ? Math.round((appliedCount / operations.length) * 100) : 100;
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Next / Current op:</strong> ${escapeHtml(currentOp)}</div>
                    <div class="binary-search-status-line"><strong>Applied:</strong> ${appliedCount}/${operations.length} | <strong>Size:</strong> ${state.length}</div>
                    <div class="binary-search-status-line"><strong>Pushes:</strong> ${pushCount} | <strong>Pops:</strong> ${popCount} | <strong>Ignored pops:</strong> ${ignoredPopCount}</div>
                    <div class="binary-search-status-line"><strong>Top:</strong> ${topLabel}</div>
                    <div class="binary-search-status-line"><strong>Stack:</strong> ${stackLabel}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${escapeHtml(resultLabel)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Operation replay progress</div>
                </div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Stack',
                'Load initial stack state before applying operations.',
                `
                    ${renderStackState(state, state.length ? state.length - 1 : null)}
                    ${renderStackStatus(operationLabel(operations[0]), 'Ready')}
                `,
                '<code>stack = initial</code>'
            ),
        ];

        operations.forEach((entry, opIdx) => {
            appliedCount += 1;
            const nextOp = operationLabel(operations[appliedCount]);

            if (entry.op === 'push') {
                if (entry.value !== null) {
                    state.push(entry.value);
                    pushCount += 1;
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: push(${formatNumber(entry.value)})`,
                            `Push places ${formatNumber(entry.value)} at the top.`,
                            `
                                ${renderStackState(state, state.length - 1)}
                                ${renderStackStatus(nextOp, `Pushed ${formatNumber(entry.value)}`)}
                            `,
                            `<code>stack.append(${formatNumber(entry.value)})</code>`
                        )
                    );
                } else {
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: push(?)`,
                            'Push value is invalid, operation ignored.',
                            `
                                ${renderStackState(state, state.length ? state.length - 1 : null)}
                                ${renderStackStatus(nextOp, 'Invalid push ignored')}
                            `,
                            '<code>if push value invalid: ignore</code>'
                        )
                    );
                }
                return;
            }

            if (entry.op === 'pop') {
                if (state.length) {
                    const removed = state.pop();
                    popCount += 1;
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: pop()`,
                            `Remove top value ${formatNumber(removed)}.`,
                            `
                                ${renderStackState(state, state.length ? state.length - 1 : null)}
                                ${renderStackStatus(nextOp, `Popped ${formatNumber(removed)}`)}
                            `,
                            '<code>if stack: stack.pop()</code>'
                        )
                    );
                } else {
                    ignoredPopCount += 1;
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: pop()`,
                            'Pop on empty stack is ignored.',
                            `
                                ${renderStackState(state)}
                                ${renderStackStatus(nextOp, 'Ignored empty pop')}
                            `,
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
                    ${renderStackStatus('done', state.length ? `Top = ${top}` : 'Top = empty')}
                    <div class="exec-summary success">Answer: ${top}</div>
                `,
                '<code>answer = stack[-1] if stack else "empty"</code>'
            )
        );

        return {
            title: 'Execution Visualization - Stack Simulator',
            subtitle: 'Replay LIFO push/pop transitions with live stack telemetry.',
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
            return renderQueueState3D(state, activeIndex);
        }

        const state = initial.slice();
        let appliedCount = 0;
        let enqueueCount = 0;
        let dequeueCount = 0;
        let ignoredDequeueCount = 0;

        function operationLabel(entry) {
            if (!entry) {
                return '-';
            }
            if (entry.op === 'enqueue') {
                return `enqueue(${entry.value !== null ? formatNumber(entry.value) : '?'})`;
            }
            return 'dequeue()';
        }

        function renderQueueStatus(currentOp, resultLabel = 'Pending') {
            const frontLabel = state.length ? formatNumber(state[0]) : 'empty';
            const rearLabel = state.length ? formatNumber(state[state.length - 1]) : 'empty';
            const queueLabel = state.length ? `[${state.map((value) => formatNumber(value)).join(', ')}]` : '[]';
            const progress = operations.length ? Math.round((appliedCount / operations.length) * 100) : 100;
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Next / Current op:</strong> ${escapeHtml(currentOp)}</div>
                    <div class="binary-search-status-line"><strong>Applied:</strong> ${appliedCount}/${operations.length} | <strong>Size:</strong> ${state.length}</div>
                    <div class="binary-search-status-line"><strong>Enqueues:</strong> ${enqueueCount} | <strong>Dequeues:</strong> ${dequeueCount} | <strong>Ignored dequeues:</strong> ${ignoredDequeueCount}</div>
                    <div class="binary-search-status-line"><strong>Front:</strong> ${frontLabel} | <strong>Rear:</strong> ${rearLabel}</div>
                    <div class="binary-search-status-line"><strong>Queue:</strong> ${queueLabel}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${escapeHtml(resultLabel)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Operation replay progress</div>
                </div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Queue',
                'Load initial queue state before applying operations.',
                `
                    ${renderQueueState(state, state.length ? 0 : null)}
                    ${renderQueueStatus(operationLabel(operations[0]), 'Ready')}
                `,
                '<code>queue = initial</code>'
            ),
        ];

        operations.forEach((entry, opIdx) => {
            appliedCount += 1;
            const nextOp = operationLabel(operations[appliedCount]);

            if (entry.op === 'enqueue') {
                if (entry.value !== null) {
                    state.push(entry.value);
                    enqueueCount += 1;
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: enqueue(${formatNumber(entry.value)})`,
                            `Enqueue adds ${formatNumber(entry.value)} to the rear.`,
                            `
                                ${renderQueueState(state, state.length - 1)}
                                ${renderQueueStatus(nextOp, `Enqueued ${formatNumber(entry.value)}`)}
                            `,
                            `<code>queue.append(${formatNumber(entry.value)})</code>`
                        )
                    );
                } else {
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: enqueue(?)`,
                            'Enqueue value is invalid, operation ignored.',
                            `
                                ${renderQueueState(state, state.length ? state.length - 1 : null)}
                                ${renderQueueStatus(nextOp, 'Invalid enqueue ignored')}
                            `,
                            '<code>if enqueue value invalid: ignore</code>'
                        )
                    );
                }
                return;
            }

            if (entry.op === 'dequeue') {
                if (state.length) {
                    const removed = state.shift();
                    dequeueCount += 1;
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: dequeue()`,
                            `Remove front value ${formatNumber(removed)}.`,
                            `
                                ${renderQueueState(state, state.length ? 0 : null)}
                                ${renderQueueStatus(nextOp, `Dequeued ${formatNumber(removed)}`)}
                            `,
                            '<code>if queue: queue.pop(0)</code>'
                        )
                    );
                } else {
                    ignoredDequeueCount += 1;
                    steps.push(
                        makeStep(
                            `Operation ${opIdx + 1}: dequeue()`,
                            'Dequeue on empty queue is ignored.',
                            `
                                ${renderQueueState(state)}
                                ${renderQueueStatus(nextOp, 'Ignored empty dequeue')}
                            `,
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
                    ${renderQueueStatus('done', state.length ? `Front = ${front}` : 'Front = empty')}
                    <div class="exec-summary success">Answer: ${front}</div>
                `,
                '<code>answer = queue[0] if queue else "empty"</code>'
            )
        );

        return {
            title: 'Execution Visualization - Queue Simulator',
            subtitle: 'Replay FIFO enqueue/dequeue transitions with live queue telemetry.',
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
        let processed = 1;

        function rangeSet(left, right) {
            const set = new Set();
            if (!Number.isInteger(left) || !Number.isInteger(right)) {
                return set;
            }
            const start = Math.min(left, right);
            const end = Math.max(left, right);
            for (let idx = start; idx <= end; idx += 1) {
                set.add(idx);
            }
            return set;
        }

        function rangeList(left, right) {
            const list = [];
            if (!Number.isInteger(left) || !Number.isInteger(right)) {
                return list;
            }
            const start = Math.min(left, right);
            const end = Math.max(left, right);
            for (let idx = start; idx <= end; idx += 1) {
                list.push(idx);
            }
            return list;
        }

        function renderKadaneStatus(stepLabel, detailLabel, idx, options = {}) {
            const value = Number.isInteger(idx) && idx >= 0 && idx < values.length ? values[idx] : null;
            const progress = Math.max(0, Math.min(100, Math.round((processed / values.length) * 100)));
            const currentSet = rangeSet(currentStart, Number.isInteger(idx) ? idx : currentStart);
            const bestSet = rangeSet(bestStart, bestEnd);
            const currentLabel = currentSet.size ? `[${currentStart}..${Number.isInteger(idx) ? idx : currentStart}]` : '-';
            const bestLabel = `[${bestStart}..${bestEnd}]`;
            const decisionLabel = options.decisionLabel || 'Update Kadane state';
            const formulaLabel = options.formulaLabel || 'current = max(arr[i], current + arr[i])';
            return `
                ${renderArrayVisualization(values, bestSet, currentSet)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Active index:</strong> ${Number.isInteger(idx) ? idx : '-'} | <strong>Value:</strong> ${value === null ? '-' : formatNumber(value)}</div>
                    <div class="binary-search-status-line"><strong>Current range:</strong> ${currentLabel} | <strong>Current sum:</strong> ${formatNumber(currentSum)}</div>
                    <div class="binary-search-status-line"><strong>Best range:</strong> ${bestLabel} | <strong>Best sum:</strong> ${formatNumber(bestSum)}</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)}</div>
                    <div class="binary-search-status-line"><strong>Formula focus:</strong> ${escapeHtml(formulaLabel)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Kadane scan progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = array index, Y = value magnitude, Z = scan-depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Kadane State',
                `Start with first value ${formatNumber(values[0])}.`,
                renderKadaneStatus(
                    'Initialize',
                    'Set current and best to first element.',
                    0,
                    {
                        decisionLabel: 'Seed both running and best sums at index 0.',
                        formulaLabel: `current = best = arr[0] = ${formatNumber(values[0])}`,
                    }
                ),
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

            const improvedBest = currentSum > bestSum;
            if (improvedBest) {
                bestSum = currentSum;
                bestStart = currentStart;
                bestEnd = idx;
            }

            processed = idx + 1;
            const bestIndices = rangeList(bestStart, bestEnd);
            steps.push(
                makeStep(
                    `Process index ${idx}`,
                    shouldRestart
                        ? `Restart at arr[${idx}] = ${formatNumber(value)}.`
                        : `Extend current segment with arr[${idx}] = ${formatNumber(value)}.`,
                    `
                        ${renderKadaneStatus(
                            'Scan value',
                            shouldRestart ? 'Restart because value alone beats extension.' : 'Extend because extension is better or equal.',
                            idx,
                            {
                                decisionLabel: improvedBest
                                    ? `Best updated to range [${bestStart}..${bestEnd}]`
                                    : 'Best remains unchanged',
                                formulaLabel: `max(${formatNumber(restart)}, ${formatNumber(extend)}) = ${formatNumber(currentSum)}`,
                            }
                        )}
                        <div class="exec-summary">Best indices: ${bestIndices.join(', ') || '-'}</div>
                    `,
                    `<code>current = max(arr[i], current + arr[i]) = max(${formatNumber(restart)}, ${formatNumber(extend)}) = ${formatNumber(currentSum)}</code><br><code>best = max(best, current) = ${formatNumber(bestSum)}</code>`
                )
            );
        }

        const finalBestSet = rangeSet(bestStart, bestEnd);
        steps.push(
            makeStep(
                'Final Answer',
                `Maximum contiguous subarray sum is ${formatNumber(bestSum)}.`,
                `
                    ${renderArrayVisualization(values, finalBestSet, finalBestSet)}
                    <div class="exec-summary">Best range: [${bestStart}..${bestEnd}]</div>
                    <div class="exec-summary success">Answer: ${formatNumber(bestSum)}</div>
                `,
                '<code>answer = best</code>'
            )
        );

        return {
            title: 'Execution Visualization - Array Max Subarray',
            subtitle: 'Kadane scan with restart/extend decisions and best-range tracking.',
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
        let processed = 0;

        const bucketFor = (value) => Math.abs(Math.floor(Number(value))) % 6;

        function renderHashStatus(
            stepLabel = 'Initialize',
            detailLabel = 'Prepare hash lookup state',
            currentIndex = -1,
            probeValue = null,
            complement = null,
            complementSeen = false,
            complementIndex = null,
            decisionLabel = 'Ready',
            done = false
        ) {
            const seenPairs = Array.from(seenIndexByValue.entries());
            const seenSetLabel = seenPairs.length
                ? seenPairs.map(([value, idx]) => `${formatNumber(value)}@${idx}`).join(', ')
                : '-';
            const progress = values.length ? Math.round((processed / values.length) * 100) : 100;
            const remaining = Math.max(0, values.length - processed);
            const currentLabel = Number.isInteger(currentIndex) && currentIndex >= 0
                ? `idx ${currentIndex} (value ${formatNumber(probeValue)})`
                : '-';
            const pairLabel = discoveredPair
                ? `(${discoveredPair[0]}, ${discoveredPair[1]})`
                : '-';
            const probeBucketLabel = Number.isFinite(probeValue) ? `b${bucketFor(probeValue)}` : '-';
            const complementBucketLabel = Number.isFinite(complement) ? `b${bucketFor(complement)}` : '-';
            return `
                ${renderIndexedStrip3D(values, Number.isInteger(currentIndex) && currentIndex >= 0 ? new Set([currentIndex]) : new Set(), discoveredPair ? new Set(discoveredPair) : new Set())}
                ${renderHashBuckets3D(seenIndexByValue, {
                    highlightValue: complementSeen ? complement : null,
                    probeValue,
                    complementValue: complement,
                })}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Current:</strong> ${currentLabel}</div>
                    <div class="binary-search-status-line"><strong>Need complement:</strong> ${complement === null ? '-' : formatNumber(complement)}${complementSeen ? ` (seen at idx ${complementIndex})` : ''}</div>
                    <div class="binary-search-status-line"><strong>Buckets:</strong> probe -> ${probeBucketLabel} | complement -> ${complementBucketLabel} | rule h(v)=|floor(v)| mod 6</div>
                    <div class="binary-search-status-line"><strong>Decision:</strong> ${escapeHtml(decisionLabel)}</div>
                    <div class="binary-search-status-line"><strong>Seen entries:</strong> [${escapeHtml(seenSetLabel)}]</div>
                    <div class="binary-search-status-line"><strong>Found pair:</strong> ${pairLabel}${done ? ' (final)' : ''}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Processed ${processed}/${values.length} values | Remaining ${remaining}</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = hash bucket id, Y = chained entries, Z = scan depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Hash Set',
                `Scan left-to-right: compute complement (target - x), check seen set, then insert x if needed. Target=${formatNumber(target)}.`,
                renderHashStatus(
                    'Initialize hash set',
                    'Start scan with empty seen map.',
                    -1,
                    null,
                    null,
                    false,
                    null,
                    'Hash set starts empty',
                    false
                ),
                '<code>for x in arr: if (target-x) in seen -> pair exists; else add x to seen</code>'
            ),
        ];

        for (let idx = 0; idx < values.length; idx += 1) {
            const value = values[idx];
            const complement = target - value;
            const complementSeen = seenIndexByValue.has(complement);
            const complementIndex = complementSeen ? seenIndexByValue.get(complement) : null;
            processed = idx + 1;

            if (complementSeen && discoveredPair === null) {
                discoveredPair = [complementIndex, idx];
            }

            const statusText = complementSeen
                ? `Complement ${formatNumber(complement)} already exists at idx ${complementIndex}.`
                : `Complement ${formatNumber(complement)} not found in seen set.`;

            steps.push(
                makeStep(
                    `Probe idx ${idx}`,
                    `x=${formatNumber(value)}. ${statusText}`,
                    renderHashStatus(
                        'Probe value',
                        `Compute complement and check seen map for idx ${idx}.`,
                        idx,
                        value,
                        complement,
                        complementSeen,
                        complementIndex,
                        complementSeen ? 'Complement hit: pair found' : 'No complement hit: continue',
                        false
                    ),
                    `<code>complement = ${formatNumber(target)} - ${formatNumber(value)} = ${formatNumber(complement)}</code>`
                )
            );

            if (!seenIndexByValue.has(value)) {
                seenIndexByValue.set(value, idx);
                steps.push(
                    makeStep(
                        `Insert ${formatNumber(value)} into hash`,
                        `Store value ${formatNumber(value)} with first index ${idx} for future complement checks.`,
                        renderHashStatus(
                            'Insert into hash',
                            `Complement not found; cache value ${formatNumber(value)} at first occurrence.`,
                            idx,
                            value,
                            complement,
                            complementSeen,
                            complementIndex,
                            `Insert ${formatNumber(value)} into seen set`,
                            false
                        ),
                        `<code>if ${formatNumber(value)} not in seen: seen[${formatNumber(value)}] = ${idx}</code>`
                    )
                );
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
                    ${renderHashStatus(
                        'Finalize decision',
                        hasPair ? 'Complement hit occurred during scan.' : 'Completed scan without complement hit.',
                        hasPair ? discoveredPair[1] : -1,
                        hasPair ? values[discoveredPair[1]] : null,
                        hasPair ? (target - values[discoveredPair[1]]) : null,
                        hasPair,
                        hasPair ? discoveredPair[0] : null,
                        hasPair ? 'Complement found and pair confirmed' : 'Scan completed without complement match',
                        true
                    )}
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
        const rawInsertSequence =
            Array.isArray(payload.insert_sequence) && payload.insert_sequence.length
                ? payload.insert_sequence
                : payload.data;
        const insertSequence = normalizeNumberArray(rawInsertSequence);
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

        function renderTreeBoard(root, focusValue = null) {
            if (!root) {
                return '<div class="bst-route-empty">BST is empty.</div>';
            }
            const queue = [root];
            const rows = [];
            while (queue.length) {
                const node = queue.shift();
                const left = node.left ? formatNumber(node.left.value) : 'null';
                const right = node.right ? formatNumber(node.right.value) : 'null';
                const isFocus = focusValue !== null && Number(node.value) === Number(focusValue);
                const stateClass = isFocus ? 'is-next' : 'is-inserted';
                rows.push(`
                    <div class="bst-insert-node ${stateClass}">
                        <span class="bst-route-node-main">Node ${formatNumber(node.value)}</span>
                        <span class="bst-route-node-sub">L:${left} | R:${right}</span>
                    </div>
                `);
                if (node.left) queue.push(node.left);
                if (node.right) queue.push(node.right);
            }
            return `<div class="bst-insert-board">${rows.join('')}</div>`;
        }

        function renderBstStatus(insertedValues, inorderValues, nextValue = null) {
            const insertedLabel = insertedValues.length
                ? insertedValues.map((value) => formatNumber(value)).join(', ')
                : '-';
            const inorderLabel = inorderValues.length
                ? inorderValues.map((value) => formatNumber(value)).join(' ')
                : '-';
            const nextLabel = nextValue === null ? 'none' : formatNumber(nextValue);
            return `
                <div class="bst-route-status">
                    <div class="bst-route-status-line"><strong>Inserted:</strong> [${insertedLabel}]</div>
                    <div class="bst-route-status-line"><strong>Inorder:</strong> ${inorderLabel}</div>
                    <div class="bst-route-status-line"><strong>Next:</strong> ${nextLabel}</div>
                </div>
            `;
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
                    ${renderIndexedStrip3D(insertSequence, new Set(), new Set([0]))}
                    ${renderBstStatus([], [], insertSequence[0])}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = inorder layout, Y = tree depth, Z = depth cue.</em></div>
                    <div class="exec-summary">Await first insertion to build BST root.</div>
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
            const insertedIndices = new Set(
                Array.from({ length: idx + 1 }, (_, position) => position)
            );
            const currentIndices = new Set([idx]);
            const nextValue = idx + 1 < insertSequence.length ? insertSequence[idx + 1] : null;
            steps.push(
                makeStep(
                    `Insert ${formatNumber(value)}`,
                    result.trace.join(' '),
                    `
                        ${renderIndexedStrip3D(insertSequence, insertedIndices, currentIndices)}
                        ${renderBstStatus(insertSequence.slice(0, idx + 1), inorder, nextValue)}
                        ${renderBstTree3D(root, { focusValue: value })}
                        ${renderTreeBoard(root, value)}
                        <div class="exec-summary">Inorder so far: ${inorder.map((entry) => formatNumber(entry)).join(' ')}</div>
                    `,
                    `<code>Insertion rule applied at each comparison for ${formatNumber(value)}</code>`
                )
            );
        });

        const finalInorder = [];
        inorderTraversal(root, finalInorder);
        const answer = finalInorder.map((value) => formatNumber(value)).join(' ');
        const allInsertedIndices = new Set(
            Array.from({ length: insertSequence.length }, (_, position) => position)
        );
        steps.push(
            makeStep(
                'Final Answer',
                `Inorder traversal yields sorted order: ${answer}.`,
                `
                    ${renderIndexedStrip3D(insertSequence, allInsertedIndices, new Set())}
                    ${renderBstStatus(insertSequence, finalInorder, null)}
                    ${renderBstTree3D(root)}
                    ${renderTreeBoard(root)}
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

    function buildBubbleSortModel(payload) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        const arr = values.slice();
        const steps = [];
        const n = arr.length;
        let comparisons = 0;
        let totalSwaps = 0;
        let sortedFrom = n;

        function renderBubbleStatus(passNo, compareLeft = null, compareRight = null, passSwaps = 0, resultLabel = 'Pending') {
            const sortedCount = Math.max(0, n - sortedFrom);
            const progress = n ? Math.round((sortedCount / n) * 100) : 0;
            const pairLabel = Number.isInteger(compareLeft) && Number.isInteger(compareRight)
                ? `[${compareLeft}, ${compareRight}]`
                : '-';
            const sortedTailLabel = sortedFrom < n
                ? `[${sortedFrom}..${n - 1}]`
                : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Pass:</strong> ${passNo}</div>
                    <div class="binary-search-status-line"><strong>Compare pair:</strong> ${pairLabel}</div>
                    <div class="binary-search-status-line"><strong>Fixed suffix:</strong> ${sortedTailLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons}</div>
                    <div class="binary-search-status-line"><strong>Swaps:</strong> ${totalSwaps} (this pass: ${passSwaps})</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Fixed ${sortedCount}/${n} values in final position</div>
                </div>
            `;
        }

        steps.push(
            makeStep(
                'Load Array',
                'Bubble Sort compares adjacent pairs and bubbles larger values to the right.',
                `
                    ${renderBubbleSortTrack3D(arr, { sortedFrom, stepDepth: 0 })}
                    ${renderBubbleStatus(1, 0, arr.length > 1 ? 1 : null, 0, 'Start')}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = index, Y = state lane, Z = pass depth cue.</em></div>
                `,
                '<code>for each pass: compare adjacent pairs and swap if left > right</code>'
            )
        );

        for (let i = 0; i < n - 1; i += 1) {
            const passNo = i + 1;
            let passSwaps = 0;
            for (let j = 0; j < n - i - 1; j += 1) {
                comparisons += 1;
                const leftValue = arr[j];
                const rightValue = arr[j + 1];
                const shouldSwap = leftValue > rightValue;
                steps.push(
                    makeStep(
                        `Pass ${passNo}, compare [${j}, ${j + 1}]`,
                        shouldSwap
                            ? `${formatNumber(leftValue)} > ${formatNumber(rightValue)}, swap required.`
                            : `${formatNumber(leftValue)} <= ${formatNumber(rightValue)}, keep order.`,
                        `
                            ${renderBubbleSortTrack3D(arr, {
                                compareLeft: j,
                                compareRight: j + 1,
                                sortedFrom,
                                stepDepth: passNo,
                            })}
                            ${renderBubbleStatus(passNo, j, j + 1, passSwaps, shouldSwap ? 'Swap needed' : 'No swap')}
                        `,
                        '<code>if arr[j] > arr[j+1]: swap</code>'
                    )
                );

                if (shouldSwap) {
                    const temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                    passSwaps += 1;
                    totalSwaps += 1;
                    steps.push(
                        makeStep(
                            `Swap ${j} <-> ${j + 1}`,
                            'Larger value moves one position right.',
                            `
                                ${renderBubbleSortTrack3D(arr, {
                                    compareLeft: j,
                                    compareRight: j + 1,
                                    sortedFrom,
                                    swappedPair: [j, j + 1],
                                    stepDepth: passNo,
                                })}
                                ${renderBubbleStatus(passNo, j, j + 1, passSwaps, 'Adjacent swap applied')}
                            `,
                            '<code>swap(arr[j], arr[j+1])</code>'
                        )
                    );
                }
            }

            sortedFrom = n - i - 1;
            steps.push(
                makeStep(
                    `Pass ${passNo} complete`,
                    `Index ${sortedFrom} is now fixed in final position.`,
                    `
                        ${renderBubbleSortTrack3D(arr, { sortedFrom, stepDepth: passNo })}
                        ${renderBubbleStatus(passNo, null, null, passSwaps, `Pass ${passNo} sealed`)}
                    `,
                    '<code>after each pass, the largest unsorted element is fixed at the end</code>'
                )
            );

            if (passSwaps === 0) {
                sortedFrom = 0;
                steps.push(
                    makeStep(
                        'Early Stop',
                        'No swaps in this pass, array is already sorted.',
                        `
                            ${renderBubbleSortTrack3D(arr, { sortedFrom, stepDepth: passNo })}
                            ${renderBubbleStatus(passNo, null, null, passSwaps, 'Sorted early')}
                        `,
                        '<code>if pass has 0 swaps: break</code>'
                    )
                );
                break;
            }
        }

        sortedFrom = 0;
        steps.push(
            makeStep(
                'Final Answer',
                `Sorted array: ${arr.map((value) => formatNumber(value)).join(' ')}.`,
                `
                    ${renderBubbleSortTrack3D(arr, { sortedFrom, stepDepth: n - 1 })}
                    ${renderBubbleStatus(Math.max(1, n - 1), null, null, 0, 'Sorted')}
                `,
                '<code>array is sorted in non-decreasing order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Bubble Sort',
            subtitle: 'Adjacent comparisons with pass-by-pass bubbling.',
            steps,
        };
    }

    function buildSelectionSortModel(payload) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        const arr = values.slice();
        const steps = [];
        const n = arr.length;
        let comparisons = 0;
        let swaps = 0;
        let fixedUntil = 0;

        function renderSelectionStatus(passNo, slotIndex, minIndex, scanIndex = null, resultLabel = 'Pending') {
            const progress = n ? Math.round((fixedUntil / n) * 100) : 0;
            const scanLabel = Number.isInteger(scanIndex) ? scanIndex : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Pass:</strong> ${passNo}</div>
                    <div class="binary-search-status-line"><strong>Slot:</strong> ${slotIndex}</div>
                    <div class="binary-search-status-line"><strong>Current Min Index:</strong> ${minIndex}</div>
                    <div class="binary-search-status-line"><strong>Scan Index:</strong> ${scanLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons} | <strong>Swaps:</strong> ${swaps}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Fixed prefix: ${fixedUntil}/${n}</div>
                </div>
            `;
        }

        steps.push(
            makeStep(
                'Load Array',
                'Selection Sort chooses the minimum from unsorted suffix and places it at current slot.',
                `
                    ${renderSelectionSortTrack3D(arr, {
                        fixedUntil: 0,
                        slotIndex: 0,
                        minIndex: 0,
                        scanIndex: n > 1 ? 1 : null,
                        stepDepth: 0,
                    })}
                    ${renderSelectionStatus(1, 0, 0, n > 1 ? 1 : null, 'Start')}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = index, Y = state lane, Z = pass depth cue.</em></div>
                `,
                '<code>for each slot i: find min in [i..n-1], then place at i</code>'
            )
        );

        for (let i = 0; i < n - 1; i += 1) {
            let minIndex = i;
            steps.push(
                makeStep(
                    `Pass ${i + 1} setup`,
                    `Start with minIndex = ${i}.`,
                    `
                        ${renderSelectionSortTrack3D(arr, {
                            fixedUntil,
                            slotIndex: i,
                            minIndex,
                            scanIndex: i + 1 < n ? i + 1 : null,
                            stepDepth: i + 1,
                        })}
                        ${renderSelectionStatus(i + 1, i, minIndex, i + 1 < n ? i + 1 : null, 'Searching minimum')}
                    `,
                    '<code>minIndex = i</code>'
                )
            );

            for (let j = i + 1; j < n; j += 1) {
                comparisons += 1;
                if (arr[j] < arr[minIndex]) {
                    minIndex = j;
                    steps.push(
                        makeStep(
                            `Pass ${i + 1}, scan idx ${j}`,
                            `Found new minimum at idx ${j}: ${formatNumber(arr[j])}.`,
                            `
                                ${renderSelectionSortTrack3D(arr, {
                                    fixedUntil,
                                    slotIndex: i,
                                    minIndex,
                                    scanIndex: j,
                                    stepDepth: i + 1,
                                })}
                                ${renderSelectionStatus(i + 1, i, minIndex, j, 'Min updated')}
                            `,
                            '<code>if arr[j] < arr[minIndex]: minIndex = j</code>'
                        )
                    );
                } else {
                    steps.push(
                        makeStep(
                            `Pass ${i + 1}, scan idx ${j}`,
                            `${formatNumber(arr[j])} is not smaller than current minimum ${formatNumber(arr[minIndex])}.`,
                            `
                                ${renderSelectionSortTrack3D(arr, {
                                    fixedUntil,
                                    slotIndex: i,
                                    minIndex,
                                    scanIndex: j,
                                    stepDepth: i + 1,
                                })}
                                ${renderSelectionStatus(i + 1, i, minIndex, j, 'Keep current min')}
                            `,
                            '<code>continue scanning suffix</code>'
                        )
                    );
                }
            }

            if (minIndex !== i) {
                const temp = arr[i];
                arr[i] = arr[minIndex];
                arr[minIndex] = temp;
                swaps += 1;
                steps.push(
                    makeStep(
                        `Place minimum at slot ${i}`,
                        `Swap idx ${i} with min idx ${minIndex}.`,
                        `
                            ${renderSelectionSortTrack3D(arr, {
                                fixedUntil,
                                slotIndex: i,
                                minIndex: i,
                                scanIndex: null,
                                placedIndex: i,
                                stepDepth: i + 1,
                            })}
                            ${renderSelectionStatus(i + 1, i, i, null, 'Minimum placed')}
                        `,
                        '<code>swap(arr[i], arr[minIndex])</code>'
                    )
                );
            } else {
                steps.push(
                    makeStep(
                        `Slot ${i} already minimum`,
                        'No swap required for this pass.',
                        `
                            ${renderSelectionSortTrack3D(arr, {
                                fixedUntil,
                                slotIndex: i,
                                minIndex: i,
                                scanIndex: null,
                                stepDepth: i + 1,
                            })}
                            ${renderSelectionStatus(i + 1, i, i, null, 'No swap')}
                        `,
                        '<code>if minIndex == i: keep as-is</code>'
                    )
                );
            }

            fixedUntil = i + 1;
            steps.push(
                makeStep(
                    `Pass ${i + 1} complete`,
                    `Prefix [0..${fixedUntil - 1}] is fixed.`,
                    `
                        ${renderSelectionSortTrack3D(arr, {
                            fixedUntil,
                            slotIndex: fixedUntil < n ? fixedUntil : null,
                            minIndex: fixedUntil < n ? fixedUntil : null,
                            scanIndex: null,
                            stepDepth: i + 1,
                        })}
                        ${renderSelectionStatus(i + 1, fixedUntil < n ? fixedUntil : n - 1, fixedUntil < n ? fixedUntil : n - 1, null, 'Pass sealed')}
                    `,
                    '<code>advance to next slot</code>'
                )
            );
        }

        fixedUntil = n;
        steps.push(
            makeStep(
                'Final Answer',
                `Sorted array: ${arr.map((value) => formatNumber(value)).join(' ')}.`,
                `
                    ${renderSelectionSortTrack3D(arr, {
                        fixedUntil,
                        slotIndex: null,
                        minIndex: null,
                        scanIndex: null,
                        stepDepth: Math.max(1, n - 1),
                    })}
                    ${renderSelectionStatus(Math.max(1, n - 1), n - 1, n - 1, null, 'Sorted')}
                `,
                '<code>array is sorted in non-decreasing order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Selection Sort',
            subtitle: 'Find minimum in suffix, place it at current slot.',
            steps,
        };
    }

    function buildInsertionSortModel(payload) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        const arr = values.slice();
        const steps = [];
        const n = arr.length;
        let comparisons = 0;
        let shifts = 0;
        let sortedUntil = 1;

        function renderInsertionStatus(passNo, keyValue, scanIndex, insertIndex, resultLabel = 'Pending') {
            const progress = n ? Math.round((sortedUntil / n) * 100) : 0;
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Pass:</strong> ${passNo}</div>
                    <div class="binary-search-status-line"><strong>Key:</strong> ${formatNumber(keyValue)}</div>
                    <div class="binary-search-status-line"><strong>Scan Index:</strong> ${Number.isInteger(scanIndex) ? scanIndex : '-'}</div>
                    <div class="binary-search-status-line"><strong>Insert Index:</strong> ${insertIndex}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons} | <strong>Shifts:</strong> ${shifts}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Sorted prefix: ${sortedUntil}/${n}</div>
                </div>
            `;
        }

        steps.push(
            makeStep(
                'Load Array',
                'Insertion Sort keeps left prefix sorted and inserts each new key at correct position.',
                `
                    ${renderInsertionSortTrack3D(arr, {
                        sortedUntil,
                        keyIndex: 1 < n ? 1 : 0,
                        scanIndex: 0,
                        stepDepth: 0,
                    })}
                    ${renderInsertionStatus(1, n > 1 ? arr[1] : arr[0], 0, 1, 'Start')}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = index, Y = state lane, Z = pass depth cue.</em></div>
                `,
                '<code>for i from 1 to n-1: insert key arr[i] into sorted prefix</code>'
            )
        );

        for (let i = 1; i < n; i += 1) {
            const key = arr[i];
            let j = i - 1;
            steps.push(
                makeStep(
                    `Pass ${i}: pick key at idx ${i}`,
                    `Key = ${formatNumber(key)}.`,
                    `
                        ${renderInsertionSortTrack3D(arr, {
                            sortedUntil,
                            keyIndex: i,
                            scanIndex: j,
                            stepDepth: i,
                        })}
                        ${renderInsertionStatus(i, key, j, j + 1, 'Key selected')}
                    `,
                    '<code>key = arr[i], j = i - 1</code>'
                )
            );

            while (j >= 0) {
                comparisons += 1;
                if (arr[j] > key) {
                    arr[j + 1] = arr[j];
                    shifts += 1;
                    steps.push(
                        makeStep(
                            `Shift idx ${j} to ${j + 1}`,
                            `${formatNumber(arr[j + 1])} > key, shift right.`,
                            `
                                ${renderInsertionSortTrack3D(arr, {
                                    sortedUntil,
                                    keyIndex: j + 1,
                                    scanIndex: j,
                                    shiftedIndex: j + 1,
                                    stepDepth: i,
                                })}
                                ${renderInsertionStatus(i, key, j, j, 'Shift right')}
                            `,
                            '<code>while arr[j] > key: arr[j+1] = arr[j]; j--</code>'
                        )
                    );
                    j -= 1;
                } else {
                    steps.push(
                        makeStep(
                            `Stop shifting at idx ${j}`,
                            `${formatNumber(arr[j])} <= key, stop shifting.`,
                            `
                                ${renderInsertionSortTrack3D(arr, {
                                    sortedUntil,
                                    keyIndex: j + 1,
                                    scanIndex: j,
                                    stepDepth: i,
                                })}
                                ${renderInsertionStatus(i, key, j, j + 1, 'Position found')}
                            `,
                            '<code>if arr[j] <= key: break</code>'
                        )
                    );
                    break;
                }
            }

            const insertAt = j + 1;
            arr[insertAt] = key;
            steps.push(
                makeStep(
                    `Insert key at idx ${insertAt}`,
                    `Placed key ${formatNumber(key)}.`,
                    `
                        ${renderInsertionSortTrack3D(arr, {
                            sortedUntil: i + 1,
                            keyIndex: insertAt,
                            scanIndex: j,
                            insertedIndex: insertAt,
                            stepDepth: i,
                        })}
                        ${renderInsertionStatus(i, key, j, insertAt, 'Key inserted')}
                    `,
                    '<code>arr[j+1] = key</code>'
                )
            );

            sortedUntil = i + 1;
        }

        sortedUntil = n;
        steps.push(
            makeStep(
                'Final Answer',
                `Sorted array: ${arr.map((value) => formatNumber(value)).join(' ')}.`,
                `
                    ${renderInsertionSortTrack3D(arr, {
                        sortedUntil,
                        keyIndex: null,
                        scanIndex: null,
                        insertedIndex: null,
                        stepDepth: Math.max(1, n - 1),
                    })}
                    ${renderInsertionStatus(Math.max(1, n - 1), arr[n - 1], null, n - 1, 'Sorted')}
                `,
                '<code>array is sorted in non-decreasing order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Insertion Sort',
            subtitle: 'Shift larger prefix elements right and insert key.',
            steps,
        };
    }

    function buildMergeSortModel(payload) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        const arr = values.slice();
        const steps = [];
        const n = arr.length;
        let comparisons = 0;
        let mergeCount = 0;

        function renderMergeStatus(passWidth, left, mid, right, headLeft, headRight, mergedPreview, resultLabel = 'Pending') {
            const totalMergesEstimate = Math.max(1, n - 1);
            const progress = n > 1 ? Math.round((mergeCount / totalMergesEstimate) * 100) : 100;
            const leftHeadLabel = Number.isInteger(headLeft) ? `${headLeft} (${formatNumber(arr[headLeft])})` : '-';
            const rightHeadLabel = Number.isInteger(headRight) ? `${headRight} (${formatNumber(arr[headRight])})` : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Run Width:</strong> ${passWidth}</div>
                    <div class="binary-search-status-line"><strong>Segment:</strong> [${left}..${right - 1}] | mid=${mid}</div>
                    <div class="binary-search-status-line"><strong>Heads:</strong> left=${leftHeadLabel}, right=${rightHeadLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons} | <strong>Merges:</strong> ${mergeCount}</div>
                    <div class="binary-search-status-line"><strong>Merged So Far:</strong> ${mergedPreview.length ? mergedPreview.map((v) => formatNumber(v)).join(' ') : '-'}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Merge operations progress: ${mergeCount}/${totalMergesEstimate}</div>
                </div>
            `;
        }

        steps.push(
            makeStep(
                'Load Array',
                'Merge Sort splits array into runs and merges sorted runs.',
                `
                    ${renderMergeSortTrack3D(arr, { left: 0, mid: Math.floor(n / 2), right: n, stepDepth: 0 })}
                    ${renderMergeStatus(1, 0, Math.floor(n / 2), n, 0, Math.floor(n / 2), [], 'Start')}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = index, Y = state lane, Z = merge depth cue.</em></div>
                `,
                '<code>width = 1; while width < n: merge adjacent runs of size width</code>'
            )
        );

        for (let width = 1; width < n; width *= 2) {
            for (let left = 0; left < n; left += 2 * width) {
                const mid = Math.min(left + width, n);
                const right = Math.min(left + (2 * width), n);
                if (mid >= right) {
                    continue;
                }

                const leftPart = arr.slice(left, mid);
                const rightPart = arr.slice(mid, right);
                const merged = [];
                let i = 0;
                let j = 0;

                steps.push(
                    makeStep(
                        `Prepare merge [${left}..${mid - 1}] + [${mid}..${right - 1}]`,
                        `Merge two sorted runs of width <= ${width}.`,
                        `
                            ${renderMergeSortTrack3D(arr, {
                                left,
                                mid,
                                right,
                                headLeft: left,
                                headRight: mid,
                                writtenUntil: left,
                                mergedSet: new Set(),
                                stepDepth: width,
                            })}
                            ${renderMergeStatus(width, left, mid, right, left, mid, merged, 'Runs loaded')}
                        `,
                        '<code>merge(leftRun, rightRun)</code>'
                    )
                );

                while (i < leftPart.length && j < rightPart.length) {
                    const leftHeadIndex = left + i;
                    const rightHeadIndex = mid + j;
                    comparisons += 1;
                    if (leftPart[i] <= rightPart[j]) {
                        merged.push(leftPart[i]);
                        i += 1;
                        steps.push(
                            makeStep(
                                `Take left head`,
                                'Left head is smaller or equal, append to merged run.',
                                `
                                    ${renderMergeSortTrack3D(arr, {
                                        left,
                                        mid,
                                        right,
                                        headLeft: i < leftPart.length ? left + i : null,
                                        headRight: j < rightPart.length ? mid + j : null,
                                        writtenUntil: left + merged.length,
                                        mergedSet: new Set(Array.from({ length: merged.length }, (_, idx) => left + idx)),
                                        stepDepth: width,
                                    })}
                                    ${renderMergeStatus(
                                        width,
                                        left,
                                        mid,
                                        right,
                                        i < leftPart.length ? left + i : null,
                                        j < rightPart.length ? mid + j : null,
                                        merged,
                                        `Picked left idx ${leftHeadIndex}`
                                    )}
                                `,
                                '<code>if leftHead <= rightHead: push leftHead</code>'
                            )
                        );
                    } else {
                        merged.push(rightPart[j]);
                        j += 1;
                        steps.push(
                            makeStep(
                                `Take right head`,
                                'Right head is smaller, append to merged run.',
                                `
                                    ${renderMergeSortTrack3D(arr, {
                                        left,
                                        mid,
                                        right,
                                        headLeft: i < leftPart.length ? left + i : null,
                                        headRight: j < rightPart.length ? mid + j : null,
                                        writtenUntil: left + merged.length,
                                        mergedSet: new Set(Array.from({ length: merged.length }, (_, idx) => left + idx)),
                                        stepDepth: width,
                                    })}
                                    ${renderMergeStatus(
                                        width,
                                        left,
                                        mid,
                                        right,
                                        i < leftPart.length ? left + i : null,
                                        j < rightPart.length ? mid + j : null,
                                        merged,
                                        `Picked right idx ${rightHeadIndex}`
                                    )}
                                `,
                                '<code>else: push rightHead</code>'
                            )
                        );
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
                mergeCount += 1;
                const mergedSet = new Set(Array.from({ length: merged.length }, (_, idx) => left + idx));

                steps.push(
                    makeStep(
                        `Merged block [${left}..${right - 1}]`,
                        `Block result: ${merged.map((v) => formatNumber(v)).join(' ')}.`,
                        `
                            ${renderMergeSortTrack3D(arr, {
                                left,
                                mid,
                                right,
                                headLeft: null,
                                headRight: null,
                                writtenUntil: right,
                                mergedSet,
                                stepDepth: width,
                            })}
                            ${renderMergeStatus(width, left, mid, right, null, null, merged, 'Block merged')}
                        `,
                        '<code>write merged block back into array segment</code>'
                    )
                );
            }
        }

        steps.push(
            makeStep(
                'Final Answer',
                `Sorted array: ${arr.map((value) => formatNumber(value)).join(' ')}.`,
                `
                    ${renderMergeSortTrack3D(arr, {
                        left: 0,
                        mid: Math.floor(n / 2),
                        right: n,
                        headLeft: null,
                        headRight: null,
                        writtenUntil: n,
                        mergedSet: new Set(Array.from({ length: n }, (_, idx) => idx)),
                        stepDepth: Math.max(1, n - 1),
                    })}
                    ${renderMergeStatus(Math.max(1, n / 2), 0, Math.floor(n / 2), n, null, null, arr, 'Sorted')}
                `,
                '<code>array is sorted in non-decreasing order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Merge Sort',
            subtitle: 'Split into runs and merge back in sorted order.',
            steps,
        };
    }

    function buildQuickSortModel(payload) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        const arr = values.slice();
        const n = arr.length;
        const steps = [];
        let comparisons = 0;
        let partitionCount = 0;
        const fixedSet = new Set();

        function renderQuickStatus(low, high, pivotIndex, boundaryIndex, scanIndex, resultLabel = 'Pending') {
            const fixedCount = fixedSet.size;
            const progress = n ? Math.round((fixedCount / n) * 100) : 0;
            const segmentLabel = Number.isInteger(low) && Number.isInteger(high) ? `[${low}..${high}]` : '-';
            const pivotLabel = Number.isInteger(pivotIndex) ? `${pivotIndex} (${formatNumber(arr[pivotIndex])})` : '-';
            const boundaryLabel = Number.isInteger(boundaryIndex) ? boundaryIndex : '-';
            const scanLabel = Number.isInteger(scanIndex) ? scanIndex : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Partition:</strong> ${partitionCount + 1}</div>
                    <div class="binary-search-status-line"><strong>Segment:</strong> ${segmentLabel}</div>
                    <div class="binary-search-status-line"><strong>Pivot:</strong> ${pivotLabel}</div>
                    <div class="binary-search-status-line"><strong>Boundary i:</strong> ${boundaryLabel} | <strong>Scan j:</strong> ${scanLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons} | <strong>Pivot Placements:</strong> ${partitionCount}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Fixed positions: ${fixedCount}/${n}</div>
                </div>
            `;
        }

        steps.push(
            makeStep(
                'Load Array',
                'Quick Sort partitions by pivot: values <= pivot move left, then pivot is placed at final index.',
                `
                    ${renderQuickSortTrack3D(arr, { low: 0, high: n - 1, pivotIndex: n - 1, scanIndex: 0, boundaryIndex: -1, fixedSet, stepDepth: 0 })}
                    ${renderQuickStatus(0, n - 1, n - 1, -1, 0, 'Start')}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = index, Y = partition state lane, Z = partition depth cue.</em></div>
                `,
                '<code>partition(arr, low, high): move <= pivot left, place pivot, recurse on both sides</code>'
            )
        );

        const stack = [[0, n - 1]];
        while (stack.length) {
            const segment = stack.pop();
            if (!segment) {
                continue;
            }
            const [low, high] = segment;
            if (low > high) {
                continue;
            }
            if (low === high) {
                fixedSet.add(low);
                continue;
            }

            const pivot = arr[high];
            let i = low - 1;
            steps.push(
                makeStep(
                    `Partition segment [${low}..${high}]`,
                    `Pivot = arr[${high}] = ${formatNumber(pivot)}.`,
                    `
                        ${renderQuickSortTrack3D(arr, {
                            low,
                            high,
                            pivotIndex: high,
                            scanIndex: low,
                            boundaryIndex: i,
                            fixedSet,
                            stepDepth: partitionCount + 1,
                        })}
                        ${renderQuickStatus(low, high, high, i, low, 'Pivot selected')}
                    `,
                    '<code>i = low - 1; for j in [low..high-1], if arr[j] <= pivot then i++, swap(i, j)</code>'
                )
            );

            for (let j = low; j < high; j += 1) {
                comparisons += 1;
                const moveLeft = arr[j] <= pivot;
                steps.push(
                    makeStep(
                        `Compare idx ${j} with pivot`,
                        moveLeft
                            ? `${formatNumber(arr[j])} <= ${formatNumber(pivot)}; expand left partition.`
                            : `${formatNumber(arr[j])} > ${formatNumber(pivot)}; keep in right partition.`,
                        `
                            ${renderQuickSortTrack3D(arr, {
                                low,
                                high,
                                pivotIndex: high,
                                scanIndex: j,
                                boundaryIndex: i,
                                fixedSet,
                                stepDepth: partitionCount + 1,
                            })}
                            ${renderQuickStatus(low, high, high, i, j, moveLeft ? 'Move left' : 'Keep right')}
                        `,
                        '<code>if arr[j] <= pivot</code>'
                    )
                );

                if (moveLeft) {
                    i += 1;
                    if (i !== j) {
                        const temp = arr[i];
                        arr[i] = arr[j];
                        arr[j] = temp;
                        steps.push(
                            makeStep(
                                `Swap ${i} <-> ${j}`,
                                'Maintain <= pivot zone contiguously at left.',
                                `
                                    ${renderQuickSortTrack3D(arr, {
                                        low,
                                        high,
                                        pivotIndex: high,
                                        scanIndex: j,
                                        boundaryIndex: i,
                                        swappedPair: [i, j],
                                        fixedSet,
                                        stepDepth: partitionCount + 1,
                                    })}
                                    ${renderQuickStatus(low, high, high, i, j, 'Partition swap')}
                                `,
                                '<code>swap(arr[i], arr[j])</code>'
                            )
                        );
                    }
                }
            }

            const pivotIndex = i + 1;
            if (pivotIndex !== high) {
                const temp = arr[pivotIndex];
                arr[pivotIndex] = arr[high];
                arr[high] = temp;
            }
            const pivotSwapPair = pivotIndex !== high ? [pivotIndex, high] : [];
            fixedSet.add(pivotIndex);
            partitionCount += 1;

            steps.push(
                makeStep(
                    `Place pivot at idx ${pivotIndex}`,
                    `Pivot ${formatNumber(arr[pivotIndex])} is now fixed.`,
                    `
                        ${renderQuickSortTrack3D(arr, {
                            low,
                            high,
                            pivotIndex,
                            scanIndex: null,
                            boundaryIndex: pivotIndex - 1,
                            swappedPair: pivotSwapPair,
                            fixedSet,
                            stepDepth: partitionCount,
                        })}
                        ${renderQuickStatus(low, high, pivotIndex, pivotIndex - 1, null, 'Pivot fixed')}
                    `,
                    '<code>swap(arr[i+1], arr[high])</code>'
                )
            );

            if (pivotIndex + 1 < high) {
                stack.push([pivotIndex + 1, high]);
            } else if (pivotIndex + 1 === high) {
                fixedSet.add(high);
            }
            if (low < pivotIndex - 1) {
                stack.push([low, pivotIndex - 1]);
            } else if (low === pivotIndex - 1) {
                fixedSet.add(low);
            }
        }

        for (let idx = 0; idx < n; idx += 1) {
            fixedSet.add(idx);
        }
        steps.push(
            makeStep(
                'Final Answer',
                `Sorted array: ${arr.map((value) => formatNumber(value)).join(' ')}.`,
                `
                    ${renderQuickSortTrack3D(arr, {
                        low: 0,
                        high: n - 1,
                        pivotIndex: null,
                        scanIndex: null,
                        boundaryIndex: null,
                        fixedSet,
                        stepDepth: Math.max(1, partitionCount),
                    })}
                    ${renderQuickStatus(0, n - 1, null, null, null, 'Sorted')}
                `,
                '<code>array is sorted in non-decreasing order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Quick Sort',
            subtitle: 'Partition around pivot and lock each pivot to its final index.',
            steps,
        };
    }

    function buildHeapSortModel(payload) {
        const values = normalizeNumberArray(payload.data);
        if (!values.length) {
            return null;
        }

        const arr = values.slice();
        const n = arr.length;
        const steps = [];
        let comparisons = 0;
        let swapCount = 0;
        let extractionCount = 0;
        let heapSize = n;
        const fixedSet = new Set();

        function renderHeapStatus(phaseLabel, rootIndex, leftIndex, rightIndex, candidateIndex, resultLabel = 'Pending') {
            const fixedCount = fixedSet.size;
            const progress = n ? Math.round((fixedCount / n) * 100) : 0;
            const rootLabel = Number.isInteger(rootIndex) && rootIndex < heapSize ? `${rootIndex} (${formatNumber(arr[rootIndex])})` : '-';
            const leftLabel = Number.isInteger(leftIndex) && leftIndex < heapSize ? `${leftIndex} (${formatNumber(arr[leftIndex])})` : '-';
            const rightLabel = Number.isInteger(rightIndex) && rightIndex < heapSize ? `${rightIndex} (${formatNumber(arr[rightIndex])})` : '-';
            const bestLabel = Number.isInteger(candidateIndex) && candidateIndex < heapSize ? `${candidateIndex} (${formatNumber(arr[candidateIndex])})` : '-';
            const suffixLabel = heapSize < n ? `[${heapSize}..${n - 1}]` : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Phase:</strong> ${phaseLabel}</div>
                    <div class="binary-search-status-line"><strong>Heap size:</strong> ${heapSize}</div>
                    <div class="binary-search-status-line"><strong>Root:</strong> ${rootLabel}</div>
                    <div class="binary-search-status-line"><strong>Children:</strong> left=${leftLabel}, right=${rightLabel}</div>
                    <div class="binary-search-status-line"><strong>Best candidate:</strong> ${bestLabel}</div>
                    <div class="binary-search-status-line"><strong>Comparisons:</strong> ${comparisons} | <strong>Swaps:</strong> ${swapCount} | <strong>Extractions:</strong> ${extractionCount}</div>
                    <div class="binary-search-status-line"><strong>Sorted suffix:</strong> ${suffixLabel}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Fixed values: ${fixedCount}/${n}</div>
                </div>
            `;
        }

        function pushHeapStep(title, details, options, formula) {
            const rootIndex = Number.isInteger(options.rootIndex) ? options.rootIndex : null;
            const candidateIndex = Number.isInteger(options.candidateIndex) ? options.candidateIndex : null;
            const highlightInHeap = Number.isInteger(candidateIndex)
                ? candidateIndex
                : (Number.isInteger(rootIndex) ? rootIndex : -1);
            const heapOnly = heapSize > 0 ? arr.slice(0, heapSize) : [];
            steps.push(
                makeStep(
                    title,
                    details,
                    `
                        ${renderHeapSortTrack3D(arr, {
                            heapSize,
                            rootIndex,
                            leftIndex: options.leftIndex,
                            rightIndex: options.rightIndex,
                            candidateIndex,
                            swappedPair: options.swappedPair || [],
                            fixedSet,
                            stepDepth: options.stepDepth || 0,
                        })}
                        ${heapOnly.length ? renderHeapVisualization(heapOnly, highlightInHeap) : ''}
                        ${renderHeapStatus(
                            options.phaseLabel || 'Heap',
                            rootIndex,
                            options.leftIndex,
                            options.rightIndex,
                            candidateIndex,
                            options.resultLabel || 'Pending'
                        )}
                    `,
                    formula
                )
            );
        }

        function siftDown(start, endExclusive, phaseLabel, depthSeed = 0) {
            let root = start;
            let localDepth = depthSeed;
            while (true) {
                const left = (2 * root) + 1;
                const right = left + 1;

                if (left >= endExclusive) {
                    pushHeapStep(
                        `Heapify stop at idx ${root}`,
                        'No children left inside heap; this subtree is valid.',
                        {
                            phaseLabel,
                            rootIndex: root,
                            leftIndex: null,
                            rightIndex: null,
                            candidateIndex: root,
                            resultLabel: 'Heap property holds',
                            stepDepth: localDepth,
                        },
                        '<code>if left child index >= heapSize: stop</code>'
                    );
                    return;
                }

                let largest = root;
                comparisons += 1;
                if (arr[left] > arr[largest]) {
                    largest = left;
                }
                pushHeapStep(
                    `Compare root ${root} with left child ${left}`,
                    arr[left] > arr[root]
                        ? `Left child ${formatNumber(arr[left])} is larger than root ${formatNumber(arr[root])}.`
                        : `Root ${formatNumber(arr[root])} stays >= left child ${formatNumber(arr[left])}.`,
                    {
                        phaseLabel,
                        rootIndex: root,
                        leftIndex: left,
                        rightIndex: right < endExclusive ? right : null,
                        candidateIndex: largest,
                        resultLabel: 'Left comparison',
                        stepDepth: localDepth,
                    },
                    '<code>largest = max(root, leftChild)</code>'
                );

                if (right < endExclusive) {
                    comparisons += 1;
                    if (arr[right] > arr[largest]) {
                        largest = right;
                    }
                    pushHeapStep(
                        `Compare current best with right child ${right}`,
                        largest === right
                            ? `Right child ${formatNumber(arr[right])} becomes largest candidate.`
                            : `Right child ${formatNumber(arr[right])} does not exceed current best.`,
                        {
                            phaseLabel,
                            rootIndex: root,
                            leftIndex: left,
                            rightIndex: right,
                            candidateIndex: largest,
                            resultLabel: 'Right comparison',
                            stepDepth: localDepth,
                        },
                        '<code>largest = max(largest, rightChild)</code>'
                    );
                }

                if (largest === root) {
                    pushHeapStep(
                        `Heap property satisfied at idx ${root}`,
                        'Root is already >= both children.',
                        {
                            phaseLabel,
                            rootIndex: root,
                            leftIndex: left,
                            rightIndex: right < endExclusive ? right : null,
                            candidateIndex: root,
                            resultLabel: 'No swap needed',
                            stepDepth: localDepth,
                        },
                        '<code>if largest == root: stop sift-down</code>'
                    );
                    return;
                }

                const temp = arr[root];
                arr[root] = arr[largest];
                arr[largest] = temp;
                swapCount += 1;
                pushHeapStep(
                    `Heapify swap ${root} <-> ${largest}`,
                    'Move larger child up to restore max-heap order.',
                    {
                        phaseLabel,
                        rootIndex: largest,
                        leftIndex: (2 * largest) + 1,
                        rightIndex: ((2 * largest) + 2) < endExclusive ? (2 * largest) + 2 : null,
                        candidateIndex: largest,
                        swappedPair: [root, largest],
                        resultLabel: 'Swapped and continue',
                        stepDepth: localDepth,
                    },
                    '<code>swap(root, largest); root = largest</code>'
                );
                root = largest;
                localDepth += 1;
            }
        }

        pushHeapStep(
            'Load Array',
            'Heap Sort builds a max-heap, then repeatedly extracts the root to the sorted suffix.',
            {
                phaseLabel: 'Build Max Heap',
                rootIndex: 0,
                leftIndex: 1 < n ? 1 : null,
                rightIndex: 2 < n ? 2 : null,
                candidateIndex: 0,
                resultLabel: 'Start',
                stepDepth: 0,
            },
            '<code>build max-heap, then for end=n-1..1: swap root with end and heapify</code>'
        );

        for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) {
            pushHeapStep(
                `Heapify subtree rooted at ${i}`,
                'Apply sift-down so this subtree satisfies max-heap property.',
                {
                    phaseLabel: 'Build Max Heap',
                    rootIndex: i,
                    leftIndex: (2 * i) + 1 < heapSize ? (2 * i) + 1 : null,
                    rightIndex: (2 * i) + 2 < heapSize ? (2 * i) + 2 : null,
                    candidateIndex: i,
                    resultLabel: 'Heapify start',
                    stepDepth: Math.max(1, (Math.floor(n / 2) - i)),
                },
                '<code>for i from floor(n/2)-1 down to 0: siftDown(i)</code>'
            );
            siftDown(i, heapSize, 'Build Max Heap', Math.max(1, (Math.floor(n / 2) - i)));
        }

        pushHeapStep(
            'Max Heap Built',
            'Root now holds the maximum value in current heap.',
            {
                phaseLabel: 'Build Complete',
                rootIndex: 0,
                leftIndex: 1 < heapSize ? 1 : null,
                rightIndex: 2 < heapSize ? 2 : null,
                candidateIndex: 0,
                resultLabel: 'Build done',
                stepDepth: 1,
            },
            '<code>max-heap invariant: parent >= children</code>'
        );

        for (let end = n - 1; end > 0; end -= 1) {
            const currentMax = arr[0];
            const temp = arr[0];
            arr[0] = arr[end];
            arr[end] = temp;
            swapCount += 1;
            extractionCount += 1;
            fixedSet.add(end);
            heapSize = end;
            pushHeapStep(
                `Extract max to idx ${end}`,
                `Move max value ${formatNumber(currentMax)} to sorted suffix.`,
                {
                    phaseLabel: 'Extract Max',
                    rootIndex: 0,
                    leftIndex: 1 < heapSize ? 1 : null,
                    rightIndex: 2 < heapSize ? 2 : null,
                    candidateIndex: 0,
                    swappedPair: [0, end],
                    resultLabel: 'Root extracted',
                    stepDepth: extractionCount,
                },
                '<code>swap(arr[0], arr[end]); heapSize--</code>'
            );
            siftDown(0, heapSize, 'Restore Heap', extractionCount);
        }

        for (let idx = 0; idx < n; idx += 1) {
            fixedSet.add(idx);
        }
        heapSize = 0;
        steps.push(
            makeStep(
                'Final Answer',
                `Sorted array: ${arr.map((value) => formatNumber(value)).join(' ')}.`,
                `
                    ${renderHeapSortTrack3D(arr, {
                        heapSize,
                        rootIndex: null,
                        leftIndex: null,
                        rightIndex: null,
                        candidateIndex: null,
                        fixedSet,
                        stepDepth: Math.max(1, extractionCount),
                    })}
                    ${renderHeapStatus('Sorted', null, null, null, null, 'Complete')}
                `,
                '<code>array is sorted in non-decreasing order</code>'
            )
        );

        return {
            title: 'Execution Visualization - Heap Sort',
            subtitle: 'Build max-heap, extract root to suffix, and restore heap.',
            steps,
        };
    }

    function buildSortingModel(payload, algorithmType) {
        if (algorithmType === 'bubble_sort') {
            return buildBubbleSortModel(payload);
        }
        if (algorithmType === 'selection_sort') {
            return buildSelectionSortModel(payload);
        }
        if (algorithmType === 'insertion_sort') {
            return buildInsertionSortModel(payload);
        }
        if (algorithmType === 'merge_sort') {
            return buildMergeSortModel(payload);
        }
        if (algorithmType === 'quick_sort') {
            return buildQuickSortModel(payload);
        }
        if (algorithmType === 'heap_sort') {
            return buildHeapSortModel(payload);
        }
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
                `
                    ${renderArrayVisualization(arr)}
                    ${renderIndexedStrip3D(arr)}
                `,
                '<code>Goal: arr[i] <= arr[i+1] for all i</code>'
            ),
        ];

        function renderSortingState(highlights = new Set(), focusSet = null) {
            const active = focusSet || highlights;
            const firstActive = active && active.size ? Array.from(active)[0] : -1;
            const baseState = `
                ${renderArrayVisualization(arr, highlights, active)}
                ${renderIndexedStrip3D(arr, highlights, active)}
            `;
            if (algorithmType === 'heap_sort') {
                return `
                    ${renderHeapVisualization(arr, Number.isInteger(firstActive) ? firstActive : -1)}
                    ${baseState}
                `;
            }
            return baseState;
        }

        function pushStep(title, details, highlights, formula, focusSet = null) {
            steps.push(
                makeStep(
                    title,
                    details,
                    renderSortingState(highlights || new Set(), focusSet),
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
                renderSortingState(),
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
        
        const dimensionTexts = {
            bfs: '<strong>3D Axes:</strong> X = graph layout, Y = graph layout, Z = traversal layer/depth',
            dfs: '<strong>3D Axes:</strong> X = graph layout, Y = graph layout, Z = traversal layer/depth',
        };
        
        const steps = [
            makeStep(
                `${mode.toUpperCase()} Setup`,
                `Start traversal from node ${start}. ${dimensionTexts[mode] || ''}`,
                `
                    ${renderArrayVisualization(nodes, new Set([nodeIndex.get(start)]), new Set([nodeIndex.get(start)]))}
                    ${renderIndexedStrip(nodes, new Set([nodeIndex.get(start)]))}
                    <div class="exec-summary">Edges: ${parsedEdges.map(([u, v]) => `(${u}-${v})`).join(', ')}</div>
                    <div class="exec-summary"><em>${dimensionTexts[mode] || ''}</em></div>
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
                            ${renderArrayVisualization(nodes, new Set([nodeIndex.get(current)]), new Set([nodeIndex.get(current)]))}
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
                            ${renderArrayVisualization(nodes, new Set([nodeIndex.get(current)]), new Set([nodeIndex.get(current)]))}
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
                `${renderArrayVisualization(nodes)}${renderIndexedStrip(nodes)}`,
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
            const cardWidth = 122;
            const cardHeight = 38;
            const gap = 10;
            const left = 24;
            const top = 34;
            const depth = 8;
            const width = Math.max(460, left * 2 + (nodes.length * (cardWidth + gap)) - gap);
            const height = 130;
            const cards = nodes
                .map((node, idx) => {
                    const d = dist.get(node);
                    const token = Number.isFinite(d) ? formatNumber(d) : 'inf';
                    const x = left + (idx * (cardWidth + gap));
                    const y = top;
                    const isActive = activeNode === node;
                    const isSettled = settled.has(node);
                    const front = isActive ? '#fde68a' : isSettled ? '#86efac' : '#dbeafe';
                    const topColor = isActive ? '#fef3c7' : isSettled ? '#bbf7d0' : '#eff6ff';
                    const side = isActive ? '#ca8a04' : isSettled ? '#16a34a' : '#2563eb';
                    const stroke = isActive ? '#92400e' : '#1e3a8a';
                    return `
                        <g>
                            <polygon points="${x},${y} ${x + depth},${y - depth} ${x + cardWidth + depth},${y - depth} ${x + cardWidth},${y}" fill="${topColor}"></polygon>
                            <polygon points="${x + cardWidth},${y} ${x + cardWidth + depth},${y - depth} ${x + cardWidth + depth},${y + cardHeight - depth} ${x + cardWidth},${y + cardHeight}" fill="${side}" opacity="0.93"></polygon>
                            <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="9" fill="${front}" stroke="${stroke}" stroke-width="${isActive ? '2.3' : '1.5'}"></rect>
                            <text x="${x + 12}" y="${y + 15}" font-size="10.5" fill="#334155">node ${node}</text>
                            <text x="${x + 12}" y="${y + 29}" font-size="12.5" font-weight="700" fill="#0f172a">dist=${token}</text>
                        </g>
                    `;
                })
                .join('');

            return render3DScene(cards, width, height, '3D Dijkstra distance table');
        }

        const steps = [
            makeStep(
                'Initialize Distances',
                `Source=${source}, Target=${target}. <strong>3D Axes:</strong> X = node layout, Y = node layout, Z = path-cost context.`,
                `
                    ${distanceTable(source)}
                    <div class="exec-summary">Frontier: [(${source}, 0)]</div>
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = node layout, Y = node layout, Z = path-cost context</em></div>
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

        function heuristic(row, col) {
            return Math.abs(goal[0] - row) + Math.abs(goal[1] - col);
        }

        function renderGrid(currentKey = null, pathSet = new Set(), openSet = new Set(), closedSet = new Set()) {
            const cell = 34;
            const gap = 7;
            const depth = 6;
            const left = 24;
            const top = 26;
            const width = Math.max(420, left * 2 + (cols * (cell + gap)) - gap);
            const height = Math.max(220, top * 2 + (rows * (cell + gap)) - gap);

            const cells = [];
            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < cols; col += 1) {
                    const key = `${row},${col}`;
                    const x = left + (col * (cell + gap));
                    const y = top + (row * (cell + gap));

                    let front = '#e2e8f0';
                    let topColor = '#f8fafc';
                    let side = '#64748b';
                    let stroke = '#334155';
                    let label = '';

                    if (blocked.has(key)) {
                        front = '#cbd5e1';
                        topColor = '#e2e8f0';
                        side = '#475569';
                        label = '#';
                    } else if (key === startKey) {
                        front = '#86efac';
                        topColor = '#bbf7d0';
                        side = '#16a34a';
                        label = 'S';
                    } else if (key === goalKey) {
                        front = '#fda4af';
                        topColor = '#fecdd3';
                        side = '#e11d48';
                        label = 'G';
                    } else if (key === currentKey) {
                        front = '#fde68a';
                        topColor = '#fef3c7';
                        side = '#ca8a04';
                        label = 'C';
                    } else if (pathSet.has(key)) {
                        front = '#d8b4fe';
                        topColor = '#e9d5ff';
                        side = '#9333ea';
                        label = '*';
                    } else if (openSet.has(key)) {
                        front = '#bae6fd';
                        topColor = '#e0f2fe';
                        side = '#0284c7';
                        label = 'O';
                    } else if (closedSet.has(key)) {
                        front = '#bfdbfe';
                        topColor = '#dbeafe';
                        side = '#1d4ed8';
                        label = 'X';
                    }

                    cells.push(`
                        <g>
                            <polygon points="${x},${y} ${x + depth},${y - depth} ${x + cell + depth},${y - depth} ${x + cell},${y}" fill="${topColor}"></polygon>
                            <polygon points="${x + cell},${y} ${x + cell + depth},${y - depth} ${x + cell + depth},${y + cell - depth} ${x + cell},${y + cell}" fill="${side}" opacity="0.9"></polygon>
                            <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="7" fill="${front}" stroke="${stroke}" stroke-width="1.2"></rect>
                            ${label ? `<text x="${x + (cell / 2)}" y="${y + 22}" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">${label}</text>` : ''}
                        </g>
                    `);
                }
            }

            return render3DScene(cells.join(''), width, height, '3D A* grid');
        }

        if (blocked.has(startKey) || blocked.has(goalKey)) {
            return {
                title: 'Execution Visualization - A* Grid Search',
                subtitle: 'Grid pathfinding with heuristic guidance.',
                steps: [
                    makeStep(
                        'Invalid Grid',
                        'Start or goal is blocked, so route is unreachable.',
                        `
                            ${renderGrid(startKey, new Set(), new Set([startKey]), new Set())}
                            <div class="exec-summary">Answer: -1</div>
                        `,
                        '<code>if start/goal blocked -> unreachable</code>'
                    ),
                ],
            };
        }

        const open = [{ row: 0, col: 0, g: 0, f: heuristic(0, 0) }];
        const gScore = new Map([[startKey, 0]]);
        const cameFrom = new Map();
        const closed = new Set();

        const steps = [
            makeStep(
                'Initialize A*',
                `Grid ${rows}x${cols}, start=(0,0), goal=(${goal[0]},${goal[1]}). <strong>3D Axes:</strong> X = column, Y = row, Z = heuristic/cost.`,
                `
                    ${renderGrid(startKey, new Set(), new Set([startKey]), new Set())}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = column, Y = row, Z = heuristic/cost</em></div>
                `,
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
                        ${renderGrid(currentKey, new Set(), new Set(open.map((entry) => `${entry.row},${entry.col}`)), closed)}
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
                            renderGrid(currentKey, new Set(), new Set(open.map((entry) => `${entry.row},${entry.col}`)), closed),
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
                    ${renderGrid(null, pathSet, new Set(), closed)}
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
        if (!leaves.length || (leaves.length & (leaves.length - 1)) !== 0) {
            return null;
        }

        let level = leaves.slice();
        let maximizing = false;
        let depth = 0;
        const totalPairFolds = leaves.length - 1;
        let appliedPairFolds = 0;

        function foldPreview(values, useMax) {
            const preview = [];
            for (let idx = 0; idx < values.length; idx += 2) {
                const left = values[idx];
                const right = values[idx + 1];
                preview.push(useMax ? Math.max(left, right) : Math.min(left, right));
            }
            return preview;
        }

        function renderMinimaxFold3D(levelValues, options = {}) {
            const values = Array.isArray(levelValues) ? levelValues : [];
            if (!values.length) {
                return '<p class="concept-muted mb-0">No minimax state available.</p>';
            }

            const operator = options.operator === 'MAX' ? 'MAX' : 'MIN';
            const activePairIndex = Number.isInteger(options.activePairIndex) ? options.activePairIndex : -1;
            const nextValues = Array.isArray(options.nextValues) ? options.nextValues : [];
            const cellWidth = values.length > 8 ? 56 : 66;
            const cellHeight = 38;
            const gap = 10;
            const leftPad = 24;
            const topRowY = 66;
            const bottomRowY = 154;
            const depthOffset = 8;
            const width = Math.max(500, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
            const height = 232;
            const uniqueId = `execMinimax${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

            const topCells = values.map((value, idx) => {
                const x = leftPad + (idx * (cellWidth + gap));
                const pairIdx = Math.floor(idx / 2);
                const inActivePair = activePairIndex >= 0 && pairIdx === activePairIndex;
                const fill = inActivePair ? '#dbeafe' : '#f8fafc';
                const stroke = inActivePair ? '#2563eb' : '#94a3b8';
                return `
                    <g>
                        <polygon points="${x + depthOffset},${topRowY - depthOffset} ${x + cellWidth + depthOffset},${topRowY - depthOffset} ${x + cellWidth},${topRowY} ${x},${topRowY}"
                            fill="${inActivePair ? '#bfdbfe' : '#e2e8f0'}"></polygon>
                        <rect x="${x}" y="${topRowY}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="${inActivePair ? '2.1' : '1.3'}"></rect>
                        <text x="${x + (cellWidth / 2)}" y="${topRowY + 22}" text-anchor="middle" font-size="13.2" class="exec-ml-text">${formatNumber(value)}</text>
                        <text x="${x + (cellWidth / 2)}" y="${topRowY - 7}" text-anchor="middle" font-size="9.8" class="exec-ml-text exec-ml-text-muted">i${idx}</text>
                    </g>
                `;
            }).join('');

            const bottomCells = nextValues.map((value, idx) => {
                const nextCellWidth = Math.max(62, cellWidth + 4);
                const x = leftPad + (idx * ((nextCellWidth) + gap + 6));
                const isFocus = activePairIndex >= 0 && idx === activePairIndex;
                return `
                    <g>
                        <polygon points="${x + depthOffset},${bottomRowY - depthOffset} ${x + nextCellWidth + depthOffset},${bottomRowY - depthOffset} ${x + nextCellWidth},${bottomRowY} ${x},${bottomRowY}"
                            fill="${isFocus ? '#bbf7d0' : '#dbeafe'}"></polygon>
                        <rect x="${x}" y="${bottomRowY}" width="${nextCellWidth}" height="${cellHeight}" rx="9" fill="${isFocus ? '#dcfce7' : '#eff6ff'}" stroke="${isFocus ? '#16a34a' : '#3b82f6'}" stroke-width="${isFocus ? '2.1' : '1.3'}"></rect>
                        <text x="${x + (nextCellWidth / 2)}" y="${bottomRowY + 22}" text-anchor="middle" font-size="13.2" class="exec-ml-text">${formatNumber(value)}</text>
                        <text x="${x + (nextCellWidth / 2)}" y="${bottomRowY - 7}" text-anchor="middle" font-size="9.8" class="exec-ml-text exec-ml-text-muted">n${idx}</text>
                    </g>
                `;
            }).join('');

            const connectors = nextValues.map((_, idx) => {
                const topLeftX = leftPad + ((idx * 2) * (cellWidth + gap)) + (cellWidth / 2);
                const topRightX = leftPad + (((idx * 2) + 1) * (cellWidth + gap)) + (cellWidth / 2);
                const nextCellWidth = Math.max(62, cellWidth + 4);
                const targetX = leftPad + (idx * ((nextCellWidth) + gap + 6)) + (nextCellWidth / 2);
                const focus = activePairIndex >= 0 && idx === activePairIndex;
                const stroke = focus ? '#16a34a' : '#94a3b8';
                return `
                    <g>
                        <line x1="${topLeftX}" y1="${topRowY + cellHeight + 2}" x2="${targetX}" y2="${bottomRowY - 10}" stroke="${stroke}" stroke-width="${focus ? '2.2' : '1.4'}" opacity="${focus ? '0.9' : '0.55'}"></line>
                        <line x1="${topRightX}" y1="${topRowY + cellHeight + 2}" x2="${targetX}" y2="${bottomRowY - 10}" stroke="${stroke}" stroke-width="${focus ? '2.2' : '1.4'}" opacity="${focus ? '0.9' : '0.55'}"></line>
                    </g>
                `;
            }).join('');

            return render3DScene(`
                <defs>
                    <linearGradient id="${uniqueId}Bg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="rgba(59,130,246,0.08)"></stop>
                        <stop offset="100%" stop-color="rgba(16,185,129,0.08)"></stop>
                    </linearGradient>
                </defs>
                <rect x="12" y="30" width="${width - 24}" height="${height - 44}" rx="16" fill="url(#${uniqueId}Bg)" stroke="var(--exec-ml-floor-stroke)" stroke-width="1.1"></rect>
                <text x="24" y="20" font-size="10.8" class="exec-ml-text exec-ml-text-axis">Current Level (${operator})</text>
                <text x="24" y="146" font-size="10.8" class="exec-ml-text exec-ml-text-axis">Next Fold Level</text>
                <rect x="${width - 154}" y="10" width="132" height="22" rx="11" fill="${operator === 'MAX' ? 'rgba(147,51,234,0.16)' : 'rgba(59,130,246,0.16)'}" stroke="${operator === 'MAX' ? '#9333ea' : '#2563eb'}" stroke-width="1.2"></rect>
                <text x="${width - 88}" y="25" text-anchor="middle" font-size="11" class="exec-ml-text ${operator === 'MAX' ? 'exec-ml-text-query' : 'exec-ml-text-axis'}">${operator} fold</text>
                ${topCells}
                ${connectors}
                ${bottomCells}
            `, width, height, '3D minimax fold state', 'exec-3d-bst');
        }

        function renderMinimaxStatus(stepLabel, detailLabel, options = {}) {
            const operator = options.operator === 'MAX' ? 'MAX' : 'MIN';
            const values = Array.isArray(options.values) ? options.values : [];
            const nextValues = Array.isArray(options.nextValues) ? options.nextValues : [];
            const pairLabel = options.pairLabel ? String(options.pairLabel) : '-';
            const focusLabel = options.focusLabel ? String(options.focusLabel) : 'Evaluate pairwise fold operation.';
            const progress = Math.max(0, Math.min(100, Math.round(asFiniteNumber(options.progress, 0))));
            return `
                ${renderMinimaxFold3D(values, { operator, activePairIndex: options.activePairIndex, nextValues })}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Operator:</strong> ${operator} | <strong>Depth:</strong> ${depth} | <strong>Active pair:</strong> ${escapeHtml(pairLabel)}</div>
                    <div class="binary-search-status-line"><strong>Current level:</strong> [${values.map((value) => formatNumber(value)).join(', ')}]</div>
                    <div class="binary-search-status-line"><strong>Next level preview:</strong> [${nextValues.map((value) => formatNumber(value)).join(', ')}]</div>
                    <div class="binary-search-status-line"><strong>Focus:</strong> ${escapeHtml(focusLabel)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Fold completion ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = node position in level, Y = fold layer (current -> next), Z = game-tree depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Load Leaf Utilities',
                `Start fold with ${level.length} leaf values.`,
                renderMinimaxStatus(
                    'Initialize leaves',
                    'Bottom layer contains terminal utilities. Start at MIN fold.',
                    {
                        operator: maximizing ? 'MAX' : 'MIN',
                        values: level,
                        nextValues: foldPreview(level, maximizing),
                        activePairIndex: -1,
                        pairLabel: '-',
                        focusLabel: 'Prepare first pair fold from leaf utilities.',
                        progress: 10,
                    }
                ),
                '<code>Fold pairs bottom-up, toggling MIN/MAX each level</code>'
            ),
        ];

        while (level.length > 1) {
            if (level.length % 2 !== 0) {
                return null;
            }
            const nextLevel = foldPreview(level, maximizing);
            for (let idx = 0; idx < level.length; idx += 2) {
                const left = level[idx];
                const right = level[idx + 1];
                const chosen = maximizing ? Math.max(left, right) : Math.min(left, right);
                const activePairIndex = idx / 2;
                const progress = Math.round(((appliedPairFolds + 1) / totalPairFolds) * 100);
                steps.push(
                    makeStep(
                        `Depth ${depth + 1} pair (${idx}, ${idx + 1})`,
                        `${maximizing ? 'MAX' : 'MIN'}(${formatNumber(left)}, ${formatNumber(right)}) = ${formatNumber(chosen)}.`,
                        renderMinimaxStatus(
                            'Evaluate pair',
                            `${maximizing ? 'MAX' : 'MIN'} fold on the highlighted pair.`,
                            {
                                operator: maximizing ? 'MAX' : 'MIN',
                                values: level,
                                nextValues: nextLevel,
                                activePairIndex,
                                pairLabel: `(${idx}, ${idx + 1}) -> ${formatNumber(chosen)}`,
                                focusLabel: `${maximizing ? 'MAX' : 'MIN'} picks ${formatNumber(chosen)} from [${formatNumber(left)}, ${formatNumber(right)}]`,
                                progress,
                            }
                        ),
                        `<code>${maximizing ? 'max' : 'min'}(${formatNumber(left)}, ${formatNumber(right)})</code>`
                    )
                );
                appliedPairFolds += 1;
            }
            level = nextLevel;
            maximizing = !maximizing;
            depth += 1;

            steps.push(
                makeStep(
                    `Level ${depth} Fold Result`,
                    `Collapsed to ${level.length} node values.`,
                    renderMinimaxStatus(
                        'Commit folded level',
                        'Use folded values as next layer input.',
                        {
                            operator: maximizing ? 'MAX' : 'MIN',
                            values: level,
                            nextValues: level.length > 1 ? foldPreview(level, maximizing) : [level[0]],
                            activePairIndex: -1,
                            pairLabel: '-',
                            focusLabel: `Next layer ready (${level.length} nodes).`,
                            progress: Math.round((appliedPairFolds / totalPairFolds) * 100),
                        }
                    ),
                    '<code>repeat until one root value remains</code>'
                )
            );
        }

        const answer = level[0];
        steps.push(
            makeStep(
                'Final Answer',
                `Root minimax value is ${formatNumber(answer)}.`,
                `
                    ${renderMinimaxStatus(
                        'Root resolved',
                        'Only one node remains after all alternating folds.',
                        {
                            operator: maximizing ? 'MAX' : 'MIN',
                            values: [answer],
                            nextValues: [answer],
                            activePairIndex: -1,
                            pairLabel: '-',
                            focusLabel: `Final minimax root = ${formatNumber(answer)}`,
                            progress: 100,
                        }
                    )}
                    <div class="exec-summary success">Answer: ${formatNumber(answer)}</div>
                `,
                `<code>root = ${formatNumber(answer)}</code>`
            )
        );

        return {
            title: 'Execution Visualization - Minimax Fold',
            subtitle: 'Bottom-up game-tree reduction with alternating MIN/MAX decisions.',
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

        function sharedPrefixLength(word, candidate) {
            let idx = 0;
            const limit = Math.min(String(word || '').length, String(candidate || '').length);
            while (idx < limit && String(word || '').charAt(idx) === String(candidate || '').charAt(idx)) {
                idx += 1;
            }
            return idx;
        }

        function renderPrefixStatus(activeWordIndex, probe) {
            const candidate = String(probe || '');
            const fullMatches = words.filter((word) => word.startsWith(candidate)).length;
            const activeWord = Number.isInteger(activeWordIndex) && activeWordIndex >= 0 && activeWordIndex < words.length
                ? words[activeWordIndex]
                : null;
            const mismatchAt = activeWord === null ? null : sharedPrefixLength(activeWord, candidate);
            const mismatchLabel = activeWord === null
                ? '-'
                : (mismatchAt === candidate.length ? 'none (full prefix match)' : `idx ${mismatchAt}`);

            return `
                <div class="exec-summary"><strong>Candidate:</strong> "${escapeHtml(candidate || '(empty)')}" (len ${candidate.length})</div>
                <div class="exec-summary"><strong>Words matching candidate:</strong> ${fullMatches}/${words.length} | <strong>Active mismatch:</strong> ${escapeHtml(mismatchLabel)}</div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = character index | Y = word row | Z = comparison depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Candidate Prefix',
                `Start with first word as candidate: "${prefix}".`,
                `
                    ${renderWordRail3D(words, 0, prefix)}
                    ${renderPrefixStatus(0, prefix)}
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
                        ${renderWordRail3D(words, idx, prefix)}
                        ${renderPrefixStatus(idx, prefix)}
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
                            ${renderWordRail3D(words, idx, prefix)}
                            ${renderPrefixStatus(idx, prefix)}
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
                        `
                            ${renderWordRail3D(words, idx, '')}
                            ${renderPrefixStatus(idx, '')}
                        `,
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
                    ${renderWordRail3D(words, -1, answerLabel === '(empty)' ? '' : answerLabel)}
                    ${renderPrefixStatus(-1, answerLabel === '(empty)' ? '' : answerLabel)}
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
        const epsilon = 1e-9;

        function renderLinearStatus(visitedSet, currentIndex = null, resolvedIndex = null) {
            const checked = Array.from(visitedSet).sort((a, b) => a - b);
            const checkedLabel = checked.length ? checked.join(', ') : '-';
            const currentLabel = Number.isInteger(currentIndex) ? `${currentIndex} (${formatNumber(data[currentIndex])})` : '-';
            const progress = data.length ? Math.round((checked.length / data.length) * 100) : 0;
            const resultLabel = resolvedIndex === null
                ? 'Pending'
                : (resolvedIndex >= 0 ? `Found at idx ${resolvedIndex}` : 'Not Found (-1)');
            return `
                <div class="linear-search-status">
                    <div class="linear-search-status-line"><strong>Target:</strong> ${formatNumber(target)}</div>
                    <div class="linear-search-status-line"><strong>Current:</strong> ${currentLabel}</div>
                    <div class="linear-search-status-line"><strong>Checked:</strong> [${checkedLabel}]</div>
                    <div class="linear-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="linear-search-progress-track">
                        <span class="linear-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="linear-search-progress-text">Scanned ${checked.length}/${data.length} values</div>
                </div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Search',
                `Scan left-to-right for first target occurrence (${formatNumber(target)}).`,
                `
                    ${renderLinearSearchTrack3D(data, { visitedSet: new Set(), currentIndex: 0 })}
                    ${renderLinearStatus(new Set(), 0, null)}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = index, Y = state lane, Z = scan depth cue.</em></div>
                `,
                '<code>for i in [0..n-1]: if arr[i] == target return i</code>'
            ),
        ];

        const visited = new Set();
        let answerIndex = -1;
        for (let idx = 0; idx < data.length; idx += 1) {
            visited.add(idx);
            const matched = Math.abs(data[idx] - target) <= epsilon;
            steps.push(
                makeStep(
                    `Check index ${idx}`,
                    matched
                        ? `arr[${idx}] = ${formatNumber(data[idx])} matches target. Stop at first match.`
                        : `arr[${idx}] = ${formatNumber(data[idx])} does not match target.`,
                    `
                        ${renderLinearSearchTrack3D(data, {
                            visitedSet: visited,
                            currentIndex: idx,
                            matchIndex: matched ? idx : null,
                        })}
                        ${renderLinearStatus(visited, idx, matched ? idx : null)}
                        <div class="exec-summary">Visited: [${Array.from(visited).sort((a, b) => a - b).join(', ')}]</div>
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
                `
                    ${renderLinearSearchTrack3D(data, {
                        visitedSet: visited,
                        currentIndex: answerIndex >= 0 ? answerIndex : null,
                        matchIndex: answerIndex >= 0 ? answerIndex : null,
                    })}
                    ${renderLinearStatus(visited, answerIndex >= 0 ? answerIndex : null, answerIndex)}
                `,
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

        const epsilon = 1e-9;
        let comparisons = 0;
        const midHistory = [];
        const estimatedWorst = Math.max(1, Math.ceil(Math.log2(data.length + 1)));

        function renderBinaryStatus(low, high, mid = null, resolvedIndex = null) {
            const hasWindow = Number.isInteger(low) && Number.isInteger(high) && low <= high;
            const windowLabel = hasWindow ? `[${low}..${high}]` : 'empty';
            const midLabel = Number.isInteger(mid) ? `${mid} (${formatNumber(data[mid])})` : '-';
            const resultLabel = resolvedIndex === null
                ? 'Pending'
                : (resolvedIndex >= 0 ? `Found @ ${resolvedIndex}` : 'Not Found (-1)');
            const eliminated = hasWindow ? Math.max(0, data.length - (high - low + 1)) : data.length;
            const progress = data.length ? Math.round((eliminated / data.length) * 100) : 0;
            const checkedLabel = midHistory.length ? midHistory.join(' -> ') : '-';
            return `
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Target:</strong> ${formatNumber(target)}</div>
                    <div class="binary-search-status-line"><strong>Window:</strong> ${windowLabel}</div>
                    <div class="binary-search-status-line"><strong>Mid:</strong> ${midLabel}</div>
                    <div class="binary-search-status-line"><strong>Checked mids:</strong> ${checkedLabel}</div>
                    <div class="binary-search-status-line"><strong>Result:</strong> ${resultLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Comparisons ${comparisons}/${estimatedWorst} (typical max) | Eliminated ${eliminated}/${data.length}</div>
                </div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Search Window',
                `Binary search on sorted array for target ${formatNumber(target)}.`,
                `
                    ${renderBinarySearchTrack3D(data, {
                        low: 0,
                        high: data.length - 1,
                        mid: Math.floor((data.length - 1) / 2),
                        visitedMids: new Set(midHistory),
                        stepDepth: comparisons,
                    })}
                    ${renderBinaryStatus(0, data.length - 1, Math.floor((data.length - 1) / 2), null)}
                    <div class="exec-summary"><em><strong>3D Axes:</strong> X = sorted index layout, Y = state lane, Z = search-window depth cue.</em></div>
                `,
                '<code>while low <= high: mid=(low+high)//2</code>'
            ),
        ];

        let low = 0;
        let high = data.length - 1;
        let answerIndex = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midValue = data[mid];
            comparisons += 1;
            if (midHistory[midHistory.length - 1] !== mid) {
                midHistory.push(mid);
            }

            steps.push(
                makeStep(
                    `Window [${low}..${high}], mid=${mid}`,
                    `Compare target ${formatNumber(target)} with arr[${mid}] = ${formatNumber(midValue)}.`,
                    `
                        ${renderBinarySearchTrack3D(data, {
                            low,
                            high,
                            mid,
                            visitedMids: new Set(midHistory),
                            stepDepth: comparisons,
                        })}
                        ${renderBinaryStatus(low, high, mid, null)}
                        <div class="exec-summary">low=${low}, mid=${mid}, high=${high}</div>
                    `,
                    `<code>mid = floor((${low}+${high})/2)</code>`
                )
            );

            if (Math.abs(midValue - target) <= epsilon) {
                answerIndex = mid;
                steps.push(
                    makeStep(
                        'Target Found',
                        `arr[${mid}] equals target.`,
                        `
                            ${renderBinarySearchTrack3D(data, {
                                low,
                                high,
                                mid,
                                foundIndex: mid,
                                visitedMids: new Set(midHistory),
                                stepDepth: comparisons,
                            })}
                            ${renderBinaryStatus(low, high, mid, mid)}
                        `,
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
                        `
                            ${renderBinarySearchTrack3D(data, {
                                low: nextLow,
                                high,
                                mid: nextLow <= high ? Math.floor((nextLow + high) / 2) : null,
                                visitedMids: new Set(midHistory),
                                stepDepth: comparisons,
                            })}
                            ${renderBinaryStatus(
                                nextLow,
                                high,
                                nextLow <= high ? Math.floor((nextLow + high) / 2) : null,
                                null
                            )}
                        `,
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
                        `
                            ${renderBinarySearchTrack3D(data, {
                                low,
                                high: nextHigh,
                                mid: low <= nextHigh ? Math.floor((low + nextHigh) / 2) : null,
                                visitedMids: new Set(midHistory),
                                stepDepth: comparisons,
                            })}
                            ${renderBinaryStatus(
                                low,
                                nextHigh,
                                low <= nextHigh ? Math.floor((low + nextHigh) / 2) : null,
                                null
                            )}
                        `,
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
                    `
                        ${renderBinarySearchTrack3D(data, {
                            low,
                            high,
                            mid: null,
                            visitedMids: new Set(midHistory),
                            stepDepth: comparisons,
                        })}
                        ${renderBinaryStatus(low, high, null, -1)}
                    `,
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
                `
                    ${renderBinarySearchTrack3D(data, {
                        low: answerIndex >= 0 ? answerIndex : low,
                        high: answerIndex >= 0 ? answerIndex : high,
                        mid: answerIndex >= 0 ? answerIndex : null,
                        foundIndex: answerIndex >= 0 ? answerIndex : null,
                        visitedMids: new Set(midHistory),
                        stepDepth: comparisons,
                    })}
                    ${renderBinaryStatus(
                        answerIndex >= 0 ? answerIndex : low,
                        answerIndex >= 0 ? answerIndex : high,
                        answerIndex >= 0 ? answerIndex : null,
                        answerIndex
                    )}
                `,
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
        const residuals = points.map((point) => {
            const expected = (slope * point.x) + intercept;
            return {
                index: point.index,
                actual: point.y,
                expected,
                error: point.y - expected,
            };
        });
        const mse = residuals.reduce((acc, row) => acc + (row.error ** 2), 0) / residuals.length;
        const fitSummary = residuals
            .slice(0, 4)
            .map((row) => `P${row.index + 1}: err=${formatNumber(row.error, 3, true)}`)
            .join(' | ');

        function renderRegressionStatus(stepLabel, detailLabel, options = {}) {
            const showLine = options.showLine !== false;
            const showQuery = options.showQuery === true;
            const highlightSet = options.highlightSet instanceof Set
                ? options.highlightSet
                : new Set([p1.index, p2.index]);
            const progress = options.progress || 0;
            return `
                ${renderRegressionPlot(points, slope, intercept, queryX, {
                    showLine,
                    showQuery,
                    highlightSet,
                })}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Anchor points:</strong> P${p1.index + 1}(${formatNumber(p1.x)}, ${formatNumber(p1.y)}), P${p2.index + 1}(${formatNumber(p2.x)}, ${formatNumber(p2.y)})</div>
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Model:</strong> y = (${formatNumber(slope, 4)})x + (${formatNumber(intercept, 4)})</div>
                    <div class="binary-search-status-line"><strong>Query:</strong> x=${formatNumber(queryX)} -> y=${formatNumber(prediction, 3)}</div>
                    <div class="binary-search-status-line"><strong>Fit check:</strong> MSE=${formatNumber(mse, 5)} | ${escapeHtml(fitSummary)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Model derivation progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = feature x, Y = output y, Z = depth cue for fit/projection state.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Load Training Points',
                `Use sample points to infer y = m*x + b, then predict for x=${formatNumber(queryX)}.`,
                renderRegressionStatus(
                    'Initialize',
                    'Select two non-vertical anchor points to define line.',
                    {
                        showLine: false,
                        showQuery: false,
                        highlightSet: new Set([p1.index, p2.index]),
                        progress: 20,
                    }
                ),
                '<code>Linear model form: y = m*x + b</code>'
            ),
            makeStep(
                'Compute Slope (m)',
                `From P1 and P2: (${formatNumber(p1.x)}, ${formatNumber(p1.y)}) and (${formatNumber(p2.x)}, ${formatNumber(p2.y)}).`,
                renderRegressionStatus(
                    'Slope',
                    `Rise over run = (${formatNumber(p2.y)}-${formatNumber(p1.y)})/(${formatNumber(p2.x)}-${formatNumber(p1.x)})`,
                    {
                        showLine: true,
                        showQuery: false,
                        highlightSet: new Set([p1.index, p2.index]),
                        progress: 45,
                    }
                ),
                `<code>m = (y2 - y1) / (x2 - x1) = (${formatNumber(p2.y)} - ${formatNumber(p1.y)}) / (${formatNumber(p2.x)} - ${formatNumber(p1.x)}) = ${formatNumber(slope, 4)}</code>`
            ),
            makeStep(
                'Compute Intercept (b)',
                'Substitute one known point into y = m*x + b.',
                renderRegressionStatus(
                    'Intercept',
                    `b = y1 - m*x1 = ${formatNumber(intercept, 4)}`,
                    {
                        showLine: true,
                        showQuery: false,
                        highlightSet: new Set([p1.index]),
                        progress: 70,
                    }
                ),
                `<code>b = y1 - m*x1 = ${formatNumber(p1.y)} - (${formatNumber(slope, 4)} * ${formatNumber(p1.x)}) = ${formatNumber(intercept, 4)}</code>`
            ),
            makeStep(
                'Predict Query',
                `Evaluate model at x=${formatNumber(queryX)}.`,
                `
                    ${renderRegressionStatus(
                        'Predict',
                        `Apply y = m*x + b at x=${formatNumber(queryX)}`,
                        {
                            showLine: true,
                            showQuery: true,
                            highlightSet: new Set([p1.index, p2.index]),
                            progress: 100,
                        }
                    )}
                    <div class="exec-summary success">Predicted y = ${formatNumber(prediction, 3)}</div>
                `,
                `<code>y = m*x + b = (${formatNumber(slope, 4)} * ${formatNumber(queryX)}) + ${formatNumber(intercept, 4)} = ${formatNumber(prediction, 3)}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Linear Regression',
            subtitle: 'Derive slope/intercept, check fit residuals, then project query x.',
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

        function renderLogisticStatus(stepLabel, detailLabel, progress = 0, showPoint = false) {
            const odds = probability > 0 && probability < 1 ? (probability / (1 - probability)) : Number.POSITIVE_INFINITY;
            const classLabel = probability >= 0.5 ? '1 (positive)' : '0 (negative)';
            return `
                ${renderLogisticCurve(z, { showPoint })}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Input z:</strong> ${formatNumber(z, 4)} | <strong>e^-z:</strong> ${formatNumber(expTerm, 6, true)}</div>
                    <div class="binary-search-status-line"><strong>Denominator:</strong> ${formatNumber(denominator, 6, true)} | <strong>sigma(z):</strong> ${formatNumber(probability, 3, true)}</div>
                    <div class="binary-search-status-line"><strong>Odds p/(1-p):</strong> ${Number.isFinite(odds) ? formatNumber(odds, 4, true) : 'infinite'} | <strong>Predicted class:</strong> ${classLabel}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Sigmoid computation progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = logit z, Y = probability p, Z = curve depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Start with Logit',
                `Given z = ${formatNumber(z, 4)}.`,
                renderLogisticStatus('Initialize', 'Prepare sigmoid formula with provided z.', 20, false),
                '<code>sigma(z) = 1 / (1 + e^-z)</code>'
            ),
            makeStep(
                'Compute Exponential Term',
                `Evaluate e^-z.`,
                renderLogisticStatus('Exponential', `e^(-z) = ${formatNumber(expTerm, 6, true)}`, 45, true),
                `<code>e^-z = e^(-${formatNumber(z, 4)}) = ${formatNumber(expTerm, 6, true)}</code>`
            ),
            makeStep(
                'Build Denominator',
                'Add 1 to exponential term.',
                renderLogisticStatus('Denominator', `1 + e^-z = ${formatNumber(denominator, 6, true)}`, 70, true),
                `<code>denominator = 1 + ${formatNumber(expTerm, 6, true)} = ${formatNumber(denominator, 6, true)}</code>`
            ),
            makeStep(
                'Final Probability',
                'Invert denominator to get class probability.',
                `
                    ${renderLogisticStatus('Final probability', 'Invert denominator and classify by threshold 0.5.', 100, true)}
                    <div class="exec-summary success">sigma(z) = ${formatNumber(probability, 3, true)}</div>
                `,
                `<code>sigma(z) = 1 / ${formatNumber(denominator, 6, true)} = ${formatNumber(probability, 3, true)}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Logistic Regression',
            subtitle: 'Stepwise sigmoid evaluation with probability, odds, and class decision.',
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

        function assignmentSummaryLine(snapshotAssignments) {
            return points
                .map((point, idx) => {
                    const cluster = snapshotAssignments[idx];
                    const label = cluster === 0 ? 'C1' : cluster === 1 ? 'C2' : '-';
                    return `P${idx + 1}(${formatNumber(point)})=>${label}`;
                })
                .join(' | ');
        }

        function splitGroups(snapshotAssignments) {
            const c1Points = [];
            const c2Points = [];
            let assignedCount = 0;
            points.forEach((point, idx) => {
                if (snapshotAssignments[idx] === 0) {
                    c1Points.push(point);
                    assignedCount += 1;
                } else if (snapshotAssignments[idx] === 1) {
                    c2Points.push(point);
                    assignedCount += 1;
                }
            });
            return { c1Points, c2Points, assignedCount };
        }

        function renderKmeansStatus(stepLabel, detailLabel, options = {}) {
            const snapshotAssignments = Array.isArray(options.assignments) ? options.assignments : [];
            const activeCentroids = Array.isArray(options.centroids) && options.centroids.length === 2
                ? options.centroids
                : [c1, c2];
            const currentIndex = Number.isInteger(options.currentIndex) ? options.currentIndex : null;
            const progress = Math.max(0, Math.min(100, Math.round(asFiniteNumber(options.progress, 0))));
            const groups = splitGroups(snapshotAssignments);
            const currentPoint = currentIndex !== null ? points[currentIndex] : null;
            const currentD1 = currentPoint === null ? null : Math.abs(currentPoint - activeCentroids[0]);
            const currentD2 = currentPoint === null ? null : Math.abs(currentPoint - activeCentroids[1]);
            const currentChoice = currentPoint === null
                ? '-'
                : (currentD1 <= currentD2 ? 'C1' : 'C2');

            return `
                ${renderOneDimClusterPlot(points, activeCentroids, snapshotAssignments, { currentIndex })}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Current point:</strong> ${currentPoint === null ? '-' : formatNumber(currentPoint)} | <strong>|x-C1|:</strong> ${currentD1 === null ? '-' : formatNumber(currentD1, 3, true)} | <strong>|x-C2|:</strong> ${currentD2 === null ? '-' : formatNumber(currentD2, 3, true)} | <strong>Choice:</strong> ${currentChoice}</div>
                    <div class="binary-search-status-line"><strong>C1 members:</strong> [${groups.c1Points.map((value) => formatNumber(value)).join(', ') || '-'}] | <strong>C1 size:</strong> ${groups.c1Points.length}</div>
                    <div class="binary-search-status-line"><strong>C2 members:</strong> [${groups.c2Points.map((value) => formatNumber(value)).join(', ') || '-'}] | <strong>C2 size:</strong> ${groups.c2Points.length}</div>
                    <div class="binary-search-status-line"><strong>Assignments:</strong> ${escapeHtml(assignmentSummaryLine(snapshotAssignments))}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Iteration progress ${progress}% (${groups.assignedCount}/${points.length} points assigned)</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = point value on number line, Y = assignment lane (C1/C2 state), Z = iteration depth cue (assignment then centroid update).</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Initialize Centroids',
                `Start with C1=${formatNumber(c1, 2, true)} and C2=${formatNumber(c2, 2, true)}.`,
                renderKmeansStatus(
                    'Initialize',
                    `Seed centroids with provided values C1=${formatNumber(c1, 2, true)}, C2=${formatNumber(c2, 2, true)}.`,
                    {
                        assignments: [],
                        centroids: [c1, c2],
                        progress: 15,
                    }
                ),
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

            const progress = Math.round(15 + (((idx + 1) / points.length) * 65));
            steps.push(
                makeStep(
                    `Assign Point ${idx + 1}`,
                    `Point ${formatNumber(point)} is assigned to ${cluster === 0 ? 'C1' : 'C2'} by nearest distance.`,
                    renderKmeansStatus(
                        'Assign nearest centroid',
                        `Compare distances for point ${formatNumber(point)} and choose the smaller one.`,
                        {
                            currentIndex: idx,
                            assignments: assignments.slice(),
                            centroids: [c1, c2],
                            progress,
                        }
                    ),
                    `<code>|${formatNumber(point)} - ${formatNumber(c1, 2, true)}|=${formatNumber(d1, 3, true)}, |${formatNumber(point)} - ${formatNumber(c2, 2, true)}|=${formatNumber(d2, 3, true)} -> ${cluster === 0 ? 'C1' : 'C2'}</code>`
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
                'Recompute each centroid as the mean of its assigned points.',
                `
                    ${renderKmeansStatus(
                        'Centroid update',
                        `C1' and C2' become the average of their assigned members.`,
                        {
                            assignments: assignments.slice(),
                            centroids: [nextC1, nextC2],
                            progress: 100,
                        }
                    )}
                    <div class="exec-summary success">New centroids: ${formatNumber(nextC1, 2, true)} ${formatNumber(nextC2, 2, true)}</div>
                `,
                `<code>C1' = mean([${groupOne.map((value) => formatNumber(value)).join(', ') || '-'}]), C2' = mean([${groupTwo.map((value) => formatNumber(value)).join(', ') || '-'}])</code>`
            )
        );

        return {
            title: 'Execution Visualization - K-Means (1 Iteration)',
            subtitle: 'Assign points to nearest centroid, then recompute centroid means with full state telemetry.',
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

        function buildRankPreview(rankLimit = 4) {
            return ranked
                .slice(0, Math.max(1, rankLimit))
                .map((entry, idx) => `#${idx + 1} idx ${entry.index} x=${formatNumber(entry.x)} ${entry.label} d=${formatNumber(entry.distance, 3, true)}`)
                .join(' | ');
        }

        function renderKnnStatus(stepLabel, detailLabel, options = {}) {
            const considered = options.considered instanceof Set ? options.considered : new Set();
            const selectedTop = options.selectedTop instanceof Set ? options.selectedTop : new Set();
            const currentRow = Number.isInteger(options.currentRow) ? ranked[options.currentRow] : null;
            const progress = Math.max(0, Math.min(100, Math.round(asFiniteNumber(options.progress, 0))));
            const selectedRows = ranked.filter((row) => selectedTop.has(row.index));
            const selectedCountA = selectedRows.filter((row) => row.label === 'A').length;
            const selectedCountB = selectedRows.length - selectedCountA;
            const selectedVote = selectedRows.length ? (selectedCountA >= selectedCountB ? 'A' : 'B') : '-';

            return `
                ${renderKnnPlot(train, queryX, considered, selectedTop)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Query:</strong> x=${formatNumber(queryX)} | <strong>k:</strong> ${k} | <strong>Current candidate:</strong> ${currentRow ? `idx ${currentRow.index}, x=${formatNumber(currentRow.x)}, ${currentRow.label}, d=${formatNumber(currentRow.distance, 3, true)}` : '-'}</div>
                    <div class="binary-search-status-line"><strong>Considered:</strong> ${considered.size}/${train.length} | <strong>Top-k selected:</strong> ${selectedRows.length}/${k}</div>
                    <div class="binary-search-status-line"><strong>Vote snapshot:</strong> A=${selectedCountA}, B=${selectedCountB}, class=${selectedVote}</div>
                    <div class="binary-search-status-line"><strong>Rank preview:</strong> ${escapeHtml(buildRankPreview(Math.min(6, ranked.length)))}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">KNN ranking progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = feature value x, Y = class lane (A/B), Z = ranking depth cue by distance order.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Load Query',
                `Classify query x=${formatNumber(queryX)} with k=${k}.`,
                renderKnnStatus(
                    'Initialize',
                    'Load training points and prepare distance comparisons.',
                    {
                        considered: new Set(),
                        selectedTop: new Set(),
                        progress: 12,
                    }
                ),
                '<code>distance = |x_train - x_query|</code>'
            ),
        ];

        const considered = new Set();
        ranked.forEach((row, rankIdx) => {
            considered.add(row.index);
            const provisionalTop = new Set(ranked.slice(0, Math.min(k, rankIdx + 1)).map((entry) => entry.index));
            const progress = Math.round(12 + (((rankIdx + 1) / ranked.length) * 68));
            steps.push(
                makeStep(
                    `Rank Neighbor ${rankIdx + 1}`,
                    `Candidate x=${formatNumber(row.x)} (${row.label}) has distance ${formatNumber(row.distance)}.`,
                    renderKnnStatus(
                        'Rank by distance',
                        'Sort by (distance, x, label, index) and extend ordered frontier.',
                        {
                            considered: new Set(considered),
                            selectedTop: provisionalTop,
                            currentRow: rankIdx,
                            progress,
                        }
                    ),
                    '<code>Sort by (distance, x, label)</code>'
                )
            );
        });

        steps.push(
            makeStep(
                `Take Top ${k}`,
                `Majority vote among nearest neighbors gives class ${prediction}.`,
                `
                    ${renderKnnStatus(
                        'Select top-k',
                        `Freeze first ${k} ranked neighbors and compute vote.`,
                        {
                            considered: new Set(considered),
                            selectedTop: new Set(topK.map((row) => row.index)),
                            progress: 92,
                        }
                    )}
                    <div class="exec-list">
                        ${topK.map((row) => `<div class="exec-list-row active">x=${formatNumber(row.x)}, label=${row.label}, d=${formatNumber(row.distance)}</div>`).join('')}
                    </div>
                `,
                `<code>top_k = first ${k} in sorted order</code>`
            )
        );

        steps.push(
            makeStep(
                'Majority Decision',
                `Resolve final class from selected neighbors.`,
                `
                    ${renderKnnStatus(
                        'Vote',
                        `Count labels in top-k (A=${countA}, B=${k - countA}) and apply majority rule.`,
                        {
                            considered: new Set(considered),
                            selectedTop: new Set(topK.map((row) => row.index)),
                            progress: 100,
                        }
                    )}
                    <div class="exec-summary success">Prediction: ${prediction}</div>
                `,
                `<code>count(A)=${countA}, count(B)=${k - countA}, answer=${prediction}</code>`
            )
        );

        return {
            title: 'Execution Visualization - KNN Classification',
            subtitle: 'Distance ranking, deterministic tie-break, and majority vote with full state board.',
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

        function renderDecisionTreeStatus(stepLabel, detailLabel, options = {}) {
            const progress = Math.max(0, Math.min(100, Math.round(asFiniteNumber(options.progress, 0))));
            const showTerms = options.showTerms === true;
            const showFinal = options.showFinal === true;
            const runningEntropy = Number.isFinite(options.runningEntropy) ? options.runningEntropy : null;
            const gainIfPure = 1 - entropy;

            return `
                ${renderEntropyBars(positive, negative, pPos, pNeg)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Counts:</strong> (+) ${formatNumber(positive)} , (-) ${formatNumber(negative)} , total ${formatNumber(total)}</div>
                    <div class="binary-search-status-line"><strong>Probabilities:</strong> p(+)=${formatNumber(pPos, 4, true)} , p(-)=${formatNumber(pNeg, 4, true)}</div>
                    <div class="binary-search-status-line"><strong>Entropy terms:</strong> t+ = ${formatNumber(posTerm, 6, true)} , t- = ${formatNumber(negTerm, 6, true)}${showTerms ? '' : ' (computed next)'}</div>
                    <div class="binary-search-status-line"><strong>Entropy snapshot:</strong> ${runningEntropy === null ? '-' : formatNumber(runningEntropy, 6, true)} | <strong>Impurity reduction to pure split:</strong> ${formatNumber(gainIfPure, 6, true)}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Entropy derivation progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = class bucket (+/-), Y = probability magnitude, Z = entropy derivation depth cue.</em></div>
                ${showFinal ? `<div class="exec-summary success">Final entropy H = ${formatNumber(entropy, 3, true)}</div>` : ''}
            `;
        }

        const steps = [
            makeStep(
                'Class Distribution',
                `Positive=${formatNumber(positive)}, Negative=${formatNumber(negative)}, Total=${formatNumber(total)}.`,
                renderDecisionTreeStatus(
                    'Initialize class counts',
                    'Start with class frequencies before computing impurity.',
                    { progress: 20, showTerms: false, runningEntropy: null }
                ),
                '<code>H = -sum(p_i * log2(p_i))</code>'
            ),
            makeStep(
                'Convert to Probabilities',
                'Compute class probabilities.',
                renderDecisionTreeStatus(
                    'Normalize counts',
                    `p(+)=${formatNumber(pPos, 4, true)}, p(-)=${formatNumber(pNeg, 4, true)}`,
                    { progress: 45, showTerms: false, runningEntropy: null }
                ),
                `<code>p(+)=${formatNumber(positive)}/${formatNumber(total)}, p(-)=${formatNumber(negative)}/${formatNumber(total)}</code>`
            ),
            makeStep(
                'Compute Entropy Terms',
                'Evaluate each class contribution.',
                `
                    ${renderDecisionTreeStatus(
                        'Compute term contributions',
                        'Evaluate -(p+)log2(p+) and -(p-)log2(p-).',
                        { progress: 72, showTerms: true, runningEntropy: posTerm + negTerm }
                    )}
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
                    ${renderDecisionTreeStatus(
                        'Sum terms',
                        'Entropy is the sum of both term contributions.',
                        { progress: 100, showTerms: true, runningEntropy: entropy, showFinal: true }
                    )}
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
        const total = spamScore + hamScore;
        const spamShare = total > 0 ? (spamScore / total) : 0;
        const hamShare = total > 0 ? (hamScore / total) : 0;
        const margin = Math.abs(spamScore - hamScore);
        const logOdds = spamScore > 0 && hamScore > 0 ? Math.log(spamScore / hamScore) : Number.POSITIVE_INFINITY;

        function renderNaiveBayesStatus(stepLabel, detailLabel, options = {}) {
            const progress = Math.max(0, Math.min(100, Math.round(asFiniteNumber(options.progress, 0))));
            const showDecision = options.showDecision === true;
            return `
                ${renderScoreBars(spamScore, hamScore)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Posterior scores:</strong> spam=${formatNumber(spamScore, 6, true)} | ham=${formatNumber(hamScore, 6, true)}</div>
                    <div class="binary-search-status-line"><strong>Normalized shares:</strong> spam=${formatNumber(spamShare, 4, true)} | ham=${formatNumber(hamShare, 4, true)}</div>
                    <div class="binary-search-status-line"><strong>Margin:</strong> ${formatNumber(margin, 6, true)} | <strong>log(spam/ham):</strong> ${Number.isFinite(logOdds) ? formatNumber(logOdds, 6, true) : 'infinite'}</div>
                    <div class="binary-search-status-line"><strong>Decision rule:</strong> pick larger score${showDecision ? ` -> ${predicted}` : ''}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Posterior comparison progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = class label (spam/ham), Y = posterior score magnitude, Z = comparison-depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Load Posterior Scores',
                'Compare unnormalized posteriors for each label.',
                renderNaiveBayesStatus(
                    'Initialize scores',
                    'Read posterior values for spam and ham classes.',
                    { progress: 30, showDecision: false }
                ),
                '<code>score(label) = prior(label) * likelihood(features|label)</code>'
            ),
            makeStep(
                'Normalize and Compare',
                'Inspect relative confidence and separation margin.',
                `
                    ${renderNaiveBayesStatus(
                        'Compute confidence',
                        'Normalize both scores and calculate margin/log-odds.',
                        { progress: 68, showDecision: false }
                    )}
                    <div class="exec-list">
                        <div class="exec-list-row active">spam share = ${formatNumber(spamShare, 4, true)}</div>
                        <div class="exec-list-row active">ham share = ${formatNumber(hamShare, 4, true)}</div>
                        <div class="exec-list-row active">margin = ${formatNumber(margin, 6, true)}</div>
                    </div>
                `,
                '<code>confidence(label) = score(label) / (score_spam + score_ham)</code>'
            ),
            makeStep(
                'Choose Maximum Score',
                `Higher score decides class (${predicted}).`,
                `
                    ${renderNaiveBayesStatus(
                        'Argmax decision',
                        'Choose class with highest posterior score.',
                        { progress: 100, showDecision: true }
                    )}
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
        const predictedClass = output >= 0.5 ? '1 (positive)' : '0 (negative)';

        function renderNeuralStatus(stepLabel, detailLabel, stage, options = {}) {
            const progress = Math.max(0, Math.min(100, Math.round(asFiniteNumber(options.progress, 0))));
            const highlightLine = String(options.highlightLine || '');
            return `
                ${renderNeuronDiagram(x1, x2, w1, w2, b, z, output, stage)}
                <div class="binary-search-status">
                    <div class="binary-search-status-line"><strong>Step:</strong> ${escapeHtml(stepLabel)} | <strong>Detail:</strong> ${escapeHtml(detailLabel)}</div>
                    <div class="binary-search-status-line"><strong>Inputs:</strong> x1=${formatNumber(x1)}, x2=${formatNumber(x2)} | <strong>Weights:</strong> w1=${formatNumber(w1, 3, true)}, w2=${formatNumber(w2, 3, true)} | <strong>b:</strong> ${formatNumber(b, 3, true)}</div>
                    <div class="binary-search-status-line"><strong>Terms:</strong> w1*x1=${formatNumber(termOne, 4, true)} | w2*x2=${formatNumber(termTwo, 4, true)}</div>
                    <div class="binary-search-status-line"><strong>Linear sum z:</strong> ${formatNumber(z, 4, true)} | <strong>sigma(z):</strong> ${formatNumber(output, 3, true)} | <strong>Class:</strong> ${predictedClass}</div>
                    <div class="binary-search-status-line"><strong>Focus:</strong> ${escapeHtml(highlightLine || 'Forward-pass decomposition')}</div>
                    <div class="binary-search-progress-track">
                        <span class="binary-search-progress-fill" style="width:${progress}%;"></span>
                    </div>
                    <div class="binary-search-progress-text">Forward-pass computation progress ${progress}%</div>
                </div>
                <div class="exec-summary"><em><strong>3D Axes:</strong> X = neuron stage (input -> weighted sum -> output), Y = numeric value magnitude, Z = operation depth cue.</em></div>
            `;
        }

        const steps = [
            makeStep(
                'Load Neuron Inputs',
                `x1=${formatNumber(x1)}, x2=${formatNumber(x2)}, w1=${formatNumber(w1, 3, true)}, w2=${formatNumber(w2, 3, true)}, b=${formatNumber(b, 3, true)}.`,
                renderNeuralStatus(
                    'Initialize neuron',
                    'Load inputs, weights, and bias for single-neuron forward pass.',
                    'input',
                    { progress: 18, highlightLine: 'Prepare z = w1*x1 + w2*x2 + b' }
                ),
                '<code>z = w1*x1 + w2*x2 + b</code>'
            ),
            makeStep(
                'Weighted Term 1',
                `Compute w1*x1.`,
                renderNeuralStatus(
                    'Compute first contribution',
                    'Multiply first feature by first weight.',
                    'term1',
                    { progress: 36, highlightLine: `w1*x1 = ${formatNumber(termOne, 4, true)}` }
                ),
                `<code>${formatNumber(w1, 3, true)} * ${formatNumber(x1)} = ${formatNumber(termOne, 4, true)}</code>`
            ),
            makeStep(
                'Weighted Term 2',
                `Compute w2*x2.`,
                renderNeuralStatus(
                    'Compute second contribution',
                    'Multiply second feature by second weight.',
                    'term2',
                    { progress: 56, highlightLine: `w2*x2 = ${formatNumber(termTwo, 4, true)}` }
                ),
                `<code>${formatNumber(w2, 3, true)} * ${formatNumber(x2)} = ${formatNumber(termTwo, 4, true)}</code>`
            ),
            makeStep(
                'Linear Combination',
                'Add weighted terms and bias.',
                renderNeuralStatus(
                    'Build linear sum',
                    'Aggregate both weighted terms with bias.',
                    'linear',
                    { progress: 78, highlightLine: `z = ${formatNumber(termOne, 4, true)} + ${formatNumber(termTwo, 4, true)} + ${formatNumber(b, 3, true)}` }
                ),
                `<code>z = ${formatNumber(termOne, 4, true)} + ${formatNumber(termTwo, 4, true)} + ${formatNumber(b, 3, true)} = ${formatNumber(z, 4, true)}</code>`
            ),
            makeStep(
                'Sigmoid Activation',
                'Map z to probability.',
                `
                    ${renderNeuralStatus(
                        'Activation output',
                        'Apply sigmoid to z and read final class probability.',
                        'output',
                        { progress: 100, highlightLine: `sigma(z) = ${formatNumber(output, 3, true)}` }
                    )}
                    <div class="exec-summary success">sigma(z) = ${formatNumber(output, 3, true)}</div>
                `,
                `<code>sigma(z) = 1/(1+e^-z) = ${formatNumber(output, 3, true)}</code>`
            ),
        ];

        return {
            title: 'Execution Visualization - Neural Network (1 Neuron)',
            subtitle: 'Single-neuron forward pass with weighted decomposition, sigmoid output, and class decision telemetry.',
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
                        <button type="button" class="viz-btn viz-btn-step-prev" id="execPrevBtn"><i class="bi bi-chevron-left"></i> Prev</button>
                        <button type="button" class="viz-btn viz-btn-step-next" id="execNextBtn">Next <i class="bi bi-chevron-right"></i></button>
                        <button type="button" class="viz-btn viz-btn-step-reset" id="execResetBtn"><i class="bi bi-arrow-clockwise"></i> Reset</button>
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
