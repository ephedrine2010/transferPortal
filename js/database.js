/**
 * Database module
 * Handles SQLite database loading and search using sql.js (WASM).
 * Search logic translated from the Dart reference (localDb_example_in_dart.dart).
 *
 * Caching: the 62 MB .db file is stored in the browser Cache API after the
 * first download. Subsequent visits load from cache instantly.
 * Change DB_VERSION when you update localDB.db to force a re-download.
 */
const Database = (function () {
    let db = null;

    // ── Cache settings ─────────────────────────────────────────────────
    var CACHE_NAME = 'localdb-cache-v1';   // bump the version when the DB changes
    var DB_URL     = 'localDB.db';

    /**
     * Initialize: load sql.js WASM and fetch the .db file (from cache or network).
     * @param {function} onProgress  - optional callback(percent) for download progress
     * @param {function} onCacheHit  - optional callback() when loaded from cache
     */
    async function init(onProgress, onCacheHit) {
        // 1. Init sql.js WASM engine
        const SQL = await initSqlJs({
            locateFile: function (file) {
                return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/' + file;
            }
        });

        // 2. Try to load from browser cache first
        var buffer = await loadFromCache();

        if (buffer) {
            // Cache hit – no download needed
            if (onCacheHit) onCacheHit();
            db = new SQL.Database(new Uint8Array(buffer));
            return;
        }

        // 3. Cache miss – download with progress, then store in cache
        buffer = await downloadWithProgress(onProgress);
        db = new SQL.Database(new Uint8Array(buffer));

        // Store in cache for next time (fire-and-forget)
        storeInCache(buffer);
    }

    /**
     * Try to read the DB from the Cache API.
     * @returns {ArrayBuffer|null}
     */
    async function loadFromCache() {
        try {
            var cache = await caches.open(CACHE_NAME);
            var response = await cache.match(DB_URL);
            if (response) {
                return await response.arrayBuffer();
            }
        } catch (e) {
            console.warn('Cache read failed, will download:', e);
        }
        return null;
    }

    /**
     * Store the DB ArrayBuffer in the Cache API for future visits.
     */
    async function storeInCache(buffer) {
        try {
            var cache = await caches.open(CACHE_NAME);
            var response = new Response(buffer, {
                headers: { 'Content-Type': 'application/octet-stream' }
            });
            await cache.put(DB_URL, response);
        } catch (e) {
            console.warn('Cache write failed:', e);
        }
    }

    /**
     * Download localDB.db from the server with progress tracking.
     * @returns {ArrayBuffer}
     */
    async function downloadWithProgress(onProgress) {
        var response = await fetch(DB_URL);
        var contentLength = response.headers.get('Content-Length');
        var total = contentLength ? parseInt(contentLength, 10) : 0;

        if (!response.body || !total) {
            // Fallback: no streaming / unknown size
            return await response.arrayBuffer();
        }

        // Stream with progress
        var reader = response.body.getReader();
        var received = 0;
        var chunks = [];

        while (true) {
            var result = await reader.read();
            if (result.done) break;
            chunks.push(result.value);
            received += result.value.length;
            if (onProgress) {
                onProgress(Math.round((received / total) * 100));
            }
        }

        // Merge chunks into single Uint8Array
        var buffer = new Uint8Array(received);
        var offset = 0;
        for (var i = 0; i < chunks.length; i++) {
            buffer.set(chunks[i], offset);
            offset += chunks[i].length;
        }

        return buffer.buffer;
    }

    /**
     * Extract usable barcode from raw scan data.
     * If the scanned string is longer than 16 chars, take substring(2, 16).
     */
    function extractBarcode(barcode) {
        barcode = barcode.toString().trim();
        if (barcode.length > 16) {
            barcode = barcode.substring(2, 16);
        }
        return barcode;
    }

    /**
     * Search the localmaster table based on barcode/sku.
     *
     * Logic (from Dart):
     *   length == 9  → try sku, fallback to barcode
     *   length < 9   → search by barcode (number)
     *   10..13       → search by barcode (number)
     *   length > 13  → search by gtin (string)
     *
     * @param {string} rawBarcode
     * @param {boolean} vatRequired - include VAT in price (default true)
     * @returns {object|null} item data or null if not found
     */
    function search(rawBarcode, vatRequired) {
        if (vatRequired === undefined) vatRequired = true;
        if (!db) throw new Error('Database not initialized');

        var barcode = extractBarcode(rawBarcode);
        var results = [];

        if (barcode.length === 9) {
            // Try SKU first
            results = runQuery(
                'SELECT * FROM localmaster WHERE sku = ?',
                [parseInt(barcode, 10)]
            );
            // Fallback to barcode
            if (results.length === 0) {
                results = runQuery(
                    'SELECT * FROM localmaster WHERE barcode = ?',
                    [parseInt(barcode, 10)]
                );
            }
        } else if (barcode.length < 9) {
            results = runQuery(
                'SELECT * FROM localmaster WHERE barcode = ?',
                [parseFloat(barcode)]
            );
        } else if (barcode.length < 14 && barcode.length > 9) {
            results = runQuery(
                'SELECT * FROM localmaster WHERE barcode = ?',
                [parseFloat(barcode)]
            );
        } else if (barcode.length > 13) {
            results = runQuery(
                'SELECT * FROM localmaster WHERE gtin = ?',
                [barcode]
            );
        }

        if (results.length === 0) return null;

        return formatResult(results[0], barcode, vatRequired);
    }

    /**
     * Run a parameterised SQL query and return results as an array of objects.
     */
    function runQuery(sql, params) {
        try {
            var stmt = db.prepare(sql);
            stmt.bind(params);
            var rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
            return rows;
        } catch (e) {
            console.error('DB query error:', e);
            return [];
        }
    }

    /**
     * Convert a raw DB row into a clean item object.
     * Calculates price with VAT if required: price * (vat + 100) / 100
     */
    function formatResult(row, barcode, vatRequired) {
        var item = {
            sku: row.sku || '',
            barcode: '',
            gtin: '',
            name_en: row.name_en || '',
            price: 0,
            vat: row.vat || 0
        };

        // Determine barcode / gtin value
        try {
            if (row.gtin && row.gtin.toString().length > 3) {
                item.barcode = parseFloat(row.gtin.toString());
            } else {
                item.barcode = parseFloat(row.barcode.toString());
            }
        } catch (e) {
            item.barcode = parseFloat(barcode);
        }
        item.gtin = item.barcode.toString();

        // Price with or without VAT
        if (row.item_price != null && row.item_price !== '') {
            if (vatRequired) {
                var vatMultiplier = (parseFloat(row.vat || 0) + 100) / 100;
                item.price = parseFloat(
                    (parseFloat(row.item_price) * vatMultiplier).toFixed(2)
                );
            } else {
                item.price = parseFloat(row.item_price);
            }
        }

        return item;
    }

    // Public API
    return {
        init: init,
        search: search
    };
})();
