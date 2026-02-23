document.addEventListener('DOMContentLoaded', function () {
    var controls = document.getElementById('quickFilterControls');
    if (!controls) {
        return;
    }

    var PLAYBACK_KEY = 'aqCategorySequenceState';
    var PLAYBACK_DELAY_MS = 2500;
    var autoplayTimer = null;
    var filterButtons = controls.querySelectorAll('.category-filter-btn');
    var searchInput = document.getElementById('quickFilterSearchInput');
    var clearButton = document.getElementById('quickFilterClear');
    var selectedCategory = controls.dataset.selectedCategory || 'all';

    function normalizeValue(value) {
        return value && value !== 'all' ? value : 'all';
    }

    function resolveAbsoluteUrl(href) {
        try {
            return new URL(href, window.location.href).toString();
        } catch (error) {
            return '';
        }
    }

    function normalizeUrlForMatch(href) {
        try {
            var parsed = new URL(href, window.location.href);
            return parsed.pathname + parsed.search;
        } catch (error) {
            return '';
        }
    }

    function updateLocation(mutator) {
        var url = new URL(window.location.href);
        mutator(url.searchParams);
        window.location.href = url.toString();
    }

    function setActiveCategoryButton(category) {
        filterButtons.forEach(function (button) {
            var buttonCategory = button.getAttribute('data-category');
            var isActive = category !== 'all' && buttonCategory === category;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function submitCategoryFilter(category) {
        updateLocation(function (params) {
            if (category === 'all') {
                params.delete('category');
                params.delete('subtype');
            } else {
                params.set('category', category);
                params.delete('subtype');
            }
        });
    }

    function submitSearchFilter() {
        var value = searchInput ? searchInput.value.trim() : '';
        updateLocation(function (params) {
            if (value) {
                params.set('search', value);
            } else {
                params.delete('search');
            }
        });
    }

    function loadPlaybackState() {
        try {
            var raw = window.sessionStorage.getItem(PLAYBACK_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function savePlaybackState(state) {
        try {
            window.sessionStorage.setItem(PLAYBACK_KEY, JSON.stringify(state));
        } catch (error) {
            // Ignore storage failures (private mode, quota, etc.)
        }
    }

    function clearPlaybackState() {
        try {
            window.sessionStorage.removeItem(PLAYBACK_KEY);
        } catch (error) {
            // Ignore storage failures.
        }
    }

    function extractAlgorithmType(linkEl, cardEl) {
        var dataHint = cardEl ? cardEl.getAttribute('data-algorithm-type') : '';
        if (dataHint) {
            return dataHint.trim().toLowerCase();
        }
        if (linkEl) {
            try {
                var resolved = new URL(linkEl.getAttribute('href') || '', window.location.href);
                var subtype = resolved.searchParams.get('subtype');
                if (subtype) {
                    return String(subtype).trim().toLowerCase();
                }
            } catch (error) {
                // Keep fallback branch.
            }
        }
        return '';
    }

    function collectCategoryEntries(category) {
        var sections = document.querySelectorAll('.category-section');
        var unique = {};
        var entries = [];

        sections.forEach(function (section) {
            var sectionCategory = (section.getAttribute('data-category') || '').toLowerCase();
            if (category !== 'all' && sectionCategory !== category) {
                return;
            }

            var cards = section.querySelectorAll('.challenge-card');
            cards.forEach(function (card) {
                var wrappedLink = card.closest('a[href]');
                var directLink = card.querySelector('a.btn[href]') || card.querySelector('a[href]');
                var link = directLink || wrappedLink;
                if (!link) {
                    return;
                }

                var href = resolveAbsoluteUrl(link.getAttribute('href'));
                if (!href) {
                    return;
                }

                var titleNode = card.querySelector('h3');
                var algoNode = card.querySelector('.challenge-algorithm-label');
                var label = '';
                if (algoNode) {
                    label = algoNode.textContent.trim();
                } else if (titleNode) {
                    label = titleNode.textContent.trim();
                } else {
                    label = 'Algorithm Type';
                }

                var algorithmType = extractAlgorithmType(link, card);
                var key = (algorithmType || label.toLowerCase()) + '::' + href;
                if (unique[key]) {
                    return;
                }
                unique[key] = true;
                entries.push({
                    label: label,
                    url: href,
                    algorithmType: algorithmType,
                });
            });
        });

        return entries;
    }

    function getCurrentUrlKey() {
        return normalizeUrlForMatch(window.location.href);
    }

    function supportsExecution(entry) {
        if (!entry || !entry.algorithmType) {
            return true;
        }
        if (typeof window.hasExecutionVisualizationSupport !== 'function') {
            return true;
        }
        return window.hasExecutionVisualizationSupport(entry.algorithmType);
    }

    function findPlayableIndex(entries, startIndex, direction) {
        if (!entries.length) {
            return -1;
        }
        var index = startIndex;
        for (var step = 0; step < entries.length; step += 1) {
            var clamped = Math.max(0, Math.min(index, entries.length - 1));
            if (supportsExecution(entries[clamped])) {
                return clamped;
            }
            index += direction;
            if (index < 0 || index >= entries.length) {
                return -1;
            }
        }
        return -1;
    }

    function ensurePlaybackControls() {
        var host = document.getElementById('quickFilterPlayback');
        if (host) {
            return host;
        }

        host = document.createElement('div');
        host.id = 'quickFilterPlayback';
        host.className = 'd-flex flex-wrap align-items-center gap-2 mt-3';
        host.innerHTML = [
            '<span class="badge badge-accent">Category Sequence</span>',
            '<button type="button" class="btn btn-sm btn-outline-primary" id="quickPlaybackPrev"><i class="bi bi-chevron-left"></i> Prev Type</button>',
            '<button type="button" class="btn btn-sm btn-outline-primary" id="quickPlaybackPlay"><i class="bi bi-play-fill"></i> Play</button>',
            '<button type="button" class="btn btn-sm btn-outline-primary" id="quickPlaybackNext">Next Type <i class="bi bi-chevron-right"></i></button>',
            '<span class="text-muted small" id="quickPlaybackStatus" aria-live="polite"></span>',
        ].join('');
        controls.parentNode.appendChild(host);
        return host;
    }

    function stopAutoplay() {
        if (autoplayTimer) {
            window.clearTimeout(autoplayTimer);
            autoplayTimer = null;
        }
    }

    window.initCategoryPlayback = function initCategoryPlayback(category) {
        stopAutoplay();
        category = normalizeValue(category);

        var host = ensurePlaybackControls();
        var prevBtn = host.querySelector('#quickPlaybackPrev');
        var playBtn = host.querySelector('#quickPlaybackPlay');
        var nextBtn = host.querySelector('#quickPlaybackNext');
        var statusNode = host.querySelector('#quickPlaybackStatus');
        var entries = collectCategoryEntries(category);

        if (category === 'all' || !entries.length) {
            host.classList.add('d-none');
            clearPlaybackState();
            return;
        }
        host.classList.remove('d-none');

        var state = loadPlaybackState();
        var currentUrl = getCurrentUrlKey();
        var currentIndex = entries.findIndex(function (entry) {
            return normalizeUrlForMatch(entry.url) === currentUrl;
        });

        if (!state || state.category !== category || !Array.isArray(state.entries) || !state.entries.length) {
            state = {
                category: category,
                entries: entries,
                index: currentIndex >= 0 ? currentIndex : 0,
                autoplay: false,
            };
        } else {
            state.entries = entries;
            if (currentIndex >= 0) {
                state.index = currentIndex;
            } else {
                state.index = Math.max(0, Math.min(Number(state.index) || 0, entries.length - 1));
            }
            state.autoplay = state.autoplay === true;
        }

        function updateStatus() {
            if (!entries.length) {
                statusNode.textContent = 'No algorithm types available in this category.';
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                playBtn.disabled = true;
                return;
            }
            var entry = entries[state.index];
            var playableLabel = supportsExecution(entry) ? '' : ' (no execution model; will skip)';
            statusNode.textContent = (state.index + 1) + '/' + entries.length + ' - ' + entry.label + playableLabel;
            prevBtn.disabled = findPlayableIndex(entries, state.index - 1, -1) < 0;
            nextBtn.disabled = findPlayableIndex(entries, state.index + 1, 1) < 0;
            playBtn.disabled = entries.length < 2;
            playBtn.innerHTML = state.autoplay
                ? '<i class="bi bi-pause-fill"></i> Pause'
                : '<i class="bi bi-play-fill"></i> Play';
        }

        function goToIndex(index, direction) {
            var playableIndex = findPlayableIndex(entries, index, direction);
            if (playableIndex < 0) {
                state.autoplay = false;
                savePlaybackState(state);
                updateStatus();
                return;
            }
            state.index = playableIndex;
            savePlaybackState(state);
            window.location.href = entries[state.index].url;
        }

        function scheduleAutoplay() {
            stopAutoplay();
            if (!state.autoplay) {
                return;
            }
            var nextIndex = findPlayableIndex(entries, state.index + 1, 1);
            if (nextIndex < 0) {
                state.autoplay = false;
                savePlaybackState(state);
                updateStatus();
                return;
            }
            autoplayTimer = window.setTimeout(function () {
                goToIndex(state.index + 1, 1);
            }, PLAYBACK_DELAY_MS);
        }

        prevBtn.onclick = function () {
            state.autoplay = false;
            savePlaybackState(state);
            goToIndex(state.index - 1, -1);
        };

        nextBtn.onclick = function () {
            state.autoplay = false;
            savePlaybackState(state);
            goToIndex(state.index + 1, 1);
        };

        playBtn.onclick = function () {
            state.autoplay = !state.autoplay;
            savePlaybackState(state);
            updateStatus();
            scheduleAutoplay();
        };

        savePlaybackState(state);
        updateStatus();
        if (state.autoplay) {
            scheduleAutoplay();
        }
    };

    filterButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            selectedCategory = normalizeValue(button.getAttribute('data-category'));
            setActiveCategoryButton(selectedCategory);
            submitCategoryFilter(selectedCategory);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter') {
                return;
            }

            event.preventDefault();
            submitSearchFilter();
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', function () {
            if (searchInput) {
                searchInput.value = '';
            }
            submitSearchFilter();
        });
    }

    selectedCategory = normalizeValue(selectedCategory);
    if (!controls.querySelector('.category-filter-btn[data-category="' + selectedCategory + '"]')) {
        selectedCategory = 'all';
    }
    setActiveCategoryButton(selectedCategory);

    if (typeof window.initCategoryPlayback === 'function') {
        window.initCategoryPlayback(selectedCategory);
    }
});

