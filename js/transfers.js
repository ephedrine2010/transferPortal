/**
 * Transfers module
 * Manages the list of transfer items: add, remove, render, get all.
 * In the future this list will be pushed to Firebase.
 */
var Transfers = (function () {
    var list = [];

    /**
     * Add an item to the transfer list.
     * @param {object} item - { sku, name_en, price, qty }
     */
    function add(item) {
        list.push({
            sku: item.sku,
            name_en: item.name_en,
            price: item.price,
            qty: item.qty || 1,
            timestamp: new Date().toISOString()
        });
        render();
    }

    /**
     * Remove an item from the transfer list by its index.
     * @param {number} index
     */
    function remove(index) {
        list.splice(index, 1);
        render();
    }

    /**
     * Render the transfers table in the DOM.
     */
    function render() {
        var tbody = document.getElementById('transfers-body');
        var section = document.getElementById('transfers-section');
        var countBadge = document.getElementById('transfers-count');

        if (list.length === 0) {
            section.classList.add('hidden');
            tbody.innerHTML = '';
            return;
        }

        section.classList.remove('hidden');
        countBadge.textContent = list.length;

        var rows = '';
        for (var i = 0; i < list.length; i++) {
            rows +=
                '<tr>' +
                '<td>' + list[i].sku + '</td>' +
                '<td>' + list[i].name_en + '</td>' +
                '<td>' + list[i].price.toFixed(2) + '</td>' +
                '<td>' + list[i].qty + '</td>' +
                '<td>' +
                '<button class="btn btn-danger btn-sm" data-remove-index="' + i + '">&times;</button>' +
                '</td>' +
                '</tr>';
        }

        tbody.innerHTML = rows;

        // Attach remove handlers via event delegation
        var buttons = tbody.querySelectorAll('[data-remove-index]');
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].addEventListener('click', handleRemoveClick);
        }
    }

    /**
     * Handle click on a remove button.
     */
    function handleRemoveClick(e) {
        var index = parseInt(e.currentTarget.getAttribute('data-remove-index'), 10);
        remove(index);
    }

    /**
     * Get a copy of the full transfer list (for future Firebase push).
     * @returns {Array}
     */
    function getAll() {
        return list.slice();
    }

    /**
     * Clear all transfers.
     */
    function clear() {
        list = [];
        render();
    }

    // Public API
    return {
        add: add,
        remove: remove,
        render: render,
        getAll: getAll,
        clear: clear
    };
})();
