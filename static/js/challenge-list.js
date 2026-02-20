document.addEventListener('DOMContentLoaded', function () {
    var controls = document.getElementById('quickFilterControls');
    if (!controls) {
        return;
    }

    var filterButtons = controls.querySelectorAll('.category-filter-btn');
    var searchInput = document.getElementById('quickFilterSearchInput');
    var clearButton = document.getElementById('quickFilterClear');
    var selectedCategory = controls.dataset.selectedCategory || 'all';

    function normalizeValue(value) {
        return value && value !== 'all' ? value : 'all';
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
});
