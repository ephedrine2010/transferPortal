/**
 * Scanner module
 * Handles QR-code and barcode camera scanning using html5-qrcode library.
 */
var Scanner = (function () {
    var html5QrCode = null;
    var scanning = false;
    var scanCallback = null;

    /**
     * Create the scanner instance for a given container element id.
     * @param {string} containerId - id of the <div> that will host the camera view
     */
    function init(containerId) {
        html5QrCode = new Html5Qrcode(containerId);
    }

    /**
     * Start scanning with the rear camera.
     * @param {function} onSuccess - callback(decodedText) called once on first successful scan
     */
    async function start(onSuccess) {
        if (scanning) return;
        scanCallback = onSuccess;

        var config = {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0
        };

        try {
            await html5QrCode.start(
                { facingMode: 'environment' },
                config,
                handleSuccess,
                handleFailure
            );
            scanning = true;
        } catch (err) {
            console.error('Scanner start error:', err);
            throw err;
        }
    }

    /**
     * Stop the scanner and release the camera.
     */
    async function stop() {
        if (!scanning || !html5QrCode) return;
        try {
            await html5QrCode.stop();
        } catch (err) {
            console.error('Scanner stop error:', err);
        }
        scanning = false;
    }

    /**
     * Internal: called on every successful decode.
     */
    function handleSuccess(decodedText) {
        if (scanCallback) {
            scanCallback(decodedText);
        }
    }

    /**
     * Internal: called on scan failure frames (expected, usually silent).
     */
    function handleFailure(_errorMessage) {
        // Intentionally empty – continuous scanning produces many "failures"
    }

    /**
     * Check whether the scanner is currently active.
     */
    function isScanning() {
        return scanning;
    }

    // Public API
    return {
        init: init,
        start: start,
        stop: stop,
        isScanning: isScanning
    };
})();
