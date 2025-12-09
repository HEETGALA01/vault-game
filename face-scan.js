// Face Scan JavaScript with Face Detection
class FaceScan {
    constructor() {
        this.socket = null;
        this.stream = null;
        this.playerName = '';
        this.playerEmail = '';
        this.capturedImage = null;
        this.faceDetector = null;
        this.faceDetectionSupported = false;

        this.init();
    }

    init() {
        // Get player info from URL params or sessionStorage
        this.getPlayerInfo();
        
        // Initialize face detection
        this.initFaceDetection();
        
        // Initialize camera
        this.initCamera();
        
        // Bind events
        this.bindEvents();
        
        // Connect socket
        this.initSocket();
    }

    getPlayerInfo() {
        // Try URL params first
        const urlParams = new URLSearchParams(window.location.search);
        this.playerName = urlParams.get('name') || sessionStorage.getItem('playerName') || 'Agent';
        this.playerEmail = urlParams.get('email') || sessionStorage.getItem('playerEmail') || '';

        // Display player name
        document.getElementById('player-codename').textContent = `Agent ${this.playerName}`;
    }

    async initFaceDetection() {
        // Check if Face Detection API is available (Chrome/Edge)
        if ('FaceDetector' in window) {
            try {
                this.faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
                this.faceDetectionSupported = true;
                console.log('Face Detection API available');
            } catch (e) {
                console.log('Face Detection API failed to initialize:', e);
                this.faceDetectionSupported = false;
            }
        } else {
            console.log('Face Detection API not available - using skin tone fallback');
            this.faceDetectionSupported = false;
        }
    }

    async initCamera() {
        const video = document.getElementById('camera-feed');
        const errorMessage = document.getElementById('error-message');

        try {
            // iOS Safari requires specific constraints
            const constraints = {
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 640, max: 1280 }
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            video.srcObject = this.stream;
            
            // iOS Safari requires these attributes
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('muted', '');
            
            // Wait for video to be ready
            video.onloadedmetadata = () => {
                video.play().catch(err => {
                    console.log('Video play error (will retry on user interaction):', err);
                });
            };
            
            // iOS sometimes needs a user gesture to start video
            const startVideo = () => {
                video.play().catch(() => {});
                document.removeEventListener('touchstart', startVideo);
                document.removeEventListener('click', startVideo);
            };
            document.addEventListener('touchstart', startVideo, { passive: true });
            document.addEventListener('click', startVideo);
            
        } catch (err) {
            console.error('Camera error:', err);
            
            // More specific error messages
            let errorText = '📷 Camera access denied. Please allow camera access and refresh the page.';
            if (err.name === 'NotAllowedError') {
                errorText = '📷 Camera permission denied. Please go to Settings > Safari > Camera and allow access.';
            } else if (err.name === 'NotFoundError') {
                errorText = '📷 No camera found on this device.';
            } else if (err.name === 'NotReadableError') {
                errorText = '📷 Camera is in use by another app. Please close other apps and try again.';
            }
            
            errorMessage.textContent = errorText;
            errorMessage.classList.add('active');
            document.getElementById('capture-btn').disabled = true;
        }
    }

    initSocket() {
        try {
            // Auto-detect server URL for iOS compatibility
            let serverUrl;
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                serverUrl = `http://${window.location.hostname}:3000`;
            } else {
                serverUrl = window.location.origin;
            }
            
            console.log('Face scan connecting to:', serverUrl);
            
            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('Connected to server');
            });

            this.socket.on('connect_error', (err) => {
                console.log('Socket connection error:', err);
            });

            this.socket.on('prediction:result', (data) => {
                console.log('Prediction result received');
                this.showPrediction(data);
            });

            this.socket.on('prediction:error', (data) => {
                console.log('Prediction error:', data);
                this.showError(data.message);
            });
        } catch (e) {
            console.error('Socket init error:', e);
        }
    }

    bindEvents() {
        document.getElementById('capture-btn').addEventListener('click', () => this.capturePhoto());
        document.getElementById('continue-btn').addEventListener('click', () => this.continueToGame());
        
        // Skip button for iOS fallback
        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipFaceScan());
            
            // Show skip button after 5 seconds (fallback for iOS issues)
            setTimeout(() => {
                skipBtn.style.display = 'inline-block';
            }, 5000);
        }
    }
    
    skipFaceScan() {
        // Skip directly to game without face scan
        sessionStorage.setItem('playerName', this.playerName);
        sessionStorage.setItem('playerEmail', this.playerEmail);
        sessionStorage.setItem('faceScanComplete', 'true');
        
        // Stop camera if running
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        // Redirect to game
        window.location.href = `index.html?name=${encodeURIComponent(this.playerName)}&email=${encodeURIComponent(this.playerEmail)}&scanned=true`;
    }

    // Face detection using browser API or skin tone fallback
    async detectFace(canvas) {
        // If Face Detection API is available, use it
        if (this.faceDetectionSupported && this.faceDetector) {
            try {
                const faces = await this.faceDetector.detect(canvas);
                console.log('Face Detection API found', faces.length, 'faces');
                return faces.length > 0;
            } catch (e) {
                console.log('Face detection error:', e);
                // Fall through to skin tone detection
            }
        }
        
        // Fallback: Skin tone detection
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let skinPixels = 0;
        
        // Check center region of image (where face should be)
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const checkRadius = Math.min(canvas.width, canvas.height) * 0.35;
        
        let checkedPixels = 0;
        
        for (let y = 0; y < canvas.height; y += 2) { // Skip pixels for speed
            for (let x = 0; x < canvas.width; x += 2) {
                // Check if pixel is in center region
                const dx = x - centerX;
                const dy = y - centerY;
                if (dx * dx + dy * dy > checkRadius * checkRadius) continue;
                
                checkedPixels++;
                const i = (y * canvas.width + x) * 4;
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // Skin tone detection (works for various skin tones)
                if (r > 60 && g > 40 && b > 20 &&
                    r > g && r > b &&
                    Math.abs(r - g) > 10 &&
                    r - b > 10 && r - b < 170) {
                    skinPixels++;
                }
            }
        }
        
        const skinPercentage = checkedPixels > 0 ? (skinPixels / checkedPixels) * 100 : 0;
        console.log(`Skin detection: ${skinPercentage.toFixed(1)}% skin pixels in center`);
        
        // Require at least 12% skin tone in center for a face
        return skinPercentage > 12;
    }

    async capturePhoto() {
        const video = document.getElementById('camera-feed');
        const canvas = document.getElementById('photo-canvas');
        const capturedImg = document.getElementById('captured-image');
        const captureBtn = document.getElementById('capture-btn');
        const scanOverlay = document.getElementById('scan-overlay');
        const errorMessage = document.getElementById('error-message');

        // Set canvas size
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 640;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Check for face
        const hasFace = await this.detectFace(canvas);
        
        if (!hasFace) {
            // No face detected - show error
            errorMessage.textContent = '😕 No face detected! Please position your face in the center of the circle and try again.';
            errorMessage.classList.add('active');
            
            // Hide error after 3 seconds
            setTimeout(() => {
                errorMessage.classList.remove('active');
            }, 3000);
            
            return; // Don't proceed
        }

        // Face detected - proceed
        errorMessage.classList.remove('active');

        // Get image data
        this.capturedImage = canvas.toDataURL('image/jpeg', 0.8);

        // Show captured image
        capturedImg.src = this.capturedImage;
        capturedImg.style.display = 'block';
        video.style.display = 'none';

        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        // Show scanning animation
        scanOverlay.classList.add('active');
        captureBtn.textContent = '✅ FACE CAPTURED';
        captureBtn.classList.add('captured');
        captureBtn.disabled = true;

        // Start prediction after animation
        setTimeout(() => {
            scanOverlay.classList.remove('active');
            this.requestPrediction();
        }, 2000);
    }

    requestPrediction() {
        const loading = document.getElementById('loading');
        const prediction = document.getElementById('prediction');
        
        loading.classList.add('active');
        
        // Track if prediction was shown
        let predictionShown = false;
        
        const showFallback = () => {
            if (predictionShown) return;
            predictionShown = true;
            console.log('Using fallback prediction');
            this.useFallbackPrediction();
        };

        // Check if socket is connected before emitting
        if (this.socket && this.socket.connected) {
            console.log('Requesting prediction via socket');
            this.socket.emit('prediction:request', {
                name: this.playerName,
                email: this.playerEmail,
                image: this.capturedImage
            });
            
            // Store original handler
            const originalHandler = (data) => {
                if (predictionShown) return;
                predictionShown = true;
                console.log('Prediction received from server');
                this.showPrediction(data);
            };
            
            // Listen for result
            this.socket.once('prediction:result', originalHandler);
            
            // Fallback after 3 seconds
            setTimeout(() => {
                this.socket.off('prediction:result', originalHandler);
                showFallback();
            }, 3000);
        } else {
            console.log('Socket not connected - using immediate fallback');
            // Immediate fallback if no socket
            setTimeout(showFallback, 500);
        }
        
        // Absolute fallback - if nothing happens in 5 seconds, force show
        setTimeout(() => {
            if (!predictionShown && !prediction.classList.contains('active')) {
                console.log('Absolute fallback triggered');
                showFallback();
            }
        }, 5000);
    }

    showPrediction(data) {
        const loading = document.getElementById('loading');
        const prediction = document.getElementById('prediction');
        const skipBtn = document.getElementById('skip-btn');

        // Hide loading
        loading.classList.remove('active');
        loading.style.display = 'none';
        
        // Hide skip button
        if (skipBtn) skipBtn.style.display = 'none';

        // Fill in the prediction data
        document.getElementById('good-thing-1').textContent = data.goodThings[0] || "You have incredible focus";
        document.getElementById('good-thing-2').textContent = data.goodThings[1] || "Your determination is unmatched";
        document.getElementById('fortune-text').textContent = data.fortune || "The vaults sense great potential in you.";
        document.getElementById('wish-text').textContent = data.wish || `Good luck, Agent ${this.playerName}! 🍀`;

        // Show prediction container - force display for iOS
        prediction.style.display = 'block';
        prediction.classList.add('active');
        
        // Ensure continue button is visible
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.style.display = 'inline-block';
            continueBtn.style.visibility = 'visible';
        }
        
        console.log('Prediction displayed successfully');
    }

    useFallbackPrediction() {
        // Fallback predictions if API fails
        const fallbackData = {
            goodThings: [
                "You have incredible focus and determination",
                "Your quick thinking will be your greatest asset"
            ],
            fortune: "The vaults sense great potential in you. Trust your instincts and the codes will reveal themselves.",
            wish: "May luck be on your side, Agent " + this.playerName + "! 🍀"
        };

        this.showPrediction(fallbackData);
    }

    showError(message) {
        const loading = document.getElementById('loading');
        const errorMessage = document.getElementById('error-message');

        loading.classList.remove('active');
        errorMessage.textContent = message;
        errorMessage.classList.add('active');

        // Use fallback after showing error
        setTimeout(() => {
            errorMessage.classList.remove('active');
            this.useFallbackPrediction();
        }, 2000);
    }

    continueToGame() {
        // Store player info in session
        sessionStorage.setItem('playerName', this.playerName);
        sessionStorage.setItem('playerEmail', this.playerEmail);
        sessionStorage.setItem('faceScanComplete', 'true');

        // Redirect to game
        window.location.href = `index.html?name=${encodeURIComponent(this.playerName)}&email=${encodeURIComponent(this.playerEmail)}&scanned=true`;
    }
}

// Initialize when page loads
let faceScan;
document.addEventListener('DOMContentLoaded', () => {
    faceScan = new FaceScan();
});
