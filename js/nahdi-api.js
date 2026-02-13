/**
 * NahdiApi module
 * Fetches product images from the Nahdi Online API.
 * Provides an in-memory cache so each SKU is fetched only once per session.
 *
 * API: GET https://www.nahdionline.com/api/analytics/product
 *      ?skus={sku}&language=en&region=SA&category_id=15125
 */
var NahdiApi = (function () {
    var imageCache = {};
    var pendingRequests = {};

    var API_BASE = 'https://www.nahdionline.com/api/analytics/product';
    // CORS proxy fallback (used when direct fetch is blocked by browser CORS policy)
    var CORS_PROXY = 'https://corsproxy.io/?';

    // ─── Image Fetching ─────────────────────────────────────────────────

    /**
     * Fetch the product image URL for a given SKU.
     * Returns a cached result if available. De-duplicates in-flight requests.
     * @param {string|number} sku
     * @returns {Promise<string|null>} image URL or null
     */
    async function fetchImage(sku) {
        sku = String(sku).trim();
        if (!sku) return null;

        // Return from cache if we already know the answer
        if (imageCache[sku] !== undefined) return imageCache[sku];

        // De-duplicate: if a request for this SKU is already in-flight, wait for it
        if (pendingRequests[sku]) return pendingRequests[sku];

        pendingRequests[sku] = _doFetch(sku);
        var result = await pendingRequests[sku];
        delete pendingRequests[sku];
        return result;
    }

    /**
     * Internal: perform the actual HTTP request(s).
     */
    async function _doFetch(sku) {
        var apiUrl = API_BASE +
            '?skus=' + encodeURIComponent(sku) +
            '&language=en&region=SA&category_id=15125';

        try {
            var data = null;

            // Attempt 1: Direct fetch
            try {
                var resp = await fetch(apiUrl);
                if (resp.ok) data = await resp.json();
            } catch (_directErr) {
                // Likely a CORS error – fall through to proxy
            }

            // Attempt 2: CORS proxy
            if (!data) {
                try {
                    var proxyResp = await fetch(CORS_PROXY + encodeURIComponent(apiUrl));
                    if (proxyResp.ok) data = await proxyResp.json();
                } catch (_proxyErr) {
                    console.warn('NahdiApi: Both direct and proxy fetch failed for SKU ' + sku);
                }
            }

            if (!data) {
                imageCache[sku] = null;
                return null;
            }

            // Log the first successful response so developers can inspect the shape
            if (Object.keys(imageCache).length === 0) {
                console.log('NahdiApi: sample response for SKU ' + sku, data);
            }

            var imgUrl = extractImageUrl(data);
            imageCache[sku] = imgUrl;
            return imgUrl;
        } catch (err) {
            console.warn('NahdiApi: Error fetching image for SKU ' + sku, err);
            imageCache[sku] = null;
            return null;
        }
    }

    // ─── Response Parsing ───────────────────────────────────────────────

    /**
     * Extract an image URL from the API response.
     * Handles multiple common JSON response shapes.
     */
    function extractImageUrl(data) {
        if (!data) return null;

        // Unwrap common wrappers: { products: [...] }, [ ... ], { data: ... }
        var product = null;
        if (Array.isArray(data)) {
            product = data[0];
        } else if (data.products && Array.isArray(data.products) && data.products.length) {
            product = data.products[0];
        } else if (data.data && Array.isArray(data.data) && data.data.length) {
            product = data.data[0];
        } else if (data.data && typeof data.data === 'object') {
            product = data.data;
        } else {
            product = data;
        }

        if (!product) return null;

        // Try well-known field names first
        var knownFields = [
            'image', 'image_url', 'imageUrl', 'thumbnail', 'thumbnailUrl',
            'main_image', 'mainImage', 'photo', 'picture', 'img', 'img_url',
            'product_image', 'productImage', 'media_url', 'small_image',
            'base_image', 'swatch_image'
        ];

        for (var i = 0; i < knownFields.length; i++) {
            var val = product[knownFields[i]];
            if (val && typeof val === 'string' && val.length > 5) {
                return normaliseUrl(val);
            }
        }

        // Deep search: recursively look for any field containing 'image'/'img' with a URL value
        return deepFindImageUrl(product, 0);
    }

    /**
     * Recursively search an object for a field that looks like an image URL.
     */
    function deepFindImageUrl(obj, depth) {
        if (!obj || typeof obj !== 'object' || depth > 3) return null;

        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i].toLowerCase();
            var val = obj[keys[i]];
            if (
                typeof val === 'string' &&
                (key.indexOf('image') !== -1 || key.indexOf('img') !== -1 ||
                 key.indexOf('photo') !== -1 || key.indexOf('thumbnail') !== -1) &&
                (val.indexOf('http') === 0 || val.indexOf('//') === 0 || val.indexOf('/media') === 0)
            ) {
                return normaliseUrl(val);
            }
        }

        // Recurse into child objects / arrays
        for (var j = 0; j < keys.length; j++) {
            var child = obj[keys[j]];
            if (child && typeof child === 'object') {
                var found = deepFindImageUrl(child, depth + 1);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * Ensure the URL is absolute.
     */
    function normaliseUrl(url) {
        if (!url) return null;
        url = url.trim();
        if (url.indexOf('//') === 0) return 'https:' + url;
        if (url.indexOf('/') === 0) return 'https://www.nahdionline.com' + url;
        return url;
    }

    // ─── Image Modal ────────────────────────────────────────────────────

    /**
     * Open the full-size image modal.
     */
    function openImageModal(imgUrl) {
        var modal = document.getElementById('image-modal');
        var img = document.getElementById('image-modal-img');
        if (!modal || !img) return;

        img.src = imgUrl;
        modal.classList.remove('hidden');
        // Prevent body scroll while modal is open
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the image modal.
     */
    function closeImageModal() {
        var modal = document.getElementById('image-modal');
        var img = document.getElementById('image-modal-img');
        if (modal) modal.classList.add('hidden');
        if (img) img.src = '';
        document.body.style.overflow = '';
    }

    /**
     * Bind modal event listeners (call once after DOM ready).
     */
    function initModal() {
        var modal = document.getElementById('image-modal');
        if (!modal) return;

        // Close on overlay click
        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.classList.contains('image-modal-overlay')) {
                closeImageModal();
            }
        });

        // Close button
        var closeBtn = modal.querySelector('.image-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                closeImageModal();
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeImageModal();
        });
    }

    // ─── Public API ─────────────────────────────────────────────────────

    return {
        fetchImage: fetchImage,
        openImageModal: openImageModal,
        closeImageModal: closeImageModal,
        initModal: initModal
    };
})();
