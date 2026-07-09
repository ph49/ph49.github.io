(function () {
    // State
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
    let isAnsweringLocked = false;
    let missedKanji = JSON.parse(localStorage.getItem('kanji_missed') || '[]');

    // Flashcard state
    let flashcardIndex = 0;

    // DOM Elements
    const gradeTabs = document.getElementById('grade-tabs');
    const modeTabs = document.getElementById('mode-tabs');
    const quizView = document.getElementById('quiz-view');
    const flashcardView = document.getElementById('flashcard-view');
    const questionNumEl = document.getElementById('question-num');
    const currentScoreEl = document.getElementById('current-score');
    const bestScoreEl = document.getElementById('best-score');
    const questionCard = document.getElementById('question-card');
    const questionTextEl = document.getElementById('question-text');
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
    const modalPlayAgain = document.getElementById('modal-play-again');
    const modalReviewWeak = document.getElementById('modal-review-weak');

    // Load Datasets
    async function loadData() {
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
        // Grade selector
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

        // Modal actions
        modalPlayAgain.addEventListener('click', () => {
            resultsModal.classList.remove('active');
            startNewRound();
        });

        modalReviewWeak.addEventListener('click', () => {
            resultsModal.classList.remove('active');
            // Switch to Weak Mode
            modeTabs.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.mode === 'weak');
            });
            currentMode = 'weak';
            flashcardView.style.display = 'none';
            quizView.style.display = 'block';
            startNewRound();
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

    function startNewRound() {
        isAnsweringLocked = false;
        currentScore = 0;
        currentQuestionIndex = 0;
        currentScoreEl.textContent = '0';
        questionNumEl.textContent = '1';

        const pool = getActiveDataset();
        if (!pool || pool.length === 0) {
            questionTextEl.textContent = "No Kanji available for review!";
            optionsGrid.innerHTML = `<button class="primary-btn" onclick="location.reload()">Reset</button>`;
            return;
        }

        // Shuffle pool and select 10 (or pool.length if fewer than 10)
        const shuffled = shuffleArray([...pool]);
        roundQuestions = shuffled.slice(0, Math.min(10, shuffled.length));

        renderQuestion();
    }

    function renderQuestion() {
        isAnsweringLocked = false;
        questionNumEl.textContent = currentQuestionIndex + 1;
        const currentTarget = roundQuestions[currentQuestionIndex];
        const pool = datasets[currentGrade];

        // Pick 4 distractors from pool
        const distractors = shuffleArray(
            pool.filter(item => item.kanji !== currentTarget.kanji)
        ).slice(0, 4);

        const options = shuffleArray([currentTarget, ...distractors]);

        optionsGrid.innerHTML = '';

        if (currentMode === 'kanjiToDef' || currentMode === 'weak') {
            // Display Kanji, Pick Definition
            questionCard.innerHTML = `<div class="kanji-display">${currentTarget.kanji}</div>`;
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = opt.definition;
                btn.addEventListener('click', () => handleAnswer(opt.kanji === currentTarget.kanji, btn, currentTarget));
                optionsGrid.appendChild(btn);
            });
        } else if (currentMode === 'defToKanji') {
            // Display Definition, Pick Kanji
            questionCard.innerHTML = `<div class="definition-display">${currentTarget.definition}</div>`;
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn kanji-opt';
                btn.textContent = opt.kanji;
                btn.addEventListener('click', () => handleAnswer(opt.kanji === currentTarget.kanji, btn, currentTarget));
                optionsGrid.appendChild(btn);
            });
        }
    }

    function handleAnswer(isCorrect, selectedBtn, targetKanjiItem) {
        if (isAnsweringLocked) return;
        isAnsweringLocked = true;

        if (isCorrect) {
            selectedBtn.classList.add('correct');
            currentScore++;
            currentScoreEl.textContent = currentScore;
            // Advance after very brief feedback
            setTimeout(advanceQuestion, 300);
        } else {
            selectedBtn.classList.add('incorrect');

            // Record in missed kanji list
            addMissedKanji(targetKanjiItem);

            // Highlight correct button
            const buttons = Array.from(optionsGrid.children);
            const correctBtn = buttons.find(b => {
                if (currentMode === 'kanjiToDef' || currentMode === 'weak') {
                    return b.textContent === targetKanjiItem.definition;
                } else {
                    return b.textContent === targetKanjiItem.kanji;
                }
            });

            if (correctBtn) {
                correctBtn.classList.add('correct');
            }

            // Exactly 0.5s (500ms) delay before moving to next question
            setTimeout(advanceQuestion, 500);
        }
    }

    function advanceQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < roundQuestions.length) {
            renderQuestion();
        } else {
            finishRound();
        }
    }

    function finishRound() {
        const total = roundQuestions.length;
        modalScore.textContent = `${currentScore}/${total}`;

        const percentage = Math.round((currentScore / total) * 100);
        if (percentage === 100) {
            modalFeedback.textContent = '🎉 Perfect score! 素晴らしい!';
        } else if (percentage >= 70) {
            modalFeedback.textContent = '👍 Well done! Great progress!';
        } else {
            modalFeedback.textContent = '💪 Keep practicing! You will get better!';
        }

        // Save best score
        const key = `kanji_best_${currentGrade}_${currentMode}`;
        const previousBest = parseInt(localStorage.getItem(key) || '0', 10);
        if (currentScore > previousBest) {
            localStorage.setItem(key, currentScore);
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

    // Helper: Shuffle Array
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
