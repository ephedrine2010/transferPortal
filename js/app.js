/**
 * App module
 * Main application logic – initialises all modules and wires UI events.
 */
var App = (function () {
    var currentItem = null;

    // ─── Initialisation ────────────────────────────────────────────────

    /**
     * Boot the application: load DB, init scanner, bind events.
     */
    async function init() {
        showLoading(true);
        setLoadingText('Initialising engine…');

        try {
            await Database.init(onLoadProgress, onCacheHit);

            setLoadingText('Starting scanner…');
            Scanner.init('scanner-reader');

            // Initialise the product image modal
            NahdiApi.initModal();

            bindEvents();

            // Initialise month navigation, action buttons, and start listening
            Transfers.bindYearButtons();
            Transfers.bindActionButtons();
            Transfers.generateMonthButtons();
            Transfers.startListening();

            setLoadingText('Ready!');
            // Brief pause so user sees "Ready!" before overlay disappears
            await delay(400);
            showLoading(false);
        } catch (err) {
            console.error('App init error:', err);
            showLoading(false);
            showStatus('Failed to load database. Please refresh the page.', 'error');
        }
    }

    /**
     * DB download progress callback – drives the progress bar + percentage text.
     */
    function onLoadProgress(percent) {
        setLoadingText('Downloading database…');
        // Show and fill the progress bar
        var barContainer = document.getElementById('progress-bar-container');
        var barFill = document.getElementById('progress-bar-fill');
        if (barContainer) barContainer.classList.remove('hidden');
        if (barFill) barFill.style.width = percent + '%';
        // Show percentage below the bar
        var el = document.getElementById('loading-progress');
        if (el) el.textContent = percent + '%';
    }

    /**
     * Called when the DB was loaded from browser cache (no download needed).
     */
    function onCacheHit() {
        setLoadingText('Loading from cache…');
        var el = document.getElementById('loading-progress');
        if (el) el.textContent = '';
    }

    /**
     * Update the main title text in the loading overlay.
     */
    function setLoadingText(text) {
        var el = document.getElementById('loading-title');
        if (el) el.textContent = text;
    }

    /**
     * Simple promise-based delay helper.
     */
    function delay(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    // ─── Event Binding ─────────────────────────────────────────────────

    function bindEvents() {
        document.getElementById('btn-scan').addEventListener('click', toggleScanner);
        document.getElementById('btn-search').addEventListener('click', onManualSearch);
        document.getElementById('btn-add-transfer').addEventListener('click', onAddTransfer);

        document.getElementById('barcode-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') onManualSearch();
        });

        // Clear error highlight on "To Store" input while typing
        document.getElementById('to-store-input').addEventListener('input', function () {
            this.classList.remove('input-error');
            // Allow only digits, max 4 characters
            this.value = this.value.replace(/\D/g, '').substring(0, 4);
        });
    }

    // ─── Scanner ───────────────────────────────────────────────────────

    async function toggleScanner() {
        var container = document.getElementById('scanner-container');
        var btn = document.getElementById('btn-scan');

        if (Scanner.isScanning()) {
            await Scanner.stop();
            container.classList.add('scanner-hidden');
            btn.textContent = 'Scan';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary');
        } else {
            container.classList.remove('scanner-hidden');
            btn.textContent = 'Stop';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-danger');

            try {
                await Scanner.start(onScanResult);
            } catch (err) {
                showStatus('Camera access denied. Check permissions.', 'error');
                container.classList.add('scanner-hidden');
                btn.textContent = 'Scan';
                btn.classList.remove('btn-danger');
                btn.classList.add('btn-primary');
            }
        }
    }

    /**
     * Called when the scanner decodes a value.
     */
    async function onScanResult(barcode) {
        // Stop scanner immediately
        await Scanner.stop();
        document.getElementById('scanner-container').classList.add('scanner-hidden');
        var btn = document.getElementById('btn-scan');
        btn.textContent = 'Scan';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');

        // Put result in input & search
        document.getElementById('barcode-input').value = barcode;
        performSearch(barcode);
    }

    // ─── Search ────────────────────────────────────────────────────────

    function onManualSearch() {
        var barcode = document.getElementById('barcode-input').value.trim();
        if (!barcode) {
            showStatus('Please enter a barcode or SKU.', 'error');
            return;
        }
        clearStatus();
        performSearch(barcode);
    }

    /**
     * Look up the barcode in the local DB and show the result card.
     * Also fetches the product image from the Nahdi API so it can be saved
     * with the transfer record later.
     */
    async function performSearch(barcode) {
        var item = Database.search(barcode);
        var resultSection = document.getElementById('item-result');
        var tbody = document.getElementById('item-result-body');

        if (!item) {
            resultSection.classList.add('hidden');
            currentItem = null;
            showStatus('Item not found.', 'error');
            return;
        }

        clearStatus();
        currentItem = item;
        currentItem.qty = 1;
        currentItem.imageUrl = '';  // will be filled async

        // Render with a loading placeholder for the image
        tbody.innerHTML =
            '<tr>' +
            '<td class="td-img">' +
            '<img id="search-result-img" class="product-img product-img-loading" ' +
            'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="" />' +
            '</td>' +
            '<td>' + item.sku + '</td>' +
            '<td>' + item.name_en + '</td>' +
            '<td>' + item.price.toFixed(2) + '</td>' +
            '<td><input type="number" id="item-qty" value="1" min="1" class="qty-input" /></td>' +
            '</tr>';

        resultSection.classList.remove('hidden');

        // Fetch product image from Nahdi API (runs in background)
        NahdiApi.fetchImage(item.sku).then(function (imgUrl) {
            // Store on currentItem so it gets saved with the transfer
            if (currentItem && String(currentItem.sku) === String(item.sku)) {
                currentItem.imageUrl = imgUrl || '';
            }

            // Update the search result thumbnail
            var imgEl = document.getElementById('search-result-img');
            if (imgEl) {
                imgEl.classList.remove('product-img-loading');
                if (imgUrl) {
                    imgEl.src = imgUrl;
                    imgEl.classList.add('product-img-loaded');
                    imgEl.title = 'Click to enlarge';
                    imgEl.style.cursor = 'pointer';
                    imgEl.addEventListener('click', function () {
                        NahdiApi.openImageModal(imgUrl);
                    });
                } else {
                    imgEl.classList.add('product-img-none');
                }
            }
        });
    }

    // ─── Add Transfer ──────────────────────────────────────────────────

    async function onAddTransfer() {
        if (!currentItem) return;

        // Validate "To Store" – must be exactly 4 digits
        var toStoreInput = document.getElementById('to-store-input');
        var toStore = toStoreInput.value.trim();

        if (!/^\d{4}$/.test(toStore)) {
            toStoreInput.classList.add('input-error');
            toStoreInput.focus();
            showStatus('Please enter a valid 4-digit store number.', 'error');
            return;
        }
        toStoreInput.classList.remove('input-error');

        var qtyInput = document.getElementById('item-qty');
        var qty = parseInt(qtyInput.value, 10);
        if (isNaN(qty) || qty < 1) qty = 1;

        currentItem.qty = qty;

        // Disable button while saving
        var addBtn = document.getElementById('btn-add-transfer');
        if (addBtn) addBtn.disabled = true;

        var success = await Transfers.add({
            sku: currentItem.sku,
            name_en: currentItem.name_en,
            price: currentItem.price,
            qty: qty,
            toStore: toStore,
            imageUrl: currentItem.imageUrl || ''
        });

        if (addBtn) addBtn.disabled = false;

        if (success) {
            // Clear the result card and input (keep toStore value for convenience)
            document.getElementById('item-result').classList.add('hidden');
            document.getElementById('barcode-input').value = '';
            currentItem = null;

            showStatus('Item added to transfers.', 'success');
            // Auto-hide success message after 2s
            setTimeout(clearStatus, 2000);
        } else {
            showStatus('Failed to add transfer. Please try again.', 'error');
        }
    }

    // ─── UI Helpers ────────────────────────────────────────────────────

    function showLoading(show) {
        var overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    function showStatus(message, type) {
        var el = document.getElementById('status-message');
        el.textContent = message;
        el.className = 'status-msg ' + type;
        el.classList.remove('hidden');
    }

    function clearStatus() {
        var el = document.getElementById('status-message');
        el.textContent = '';
        el.classList.add('hidden');
    }

    // Public API
    return {
        init: init
    };
})();

// ─── Bootstrap ─────────────────────────────────────────────────────────
// App.init() is called by auth.js after successful login.
// Do NOT auto-init here – the login screen must show first.
