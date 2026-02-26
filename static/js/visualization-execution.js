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
        return `
            <div class="exec-diagram-wrap exec-3d-scene${extraClass}">
                <svg class="exec-svg exec-svg-3d" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel || '3D execution visualization')}"${svgStyleAttr}>
                    ${svgBody}
                </svg>
            </div>
        `;
    }

    function renderIndexedStrip3D(values, highlightSet = new Set(), currentSet = new Set(), indexLabel = 'idx') {
        if (!Array.isArray(values) || !values.length) {
            return '<p class="concept-muted mb-0">Array unavailable.</p>';
        }
        const cellWidth = 64;
        const gap = 10;
        const leftPad = 24;
        const topPad = 24;
        const baseY = 66;
        const height = 140;
        const width = Math.max(420, leftPad * 2 + (values.length * (cellWidth + gap)) - gap);
        const depth = 10;
        const cells = values.map((value, idx) => {
            const x = leftPad + (idx * (cellWidth + gap));
            const isHighlight = highlightSet.has(idx);
            const isCurrent = currentSet.has(idx);
            const front = isCurrent ? '#facc15' : (isHighlight ? '#86efac' : '#dbeafe');
            const top = isCurrent ? '#fde68a' : (isHighlight ? '#bbf7d0' : '#eff6ff');
            const side = isCurrent ? '#ca8a04' : (isHighlight ? '#16a34a' : '#3b82f6');
            const stroke = isCurrent ? '#92400e' : '#1e3a8a';
            return `
                <g>
                    <polygon points="${x},${baseY} ${x + depth},${baseY - depth} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth},${baseY}" fill="${top}" opacity="0.95"></polygon>
                    <polygon points="${x + cellWidth},${baseY} ${x + cellWidth + depth},${baseY - depth} ${x + cellWidth + depth},${baseY + 38 - depth} ${x + cellWidth},${baseY + 38}" fill="${side}" opacity="0.92"></polygon>
                    <rect x="${x}" y="${baseY}" width="${cellWidth}" height="38" rx="8" fill="${front}" stroke="${stroke}" stroke-width="${isCurrent ? '2.8' : '1.7'}"></rect>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + 23}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${baseY + 56}" text-anchor="middle" font-size="10.5" fill="#64748b">${escapeHtml(indexLabel)} ${idx}</text>
                </g>
            `;
        }).join('');
        const legend = `
            <g>
                <text x="${leftPad}" y="18" font-size="10.5" fill="#64748b">3D state board</text>
            </g>
        `;
        return render3DScene(`${legend}${cells}`, width, height, '3D array strip');
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
        const cardWidth = 150;
        const rowHeight = 52;
        const left = 24;
        const top = 26;
        const depth = 8;
        const width = Math.max(480, left * 2 + cardWidth);
        const height = Math.max(180, top * 2 + (words.length * (rowHeight + 10)) + 30);
        const rows = words.map((word, idx) => {
            const y = top + (idx * (rowHeight + 10));
            const isActive = idx === activeIndex;
            const base = isActive ? '#fef3c7' : '#e2e8f0';
            const side = isActive ? '#d97706' : '#64748b';
            const topColor = isActive ? '#fde68a' : '#f8fafc';
            const stroke = isActive ? '#92400e' : '#334155';
            const safeWord = escapeHtml(word);
            return `
                <g>
                    <polygon points="${left},${y} ${left + depth},${y - depth} ${left + cardWidth + depth},${y - depth} ${left + cardWidth},${y}" fill="${topColor}"></polygon>
                    <polygon points="${left + cardWidth},${y} ${left + cardWidth + depth},${y - depth} ${left + cardWidth + depth},${y + rowHeight - depth} ${left + cardWidth},${y + rowHeight}" fill="${side}" opacity="0.95"></polygon>
                    <rect x="${left}" y="${y}" width="${cardWidth}" height="${rowHeight}" rx="10" fill="${base}" stroke="${stroke}" stroke-width="${isActive ? '2.4' : '1.6'}"></rect>
                    <text x="${left + 10}" y="${y + 20}" font-size="11" fill="#475569">W${idx + 1}</text>
                    <text x="${left + 10}" y="${y + 38}" font-size="13" font-weight="700" fill="#0f172a">${safeWord}</text>
                </g>
            `;
        }).join('');
        const prefixBadge = `
            <g>
                <rect x="${left + cardWidth + 44}" y="${top + 8}" width="210" height="48" rx="12" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.8"></rect>
                <text x="${left + cardWidth + 56}" y="${top + 28}" font-size="11" fill="#1e3a8a">Candidate Prefix</text>
                <text x="${left + cardWidth + 56}" y="${top + 44}" font-size="14" font-weight="700" fill="#0f172a">${escapeHtml(prefix || '(empty)')}</text>
            </g>
        `;
        return render3DScene(`${rows}${prefixBadge}`, width, height, 'Word comparison rail');
    }

    function renderStackState3D(state, activeIndex = null) {
        if (!Array.isArray(state) || !state.length) {
            return '<div class="exec-summary">Stack: [empty]</div>';
        }
        const cardWidth = 136;
        const cardHeight = 34;
        const depth = 8;
        const gap = 8;
        const left = 72;
        const baseY = 176;
        const width = 300;
        const height = 220;
        const cards = state.map((value, idx) => {
            const visualOrder = state.length - 1 - idx;
            const y = baseY - ((visualOrder + 1) * (cardHeight + gap));
            const isActive = activeIndex === idx;
            const front = isActive ? '#fde68a' : '#dbeafe';
            const top = isActive ? '#fef3c7' : '#eff6ff';
            const side = isActive ? '#ca8a04' : '#2563eb';
            const stroke = isActive ? '#92400e' : '#1e3a8a';
            return `
                <g>
                    <polygon points="${left},${y} ${left + depth},${y - depth} ${left + cardWidth + depth},${y - depth} ${left + cardWidth},${y}" fill="${top}"></polygon>
                    <polygon points="${left + cardWidth},${y} ${left + cardWidth + depth},${y - depth} ${left + cardWidth + depth},${y + cardHeight - depth} ${left + cardWidth},${y + cardHeight}" fill="${side}"></polygon>
                    <rect x="${left}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="${front}" stroke="${stroke}" stroke-width="${isActive ? '2.3' : '1.6'}"></rect>
                    <text x="${left + 12}" y="${y + 20}" font-size="10.5" fill="#475569">${idx === state.length - 1 ? 'TOP' : `idx ${idx}`}</text>
                    <text x="${left + (cardWidth / 2)}" y="${y + 21}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                </g>
            `;
        }).join('');
        return render3DScene(cards, width, height, '3D stack state');
    }

    function renderQueueState3D(state, activeIndex = null) {
        if (!Array.isArray(state) || !state.length) {
            return '<div class="exec-summary">Queue: [empty]</div>';
        }
        const cellWidth = 84;
        const cellHeight = 40;
        const gap = 12;
        const depth = 8;
        const left = 24;
        const top = 64;
        const width = Math.max(420, left * 2 + (state.length * (cellWidth + gap)));
        const height = 170;
        const cells = state.map((value, idx) => {
            const x = left + (idx * (cellWidth + gap));
            const isActive = activeIndex === idx;
            const front = isActive ? '#fde68a' : '#dbeafe';
            const topColor = isActive ? '#fef3c7' : '#eff6ff';
            const side = isActive ? '#ca8a04' : '#2563eb';
            const stroke = isActive ? '#92400e' : '#1e3a8a';
            return `
                <g>
                    <polygon points="${x},${top} ${x + depth},${top - depth} ${x + cellWidth + depth},${top - depth} ${x + cellWidth},${top}" fill="${topColor}"></polygon>
                    <polygon points="${x + cellWidth},${top} ${x + cellWidth + depth},${top - depth} ${x + cellWidth + depth},${top + cellHeight - depth} ${x + cellWidth},${top + cellHeight}" fill="${side}" opacity="0.95"></polygon>
                    <rect x="${x}" y="${top}" width="${cellWidth}" height="${cellHeight}" rx="9" fill="${front}" stroke="${stroke}" stroke-width="${isActive ? '2.3' : '1.6'}"></rect>
                    <text x="${x + (cellWidth / 2)}" y="${top + 23}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                    <text x="${x + (cellWidth / 2)}" y="${top + 56}" text-anchor="middle" font-size="10.5" fill="#64748b">idx ${idx}</text>
                </g>
            `;
        }).join('');
        const tags = `
            <text x="${left}" y="${top - 18}" font-size="11" fill="#64748b">FRONT</text>
            <text x="${left + ((state.length - 1) * (cellWidth + gap)) + (cellWidth - 32)}" y="${top - 18}" font-size="11" fill="#64748b">REAR</text>
        `;
        return render3DScene(`${tags}${cells}`, width, height, '3D queue state');
    }

    function renderHashBuckets3D(seenMap, highlightValue = null) {
        const buckets = Array.from({ length: 6 }, () => []);
        if (seenMap instanceof Map) {
            seenMap.forEach((idx, value) => {
                const bucketIndex = Math.abs(Math.floor(Number(value))) % buckets.length;
                buckets[bucketIndex].push({ value, idx });
            });
        }
        const bucketWidth = 146;
        const bucketHeight = 34;
        const left = 24;
        const top = 28;
        const gapY = 14;
        const depth = 8;
        const width = 420;
        const height = 330;
        const rows = buckets.map((bucket, bucketIndex) => {
            const y = top + (bucketIndex * (bucketHeight + gapY));
            const line = bucket.length
                ? bucket.map((entry) => `${formatNumber(entry.value)}@${entry.idx}`).join(', ')
                : '-';
            const hasHighlight = highlightValue !== null && bucket.some((entry) => entry.value === highlightValue);
            const front = hasHighlight ? '#fde68a' : '#e2e8f0';
            const topColor = hasHighlight ? '#fef3c7' : '#f8fafc';
            const side = hasHighlight ? '#ca8a04' : '#64748b';
            const stroke = hasHighlight ? '#92400e' : '#334155';
            return `
                <g>
                    <polygon points="${left},${y} ${left + depth},${y - depth} ${left + bucketWidth + depth},${y - depth} ${left + bucketWidth},${y}" fill="${topColor}"></polygon>
                    <polygon points="${left + bucketWidth},${y} ${left + bucketWidth + depth},${y - depth} ${left + bucketWidth + depth},${y + bucketHeight - depth} ${left + bucketWidth},${y + bucketHeight}" fill="${side}"></polygon>
                    <rect x="${left}" y="${y}" width="${bucketWidth}" height="${bucketHeight}" rx="8" fill="${front}" stroke="${stroke}" stroke-width="${hasHighlight ? '2.2' : '1.5'}"></rect>
                    <text x="${left + 10}" y="${y + 21}" font-size="11" fill="#334155">b${bucketIndex}</text>
                    <text x="${left + 42}" y="${y + 21}" font-size="11.5" fill="#0f172a">${escapeHtml(line)}</text>
                </g>
            `;
        }).join('');
        return render3DScene(rows, width, height, 'Hash bucket state');
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
        const width = Math.max(560, (pad * 2) + ((values.length - 1) * spacing) + nodeWidth + 152);
        const baseY = mode === 'circular' ? 96 : 78;
        const height = mode === 'circular' ? 268 : 216;
        const pointerDivider = nodeWidth - pointerSlotWidth;
        const nextPortY = mode === 'doubly' ? baseY + 16 : baseY + 26;
        const prevPortY = baseY + 40;
        const linkCurveX = Math.max(36, Math.floor(spacing * 0.38));
        const linkCurveUp = mode === 'doubly' ? 24 : 22;
        const linkCurveDown = 24;
        const markerScope = `${mode}-${values.length}-${currentIndex ?? 'n'}-${matchedIndex ?? 'n'}-${startIndex ?? 'n'}`
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
                    <text x="${x + ((nodeWidth - pointerSlotWidth) / 2)}" y="${y + 31}" text-anchor="middle" font-size="${valueFontSize}" font-weight="700"${valueFitAttrs} class="exec-ll-text">${escapeHtml(compactValue)}</text>
                    <rect x="${x + 12}" y="${y + nodeHeight + 8}" width="${nodeWidth - pointerSlotWidth - 16}" height="16" rx="8" fill="var(--exec-ll-index-bg)" stroke="var(--exec-ll-index-stroke)" stroke-width="1"></rect>
                    <text x="${x + ((nodeWidth - pointerSlotWidth) / 2)}" y="${y + nodeHeight + 20}" text-anchor="middle" font-size="10.5" class="exec-ll-text exec-ll-label">idx ${idx}</text>
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
                'exec-3d-linked',
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
        const left = 86;
        const top = 34;
        const width = Math.max(520, left + (cols * (cell + gap)) + 34);
        const height = Math.max(220, top + (rows * (cell + gap)) + 30);

        const colLabels = [''].concat(s2.split(''));
        const rowLabels = [''].concat(s1.split(''));

        const headers = colLabels
            .map((label, col) => {
                if (col === 0) {
                    return '';
                }
                const x = left + ((col - 1) * (cell + gap)) + (cell / 2);
                return `<text x="${x}" y="20" text-anchor="middle" font-size="11" fill="#475569">${escapeHtml(label)}</text>`;
            })
            .join('');

        const rowHeader = rowLabels
            .map((label, row) => {
                const y = top + (row * (cell + gap)) + (cell / 2) + 4;
                return `<text x="${left - 26}" y="${y}" text-anchor="middle" font-size="11" fill="#475569">${escapeHtml(label)}</text>`;
            })
            .join('');

        const cells = dp
            .map((row, i) =>
                row
                    .map((value, j) => {
                        const x = left + (j * (cell + gap));
                        const y = top + (i * (cell + gap));
                        const isActive = i === activeI && j === activeJ;
                        const front = isActive ? '#fde68a' : '#dbeafe';
                        const topColor = isActive ? '#fef3c7' : '#eff6ff';
                        const side = isActive ? '#ca8a04' : '#2563eb';
                        const stroke = isActive ? '#92400e' : '#1e3a8a';
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
            ${headers}
            ${rowHeader}
            ${cells}
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
                    <text x="${x + (barWidth / 2)}" y="${axisY + 17}" text-anchor="middle" font-size="10.5" fill="#64748b">${idx}</text>
                    <text x="${x + (barWidth / 2)}" y="${Math.max(18, y - 6)}" text-anchor="middle" font-size="10.5" fill="#0f172a">${escapeHtml(formatNumber(value))}</text>
                </g>
            `;
        }).join('');

        const axis = `
            <line x1="${left - 8}" y1="${zeroY}" x2="${width - 20}" y2="${zeroY}" stroke="#94a3b8" stroke-width="1.4"></line>
            <text x="${left - 12}" y="${zeroY - 6}" font-size="10" fill="#64748b">0</text>
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
        const w1Stroke = stage === 'term1' || stage === 'linear' || stage === 'output' ? '#2563eb' : '#94a3b8';
        const w2Stroke = stage === 'term2' || stage === 'linear' || stage === 'output' ? '#10b981' : '#94a3b8';
        const zStroke = stage === 'linear' || stage === 'output' ? '#f97316' : '#94a3b8';
        const outStroke = stage === 'output' ? '#9333ea' : '#94a3b8';
        const width = 520;
        const height = 224;
        const depth = 8;

        function nodeBubble(cx, cy, r, front, side, stroke, label, fontSize) {
            return `
                <g>
                    <circle cx="${cx + (depth * 0.45)}" cy="${cy - (depth * 0.45)}" r="${r}" fill="${side}" opacity="0.95"></circle>
                    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${front}" stroke="${stroke}" stroke-width="1.8"></circle>
                    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" class="exec-ml-text">${label}</text>
                </g>
            `;
        }

        return render3DScene(`
            <line x1="126" y1="68" x2="262" y2="106" stroke="${w1Stroke}" stroke-width="2.6"></line>
            <line x1="126" y1="152" x2="262" y2="106" stroke="${w2Stroke}" stroke-width="2.6"></line>
            <line x1="302" y1="106" x2="410" y2="106" stroke="${outStroke}" stroke-width="2.6"></line>
            ${nodeBubble(94, 68, 25, '#dbeafe', '#2563eb', '#1d4ed8', `x1=${formatNumber(x1)}`, 12)}
            ${nodeBubble(94, 152, 25, '#dcfce7', '#10b981', '#15803d', `x2=${formatNumber(x2)}`, 12)}
            ${nodeBubble(278, 106, 31, '#ffedd5', '#f97316', zStroke, `z=${formatNumber(z, 3, true)}`, 11)}
            ${nodeBubble(430, 106, 29, '#f3e8ff', '#a855f7', outStroke, `${formatNumber(output, 3, true)}`, 11)}
            <rect x="160" y="66" width="96" height="17" rx="6" fill="var(--exec-ml-floor)" opacity="0.9"></rect>
            <rect x="160" y="136" width="96" height="17" rx="6" fill="var(--exec-ml-floor)" opacity="0.9"></rect>
            <rect x="232" y="42" width="92" height="17" rx="6" fill="var(--exec-ml-floor)" opacity="0.9"></rect>
            <rect x="400" y="54" width="86" height="17" rx="6" fill="var(--exec-ml-floor)" opacity="0.9"></rect>
            <text x="172" y="78" font-size="11.5" class="exec-ml-text exec-ml-text-muted">w1=${formatNumber(w1, 3, true)}</text>
            <text x="172" y="148" font-size="11.5" class="exec-ml-text exec-ml-text-muted">w2=${formatNumber(w2, 3, true)}</text>
            <text x="242" y="54" font-size="11.5" class="exec-ml-text exec-ml-text-muted">b=${formatNumber(b, 3, true)}</text>
            <text x="412" y="66" font-size="11.5" class="exec-ml-text exec-ml-text-query">sigma(z)</text>
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
        const selectedRows = new Set();
        const steps = [
            makeStep(
                'Sort by Finish Time',
                'Greedy starts by earliest finishing activity.',
                `
                    ${renderActivityTimeline3D(sorted, selectedRows, -1)}
                `,
                '<code>Sort activities by end ascending</code>'
            ),
        ];

        const selected = [];
        let lastEnd = -Infinity;
        sorted.forEach((item, rowIdx) => {
            const compatible = item.start >= lastEnd;
            if (compatible) {
                selected.push(item);
                selectedRows.add(rowIdx);
                lastEnd = item.end;
            }
            steps.push(
                makeStep(
                    `Check A${item.index + 1}`,
                    compatible
                        ? `Compatible (${item.start} >= ${selected.length > 1 ? selected[selected.length - 2].end : '-inf'}), select it.`
                        : `Overlaps with last selected finish (${lastEnd}), skip.`,
                    `
                        ${renderActivityTimeline3D(sorted, selectedRows, rowIdx)}
                        <div class="exec-summary">Selected: [${selected.map((it) => `A${it.index + 1}`).join(', ') || '-'}]</div>
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
                    ${renderActivityTimeline3D(sorted, selectedRows, -1)}
                    <div class="exec-summary">Chosen activities: [${selected.map((it) => `A${it.index + 1}`).join(', ') || '-'}]</div>
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

        function dfs(index, sum, chosenIndices) {
            if (steps.length >= stepLimit) {
                return;
            }
            const chosenValues = chosenIndices.map((entry) => values[entry]);

            pushStep(
                makeStep(
                    `Explore index ${index}`,
                    `Current subset [${chosenValues.join(', ')}], sum=${sum}.`,
                    `
                        ${renderIndexedStrip3D(values, new Set(chosenIndices), index < values.length ? new Set([index]) : new Set())}
                        <div class="exec-summary">Chosen: [${chosenValues.join(', ')}] | Sum: ${sum} | Target: ${target}</div>
                    `,
                    '<code>branch(i, sum) => include(values[i]) or exclude(values[i])</code>'
                )
            );

            if (sum === target) {
                validKeys.add(chosenValues.slice().sort((a, b) => a - b).join(','));
                pushStep(
                    makeStep(
                        'Valid subset found',
                        `[${chosenValues.join(', ')}] hits target ${target}.`,
                        `
                            ${renderIndexedStrip3D(values, new Set(chosenIndices), new Set(chosenIndices))}
                            <div class="exec-summary success">Valid subsets found: ${validKeys.size}</div>
                        `,
                        '<code>if sum == target: count += 1</code>'
                    )
                );
                return;
            }
            if (index >= values.length || sum > target) {
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
                    ${renderIndexedStrip3D(values)}
                    <div class="exec-summary">Total valid subsets: ${validKeys.size}</div>
                `,
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
                `
                    ${renderIndexedStrip3D([0, 1], new Set([0, 1]))}
                    <div class="exec-summary">Sequence: [0, 1]</div>
                `,
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
                    renderIndexedStrip3D(seq, new Set([i - 1, i - 2]), new Set([i])),
                    `<code>F(${i}) = F(${i - 1}) + F(${i - 2})</code>`
                )
            );
        }
        steps.push(
            makeStep(
                'Final Answer',
                `F${n} = ${seq[n]}`,
                renderIndexedStrip3D(seq, new Set([n]), new Set([n])),
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
                        `
                            ${renderIndexedStrip3D([0], new Set([0]), new Set([0]), 'bit')}
                            <div class="exec-summary">Binary: 0</div>
                        `,
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
                    `
                        ${renderIndexedStrip3D(remainders, new Set([remainders.length - 1]), new Set(), 'bit')}
                        <div class="exec-summary">Remainders so far (LSB->MSB): [${remainders.join(', ')}]</div>
                    `,
                    `<code>${current} = 2 * ${quotient} + ${remainder}</code>`
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
                    ${renderIndexedStrip3D(finalBits, new Set(Array.from({ length: finalBits.length }, (_, idx) => idx)), new Set([0]), 'bit')}
                    <div class="exec-summary success">Binary: ${binary}</div>
                `,
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
                `
                    ${renderEuclidState3D(a, b)}
                    <div class="exec-summary">Start: a=${a}, b=${b}</div>
                `,
                '<code>while b != 0: (a, b) = (b, a % b)</code>'
            ),
        ];

        while (b !== 0) {
            const r = a % b;
            steps.push(
                makeStep(
                    `Euclid Step`,
                    `a=${a}, b=${b}, remainder=${r}`,
                    `
                        ${renderEuclidState3D(a, b, r)}
                        <div class="exec-summary">Next pair: (${b}, ${r})</div>
                    `,
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
                `
                    ${renderEuclidState3D(a, 0)}
                    <div class="exec-summary success">GCD: ${a}</div>
                `,
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
                renderLinkedListDiagram3D(values, { mode: 'singly', currentIndex: 0, visitedSet: visited }),
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
                        ${renderLinkedListDiagram3D(values, {
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
                    ? renderLinkedListDiagram3D(values, {
                        mode: 'singly',
                        currentIndex: answerIndex,
                        matchedIndex: answerIndex,
                        visitedSet: visited,
                    })
                    : renderLinkedListDiagram3D(values, { mode: 'singly', visitedSet: visited }),
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
                renderLinkedListDiagram3D(values, {
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
                        ${renderLinkedListDiagram3D(values, {
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
                    ? renderLinkedListDiagram3D(values, {
                        mode: 'doubly',
                        currentIndex: answerIndex,
                        matchedIndex: answerIndex,
                        visitedSet: visited,
                    })
                    : renderLinkedListDiagram3D(values, { mode: 'doubly', visitedSet: visited }),
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
                renderLinkedListDiagram3D(values, {
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
                        ${renderLinkedListDiagram3D(values, {
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
                    ? renderLinkedListDiagram3D(values, {
                        mode: 'circular',
                        currentIndex: answerIndex,
                        matchedIndex: answerIndex,
                        visitedSet: visited,
                        startIndex,
                    })
                    : renderLinkedListDiagram3D(values, { mode: 'circular', visitedSet: visited, startIndex }),
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
            return renderQueueState3D(state, activeIndex);
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
                    ${renderIndexedStrip3D(values, new Set([0]), new Set([0]))}
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
                        ${renderIndexedStrip3D(values, currentIndices, new Set(bestIndices))}
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
                    ${renderIndexedStrip3D(values, new Set(Array.from({ length: bestEnd - bestStart + 1 }, (_, offset) => bestStart + offset)), new Set([bestStart, bestEnd]))}
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
                `
                    ${renderIndexedStrip3D(values)}
                    ${renderHashBuckets3D(seenIndexByValue)}
                    <div class="exec-summary">Seen set: []</div>
                `,
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
                        ${renderIndexedStrip3D(values, new Set([idx]), complementSeen ? new Set([complementIndex, idx]) : new Set([idx]))}
                        ${renderHashBuckets3D(seenIndexByValue, complementSeen ? complement : null)}
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
                    ${renderIndexedStrip3D(values, hasPair ? new Set(discoveredPair) : new Set(), hasPair ? new Set(discoveredPair) : new Set())}
                    ${renderHashBuckets3D(seenIndexByValue)}
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
                    ${renderIndexedStrip3D(insertSequence)}
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
                        ${renderIndexedStrip3D(insertSequence, new Set([idx]), new Set([idx]))}
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
        const steps = [
            makeStep(
                `${mode.toUpperCase()} Setup`,
                `Start traversal from node ${start}.`,
                `
                    ${renderArrayVisualization(nodes, new Set([nodeIndex.get(start)]), new Set([nodeIndex.get(start)]))}
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
                `Grid ${rows}x${cols}, start=(0,0), goal=(${goal[0]},${goal[1]}).`,
                renderGrid(startKey, new Set(), new Set([startKey]), new Set()),
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
                    ${renderIndexedStrip3D(level)}
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
                        renderIndexedStrip3D(level, new Set([idx, idx + 1]), new Set([idx, idx + 1])),
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
                    renderIndexedStrip3D(level),
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
                    ${renderWordRail3D(words, 0, prefix)}
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
                        ${renderWordRail3D(words, idx, prefix)}
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
                            ${renderWordRail3D(words, idx, prefix)}
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
                        `
                            ${renderWordRail3D(words, idx, '')}
                            <div class="exec-summary">Current prefix: ""</div>
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
                renderIndexedStrip3D(data),
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
                        ${renderArrayVisualization(data, visited, new Set([idx]))}
                        ${renderIndexedStrip3D(data, visited, new Set([idx]))}
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
                    ? `${renderArrayVisualization(data, new Set([answerIndex]), new Set([answerIndex]))}${renderIndexedStrip3D(data, new Set([answerIndex]), new Set([answerIndex]))}`
                    : `${renderArrayVisualization(data)}${renderIndexedStrip3D(data)}`,
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
                renderIndexedStrip3D(data),
                '<code>while low <= high: mid=(low+high)//2</code>'
            ),
        ];

        let low = 0;
        let high = data.length - 1;
        let answerIndex = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midValue = data[mid];
            const windowHighlight = new Set();
            for (let cursor = low; cursor <= high; cursor += 1) {
                windowHighlight.add(cursor);
            }
            const highlight = new Set([low, mid, high]);

            steps.push(
                makeStep(
                    `Window [${low}..${high}], mid=${mid}`,
                    `Compare target ${formatNumber(target)} with arr[${mid}] = ${formatNumber(midValue)}.`,
                    `
                        ${renderArrayVisualization(data, windowHighlight, highlight)}
                        ${renderIndexedStrip3D(data, windowHighlight, highlight)}
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
                        `
                            ${renderArrayVisualization(data, new Set([mid]), new Set([mid]))}
                            ${renderIndexedStrip3D(data, new Set([mid]), new Set([mid]))}
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
                            ${renderArrayVisualization(data, windowHighlight, highlight)}
                            ${renderIndexedStrip3D(data, windowHighlight, highlight)}
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
                            ${renderArrayVisualization(data, windowHighlight, highlight)}
                            ${renderIndexedStrip3D(data, windowHighlight, highlight)}
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
                        ${renderArrayVisualization(data)}
                        ${renderIndexedStrip3D(data)}
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
                answerIndex >= 0
                    ? `${renderArrayVisualization(data, new Set([answerIndex]), new Set([answerIndex]))}${renderIndexedStrip3D(data, new Set([answerIndex]), new Set([answerIndex]))}`
                    : `${renderArrayVisualization(data)}${renderIndexedStrip3D(data)}`,
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
