document.addEventListener('DOMContentLoaded', function () {
    var controls = document.getElementById('quickFilterControls');
    if (!controls) {
        return;
    }

    var filterForm = document.getElementById('filterForm');
    var categorySelect = document.getElementById('categoryFilter');
    var filterButtons = controls.querySelectorAll('.category-filter-btn');
    var searchInput = document.getElementById('quickFilterSearchInput');
    var clearButton = document.getElementById('quickFilterClear');
    var noMatch = document.getElementById('quickFilterNoMatch');
    var selectedCategory = controls.dataset.selectedCategory || 'all';

    function normalizeCategory(value) {
        return value && value !== 'all' ? value : 'all';
    }

    function visibleButtons() {
        return Array.prototype.slice.call(filterButtons).filter(function (button) {
            return !button.classList.contains('d-none');
        });
    }

    function normalizeText(value) {
        return (value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function setActiveButton(category) {
        filterButtons.forEach(function (button) {
            var buttonCategory = button.getAttribute('data-category');
            var isActive = category !== 'all' && buttonCategory === category;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    function submitCategoryFilter(category) {
        if (filterForm && categorySelect) {
            categorySelect.value = category;
            if (typeof filterForm.requestSubmit === 'function') {
                filterForm.requestSubmit();
            } else {
                filterForm.submit();
            }
            return;
        }

        var url = new URL(window.location.href);
        if (category === 'all') {
            url.searchParams.delete('category');
        } else {
            url.searchParams.set('category', category);
        }
        window.location.href = url.toString();
    }

    function filterQuickButtons(query) {
        var normalizedQuery = normalizeText(query);
        var hasVisible = false;

        filterButtons.forEach(function (button) {
            var label = normalizeText(button.textContent || '');
            var matches = !normalizedQuery || label.indexOf(normalizedQuery) !== -1;
            button.classList.toggle('d-none', !matches);
            if (matches) {
                hasVisible = true;
            }
        });

        if (noMatch) {
            noMatch.classList.toggle('d-none', hasVisible);
        }
    }

    filterButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            selectedCategory = normalizeCategory(button.getAttribute('data-category'));
            setActiveButton(selectedCategory);
            submitCategoryFilter(selectedCategory);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            filterQuickButtons(searchInput.value);
        });

        searchInput.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter') {
                return;
            }

            event.preventDefault();
            var buttons = visibleButtons();
            if (!buttons.length) {
                return;
            }
            buttons[0].click();
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', function () {
            if (searchInput) {
                searchInput.value = '';
            }
            filterQuickButtons('');
            selectedCategory = 'all';
            setActiveButton(selectedCategory);
            submitCategoryFilter('all');
        });
    }

    selectedCategory = normalizeCategory(selectedCategory);
    if (!controls.querySelector('.category-filter-btn[data-category="' + selectedCategory + '"]')) {
        selectedCategory = 'all';
    }
    setActiveButton(selectedCategory);
    filterQuickButtons('');
});
