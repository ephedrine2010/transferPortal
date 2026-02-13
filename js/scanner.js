/**
 * Scanner module
 * Uses the native BarcodeDetector API for fast hardware-accelerated scanning.
 * Works on Chrome Android 83+ and Safari iOS 17.2+.
 */
var Scanner = (function () {
    var video = null;
    var stream = null;
    var detector = null;
    var animFrameId = null;
    var scanning = false;
    var scanCallback = null;
    var containerId = '';

    /**
     * Prepare the scanner: create the BarcodeDetector and video element.
     * @param {string} id - id of the container <div> for the camera preview
     */
    function init(id) {
        containerId = id;

        if (!('BarcodeDetector' in window)) {
            console.error('BarcodeDetector API not supported on this browser.');
            return;
        }

        detector = new BarcodeDetector({
            formats: [
                'qr_code',
                'ean_13',
                'ean_8',
                'upc_a',
                'upc_e',
                'code_128',
                'code_39',
                'code_93',
                'itf',
                'codabar'
            ]
        });
    }

    /**
     * Start the camera and begin scanning frames.
     * @param {function} onSuccess - callback(decodedText) on first successful detect
     */
    async function start(onSuccess) {
        if (scanning) return;
        if (!detector) throw new Error('BarcodeDetector not supported.');

        scanCallback = onSuccess;

        // Create <video> inside the container
        var container = document.getElementById(containerId);
        video = document.createElement('video');
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.style.width = '100%';
        video.style.borderRadius = '8px';
        container.innerHTML = '';
        container.appendChild(video);

        // Open rear camera
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        await video.play();

        scanning = true;
        detectLoop();
    }

    /**
     * Continuously detect barcodes from video frames using requestAnimationFrame.
     */
    function detectLoop() {
        if (!scanning) return;

        animFrameId = requestAnimationFrame(async function () {
            if (!scanning || !video || video.readyState < 2) {
                detectLoop();
                return;
            }

            try {
                var barcodes = await detector.detect(video);
                if (barcodes.length > 0 && scanCallback) {
                    var result = barcodes[0].rawValue;
                    scanCallback(result);
                    return; // stop loop after first successful scan
                }
            } catch (e) {
                // Detection error on a frame, keep going
            }

            detectLoop();
        });
    }

    /**
     * Stop scanning and release the camera.
     */
    async function stop() {
        scanning = false;

        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        if (stream) {
            stream.getTracks().forEach(function (track) { track.stop(); });
            stream = null;
        }

        if (video) {
            video.srcObject = null;
            video.remove();
            video = null;
        }

        // Clear container
        var container = document.getElementById(containerId);
        if (container) container.innerHTML = '';
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
