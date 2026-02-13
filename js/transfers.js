/**
 * Transfers module
 * Manages transfer records: add to Firebase, real-time sync via onSnapshot, delete.
 *
 * Firebase path: {storeCode}/transfers/{YYYYMM}/{document}
 *   - storeCode = first 4 characters of the logged-in user's email
 *   - YYYYMM    = current year + month (e.g. 202602)
 */
var Transfers = (function () {
    var list = [];
    var unsubscribe = null;

    // ─── Month / Year State ─────────────────────────────────────────────

    var selectedYear = new Date().getFullYear();
    var currentMonth = (function () {
        var now = new Date();
        return '' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
    })();

    var MONTH_NAMES = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // ─── Helpers ────────────────────────────────────────────────────────

    /**
     * Extract the store code (first 4 characters) from the logged-in user's email.
     */
    function getStoreCode() {
        var user = window.currentAppUser;
        if (!user || !user.email) return null;
        return user.email.substring(0, 4);
    }

    /**
     * Build the Firestore collection path for the current store + selected month.
     * Pattern: {storeCode}/transfers/{YYYYMM}
     */
    function getCollectionPath() {
        var storeCode = getStoreCode();
        if (!storeCode) return null;
        return storeCode + '/transfers/' + currentMonth;
    }

    // ─── Month Navigation ───────────────────────────────────────────────

    /**
     * Generate month buttons for the selected year.
     */
    function generateMonthButtons() {
        var container = document.getElementById('months-tab');
        var yearDisplay = document.getElementById('current-year');
        if (!container) return;

        if (yearDisplay) yearDisplay.textContent = selectedYear;

        var html = '';
        for (var m = 1; m <= 12; m++) {
            var monthStr = String(m).padStart(2, '0');
            var key = '' + selectedYear + monthStr;
            var isActive = key === currentMonth ? ' active' : '';
            html += '<button class="month-btn' + isActive + '" data-month="' + key + '">' +
                    MONTH_NAMES[m - 1] + '</button>';
        }
        container.innerHTML = html;

        // Attach click handlers
        var buttons = container.querySelectorAll('.month-btn');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].addEventListener('click', onMonthClick);
        }
    }

    /**
     * Handle click on a month button.
     */
    function onMonthClick(e) {
        var month = e.currentTarget.getAttribute('data-month');
        selectMonth(month);
    }

    /**
     * Select a month and reload transfers.
     */
    function selectMonth(month) {
        currentMonth = month;

        // Update active state
        var buttons = document.querySelectorAll('.month-btn');
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].getAttribute('data-month') === month) {
                buttons[i].classList.add('active');
            } else {
                buttons[i].classList.remove('active');
            }
        }

        // Restart listener for the new month
        startListening();
    }

    /**
     * Change year by delta (-1 / +1) and refresh.
     */
    function changeYear(delta) {
        selectedYear += delta;

        // Keep the same month number but in the new year
        var monthPart = currentMonth.substring(4);
        currentMonth = '' + selectedYear + monthPart;

        generateMonthButtons();
        startListening();
    }

    /**
     * Bind year navigation button events.
     */
    function bindYearButtons() {
        var prev = document.getElementById('prev-year-btn');
        var next = document.getElementById('next-year-btn');
        if (prev) prev.addEventListener('click', function () { changeYear(-1); });
        if (next) next.addEventListener('click', function () { changeYear(1); });
    }

    // ─── Firebase Operations ────────────────────────────────────────────

    /**
     * Add a transfer record to Firebase.
     * Returns true on success, false on failure.
     */
    async function add(item) {
        var db = window.firestoreDb;
        var fns = window.firestoreFns;
        if (!db || !fns) {
            console.error('Transfers: Firebase not initialised');
            return false;
        }

        var path = getCollectionPath();
        if (!path) {
            console.error('Transfers: Cannot determine collection path – user not logged in');
            return false;
        }

        try {
            await fns.addDoc(fns.collection(db, path), {
                sku: item.sku,
                name_en: item.name_en,
                price: item.price,
                qty: item.qty || 1,
                toStore: item.toStore || '',
                imageUrl: item.imageUrl || '',
                transferDone: false,
                createdAt: fns.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Transfers: Error adding record:', error);
            return false;
        }
    }

    /**
     * Delete a transfer record from Firebase by its document ID.
     */
    async function remove(docId) {
        var db = window.firestoreDb;
        var fns = window.firestoreFns;
        if (!db || !fns) return;

        var path = getCollectionPath();
        if (!path) return;

        try {
            await fns.deleteDoc(fns.doc(db, path, docId));
        } catch (error) {
            console.error('Transfers: Error deleting record:', error);
            alert('Failed to delete transfer: ' + error.message);
        }
    }

    // ─── Real-time Listener ─────────────────────────────────────────────

    /**
     * Start listening to the transfers collection for the current store + month.
     * Any change (add / remove) automatically re-renders the table.
     */
    function startListening() {
        stopListening(); // Clean up any existing listener

        var db = window.firestoreDb;
        var fns = window.firestoreFns;
        if (!db || !fns) {
            console.error('Transfers: Firebase not initialised – cannot start listener');
            return;
        }

        var path = getCollectionPath();
        if (!path) {
            console.error('Transfers: Cannot determine collection path');
            return;
        }

        var q = fns.query(fns.collection(db, path));

        unsubscribe = fns.onSnapshot(q, function (snapshot) {
            list = [];
            snapshot.forEach(function (docSnap) {
                var data = docSnap.data();
                list.push({
                    id: docSnap.id,
                    sku: data.sku,
                    name_en: data.name_en,
                    price: data.price,
                    qty: data.qty,
                    toStore: data.toStore || '',
                    imageUrl: data.imageUrl || '',
                    transferDone: data.transferDone || false,
                    createdAt: data.createdAt
                });
            });
            render();
        }, function (error) {
            console.error('Transfers: Snapshot error:', error);
            if (error.code !== 'permission-denied') {
                alert('Failed to load transfers: ' + error.message);
            } else {
                // Empty collection or no permissions yet – just show empty table
                list = [];
                render();
            }
        });

        console.log('Transfers: Listening on', path);
    }

    /**
     * Stop the real-time listener and clear the local list.
     */
    function stopListening() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        list = [];
        render();
    }

    // ─── Rendering ──────────────────────────────────────────────────────

    /**
     * Render the transfers table from the local list.
     */
    function render() {
        var tbody = document.getElementById('transfers-body');
        var section = document.getElementById('transfers-section');
        var countBadge = document.getElementById('transfers-count');

        if (!tbody || !section) return;

        if (list.length === 0) {
            section.classList.add('hidden');
            tbody.innerHTML = '';
            if (countBadge) countBadge.textContent = '0';
            return;
        }

        section.classList.remove('hidden');
        if (countBadge) countBadge.textContent = list.length;

        var rows = '';
        for (var i = 0; i < list.length; i++) {
            var hasImg = !!list[i].imageUrl;
            var imgHtml;
            if (hasImg) {
                imgHtml =
                    '<img class="product-img product-img-loaded" ' +
                    'src="' + list[i].imageUrl + '" alt="" title="Click to enlarge" ' +
                    'data-full-img="' + list[i].imageUrl + '" />';
            } else {
                imgHtml = '<img class="product-img product-img-none" ' +
                    'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" />';
            }

            rows +=
                '<tr' + (list[i].transferDone ? ' class="transfer-done"' : '') + '>' +
                '<td class="td-img">' + imgHtml + '</td>' +
                '<td>' + list[i].sku + '</td>' +
                '<td>' + list[i].name_en + '</td>' +
                '<td>' + list[i].price.toFixed(2) + '</td>' +
                '<td>' + list[i].qty + '</td>' +
                '<td>' + list[i].toStore + '</td>' +
                '<td class="td-center">' +
                '<input type="checkbox" class="done-checkbox" data-done-id="' + list[i].id + '"' +
                (list[i].transferDone ? ' checked' : '') + ' />' +
                '</td>' +
                '<td>' +
                '<button class="btn btn-danger btn-sm" data-remove-id="' + list[i].id + '">&times;</button>' +
                '</td>' +
                '</tr>';
        }

        tbody.innerHTML = rows;

        // Attach remove handlers via event delegation
        var buttons = tbody.querySelectorAll('[data-remove-id]');
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].addEventListener('click', handleRemoveClick);
        }

        // Attach "Done" checkbox handlers
        var checkboxes = tbody.querySelectorAll('[data-done-id]');
        for (var k = 0; k < checkboxes.length; k++) {
            checkboxes[k].addEventListener('change', handleDoneToggle);
        }

        // Attach image click → open modal
        var imgEls = tbody.querySelectorAll('img[data-full-img]');
        for (var m = 0; m < imgEls.length; m++) {
            imgEls[m].addEventListener('click', handleImageClick);
        }
    }

    /**
     * Handle click on a product thumbnail – opens the full-size modal.
     */
    function handleImageClick(e) {
        var imgUrl = e.currentTarget.getAttribute('data-full-img');
        if (imgUrl) NahdiApi.openImageModal(imgUrl);
    }

    /**
     * Handle click on a remove button – confirms then deletes from Firebase.
     */
    function handleRemoveClick(e) {
        var docId = e.currentTarget.getAttribute('data-remove-id');
        if (confirm('Remove this transfer?')) {
            remove(docId);
        }
    }

    /**
     * Handle "Done" checkbox toggle – updates Firebase.
     */
    function handleDoneToggle(e) {
        var docId = e.currentTarget.getAttribute('data-done-id');
        var isChecked = e.currentTarget.checked;
        toggleDone(docId, isChecked);
    }

    /**
     * Update the transferDone field on a document in Firebase.
     */
    async function toggleDone(docId, isDone) {
        var db = window.firestoreDb;
        var fns = window.firestoreFns;
        if (!db || !fns) return;

        var path = getCollectionPath();
        if (!path) return;

        try {
            await fns.updateDoc(fns.doc(db, path, docId), {
                transferDone: isDone
            });
        } catch (error) {
            console.error('Transfers: Error updating done status:', error);
            alert('Failed to update status: ' + error.message);
        }
    }

    // ─── Export to Excel (CSV) ──────────────────────────────────────────

    /**
     * Export the current transfers list to a CSV file and trigger download.
     */
    function exportToExcel() {
        if (list.length === 0) {
            alert('No transfers to export.');
            return;
        }

        // Build data rows
        var rows = [];
        for (var i = 0; i < list.length; i++) {
            rows.push({
                'SKU': list[i].sku,
                'Item Name': list[i].name_en,
                'Price': list[i].price.toFixed(2),
                'Qty': list[i].qty,
                'To Store': list[i].toStore,
                'Done': list[i].transferDone ? 'Yes' : 'No'
            });
        }

        // Convert to CSV
        var headers = Object.keys(rows[0]);
        var csvLines = [];
        csvLines.push(headers.join(','));

        for (var j = 0; j < rows.length; j++) {
            var values = [];
            for (var k = 0; k < headers.length; k++) {
                var val = rows[j][headers[k]];
                // Wrap in quotes if value contains commas
                if (typeof val === 'string' && val.indexOf(',') !== -1) {
                    val = '"' + val + '"';
                }
                values.push(val);
            }
            csvLines.push(values.join(','));
        }

        var csv = csvLines.join('\n');

        // Build filename: transfers_{storeCode}_{YYYYMM}.csv
        var storeCode = getStoreCode() || 'unknown';
        var filename = 'transfers_' + storeCode + '_' + currentMonth + '.csv';

        // Trigger download
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        if (link.download !== undefined) {
            var url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // ─── Print ──────────────────────────────────────────────────────────

    /**
     * Print the transfers table only.
     */
    function printTransfers() {
        if (list.length === 0) {
            alert('No transfers to print.');
            return;
        }
        window.print();
    }

    // ─── Bind Action Buttons ────────────────────────────────────────────

    /**
     * Bind Export Excel and Print button events.
     */
    function bindActionButtons() {
        var exportBtn = document.getElementById('btn-export-excel');
        var printBtn = document.getElementById('btn-print');
        if (exportBtn) exportBtn.addEventListener('click', exportToExcel);
        if (printBtn) printBtn.addEventListener('click', printTransfers);
    }

    // ─── Utility ────────────────────────────────────────────────────────

    /**
     * Get a copy of the current transfer list.
     */
    function getAll() {
        return list.slice();
    }

    // ─── Public API ─────────────────────────────────────────────────────

    return {
        add: add,
        remove: remove,
        render: render,
        getAll: getAll,
        startListening: startListening,
        stopListening: stopListening,
        generateMonthButtons: generateMonthButtons,
        bindYearButtons: bindYearButtons,
        bindActionButtons: bindActionButtons
    };
})();
