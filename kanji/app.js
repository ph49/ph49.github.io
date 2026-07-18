(function () {
    // main state stuff. probly should use an object or class for this but whatever
    let datasets = {
        grade1: [],
        grade2: [],
        grade3: []
    };

    let currentGrade = 'grade1';
    let currentMode = 'kanjiToDef'; // 'kanjiToDef' | 'defToKanji' | 'flashcards' | 'weak'
    let roundQuestions = [];
    let currentQuestionIndex = 0;
    let currentScore = 0;
    let correctlyGuessedThisRound = [];
    let isAnsweringLocked = false;
    // load missed kanji from localstorage. hope JSON.parse doesnt crash if someone tampers whith it
    let missedKanji = JSON.parse(localStorage.getItem('kanji_missed') || '[]');

    // Flashcard state
    let flashcardIndex = 0;

    // DOM Elements - hopefully none of these ID's change in index.html or this whole thing breaks
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

    const fcCurrentNum = document.getElementById('fc-current-num');
    const fcTotalNum = document.getElementById('fc-total-num');
    const flashcard = document.getElementById('flashcard');
    const fcFrontText = document.getElementById('fc-front-text');
    const fcBackText = document.getElementById('fc-back-text');
    const fcPrevBtn = document.getElementById('fc-prev-btn');
    const fcNextBtn = document.getElementById('fc-next-btn');

    const resultsModal = document.getElementById('results-modal');
    const modalScore = document.getElementById('modal-score');
    const modalFeedback = document.getElementById('modal-feedback');
    const modalCorrectKanjiGrid = document.getElementById('modal-correct-kanji-grid');
    const modalPlayAgain = document.getElementById('modal-play-again');
    const modalReviewWeak = document.getElementById('modal-review-weak');

    // Load Datasets (uses window.KANJI_DATASETS if embedded in data.js because CORS on file:// is annoying)
    async function loadData() {
        if (window.KANJI_DATASETS) {
            datasets = window.KANJI_DATASETS;
            initApp();
            return;
        }

        try {
            const [g1, g2, g3] = await Promise.all([
                fetch('data/grade1.json').then(res => res.json()),
                fetch('data/grade2.json').then(res => res.json()),
                fetch('data/grade3.json').then(res => res.json())
            ]);
            datasets.grade1 = g1;
            datasets.grade2 = g2;
            datasets.grade3 = g3;

            initApp();
        } catch (err) {
            console.error('Failed to load kanji data:', err);
        }
    }

    function initApp() {
        setupEventListeners();
        updateBestScore();
        startNewRound();
    }

    function setupEventListeners() {
        // Grade selector tab handler. took me 20 mins to realize e.target was clicking the span inside the button lol
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

        // Mode selector
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

        // Modal button actions
        modalPlayAgain.addEventListener('click', () => {
            resultsModal.classList.remove('active');
            startNewRound();
        });

        modalReviewWeak.addEventListener('click', () => {
            resultsModal.classList.remove('active');
            // Switch to Weak Mode automatically when user clicks review
            modeTabs.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.mode === 'weak');
            });
            currentMode = 'weak';
            flashcardView.style.display = 'none';
            quizView.style.display = 'block';
            startNewRound();
        });

        // Global keyboard shortcut listener so we dont have to keep clicking with mouse
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
            return missedKanji.length > 0 ? missedKanji : datasets[currentGrade];
        }
        return datasets[currentGrade] || [];
    }

    function updateBestScore() {
        const key = `kanji_best_${currentGrade}_${currentMode}`;
        const best = localStorage.getItem(key) || 0;
        bestScoreEl.textContent = best;
    }

    let targetScore = 10;
    let totalQuestionsAsked = 0;
    let unsolvedPool = [];

    // starts a brand new round. resets all counters and shuffles pool
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
            cardMainContent.innerHTML = `<div class="definition-display">No Kanji available for review!</div>`;
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

        // if we ran out of items in unsolvedPool before getting 10 right, refill it
        if (unsolvedPool.length === 0) {
            unsolvedPool = shuffleArray([...pool]);
        }

        const currentTarget = unsolvedPool.shift();

        // Pick 4 distractors from pool (make sure distractor is not same as target!)
        const distractors = shuffleArray(
            pool.filter(item => item.kanji !== currentTarget.kanji)
        ).slice(0, 4);

        const options = shuffleArray([currentTarget, ...distractors]);

        optionsGrid.innerHTML = '';

        if (currentMode === 'kanjiToDef' || currentMode === 'weak') {
            // Display Kanji, Pick Definition
            cardMainContent.innerHTML = `<div class="kanji-display">${currentTarget.kanji}</div>`;
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.dataset.kanji = opt.kanji;
                btn.innerHTML = `<span class="key-badge">${idx + 1}</span> <span>${opt.definition}</span>`;
                btn.addEventListener('click', () => handleAnswer(opt.kanji === currentTarget.kanji, btn, currentTarget));
                optionsGrid.appendChild(btn);
            });
        } else if (currentMode === 'defToKanji') {
            // Display Definition, Pick Kanji
            cardMainContent.innerHTML = `<div class="definition-display">${currentTarget.definition}</div>`;
            options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn kanji-opt';
                btn.dataset.kanji = opt.kanji;
                btn.innerHTML = `<span class="key-badge">${idx + 1}</span> <span>${opt.kanji}</span>`;
                btn.addEventListener('click', () => handleAnswer(opt.kanji === currentTarget.kanji, btn, currentTarget));
                optionsGrid.appendChild(btn);
            });
        }
    }

    // answer handler. locks clicking so user cant double-click and skip questions by mistake
    function handleAnswer(isCorrect, selectedBtn, targetKanjiItem) {
        if (isAnsweringLocked) return;
        isAnsweringLocked = true;

        if (isCorrect) {
            selectedBtn.classList.add('correct');
            currentScore++;
            currentScoreEl.textContent = currentScore;

            // Record correctly guessed kanji and render inside the question card
            correctlyGuessedThisRound.push(targetKanjiItem);
            renderCorrectChip(targetKanjiItem);

            // Advance immediately on correct answer
            advanceQuestion();
        } else {
            selectedBtn.classList.add('incorrect');

            // Record in missed kanji list & re-enqueue for extra practice
            addMissedKanji(targetKanjiItem);
            unsolvedPool.push(targetKanjiItem);
            renderMissedChip(targetKanjiItem);

            // Highlight correct button so user sees what it was
            const buttons = Array.from(optionsGrid.children);
            const correctBtn = buttons.find(b => b.dataset.kanji === targetKanjiItem.kanji);

            if (correctBtn) {
                correctBtn.classList.add('correct');
            }

            // Exactly 1.0s (1000ms) delay before moving to next question on error (why 1000ms? because 2.5s was way too long)
            setTimeout(advanceQuestion, 1000);
        }
    }

    function renderCorrectChip(item) {
        const badge = document.createElement('div');
        badge.className = 'solved-mini-badge';
        badge.innerHTML = `${item.kanji}<span class="tooltip">${item.definition}</span>`;
        cardSolvedRow.appendChild(badge);
    }

    function renderMissedChip(item) {
        const badge = document.createElement('div');
        badge.className = 'solved-mini-badge incorrect-badge';
        badge.innerHTML = `${item.kanji}<span class="tooltip">${item.definition}</span>`;
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
            modalFeedback.textContent = `🎉 Flawless! 10/10 in 10 questions! 素晴らしい!`;
        } else {
            modalFeedback.textContent = `👍 Completed in ${totalQuestionsAsked} questions (${accuracy}% accuracy)!`;
        }

        // Render modal correct kanji chips
        modalCorrectKanjiGrid.innerHTML = '';
        if (correctlyGuessedThisRound.length === 0) {
            modalCorrectKanjiGrid.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">None this round</span>';
        } else {
            correctlyGuessedThisRound.forEach(item => {
                const chip = document.createElement('div');
                chip.className = 'kanji-chip';
                chip.innerHTML = `${item.kanji}<span class="tooltip">${item.definition}</span>`;
                modalCorrectKanjiGrid.appendChild(chip);
            });
        }

        // Save best score (fewest questions taken to complete 10 correct)
        const key = `kanji_best_${currentGrade}_${currentMode}`;
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
        fcFrontText.textContent = item.kanji;
        fcBackText.textContent = item.definition;

        fcPrevBtn.disabled = flashcardIndex === 0;
        fcNextBtn.disabled = flashcardIndex === pool.length - 1;
    }

    // Helper: Missed Kanji Storage
    function addMissedKanji(item) {
        if (!missedKanji.some(k => k.kanji === item.kanji)) {
            missedKanji.push(item);
            localStorage.setItem('kanji_missed', JSON.stringify(missedKanji));
        }
    }

    // Fisher-Yates shufle algorithm (stole this off stack overflow)
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Start App
    loadData();
})();
