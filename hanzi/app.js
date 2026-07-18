(function () {
    let datasets = {
        hsk1: [],
        hsk2: [],
        hsk3: []
    };

    let currentGrade = 'hsk1'; // 'hsk1' | 'hsk2' | 'hsk3'
    let currentMode = 'hanziToDef'; // 'hanziToDef' | 'defToHanzi' | 'flashcards' | 'weak'
    let currentQuestionIndex = 0;
    let currentScore = 0;
    let correctlyGuessedThisRound = [];
    let isAnsweringLocked = false;
    let missedHanzi = JSON.parse(localStorage.getItem('hanzi_missed') || '[]');

    let flashcardIndex = 0;

    let isAudioMuted = localStorage.getItem('hanzi_audio_muted') === 'true';

    // DOM Elements
    const gradeTabs = document.getElementById('grade-tabs');
    const modeTabs = document.getElementById('mode-tabs');
    const quizView = document.getElementById('quiz-view');
    const flashcardView = document.getElementById('flashcard-view');
    const questionNumEl = document.getElementById('question-num');
    const currentScoreEl = document.getElementById('current-score');
    const bestScoreEl = document.getElementById('best-score');
    const cardSolvedRow = document.getElementById('card-solved-row');
    const cardMissedRow = document.getElementById('card-missed-row');
    const cardMainContent = document.getElementById('card-main-content');
    const optionsGrid = document.getElementById('options-grid');
    const quizAudioBtn = document.getElementById('quiz-audio-btn');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');

    const fcCurrentNum = document.getElementById('fc-current-num');
    const fcTotalNum = document.getElementById('fc-total-num');
    const flashcard = document.getElementById('flashcard');
    const fcFrontText = document.getElementById('fc-front-text');
    const fcPinyinText = document.getElementById('fc-pinyin-text');
    const fcBackText = document.getElementById('fc-back-text');
    const fcPrevBtn = document.getElementById('fc-prev-btn');
    const fcNextBtn = document.getElementById('fc-next-btn');
    const fcAudioBtn = document.getElementById('fc-audio-btn');

    const resultsModal = document.getElementById('results-modal');
    const modalScore = document.getElementById('modal-score');
    const modalFeedback = document.getElementById('modal-feedback');
    const modalCorrectKanjiGrid = document.getElementById('modal-correct-kanji-grid');
    const modalPlayAgain = document.getElementById('modal-play-again');
    const modalReviewWeak = document.getElementById('modal-review-weak');

    let currentTargetItem = null;

    // TTS Pronunciation helper
    function speakHanzi(text, force = false) {
        if (!force && isAudioMuted) return;
        if (!text || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel(); // Stop any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.85; // Slightly slower for language learners
        window.speechSynthesis.speak(utterance);
    }

    function updateSoundToggleUI() {
        if (!soundToggleBtn) return;
        if (isAudioMuted) {
            soundToggleBtn.textContent = '🔇 Sound Off';
            soundToggleBtn.classList.add('muted');
        } else {
            soundToggleBtn.textContent = '🔊 Sound On';
            soundToggleBtn.classList.remove('muted');
        }
    }

    async function loadData() {
        if (window.HANZI_DATASETS) {
            datasets = window.HANZI_DATASETS;
            initApp();
            return;
        }

        try {
            const [h1, h2, h3] = await Promise.all([
                fetch('data/hsk1.json').then(res => res.json()),
                fetch('data/hsk2.json').then(res => res.json()),
                fetch('data/hsk3.json').then(res => res.json())
            ]);
            datasets.hsk1 = h1;
            datasets.hsk2 = h2;
            datasets.hsk3 = h3;

            initApp();
        } catch (err) {
            console.error('Failed to load hanzi data:', err);
        }
    }

    function initApp() {
        setupEventListeners();
        updateSoundToggleUI();
        updateBestScore();
        startNewRound();
    }

    function setupEventListeners() {
        if (soundToggleBtn) {
            soundToggleBtn.addEventListener('click', () => {
                isAudioMuted = !isAudioMuted;
                localStorage.setItem('hanzi_audio_muted', isAudioMuted);
                updateSoundToggleUI();
            });
        }

        gradeTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            gradeTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGrade = btn.dataset.grade;
            updateBestScore();
            if (currentMode === 'flashcards') {
                initFlashcards();
            } else {
                startNewRound();
            }
        });

        modeTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            modeTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;

            if (currentMode === 'flashcards') {
                quizView.style.display = 'none';
                flashcardView.style.display = 'block';
                initFlashcards();
            } else {
                flashcardView.style.display = 'none';
                quizView.style.display = 'block';
                updateBestScore();
                startNewRound();
            }
        });

        // Quiz Audio (forced speak when explicitly clicking 🔊 icon)
        quizAudioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentTargetItem) speakHanzi(currentTargetItem.hanzi, true);
        });

        // Flashcard Audio (forced speak when explicitly clicking 🔊 icon)
        fcAudioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pool = getActiveDataset();
            if (pool[flashcardIndex]) speakHanzi(pool[flashcardIndex].hanzi, true);
        });

        // Flashcard flip & nav
        flashcard.addEventListener('click', () => {
            flashcard.classList.toggle('flipped');
        });

        fcPrevBtn.addEventListener('click', () => {
            if (flashcardIndex > 0) {
                flashcardIndex--;
                renderFlashcard();
            }
        });

        fcNextBtn.addEventListener('click', () => {
            const currentList = getActiveDataset();
            if (flashcardIndex < currentList.length - 1) {
                flashcardIndex++;
                renderFlashcard();
            }
        });

        // Modal actions
        modalPlayAgain.addEventListener('click', () => {
            resultsModal.classList.remove('active');
            startNewRound();
        });

        modalReviewWeak.addEventListener('click', () => {
            resultsModal.classList.remove('active');
            modeTabs.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.mode === 'weak');
            });
            currentMode = 'weak';
            flashcardView.style.display = 'none';
            quizView.style.display = 'block';
            startNewRound();
        });

        // Global Keyboard Listeners
        document.addEventListener('keydown', (e) => {
            if (resultsModal.classList.contains('active')) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    resultsModal.classList.remove('active');
                    startNewRound();
                }
                return;
            }

            if (quizView.style.display !== 'none' && !isAnsweringLocked) {
                const num = parseInt(e.key, 10);
                if (!isNaN(num) && num >= 1 && num <= 5) {
                    const buttons = optionsGrid.children;
                    if (buttons[num - 1]) {
                        e.preventDefault();
                        buttons[num - 1].click();
                    }
                }
            }

            if (flashcardView.style.display !== 'none') {
                if (e.key === 'ArrowRight' || e.key === ' ') {
                    e.preventDefault();
                    fcNextBtn.click();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    fcPrevBtn.click();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    flashcard.click();
                }
            }
        });
    }

    function getActiveDataset() {
        if (currentMode === 'weak') {
            return missedHanzi.length > 0 ? missedHanzi : datasets[currentGrade];
        }
        return datasets[currentGrade] || [];
    }

    function updateBestScore() {
        const key = `hanzi_best_${currentGrade}_${currentMode}`;
        const best = localStorage.getItem(key) || 0;
        bestScoreEl.textContent = best;
    }

    let targetScore = 10;
    let totalQuestionsAsked = 0;
    let unsolvedPool = [];

    function startNewRound() {
        isAnsweringLocked = false;
        currentScore = 0;
        totalQuestionsAsked = 0;
        correctlyGuessedThisRound = [];

        currentScoreEl.textContent = '0';
        questionNumEl.textContent = '0';
        if (cardSolvedRow) cardSolvedRow.innerHTML = '';
        if (cardMissedRow) cardMissedRow.innerHTML = '';

        const pool = getActiveDataset();
        if (!pool || pool.length === 0) {
            cardMainContent.innerHTML = `<div class="definition-display">No Hanzi available for review!</div>`;
            optionsGrid.innerHTML = `<button class="primary-btn" onclick="location.reload()">Reset</button>`;
            return;
        }

        targetScore = Math.min(10, pool.length);
        const targetScoreEl = document.getElementById('target-score');
        if (targetScoreEl) targetScoreEl.textContent = targetScore;

        unsolvedPool = shuffleArray([...pool]);
        renderQuestion();
    }

    function renderQuestion() {
        isAnsweringLocked = false;
        totalQuestionsAsked++;
        questionNumEl.textContent = totalQuestionsAsked;

        const pool = datasets[currentGrade];
        if (!pool || pool.length === 0) return;

        if (unsolvedPool.length === 0) {
            unsolvedPool = shuffleArray([...pool]);
        }

        currentTargetItem = unsolvedPool.shift();

        const distractors = shuffleArray(
            pool.filter(item => item.hanzi !== currentTargetItem.hanzi)
        ).slice(0, 4);

        const options = shuffleArray([currentTargetItem, ...distractors]);

        optionsGrid.innerHTML = '';

        if (currentMode === 'hanziToDef' || currentMode === 'weak') {
            // Display Hanzi -> Pick Definition (No Pinyin)
            cardMainContent.innerHTML = `<div class="hanzi-display">${currentTargetItem.hanzi}</div>`;
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.dataset.hanzi = opt.hanzi;
                btn.innerHTML = `<span class="key-badge">${idx + 1}</span> <span>${opt.definition}</span>`;
                btn.addEventListener('click', () => handleAnswer(opt.hanzi === currentTargetItem.hanzi, btn, currentTargetItem));
                optionsGrid.appendChild(btn);
            });
        } else if (currentMode === 'hanziToPinyin') {
            // Display Hanzi -> Pick Pinyin (No English)
            cardMainContent.innerHTML = `<div class="hanzi-display">${currentTargetItem.hanzi}</div>`;
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.dataset.hanzi = opt.hanzi;
                btn.innerHTML = `<span class="key-badge">${idx + 1}</span> <span class="opt-pinyin">${opt.pinyin}</span>`;
                btn.addEventListener('click', () => handleAnswer(opt.hanzi === currentTargetItem.hanzi, btn, currentTargetItem));
                optionsGrid.appendChild(btn);
            });
        } else if (currentMode === 'defToHanzi') {
            // Display Definition -> Pick Hanzi
            cardMainContent.innerHTML = `
                <div class="definition-display">${currentTargetItem.definition}</div>
            `;
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn hanzi-opt';
                btn.dataset.hanzi = opt.hanzi;
                btn.innerHTML = `<span class="key-badge">${idx + 1}</span> <span>${opt.hanzi}</span>`;
                btn.addEventListener('click', () => handleAnswer(opt.hanzi === currentTargetItem.hanzi, btn, currentTargetItem));
                optionsGrid.appendChild(btn);
            });
        }
    }

    function handleAnswer(isCorrect, selectedBtn, targetItem) {
        if (isAnsweringLocked) return;
        isAnsweringLocked = true;

        speakHanzi(targetItem.hanzi);

        if (isCorrect) {
            selectedBtn.classList.add('correct');
            currentScore++;
            currentScoreEl.textContent = currentScore;

            correctlyGuessedThisRound.push(targetItem);
            renderCorrectChip(targetItem);

            advanceQuestion();
        } else {
            selectedBtn.classList.add('incorrect');
            addMissedHanzi(targetItem);
            unsolvedPool.push(targetItem);
            renderMissedChip(targetItem);

            const buttons = Array.from(optionsGrid.children);
            const correctBtn = buttons.find(b => b.dataset.hanzi === targetItem.hanzi);
            if (correctBtn) correctBtn.classList.add('correct');

            setTimeout(advanceQuestion, 1000);
        }
    }

    function renderCorrectChip(item) {
        const badge = document.createElement('div');
        badge.className = 'solved-mini-badge';
        badge.innerHTML = `${item.hanzi}<span class="tooltip">${item.pinyin}: ${item.definition}</span>`;
        cardSolvedRow.appendChild(badge);
    }

    function renderMissedChip(item) {
        const badge = document.createElement('div');
        badge.className = 'solved-mini-badge incorrect-badge';
        badge.innerHTML = `${item.hanzi}<span class="tooltip">${item.pinyin}: ${item.definition}</span>`;
        cardMissedRow.appendChild(badge);
    }

    function advanceQuestion() {
        if (currentScore >= targetScore) {
            finishRound();
        } else {
            renderQuestion();
        }
    }

    function finishRound() {
        modalScore.textContent = `${currentScore}/${targetScore} Target Reached!`;

        const accuracy = Math.round((currentScore / totalQuestionsAsked) * 100);
        if (accuracy === 100) {
            modalFeedback.textContent = `🎉 Perfect Score! 10/10 in 10 questions! 太棒了!`;
        } else {
            modalFeedback.textContent = `👍 Finished in ${totalQuestionsAsked} questions (${accuracy}% accuracy)!`;
        }

        modalCorrectKanjiGrid.innerHTML = '';
        if (correctlyGuessedThisRound.length === 0) {
            modalCorrectKanjiGrid.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">None this round</span>';
        } else {
            correctlyGuessedThisRound.forEach(item => {
                const chip = document.createElement('div');
                chip.className = 'kanji-chip';
                chip.innerHTML = `${item.hanzi}<span class="tooltip">${item.pinyin}: ${item.definition}</span>`;
                modalCorrectKanjiGrid.appendChild(chip);
            });
        }

        const key = `hanzi_best_${currentGrade}_${currentMode}`;
        const previousBest = parseInt(localStorage.getItem(key) || '0', 10);
        if (previousBest === 0 || totalQuestionsAsked < previousBest) {
            localStorage.setItem(key, totalQuestionsAsked);
            updateBestScore();
        }

        resultsModal.classList.add('active');
    }

    // Flashcard Functions
    function initFlashcards() {
        flashcardIndex = 0;
        const pool = getActiveDataset();
        fcTotalNum.textContent = pool.length;
        renderFlashcard();
    }

    function renderFlashcard() {
        const pool = getActiveDataset();
        if (!pool || pool.length === 0) return;

        flashcard.classList.remove('flipped');
        fcCurrentNum.textContent = flashcardIndex + 1;

        const item = pool[flashcardIndex];
        fcFrontText.textContent = item.hanzi;
        fcPinyinText.textContent = item.pinyin;
        fcBackText.textContent = item.definition;

        fcPrevBtn.disabled = flashcardIndex === 0;
        fcNextBtn.disabled = flashcardIndex === pool.length - 1;
    }

    function addMissedHanzi(item) {
        if (!missedHanzi.some(h => h.hanzi === item.hanzi)) {
            missedHanzi.push(item);
            localStorage.setItem('hanzi_missed', JSON.stringify(missedHanzi));
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    loadData();
})();
