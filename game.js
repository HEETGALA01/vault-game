// Vault Breaker - Dynamic Question Generator Version
// All questions are generated dynamically for unlimited unique gameplay!

class VaultBreaker {
    constructor() {
        this.currentVault = 0;
        this.score = 0;
        this.timeLeft = 180;
        this.timerInterval = null;
        this.gameActive = false;
        this.playerName = '';
        this.playerEmail = '';
        this.socket = null;
        this.playerId = null;
        this.hintsUsed = 0;
        this.diamondMineRevealed = [];
        this.currentQuestion = null;
        this.currentDiamondMine = null;
        this.vaultsCompleted = 0; // Track actually completed vaults (not skipped/failed)
        this.vaultResults = []; // Track result of each vault: 'success', 'failed', or 'skipped'
        
        this.initGenerators();
        this.initSocket();
        this.initAudio();
        this.bindEvents();
        this.createParticles();
    }

    // ========================================
    // QUESTION GENERATORS - Infinite Questions!
    // ========================================

    initGenerators() {
        // Use external VaultQuestions if available, otherwise use inline data
        const Q = (typeof VaultQuestions !== 'undefined') ? VaultQuestions : null;
        
        // Data pools for generating questions
        this.mathData = {
            operations: ['+', '-', '×'],
            generateProblem: () => {
                const op = this.mathData.operations[Math.floor(Math.random() * 3)];
                let a, b, answer;
                switch(op) {
                    case '+':
                        a = Math.floor(Math.random() * 50) + 10;
                        b = Math.floor(Math.random() * 50) + 10;
                        answer = a + b;
                        break;
                    case '-':
                        a = Math.floor(Math.random() * 50) + 30;
                        b = Math.floor(Math.random() * 30) + 1;
                        answer = a - b;
                        break;
                    case '×':
                        a = Math.floor(Math.random() * 12) + 2;
                        b = Math.floor(Math.random() * 12) + 2;
                        answer = a * b;
                        break;
                }
                return { question: `${a} ${op} ${b} = ?`, answer: answer.toString(), hint: `Calculate ${a} ${op} ${b}` };
            }
        };

        // Riddle templates - use external file if available
        this.riddleTemplates = Q?.riddleTemplates || [
            { template: "I have {count} {items}, but I cannot {action}. What am I?", 
              options: [
                { count: "hands", items: "", action: "clap", answer: "clock", hint: "Tells time" },
                { count: "a face", items: "", action: "smile", answer: "clock", hint: "Hangs on wall" },
                { count: "teeth", items: "", action: "eat", answer: "comb", hint: "Used for hair" }
              ]
            }
        ];

        // Cipher words - use external file if available
        this.cipherWords = Q?.cipherWords || [
            "password", "security", "computer", "network", "digital", "program", "system"
        ];

        // GK question banks - use external file if available
        this.gkCategories = Q?.gkCategories || {
            science: [
                { q: "What planet is known as the Red Planet?", a: "mars" },
                { q: "What is the chemical symbol for water?", a: "h2o" }
            ],
            geography: [
                { q: "What is the capital of France?", a: "paris" }
            ],
            general: [
                { q: "How many days are in a leap year?", a: "366" }
            ]
        };

        // Bollywood movies - use external file if available
        this.bollywoodData = Q?.bollywoodMovies || [
            { name: "sholay", keywords: ["desert", "villain", "friends", "revenge"], emojis: ["💀", "🏜️", "🔫", "🐴"] },
            { name: "ddlj", keywords: ["train", "love", "europe", "bride"], emojis: ["🚂", "💕", "👰", "🌾"] },
            { name: "3idiots", keywords: ["college", "engineering", "friends", "comedy"], emojis: ["3️⃣", "🎓", "😂", "🧠"] }
        ];

        // Scrambled words - use external file if available
        this.scrambledWords = Q?.scrambledWords || [
            { word: "computer", hint: "Electronic device for computing" },
            { word: "keyboard", hint: "Used for typing" },
            { word: "elephant", hint: "Large animal with trunk" }
        ];
    }

    // ========== DYNAMIC QUESTION GENERATORS ==========

    generateRiddle() {
        const template = this.riddleTemplates[Math.floor(Math.random() * this.riddleTemplates.length)];
        
        // Support both old format (with generate function) and new format (with options array)
        let data;
        if (template.generate) {
            data = template.generate();
        } else if (template.options) {
            data = template.options[Math.floor(Math.random() * template.options.length)];
        } else {
            // Fallback
            data = { count: "hands", items: "", action: "clap", answer: "clock", hint: "Tells time" };
        }
        
        // For classic riddles that have the question directly
        if (data.question) {
            return {
                question: data.question,
                answer: data.answer,
                hint: data.hint || "Think carefully!"
            };
        }
        
        return {
            question: template.template
                .replace("{count}", data.count || "")
                .replace("{items}", data.items || "")
                .replace("{action}", data.action || "")
                .replace("{comparison}", data.comparison || "")
                .replace("{ability1}", data.ability1 || "")
                .replace("{ability2}", data.ability2 || "")
                .replace("{question}", data.question || ""),
            answer: data.answer,
            hint: data.hint
        };
    }

    generateScrambledWord() {
        // Use external scrambled words if available
        const words = this.scrambledWords || [
            { word: "computer", hint: "Electronic device for computing" },
            { word: "keyboard", hint: "Used for typing" },
            { word: "elephant", hint: "Large animal with trunk" },
            { word: "mountain", hint: "Very tall landform" },
            { word: "building", hint: "Structure where people live or work" },
            { word: "hospital", hint: "Place for medical treatment" },
            { word: "universe", hint: "Everything that exists" },
            { word: "airplane", hint: "Flying vehicle" },
            { word: "birthday", hint: "Annual celebration of birth" },
            { word: "painting", hint: "Art created with colors" },
            { word: "shopping", hint: "Buying things from stores" },
            { word: "swimming", hint: "Moving in water" },
            { word: "football", hint: "Popular sport with ball" },
            { word: "children", hint: "Young humans" },
            { word: "sandwich", hint: "Food between bread slices" },
            { word: "calendar", hint: "Shows days and months" },
            { word: "treasure", hint: "Valuable hidden items" },
            { word: "dinosaur", hint: "Extinct giant reptile" },
            { word: "chocolate", hint: "Sweet brown treat" },
            { word: "butterfly", hint: "Colorful flying insect" },
            { word: "adventure", hint: "Exciting experience" },
            { word: "beautiful", hint: "Very pleasing to look at" },
            { word: "breakfast", hint: "Morning meal" },
            { word: "celebrate", hint: "Mark a special occasion" },
            { word: "dangerous", hint: "Could cause harm" },
            { word: "education", hint: "Learning and teaching" },
            { word: "fantastic", hint: "Extremely good" },
            { word: "gardening", hint: "Growing plants" },
            { word: "happiness", hint: "State of joy" },
            { word: "important", hint: "Of great significance" },
            { word: "knowledge", hint: "Information and understanding" },
            { word: "lightning", hint: "Electric flash in sky" },
            { word: "nightmare", hint: "Bad scary dream" },
            { word: "orchestra", hint: "Large music group" },
            { word: "pineapple", hint: "Tropical spiky fruit" },
            { word: "questions", hint: "Things you ask" },
            { word: "rectangle", hint: "Four-sided shape" },
            { word: "skyscraper", hint: "Very tall building" },
            { word: "telephone", hint: "Device for calling" },
            { word: "vegetable", hint: "Plant food like carrot" },
            { word: "wonderful", hint: "Causing wonder" },
            { word: "xylophone", hint: "Musical instrument with bars" },
            { word: "yesterday", hint: "Day before today" },
            { word: "crocodile", hint: "Large reptile in water" },
            { word: "democracy", hint: "Government by the people" },
            { word: "fireworks", hint: "Explosive lights in sky" },
            { word: "honeybees", hint: "Insects that make honey" },
            { word: "invisible", hint: "Cannot be seen" },
            { word: "jellyfish", hint: "Sea creature with tentacles" },
            { word: "kangaroos", hint: "Jumping Australian animal" }
        ];
        
        const selected = words[Math.floor(Math.random() * words.length)];
        const word = selected.word.toUpperCase();
        
        // Scramble the word
        let scrambled = word.split('');
        for (let i = scrambled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
        }
        scrambled = scrambled.join('');
        
        // Make sure scrambled is different from original
        if (scrambled === word) {
            scrambled = scrambled.split('').reverse().join('');
        }
        
        return {
            scrambled: scrambled,
            answer: selected.word.toLowerCase(),
            hint: selected.hint,
            length: word.length
        };
    }

    generateGKQuestion() {
        const categories = Object.keys(this.gkCategories);
        const category = categories[Math.floor(Math.random() * categories.length)];
        const questions = this.gkCategories[category];
        const questionIndex = Math.floor(Math.random() * questions.length);
        const q = questions[questionIndex];
        
        // Generate 4 options: 1 correct + 3 wrong from same category
        const correctAnswer = q.a;
        const wrongAnswers = [];
        
        // Get other answers from the same category
        const otherQuestions = questions.filter((_, idx) => idx !== questionIndex);
        const shuffledOthers = otherQuestions.sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < shuffledOthers.length && wrongAnswers.length < 3; i++) {
            const wrongAns = shuffledOthers[i].a;
            if (wrongAns !== correctAnswer && !wrongAnswers.includes(wrongAns)) {
                wrongAnswers.push(wrongAns);
            }
        }
        
        // If not enough wrong answers from same category, add some generic ones
        const genericWrong = ["unknown", "none", "other", "false", "zero", "null"];
        while (wrongAnswers.length < 3) {
            const generic = genericWrong[wrongAnswers.length];
            if (generic !== correctAnswer) {
                wrongAnswers.push(generic);
            }
        }
        
        // Combine and shuffle all options
        const allOptions = [correctAnswer, ...wrongAnswers];
        const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);
        
        return { 
            question: q.q, 
            answer: correctAnswer,
            options: shuffledOptions
        };
    }

    generateBollywoodEmoji() {
        const movie = this.bollywoodData[Math.floor(Math.random() * this.bollywoodData.length)];
        // Randomly select 3 emojis from the movie's emoji pool
        const shuffled = [...movie.emojis].sort(() => Math.random() - 0.5);
        const selectedEmojis = shuffled.slice(0, 3).join("");
        
        return {
            emojis: selectedEmojis,
            answer: movie.name,
            hint: `Keywords: ${movie.keywords.slice(0, 2).join(", ")}`
        };
    }

    // ========== VAULT 2: DIAMOND MINE GAME ==========
    initDiamondMineGame() {
        const positions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        
        // Fisher-Yates shuffle
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        const bombs = positions.slice(0, 3);
        const grid = [];
        for (let i = 0; i < 9; i++) {
            grid.push({
                index: i,
                isBomb: bombs.includes(i),
                revealed: false
            });
        }
        
        return {
            grid: grid,
            bombPositions: bombs,
            safePicks: 0,
            requiredSafePicks: 3
        };
    }

    // ========================================
    // SOCKET & AUDIO INITIALIZATION
    // ========================================

    initSocket() {
        try {
            // Auto-detect server URL - connect to the same origin that served this page
            let serverUrl;
            
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                // Local development
                serverUrl = `http://${window.location.hostname}:3000`;
            } else {
                // Production - connect to same server that's serving this page
                serverUrl = window.location.origin;
            }
            
            console.log('Game connecting to server:', serverUrl);
            
            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });

            this.socket.on('connect', () => {
                console.log('Connected to server!');
                this.playerId = this.socket.id;
                this.updateConnectionStatus(true);
                
                // If game was already started before socket connected, send the start event now
                if (this.gameActive && this.playerName) {
                    console.log('Socket connected after game start - sending game:start now');
                    this.socket.emit('game:start', { name: this.playerName, email: this.playerEmail });
                }
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.updateConnectionStatus(false);
            });

            this.socket.on('player:count', (count) => {
                this.updatePlayerCount(count);
            });

            this.socket.on('leaderboard:update', (leaderboard) => {
                this.updateLiveLeaderboard(leaderboard);
            });

            this.socket.on('connect_error', (error) => {
                console.log('Connection error:', error);
                this.updateConnectionStatus(false);
            });

            // Handle being kicked by admin
            this.socket.on('admin:kicked', (data) => {
                console.log('You have been kicked by admin');
                this.gameActive = false;
                clearInterval(this.timerInterval);
                
                // Show kicked message
                this.showKickedMessage(data?.message || 'You have been removed from the game by the host.');
            });
        } catch (error) {
            console.log('Socket initialization failed:', error);
            this.updateConnectionStatus(false);
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = connected ? '🟢 ONLINE' : '🔴 OFFLINE';
            statusEl.className = connected ? 'connection-status online' : 'connection-status offline';
        }
    }

    updatePlayerCount(count) {
        const countEl = document.getElementById('active-players');
        if (countEl) countEl.textContent = count;
        const liveCountEl = document.getElementById('live-active-count');
        if (liveCountEl) liveCountEl.textContent = count;
    }

    updateLiveLeaderboard(leaderboard) {
        const container = document.getElementById('live-leaderboard-list');
        if (!container) return;

        container.innerHTML = '';
        leaderboard.slice(0, 10).forEach((player, index) => {
            const entry = document.createElement('div');
            entry.className = 'live-leaderboard-entry';
            if (player.id === this.playerId) entry.classList.add('current-player');
            entry.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${player.name}</span>
                <span class="score">${player.score}</span>
            `;
            container.appendChild(entry);
        });
    }

    initAudio() {
        this.audioContext = null;
        try {
            // iOS requires webkit prefix
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();
                
                // iOS Safari requires audio context to be resumed after user gesture
                // We'll resume it on first user interaction
                const resumeAudio = () => {
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    // Remove listeners after first interaction
                    document.removeEventListener('touchstart', resumeAudio);
                    document.removeEventListener('touchend', resumeAudio);
                    document.removeEventListener('click', resumeAudio);
                };
                
                document.addEventListener('touchstart', resumeAudio, { passive: true });
                document.addEventListener('touchend', resumeAudio, { passive: true });
                document.addEventListener('click', resumeAudio);
            }
        } catch (e) {
            console.log('Audio not supported:', e);
        }
    }

    playSound(type) {
        if (!this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            switch(type) {
                case 'start':
                    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.3);
                    break;
                case 'success':
                    oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1);
                    oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.4);
                    break;
                case 'fail':
                    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.3);
                    break;
                case 'victory':
                    const playNote = (freq, time) => {
                        const osc = this.audioContext.createOscillator();
                        const gain = this.audioContext.createGain();
                        osc.connect(gain);
                        gain.connect(this.audioContext.destination);
                        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + time);
                        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime + time);
                        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + time + 0.2);
                        osc.start(this.audioContext.currentTime + time);
                        osc.stop(this.audioContext.currentTime + time + 0.2);
                    };
                    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => playNote(freq, i * 0.15));
                    return;
                case 'bomb':
                    oscillator.type = 'sawtooth';
                    oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.5);
                    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.5);
                    break;
                case 'heart':
                    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                    break;
            }
        } catch (e) {
            console.log('Sound error:', e);
        }
    }

    bindEvents() {
        const startBtn = document.getElementById('start-btn');
        const playAgainBtn = document.getElementById('play-again');
        
        if (startBtn) startBtn.addEventListener('click', () => this.startGame());
        if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.resetGame());
        
        // Check if coming back from face scan - prefill and auto-start
        this.checkFaceScanReturn();
    }

    checkFaceScanReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const name = urlParams.get('name') || sessionStorage.getItem('playerName');
        const email = urlParams.get('email') || sessionStorage.getItem('playerEmail');
        const scanned = urlParams.get('scanned') || sessionStorage.getItem('faceScanComplete');
        
        if (name && email && scanned) {
            // Prefill the form
            const nameInput = document.getElementById('player-name');
            const emailInput = document.getElementById('player-email');
            
            if (nameInput) nameInput.value = name;
            if (emailInput) emailInput.value = email;
            
            // Wait for socket to connect before auto-starting
            // This ensures game:start is sent immediately
            const startGameWhenReady = () => {
                if (this.socket && this.socket.connected) {
                    console.log('Socket ready - auto-starting game');
                    this.startGame();
                } else {
                    console.log('Waiting for socket connection before auto-start...');
                    // Wait for socket connect event
                    if (this.socket) {
                        this.socket.once('connect', () => {
                            console.log('Socket connected - now auto-starting game');
                            setTimeout(() => this.startGame(), 100);
                        });
                    }
                    // Fallback: start anyway after 3 seconds (game will work, just no real-time)
                    setTimeout(() => {
                        if (!this.gameActive) {
                            console.log('Socket timeout - starting game anyway');
                            this.startGame();
                        }
                    }, 3000);
                }
            };
            
            // Give a small delay for socket initialization
            setTimeout(startGameWhenReady, 300);
        }
    }

    createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 15 + 's';
            particle.style.animationDuration = (15 + Math.random() * 10) + 's';
            container.appendChild(particle);
        }
    }

    // ========================================
    // GAME FLOW
    // ========================================

    validateEmail(email) {
        // Check for valid email format with proper domain
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        
        if (!emailRegex.test(email)) {
            return false;
        }
        
        // Check for common valid domains (can be extended)
        const validDomains = [
            'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
            'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'aol.com',
            'yandex.com', 'gmx.com', 'inbox.com', 'rediffmail.com',
            // Educational domains
            'edu', 'ac.in', 'edu.in',
            // Corporate domains (allow any)
        ];
        
        const domain = email.split('@')[1].toLowerCase();
        
        // Allow if domain has valid TLD (.com, .in, .org, .net, .edu, etc.)
        const validTLDs = ['com', 'in', 'org', 'net', 'edu', 'gov', 'co', 'io', 'info', 'biz', 'me', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'ru', 'br', 'it', 'es', 'nl', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'at', 'ch', 'be', 'ie', 'nz', 'sg', 'hk', 'kr', 'tw', 'my', 'ph', 'th', 'id', 'vn', 'pk', 'bd', 'lk', 'np', 'ae', 'sa', 'za', 'ng', 'ke', 'eg', 'mx', 'ar', 'cl', 'co', 'pe', 've'];
        
        const domainParts = domain.split('.');
        const tld = domainParts[domainParts.length - 1];
        
        // Check if it's a known valid domain or has valid TLD
        if (validDomains.some(d => domain.endsWith(d)) || validTLDs.includes(tld)) {
            return true;
        }
        
        return false;
    }

    showEmailError(message) {
        let errorEl = document.getElementById('email-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'email-error';
            errorEl.className = 'email-error';
            const emailInput = document.getElementById('player-email');
            emailInput.parentNode.appendChild(errorEl);
        }
        errorEl.textContent = message;
        errorEl.classList.add('show');
        
        // Shake the input
        const emailInput = document.getElementById('player-email');
        emailInput.classList.add('shake');
        setTimeout(() => {
            emailInput.classList.remove('shake');
        }, 500);
        
        // Hide error after 3 seconds
        setTimeout(() => {
            errorEl.classList.remove('show');
        }, 3000);
    }

    startGame() {
        const nameInput = document.getElementById('player-name');
        const emailInput = document.getElementById('player-email');
        const email = emailInput.value.trim();
        const name = nameInput.value.trim();
        
        // Validate email is required and valid
        if (!email) {
            this.showEmailError('⚠️ Please enter your email address');
            emailInput.focus();
            return;
        }
        
        if (!this.validateEmail(email)) {
            this.showEmailError('⚠️ Please enter a valid email address (e.g., name@gmail.com)');
            emailInput.focus();
            return;
        }
        
        // Validate name
        if (!name) {
            const nameError = document.createElement('div');
            nameError.className = 'email-error show';
            nameError.textContent = '⚠️ Please enter your codename';
            nameInput.parentNode.appendChild(nameError);
            nameInput.focus();
            setTimeout(() => nameError.remove(), 3000);
            return;
        }
        
        // Check if player came from face scan
        const urlParams = new URLSearchParams(window.location.search);
        const scanned = urlParams.get('scanned') || sessionStorage.getItem('faceScanComplete');
        
        if (!scanned) {
            // Redirect to face scan page
            sessionStorage.setItem('playerName', name);
            sessionStorage.setItem('playerEmail', email);
            window.location.href = `face-scan.html?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`;
            return;
        }
        
        // Clear the face scan flag for next game
        sessionStorage.removeItem('faceScanComplete');
        
        this.playerName = name;
        this.playerEmail = email;
        
        const hudName = document.getElementById('hud-player-name');
        if (hudName) hudName.textContent = this.playerName;
        
        // Update mobile player name display
        const mobilePlayerName = document.getElementById('mobile-player-name');
        if (mobilePlayerName) mobilePlayerName.textContent = this.playerName;
        
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.playSound('start');
        
        // Set game active BEFORE trying to emit - so socket connect handler knows game started
        this.gameActive = true;
        this.currentVault = 0;
        this.score = 0;
        this.hintsUsed = 0;
        this.timeLeft = 180;
        this.vaultsCompleted = 0; // Reset vaults actually completed
        
        // Try to send game:start - if socket not connected yet, the connect handler will send it
        if (this.socket) {
            if (this.socket.connected) {
                console.log('Socket connected - sending game:start immediately');
                this.socket.emit('game:start', { name: this.playerName, email: this.playerEmail });
            } else {
                console.log('Socket not connected yet - game:start will be sent on connect');
            }
        }

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('active');
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('active');
        
        this.updateVaultProgress();
        this.loadVault();
        this.startTimer();
    }

    loadVault() {
        const vaultDoor = document.getElementById('vault-door');
        const vaultNumber = document.getElementById('vault-number');
        const questionContainer = document.getElementById('question-container');
        const answerContainer = document.getElementById('answer-container');
        const hintBtn = document.getElementById('hint-btn');
        const hintText = document.getElementById('hint-text');
        
        if (hintText) {
            hintText.classList.add('hidden');
            hintText.textContent = '';
        }
        
        vaultDoor.classList.remove('open', 'opening', 'closing', 'success', 'failed');
        
        // Force reflow to reset animation
        void vaultDoor.offsetWidth;
        
        vaultDoor.classList.add('opening');
        
        setTimeout(() => {
            vaultNumber.textContent = 'VAULT ' + (this.currentVault + 1);
            vaultDoor.classList.remove('opening');
            vaultDoor.classList.add('open');
            
            switch(this.currentVault) {
                case 0:
                    this.loadRiddleVault(questionContainer, answerContainer, hintBtn);
                    break;
                case 1:
                    this.loadDiamondMineVault(questionContainer, answerContainer, hintBtn);
                    break;
                case 2:
                    this.loadBollywoodVault(questionContainer, answerContainer, hintBtn);
                    break;
                case 3:
                    this.loadScrambledWordVault(questionContainer, answerContainer, hintBtn);
                    break;
                case 4:
                    this.loadGKVault(questionContainer, answerContainer, hintBtn);
                    break;
            }
            
            this.updateVaultProgress();
        }, 500);
    }

    // ========== VAULT 1: RIDDLE ==========
    loadRiddleVault(questionContainer, answerContainer, hintBtn) {
        // Generate a fresh riddle
        this.currentQuestion = this.generateRiddle();
        
        questionContainer.innerHTML = `
            <div class="vault-type-label">🧩 RIDDLE VAULT</div>
            <p class="question-text">${this.currentQuestion.question}</p>
        `;
        
        answerContainer.innerHTML = `
            <input type="text" id="answer-input" class="cyber-input" placeholder="Enter your answer..." autocomplete="off">
            <div class="button-row">
                <button id="submit-answer" class="cyber-btn submit-btn">CRACK IT!</button>
                <button id="skip-btn" class="cyber-btn skip-btn">SKIP →</button>
            </div>
        `;
        
        if (hintBtn) {
            hintBtn.classList.remove('hidden');
            hintBtn.onclick = () => this.showHint();
        }
        
        document.getElementById('submit-answer').addEventListener('click', () => this.submitAnswer());
        document.getElementById('skip-btn').addEventListener('click', () => this.skipVault());
        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });
        document.getElementById('answer-input').focus();
    }

    // ========== VAULT 2: DIAMOND MINE ==========
    loadDiamondMineVault(questionContainer, answerContainer, hintBtn) {
        this.currentDiamondMine = this.initDiamondMineGame();
        this.diamondMineRevealed = [];
        
        questionContainer.innerHTML = `
            <div class="mine-status">
                <span class="hearts-label">Find 3 Hearts</span>
                <span id="hearts-found" class="hearts-count">❤️ 0 / 3</span>
            </div>
            <div class="diamond-mine-grid" id="diamond-grid">
                ${this.currentDiamondMine.grid.map((cell, i) => `
                    <div class="mine-cell" data-index="${i}">
                        <span class="cell-content">?</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        answerContainer.innerHTML = `
            <div class="button-row">
                <button id="skip-btn" class="cyber-btn skip-btn">SKIP →</button>
            </div>
        `;
        
        if (hintBtn) hintBtn.classList.add('hidden');
        const hintText = document.getElementById('hint-text');
        if (hintText) hintText.classList.add('hidden');
        
        document.querySelectorAll('.mine-cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.revealCell(e));
        });
        
        document.getElementById('skip-btn').addEventListener('click', () => this.skipVault());
    }

    revealCell(e) {
        const cell = e.currentTarget;
        const index = parseInt(cell.dataset.index);
        
        if (this.diamondMineRevealed.includes(index) || !this.gameActive) return;
        
        this.diamondMineRevealed.push(index);
        const cellData = this.currentDiamondMine.grid[index];
        const content = cell.querySelector('.cell-content');
        
        cell.classList.add('revealed');
        
        if (cellData.isBomb) {
            content.textContent = '💣';
            cell.classList.add('bomb');
            this.playSound('bomb');
            this.revealAllCells();
            setTimeout(() => this.bombHitSkip(), 1000);
        } else {
            content.textContent = '❤️';
            cell.classList.add('heart');
            this.playSound('heart');
            
            this.currentDiamondMine.safePicks++;
            const heartsEl = document.getElementById('hearts-found');
            if (heartsEl) heartsEl.textContent = `❤️ ${this.currentDiamondMine.safePicks} / 3`;
            
            if (this.currentDiamondMine.safePicks >= this.currentDiamondMine.requiredSafePicks) {
                this.revealAllCells();
                setTimeout(() => this.vaultSuccess(), 500);
            }
        }
    }

    revealAllCells() {
        document.querySelectorAll('.mine-cell').forEach((cell, i) => {
            const cellData = this.currentDiamondMine.grid[i];
            const content = cell.querySelector('.cell-content');
            cell.classList.add('revealed');
            content.textContent = cellData.isBomb ? '💣' : '❤️';
            cell.classList.add(cellData.isBomb ? 'bomb' : 'heart');
        });
    }

    bombHitSkip() {
        const vaultDoor = document.getElementById('vault-door');
        if (vaultDoor) vaultDoor.classList.add('failed');
        
        // Track this vault as failed
        this.vaultResults[this.currentVault] = 'failed';
        this.updateVaultProgress();
        
        this.showBombMessage();
        
        setTimeout(() => {
            if (vaultDoor) vaultDoor.classList.remove('failed', 'open');
            this.hintsUsed = 0;
            this.currentVault++;
            
            if (this.currentVault >= 5) {
                this.endGame(false);
            } else {
                this.loadVault();
            }
        }, 1200);
    }

    showBombMessage() {
        const message = document.createElement('div');
        message.className = 'bomb-message';
        message.innerHTML = `
            <div class="bomb-icon">💣</div>
            <div class="bomb-text">BOOM! VAULT LOCKED</div>
            <div class="bomb-score">Moving to next vault...</div>
        `;
        document.getElementById('game-screen').appendChild(message);
        setTimeout(() => message.remove(), 1100);
    }

    // ========== VAULT 3: BOLLYWOOD EMOJI ==========
    loadBollywoodVault(questionContainer, answerContainer, hintBtn) {
        this.currentQuestion = this.generateBollywoodEmoji();
        
        questionContainer.innerHTML = `
            <div class="vault-type-label">🎬 BOLLYWOOD VAULT</div>
            <p class="question-text">Guess the Bollywood movie from emojis!</p>
            <div class="emoji-display">${this.currentQuestion.emojis}</div>
        `;
        
        answerContainer.innerHTML = `
            <input type="text" id="answer-input" class="cyber-input" placeholder="Movie name (no spaces)..." autocomplete="off">
            <div class="button-row">
                <button id="submit-answer" class="cyber-btn submit-btn">CRACK IT!</button>
                <button id="skip-btn" class="cyber-btn skip-btn">SKIP →</button>
            </div>
        `;
        
        if (hintBtn) {
            hintBtn.classList.remove('hidden');
            hintBtn.onclick = () => this.showHint();
        }
        
        document.getElementById('submit-answer').addEventListener('click', () => this.submitAnswer());
        document.getElementById('skip-btn').addEventListener('click', () => this.skipVault());
        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });
        document.getElementById('answer-input').focus();
    }

    // ========== VAULT 4: SCRAMBLED WORDS ==========
    loadScrambledWordVault(questionContainer, answerContainer, hintBtn) {
        this.currentQuestion = this.generateScrambledWord();
        
        questionContainer.innerHTML = `
            <div class="vault-type-label">� SCRAMBLED WORD VAULT</div>
            <p class="question-text">Unscramble the letters to form a word!</p>
            <div class="scrambled-display">${this.currentQuestion.scrambled}</div>
            <p class="word-length">Word Length: ${this.currentQuestion.length} letters</p>
        `;
        
        answerContainer.innerHTML = `
            <input type="text" id="answer-input" class="cyber-input" placeholder="Type the unscrambled word..." autocomplete="off">
            <div class="button-row">
                <button id="submit-answer" class="cyber-btn submit-btn">CRACK IT!</button>
                <button id="skip-btn" class="cyber-btn skip-btn">SKIP →</button>
            </div>
        `;
        
        if (hintBtn) {
            hintBtn.classList.remove('hidden');
            hintBtn.onclick = () => this.showHint();
        }
        
        document.getElementById('submit-answer').addEventListener('click', () => this.submitAnswer());
        document.getElementById('skip-btn').addEventListener('click', () => this.skipVault());
        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });
        document.getElementById('answer-input').focus();
    }

    // ========== VAULT 5: GK (Multiple Choice) ==========
    loadGKVault(questionContainer, answerContainer, hintBtn) {
        this.currentQuestion = this.generateGKQuestion();
        this.gkAnswered = false; // Track if player has already answered
        
        questionContainer.innerHTML = `
            <div class="vault-type-label">🧠 KNOWLEDGE VAULT</div>
            <p class="question-text">${this.currentQuestion.question}</p>
        `;
        
        // Create 4 option buttons
        const optionsHTML = this.currentQuestion.options.map((option, index) => `
            <button class="gk-option-btn" data-answer="${option}" data-index="${index}">
                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                <span class="option-text">${option.toUpperCase()}</span>
            </button>
        `).join('');
        
        answerContainer.innerHTML = `
            <div class="gk-options-container">
                ${optionsHTML}
            </div>
            <div class="button-row" style="margin-top: 15px;">
                <button id="skip-btn" class="cyber-btn skip-btn">SKIP →</button>
            </div>
        `;
        
        if (hintBtn) hintBtn.classList.add('hidden');
        
        // Add click listeners to all option buttons
        document.querySelectorAll('.gk-option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleGKOptionClick(e));
        });
        
        document.getElementById('skip-btn').addEventListener('click', () => this.skipVault());
    }
    
    handleGKOptionClick(e) {
        // Prevent multiple clicks
        if (this.gkAnswered) return;
        this.gkAnswered = true;
        
        const clickedBtn = e.currentTarget;
        const selectedAnswer = clickedBtn.dataset.answer;
        const correctAnswer = this.currentQuestion.answer;
        
        // Disable all buttons
        document.querySelectorAll('.gk-option-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
        });
        
        // Hide skip button
        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) skipBtn.style.display = 'none';
        
        if (selectedAnswer === correctAnswer) {
            // Correct answer - turn green
            clickedBtn.classList.add('correct');
            this.playSound('success');
            
            setTimeout(() => {
                this.vaultSuccess();
            }, 1000);
        } else {
            // Wrong answer - turn red and show correct answer in green
            clickedBtn.classList.add('wrong');
            this.playSound('error');
            
            // Highlight the correct answer
            document.querySelectorAll('.gk-option-btn').forEach(btn => {
                if (btn.dataset.answer === correctAnswer) {
                    btn.classList.add('correct');
                }
            });
            
            setTimeout(() => {
                this.vaultFailed();
            }, 1500);
        }
    }
    
    vaultFailed() {
        const vaultDoor = document.getElementById('vault-door');
        const correctAnswer = this.currentQuestion ? this.currentQuestion.answer : '';
        
        // First close the vault door with animation
        if (vaultDoor) {
            vaultDoor.classList.remove('open');
            vaultDoor.classList.add('closing');
        }
        
        // After door closes, show the result
        setTimeout(() => {
            if (vaultDoor) {
                vaultDoor.classList.remove('closing');
                vaultDoor.classList.add('failed');
            }
            
            // Show failed message with correct answer
            const message = document.createElement('div');
            message.className = 'vault-result-overlay failed';
            message.innerHTML = `
                <div class="result-modal">
                    <div class="result-icon">❌</div>
                    <div class="result-title">VAULT LOCKED!</div>
                    <div class="correct-answer-box">
                        <span class="answer-label">Correct Answer:</span>
                        <span class="answer-value">${correctAnswer}</span>
                    </div>
                    <div class="result-subtitle">Moving to next vault...</div>
                </div>
            `;
            document.getElementById('game-screen').appendChild(message);
            
            setTimeout(() => {
                message.remove();
                if (vaultDoor) vaultDoor.classList.remove('failed');
                
                // Track this vault as failed and update indicator
                this.vaultResults[this.currentVault] = 'failed';
                this.updateVaultIndicator(this.currentVault, 'failed');
                
                this.hintsUsed = 0;
                this.currentVault++;
                
                if (this.currentVault >= 5) {
                    this.endGame(false);
                } else {
                    this.loadVault();
                }
            }, 2000);
        }, 600); // Wait for door to close
    }

    // ========================================
    // ANSWER HANDLING
    // ========================================

    showHint() {
        const hintText = document.getElementById('hint-text');
        if (this.currentQuestion && this.currentQuestion.hint && hintText) {
            hintText.textContent = '💡 Hint: ' + this.currentQuestion.hint;
            hintText.classList.remove('hidden');
            this.hintsUsed++;
        }
    }

    submitAnswer() {
        const input = document.getElementById('answer-input');
        if (!input) return;
        
        const answer = input.value.trim().toLowerCase().replace(/\s+/g, '');
        const correct = this.currentQuestion.answer.toLowerCase().replace(/\s+/g, '');
        
        // Check for exact match only
        if (answer === correct) {
            this.vaultSuccess();
        } else {
            this.showWrongAnswer();
        }
    }

    showWrongAnswer() {
        this.playSound('fail');
        const input = document.getElementById('answer-input');
        if (input) {
            input.classList.add('wrong');
            input.value = '';
            setTimeout(() => input.classList.remove('wrong'), 500);
        }
    }

    skipVault() {
        this.playSound('fail');
        
        const vaultDoor = document.getElementById('vault-door');
        if (vaultDoor) vaultDoor.classList.add('skipped');
        
        this.showSkipMessage();
        
        setTimeout(() => {
            if (vaultDoor) vaultDoor.classList.remove('skipped', 'open');
            
            // Track this vault as skipped and update indicator
            this.vaultResults[this.currentVault] = 'skipped';
            this.updateVaultIndicator(this.currentVault, 'skipped');
            
            this.hintsUsed = 0;
            this.currentVault++;
            
            if (this.currentVault >= 5) {
                this.endGame(false);
            } else {
                this.loadVault();
            }
        }, 1000);
    }

    showSkipMessage() {
        const message = document.createElement('div');
        message.className = 'skip-message';
        message.innerHTML = `
            <div class="skip-icon">⏭️</div>
            <div class="skip-text">VAULT SKIPPED</div>
            <div class="skip-score">No points earned</div>
        `;
        document.getElementById('game-screen').appendChild(message);
        setTimeout(() => message.remove(), 900);
    }

    vaultSuccess() {
        this.playSound('success');
        
        const baseScore = 100;
        const timeBonus = Math.floor(this.timeLeft / 2);
        const hintPenalty = this.hintsUsed * 10;
        const vaultScore = Math.max(baseScore + timeBonus - hintPenalty, 50);
        
        this.score += vaultScore;
        this.vaultsCompleted++;
        this.updateScore();
        
        // Get correct answer based on vault type
        let correctAnswer = '';
        switch(this.currentVault) {
            case 0: // Riddle
                correctAnswer = this.currentQuestion ? this.currentQuestion.answer : '';
                break;
            case 1: // Diamond Mine
                correctAnswer = '3 Hearts Found! 💎';
                break;
            case 2: // Bollywood
                correctAnswer = this.currentQuestion ? this.currentQuestion.answer : '';
                break;
            case 3: // Scrambled Words
                correctAnswer = this.currentQuestion ? this.currentQuestion.answer : '';
                break;
            case 4: // GK
                correctAnswer = this.currentQuestion ? this.currentQuestion.answer : '';
                break;
            default:
                correctAnswer = this.currentQuestion ? this.currentQuestion.answer : '';
        }
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('game:score', { 
                name: this.playerName,
                score: this.score,
                vaults: this.vaultsCompleted,
                vault: this.currentVault + 1
            });
        }

        const vaultDoor = document.getElementById('vault-door');
        
        // First close the vault door with animation
        if (vaultDoor) {
            vaultDoor.classList.remove('open');
            vaultDoor.classList.add('closing');
        }
        
        // After door closes, show success state
        setTimeout(() => {
            if (vaultDoor) {
                vaultDoor.classList.remove('closing');
                vaultDoor.classList.add('success');
            }
            
            // Show success message with answer
            const message = document.createElement('div');
            message.className = 'vault-result-overlay success';
            message.innerHTML = `
                <div class="result-modal">
                    <div class="result-icon">✅</div>
                    <div class="result-title">VAULT CRACKED!</div>
                    <div class="correct-answer-box success">
                        <span class="answer-label">Answer:</span>
                        <span class="answer-value">${correctAnswer}</span>
                    </div>
                    <div class="result-score">+${vaultScore} POINTS</div>
                </div>
            `;
            document.getElementById('game-screen').appendChild(message);
            
            setTimeout(() => {
                message.remove();
                if (vaultDoor) vaultDoor.classList.remove('success');
                
                // Track this vault as success and update indicator
                this.vaultResults[this.currentVault] = 'success';
                this.updateVaultIndicator(this.currentVault, 'success');
                
                this.hintsUsed = 0;
                this.currentVault++;
                
                if (this.currentVault >= 5) {
                    this.endGame(true);
                } else {
                    this.loadVault();
                }
            }, 2000);
        }, 600); // Wait for door to close
    }
    
    updateVaultIndicator(vaultIndex, result) {
        const indicator = document.querySelector(`.vault-indicator[data-vault="${vaultIndex + 1}"]`);
        if (!indicator) return;
        
        indicator.classList.remove('current', 'unlocked', 'failed', 'success');
        
        if (result === 'success') {
            indicator.classList.add('unlocked', 'success');
            indicator.querySelector('.vault-icon').textContent = '✅';
        } else if (result === 'failed' || result === 'skipped') {
            indicator.classList.add('failed');
            indicator.querySelector('.vault-icon').textContent = '❌';
        }
    }

    showSuccessMessage(score) {
        const message = document.createElement('div');
        message.className = 'success-message';
        message.innerHTML = `
            <div class="success-icon">✓</div>
            <div class="success-text">VAULT CRACKED!</div>
            <div class="success-score">+${score} points</div>
        `;
        document.getElementById('game-screen').appendChild(message);
        setTimeout(() => message.remove(), 1400);
    }

    showKickedMessage(reason) {
        // Create full screen kicked overlay
        const overlay = document.createElement('div');
        overlay.className = 'kicked-overlay';
        overlay.innerHTML = `
            <div class="kicked-modal">
                <div class="kicked-icon">🚫</div>
                <h2 class="kicked-title">REMOVED FROM GAME</h2>
                <p class="kicked-reason">${reason}</p>
                <button class="kicked-btn" onclick="window.location.href='index.html'">RETURN TO HOME</button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Auto redirect after 5 seconds
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 5000);
    }

    updateScore() {
        const scoreEl = document.getElementById('current-score');
        if (scoreEl) scoreEl.textContent = this.score;
        
        // Update mobile score display
        const mobileScoreEl = document.getElementById('mobile-score-display');
        if (mobileScoreEl) mobileScoreEl.textContent = this.score;
        
        // Update score progress bar - max score estimated at 5000 for full bar
        const scoreProgress = document.getElementById('score-progress');
        if (scoreProgress) {
            const maxScore = 5000; // Maximum expected score for full bar
            const percentage = Math.min((this.score / maxScore) * 100, 100);
            scoreProgress.style.width = percentage + '%';
        }
    }

    updateVaultProgress() {
        const vaults = document.querySelectorAll('.vault-indicator');
        vaults.forEach((vault, index) => {
            vault.classList.remove('active', 'completed', 'success', 'failed', 'skipped');
            
            if (index < this.currentVault) {
                vault.classList.add('completed');
                vault.querySelector('.vault-icon').textContent = '🔓';
                
                // Apply result-based styling
                const result = this.vaultResults[index];
                if (result === 'success') {
                    vault.classList.add('success');
                } else if (result === 'failed') {
                    vault.classList.add('failed');
                } else if (result === 'skipped') {
                    vault.classList.add('skipped');
                }
            } else if (index === this.currentVault) {
                vault.classList.add('active');
            }
        });
    }

    startTimer() {
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.endGame(false);
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = display;
            // Remove old classes and add new ones
            timerEl.classList.remove('warning', 'danger');
            if (this.timeLeft <= 10) {
                timerEl.classList.add('danger');
            } else if (this.timeLeft <= 30) {
                timerEl.classList.add('warning');
            }
        }
        
        // Update mobile timer display
        const mobileTimerEl = document.getElementById('mobile-timer-display');
        if (mobileTimerEl) {
            mobileTimerEl.textContent = display;
            mobileTimerEl.classList.remove('warning', 'danger');
            if (this.timeLeft <= 10) {
                mobileTimerEl.classList.add('danger');
            } else if (this.timeLeft <= 30) {
                mobileTimerEl.classList.add('warning');
            }
        }
        
        const timerProgress = document.getElementById('timer-progress');
        if (timerProgress) {
            const percentage = (this.timeLeft / 180) * 100;
            
            // Update width for horizontal progress bar (square timer on right)
            timerProgress.style.width = percentage + '%';
            
            // Update classes for warning/danger states
            timerProgress.classList.remove('warning', 'danger');
            if (this.timeLeft <= 10) {
                timerProgress.classList.add('danger');
            } else if (this.timeLeft <= 30) {
                timerProgress.classList.add('warning');
            }
        }
    }

    endGame(completedAllVaults) {
        this.gameActive = false;
        clearInterval(this.timerInterval);
        
        // Player wins if they completed at least 2 vaults
        const won = this.vaultsCompleted >= 2;
        
        if (won) {
            this.playSound('victory');
        } else {
            this.playSound('fail');
        }

        // Send game completion to server
        const gameData = {
            name: this.playerName,
            email: this.playerEmail,
            score: this.score,
            vaultsCompleted: this.vaultsCompleted,
            won: won
        };
        
        if (this.socket) {
            if (this.socket.connected) {
                console.log('Sending game:complete to server');
                this.socket.emit('game:complete', gameData);
            } else {
                // Socket not connected - try to reconnect and send
                console.log('Socket not connected - attempting to send game:complete');
                this.socket.once('connect', () => {
                    console.log('Reconnected - sending game:complete');
                    this.socket.emit('game:complete', gameData);
                });
            }
        }

        this.updateLocalLeaderboard();

        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('end-screen').classList.remove('hidden');
        document.getElementById('end-screen').classList.add('active');
        
        const endTitle = document.getElementById('end-title');
        const finalScore = document.getElementById('final-score');
        const vaultsCracked = document.getElementById('vaults-cracked');
        
        if (won) {
            if (endTitle) {
                endTitle.textContent = '🎉 MASTER VAULT BREAKER! 🎉';
                endTitle.classList.add('victory');
            }
        } else {
            if (endTitle) {
                endTitle.textContent = '💀 VAULT SEALED 💀';
                endTitle.classList.remove('victory');
            }
        }
        
        if (finalScore) finalScore.textContent = this.score;
        if (vaultsCracked) vaultsCracked.textContent = `${this.vaultsCompleted}/5`;
    }

    updateLocalLeaderboard() {
        let leaderboard = JSON.parse(localStorage.getItem('vaultLeaderboard') || '[]');
        
        leaderboard.push({
            name: this.playerName,
            email: this.playerEmail,
            score: this.score,
            vaults: this.vaultsCompleted, // Use actual completed vaults
            date: new Date().toLocaleDateString()
        });
        
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 10);
        
        localStorage.setItem('vaultLeaderboard', JSON.stringify(leaderboard));
        this.displayLocalLeaderboard(leaderboard);
    }

    displayLocalLeaderboard(leaderboard) {
        const container = document.getElementById('final-leaderboard-list');
        if (!container) return;
        
        container.innerHTML = '';
        leaderboard.forEach((entry, index) => {
            const div = document.createElement('div');
            div.className = 'leaderboard-entry';
            div.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span class="name">${entry.name}</span>
                <span class="score">${entry.score}</span>
                <span class="vaults">${entry.vaults}/5</span>
            `;
            container.appendChild(div);
        });
        
        const playerRank = document.getElementById('player-rank');
        if (playerRank) {
            const rank = leaderboard.findIndex(e => e.name === this.playerName && e.score === this.score) + 1;
            playerRank.textContent = `#${rank || '?'}`;
        }
    }

    resetGame() {
        document.getElementById('end-screen').classList.add('hidden');
        document.getElementById('end-screen').classList.remove('active');
        document.getElementById('start-screen').classList.remove('hidden');
        document.getElementById('start-screen').classList.add('active');
        
        this.currentVault = 0;
        this.score = 0;
        this.timeLeft = 180;
        this.hintsUsed = 0;
        
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.classList.remove('warning');
        
        const vaultDoor = document.getElementById('vault-door');
        if (vaultDoor) vaultDoor.classList.remove('success', 'failed', 'open', 'opening', 'skipped');
        
        document.querySelectorAll('.vault-indicator').forEach(v => {
            v.classList.remove('active', 'completed');
            v.querySelector('.vault-icon').textContent = '🔒';
        });
    }
}

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    window.game = new VaultBreaker();
});
