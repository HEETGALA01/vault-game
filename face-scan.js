// Face Scan JavaScript
class FaceScan {
    constructor() {
        this.socket = null;
        this.stream = null;
        this.playerName = '';
        this.playerEmail = '';
        this.capturedImage = null;

        this.init();
    }

    init() {
        // Get player info from URL params or sessionStorage
        this.getPlayerInfo();
        
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

    async initCamera() {
        const video = document.getElementById('camera-feed');
        const errorMessage = document.getElementById('error-message');

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 640 }
                },
                audio: false
            });
            
            video.srcObject = this.stream;
            
            video.onloadedmetadata = () => {
                video.play();
            };
        } catch (err) {
            console.error('Camera error:', err);
            errorMessage.textContent = '📷 Camera access denied. Please allow camera access and refresh the page.';
            errorMessage.classList.add('active');
            document.getElementById('capture-btn').disabled = true;
        }
    }

    initSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('prediction:result', (data) => {
            this.showPrediction(data);
        });

        this.socket.on('prediction:error', (data) => {
            this.showError(data.message);
        });
    }

    bindEvents() {
        document.getElementById('capture-btn').addEventListener('click', () => this.capturePhoto());
        document.getElementById('continue-btn').addEventListener('click', () => this.continueToGame());
    }

    capturePhoto() {
        const video = document.getElementById('camera-feed');
        const canvas = document.getElementById('photo-canvas');
        const capturedImg = document.getElementById('captured-image');
        const captureBtn = document.getElementById('capture-btn');
        const scanOverlay = document.getElementById('scan-overlay');

        // Set canvas size
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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
        captureBtn.textContent = '✅ CAPTURED';
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
        loading.classList.add('active');

        // Request prediction from server
        this.socket.emit('prediction:request', {
            name: this.playerName,
            email: this.playerEmail,
            image: this.capturedImage
        });

        // Fallback if server doesn't respond in 10 seconds
        setTimeout(() => {
            if (loading.classList.contains('active')) {
                this.useFallbackPrediction();
            }
        }, 10000);
    }

    showPrediction(data) {
        const loading = document.getElementById('loading');
        const prediction = document.getElementById('prediction');

        loading.classList.remove('active');

        // Fill in the prediction data
        document.getElementById('good-thing-1').textContent = data.goodThings[0];
        document.getElementById('good-thing-2').textContent = data.goodThings[1];
        document.getElementById('fortune-text').textContent = data.fortune;
        document.getElementById('wish-text').textContent = data.wish;

        // Show prediction container
        prediction.classList.add('active');
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
