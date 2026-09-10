/**
 * Letter Ladder — Add a Letter Game Engine
 * ph49.github.io
 */

(function () {
    'use strict';

    // Game State
    const state = {
        mode: localStorage.getItem('letter_game_mode') || 'anagram', // 'anagram' | 'inorder'
        soundEnabled: localStorage.getItem('letter_game_sound') !== 'false',
        starters: [],
        wordList: [],
        wordSet: new Set(),
        wordRank: new Map(),
        sigToWords: new Map(),
        
        currentWord: '',
        chain: [], // Array of { word, source: 'start'|'user'|'ai', addedLetter, addedIndex }
        isRevealing: false,
        revealInterval: null,
        
        longestPossible: 0,
        optimalSubChain: [],
        
        bestScores: {
            anagram: parseInt(localStorage.getItem('letter_game_best_anagram') || '0', 10),
            inorder: parseInt(localStorage.getItem('letter_game_best_inorder') || '0', 10)
        }
    };

    // Memoization caches for solvers
    const memoAnagram = new Map();
    const memoInOrder = new Map();

    // DOM Elements
    const elements = {
        currentLength: document.getElementById('stat-current-len'),
        longestChain: document.getElementById('stat-longest-chain'),
        longestSubtext: document.getElementById('stat-longest-subtext'),
        bestScore: document.getElementById('stat-best-score'),
        ladderList: document.getElementById('ladder-list'),
        ladderSection: document.getElementById('ladder-section'),
        wordInput: document.getElementById('word-input'),
        submitBtn: document.getElementById('submit-btn'),
        feedbackMsg: document.getElementById('feedback-msg'),
        btnNextWord: document.getElementById('btn-next-word'),
        btnShowMe: document.getElementById('btn-show-me'),
        btnHint: document.getElementById('btn-hint'),
        btnUndo: document.getElementById('btn-undo'),
        btnNew: document.getElementById('btn-new'),
        btnCustom: document.getElementById('btn-custom'),
        soundToggle: document.getElementById('sound-toggle'),
        soundIcon: document.getElementById('sound-icon'),
        modeAnagram: document.getElementById('mode-anagram'),
        modeInorder: document.getElementById('mode-inorder'),
        modalHelp: document.getElementById('modal-help'),
        modalCustom: document.getElementById('modal-custom'),
        customWordInput: document.getElementById('custom-word-input'),
        customWordSubmit: document.getElementById('custom-word-submit')
    };

    // Sound Synthesizer (Web Audio API)
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx && typeof AudioContext !== 'undefined') {
            audioCtx = new AudioContext();
        } else if (!audioCtx && typeof webkitAudioContext !== 'undefined') {
            audioCtx = new webkitAudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    const sound = {
        playTone(freq, type, duration, gainLevel = 0.1) {
            if (!state.soundEnabled) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(gainLevel, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch (e) {
                // Ignore audio errors
            }
        },
        type() {
            this.playTone(480 + Math.random() * 40, 'sine', 0.04, 0.04);
        },
        accept() {
            if (!state.soundEnabled) return;
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            [523.25, 659.25, 783.99].forEach((freq, idx) => {
                setTimeout(() => this.playTone(freq, 'triangle', 0.18, 0.12), idx * 60);
            });
        },
        error() {
            this.playTone(160, 'sawtooth', 0.22, 0.14);
        },
        step() {
            this.playTone(600 + Math.random() * 80, 'sine', 0.1, 0.08);
        },
        fanfare() {
            if (!state.soundEnabled) return;
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                setTimeout(() => this.playTone(freq, 'sine', 0.35, 0.15), idx * 90);
            });
        }
    };

    // Initialize Dictionary & Maps
    function initData() {
        if (!window.LETTER_GAME_DATA) {
            showFeedback('Dictionary data could not be loaded.', 'error');
            return false;
        }
        state.starters = window.LETTER_GAME_DATA.starters || [];
        state.wordList = window.LETTER_GAME_DATA.words ? window.LETTER_GAME_DATA.words.split('\n') : [];
        state.wordSet = new Set(state.wordList);

        for (let i = 0; i < state.wordList.length; i++) {
            const w = state.wordList[i];
            state.wordRank.set(w, i);

            const sig = w.split('').sort().join('');
            let arr = state.sigToWords.get(sig);
            if (!arr) {
                arr = [];
                state.sigToWords.set(sig, arr);
            }
            arr.push(w);
        }

        // Starters sanity check
        if (state.starters.length === 0) {
            state.starters = ['cat', 'dog', 'sea', 'tea', 'art', 'sun', 'red', 'car', 'win', 'run', 'pen', 'pie', 'cup', 'bed'];
        }
        return true;
    }

    // Solvers
    function getLongestAnagramFrom(sig) {
        if (memoAnagram.has(sig)) return memoAnagram.get(sig);

        let bestLen = sig.length;
        let bestNextSig = null;
        let bestCost = 999999999;

        if (sig.length < 12) {
            for (let code = 97; code <= 122; code++) {
                const c = String.fromCharCode(code);
                const nextSig = (sig + c).split('').sort().join('');
                const cands = state.sigToWords.get(nextSig);
                if (cands && cands.length > 0) {
                    const sub = getLongestAnagramFrom(nextSig);
                    const cost = (state.wordRank.get(cands[0]) || 50000) + sub.cost;
                    if (sub.bestLen > bestLen) {
                        bestLen = sub.bestLen;
                        bestNextSig = nextSig;
                        bestCost = cost;
                    } else if (sub.bestLen === bestLen && cost < bestCost) {
                        bestNextSig = nextSig;
                        bestCost = cost;
                    }
                }
            }
        }
        const res = { bestLen, bestNextSig, cost: bestNextSig ? bestCost : 0 };
        memoAnagram.set(sig, res);
        return res;
    }

    function getOptimalAnagramChain(currentWord) {
        const currentSig = currentWord.split('').sort().join('');
        const { bestLen } = getLongestAnagramFrom(currentSig);
        
        const chain = [];
        let currSig = currentSig;
        while (true) {
            const node = getLongestAnagramFrom(currSig);
            if (!node.bestNextSig) break;
            const nextWords = state.sigToWords.get(node.bestNextSig);
            const chosenWord = nextWords[0];
            
            // Determine added letter relative to the previous word in chain
            const prevWord = chain.length === 0 ? currentWord : chain[chain.length - 1].word;
            const validation = validateAnagram(prevWord, chosenWord);
            
            chain.push({
                word: chosenWord,
                source: 'ai',
                addedLetter: validation.addedLetter || ''
            });
            currSig = node.bestNextSig;
        }
        return { maxLen: bestLen, subChain: chain };
    }

    function getLongestInOrderFrom(w) {
        if (memoInOrder.has(w)) return memoInOrder.get(w);

        let bestLen = w.length;
        let bestNextWord = null;
        let bestCost = 999999999;

        if (w.length < 12) {
            for (let i = 0; i <= w.length; i++) {
                for (let code = 97; code <= 122; code++) {
                    const c = String.fromCharCode(code);
                    const cand = w.slice(0, i) + c + w.slice(i);
                    if (state.wordSet.has(cand)) {
                        const sub = getLongestInOrderFrom(cand);
                        const cost = (state.wordRank.get(cand) || 50000) + sub.cost;
                        if (sub.bestLen > bestLen) {
                            bestLen = sub.bestLen;
                            bestNextWord = cand;
                            bestCost = cost;
                        } else if (sub.bestLen === bestLen && cost < bestCost) {
                            bestNextWord = cand;
                            bestCost = cost;
                        }
                    }
                }
            }
        }
        const res = { bestLen, bestNextWord, cost: bestNextWord ? bestCost : 0 };
        memoInOrder.set(w, res);
        return res;
    }

    function getOptimalInOrderChain(currentWord) {
        const { bestLen } = getLongestInOrderFrom(currentWord);
        const chain = [];
        let currWord = currentWord;
        while (true) {
            const node = getLongestInOrderFrom(currWord);
            if (!node.bestNextWord) break;
            const nextWord = node.bestNextWord;
            const val = validateInOrder(currWord, nextWord);
            chain.push({
                word: nextWord,
                source: 'ai',
                addedLetter: val.addedLetter,
                addedIndex: val.addedIndex
            });
            currWord = nextWord;
        }
        return { maxLen: bestLen, subChain: chain };
    }

    // Validation
    function validateAnagram(prevWord, newWord) {
        if (newWord.length !== prevWord.length + 1) {
            return { valid: false, error: `Word must be exactly ${prevWord.length + 1} letters long.` };
        }
        if (!state.wordSet.has(newWord)) {
            return { valid: false, error: `"${newWord.toUpperCase()}" is not in the dictionary.` };
        }
        const prevChars = prevWord.split('').sort();
        const newChars = newWord.split('').sort();
        let pi = 0;
        let addedLetter = null;
        for (let ni = 0; ni < newChars.length; ni++) {
            if (pi < prevChars.length && newChars[ni] === prevChars[pi]) {
                pi++;
            } else if (addedLetter === null) {
                addedLetter = newChars[ni];
            } else {
                return { valid: false, error: `Must contain all letters of "${prevWord.toUpperCase()}" plus 1 new letter.` };
            }
        }
        return { valid: true, addedLetter };
    }

    function validateInOrder(prevWord, newWord) {
        if (newWord.length !== prevWord.length + 1) {
            return { valid: false, error: `Word must be exactly ${prevWord.length + 1} letters long.` };
        }
        if (!state.wordSet.has(newWord)) {
            return { valid: false, error: `"${newWord.toUpperCase()}" is not in the dictionary.` };
        }
        let pi = 0;
        let addedIndex = -1;
        for (let ni = 0; ni < newWord.length; ni++) {
            if (pi < prevWord.length && newWord[ni] === prevWord[pi]) {
                pi++;
            } else if (addedIndex === -1) {
                addedIndex = ni;
            } else {
                return { valid: false, error: `Must keep letters of "${prevWord.toUpperCase()}" in order and insert 1 letter.` };
            }
        }
        if (addedIndex === -1) {
            addedIndex = newWord.length - 1;
        }
        return { valid: true, addedLetter: newWord[addedIndex], addedIndex };
    }

    // Highlight helper for anagram mode: find which letter in newWord is the added one
    function findAddedLetterInfo(prevWord, newWord) {
        const prevCount = {};
        for (let c of prevWord) prevCount[c] = (prevCount[c] || 0) + 1;
        
        const newCount = {};
        for (let c of newWord) newCount[c] = (newCount[c] || 0) + 1;

        let addedChar = null;
        for (let c in newCount) {
            if (!prevCount[c] || newCount[c] > prevCount[c]) {
                addedChar = c;
                break;
            }
        }

        // Highlight the first instance of addedChar that wasn't matched
        let highlightedIndex = -1;
        let matched = 0;
        const targetOccurrences = prevCount[addedChar] || 0;
        for (let i = 0; i < newWord.length; i++) {
            if (newWord[i] === addedChar) {
                if (matched === targetOccurrences) {
                    highlightedIndex = i;
                    break;
                }
                matched++;
            }
        }
        return { letter: addedChar, index: highlightedIndex };
    }

    // UI Updates
    function updateStats() {
        const currentLen = state.chain.length;
        elements.currentLength.textContent = currentLen;

        const maxTotal = state.longestPossible;
        elements.longestChain.textContent = maxTotal;

        const remainingSteps = Math.max(0, maxTotal - currentLen);
        if (remainingSteps === 0) {
            elements.longestSubtext.textContent = 'Maximum possible chain reached!';
        } else {
            elements.longestSubtext.textContent = `+${remainingSteps} more word${remainingSteps === 1 ? '' : 's'} can be built`;
        }

        const best = state.bestScores[state.mode] || 0;
        elements.bestScore.textContent = best;

        // Input placeholder
        const nextLen = state.currentWord.length + 1;
        elements.wordInput.placeholder = `Type a ${nextLen}-letter word...`;

        // Button states
        elements.btnNextWord.disabled = state.isRevealing || remainingSteps === 0;
        elements.btnShowMe.disabled = state.isRevealing || remainingSteps === 0;
        elements.btnHint.disabled = state.isRevealing || remainingSteps === 0;
        elements.btnUndo.disabled = state.isRevealing || state.chain.length <= 1;
    }

    function renderLadder() {
        elements.ladderList.innerHTML = '';
        state.chain.forEach((item, idx) => {
            const rung = document.createElement('div');
            rung.className = `ladder-rung ${item.source}-rung`;
            
            const meta = document.createElement('div');
            meta.className = 'rung-meta';

            const stepNum = document.createElement('span');
            stepNum.className = 'rung-step';
            stepNum.textContent = idx + 1;

            const badge = document.createElement('span');
            badge.className = `rung-source ${item.source}`;
            badge.textContent = item.source === 'start' ? 'Start' : (item.source === 'user' ? 'You' : 'AI');

            meta.appendChild(stepNum);
            meta.appendChild(badge);

            const tiles = document.createElement('div');
            tiles.className = 'word-tiles';

            // Render each letter
            for (let i = 0; i < item.word.length; i++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.textContent = item.word[i];
                if (item.addedIndex === i || (item.source !== 'start' && item.addedLetter === item.word[i] && item.addedIndex === undefined)) {
                    tile.classList.add('new-letter');
                }
                tiles.appendChild(tile);
            }

            const rightSide = document.createElement('div');
            rightSide.style.display = 'flex';
            rightSide.style.alignItems = 'center';
            rightSide.style.gap = '0.75rem';

            if (item.addedLetter) {
                const addedTag = document.createElement('span');
                addedTag.className = 'added-badge';
                addedTag.textContent = `+${item.addedLetter.toUpperCase()}`;
                rightSide.appendChild(addedTag);
            }
            rightSide.appendChild(tiles);

            rung.appendChild(meta);
            rung.appendChild(rightSide);
            elements.ladderList.appendChild(rung);
        });

        // Scroll to bottom smoothly
        elements.ladderSection.scrollTop = elements.ladderSection.scrollHeight;
    }

    function showFeedback(text, type = 'info') {
        elements.feedbackMsg.textContent = text;
        elements.feedbackMsg.className = `feedback-msg ${type}`;
        if (type === 'error') {
            elements.wordInput.classList.remove('shake');
            void elements.wordInput.offsetWidth; // trigger reflow
            elements.wordInput.classList.add('shake');
        }
    }

    // Recalculate optimal path from current word
    function recalculateOptimal() {
        if (state.mode === 'anagram') {
            const res = getOptimalAnagramChain(state.currentWord);
            state.longestPossible = res.maxLen;
            state.optimalSubChain = res.subChain;
        } else {
            const res = getOptimalInOrderChain(state.currentWord);
            state.longestPossible = res.maxLen;
            state.optimalSubChain = res.subChain;
        }
        updateStats();
    }

    // Start a game with given word
    function startGame(starterWord) {
        if (state.revealInterval) {
            clearInterval(state.revealInterval);
            state.revealInterval = null;
        }
        state.isRevealing = false;
        state.currentWord = starterWord.toLowerCase();
        state.chain = [{
            word: state.currentWord,
            source: 'start'
        }];

        recalculateOptimal();
        renderLadder();
        elements.wordInput.value = '';
        elements.wordInput.focus();
        showFeedback(`Started with "${state.currentWord.toUpperCase()}". Build the chain!`, 'info');
    }

    // Submit player guess
    function submitWord() {
        if (state.isRevealing) return;
        const val = elements.wordInput.value.trim().toLowerCase();
        if (!val) return;

        const prevWord = state.currentWord;
        let validation;

        if (state.mode === 'anagram') {
            validation = validateAnagram(prevWord, val);
        } else {
            validation = validateInOrder(prevWord, val);
        }

        if (!validation.valid) {
            sound.error();
            showFeedback(validation.error, 'error');
            return;
        }

        sound.accept();
        let letterInfo;
        if (state.mode === 'anagram') {
            letterInfo = findAddedLetterInfo(prevWord, val);
        } else {
            letterInfo = { letter: validation.addedLetter, index: validation.addedIndex };
        }

        state.currentWord = val;
        state.chain.push({
            word: val,
            source: 'user',
            addedLetter: letterInfo.letter,
            addedIndex: letterInfo.index
        });

        // Update best score
        const currentLen = state.chain.length;
        if (currentLen > state.bestScores[state.mode]) {
            state.bestScores[state.mode] = currentLen;
            localStorage.setItem(`letter_game_best_${state.mode}`, currentLen);
            sound.fanfare();
            showFeedback(`🎉 New Personal Best: ${currentLen} words!`, 'success');
        } else {
            showFeedback(`Nice! Added "${letterInfo.letter.toUpperCase()}" to make "${val.toUpperCase()}".`, 'success');
        }

        recalculateOptimal();
        renderLadder();
        elements.wordInput.value = '';
        elements.wordInput.focus();

        if (state.chain.length === state.longestPossible) {
            sound.fanfare();
            showFeedback(`🏆 Perfect Run! You reached the absolute longest chain (${state.longestPossible} words)!`, 'success');
        }
    }

    // Show just the one next word
    function showNextWord() {
        if (state.isRevealing || state.optimalSubChain.length === 0) return;

        const nextStep = state.optimalSubChain[0];
        const prevWord = state.currentWord;
        state.currentWord = nextStep.word;

        let letterInfo;
        if (state.mode === 'anagram') {
            letterInfo = findAddedLetterInfo(prevWord, nextStep.word);
        } else {
            letterInfo = { letter: nextStep.addedLetter, index: nextStep.addedIndex };
        }

        state.chain.push({
            word: nextStep.word,
            source: 'ai',
            addedLetter: letterInfo.letter,
            addedIndex: letterInfo.index
        });

        sound.step();
        recalculateOptimal();
        renderLadder();
        elements.wordInput.value = '';
        elements.wordInput.focus();

        if (state.chain.length === state.longestPossible) {
            sound.fanfare();
            showFeedback(`Reached the end of the chain (${state.chain.length} words)!`, 'info');
        } else {
            showFeedback(`Revealed "${nextStep.word.toUpperCase()}" (+${letterInfo.letter.toUpperCase()}). Keep going!`, 'info');
        }
    }

    // "Show Me" optimal chain generator
    function showMe() {
        if (state.isRevealing) return;
        if (state.optimalSubChain.length === 0) {
            showFeedback('No further words can be added from this point.', 'info');
            return;
        }

        state.isRevealing = true;
        updateStats();
        elements.wordInput.disabled = true;
        elements.submitBtn.disabled = true;

        showFeedback('Computing and filling system chain...', 'info');

        let index = 0;
        const subChain = [...state.optimalSubChain];

        state.revealInterval = setInterval(() => {
            if (index >= subChain.length) {
                clearInterval(state.revealInterval);
                state.revealInterval = null;
                state.isRevealing = false;
                elements.wordInput.disabled = false;
                elements.submitBtn.disabled = false;
                updateStats();
                showFeedback(`Completed! Longest chain reached: ${state.chain.length} words.`, 'info');
                return;
            }

            const nextStep = subChain[index];
            const prevWord = state.currentWord;
            state.currentWord = nextStep.word;

            let letterInfo;
            if (state.mode === 'anagram') {
                letterInfo = findAddedLetterInfo(prevWord, nextStep.word);
            } else {
                letterInfo = { letter: nextStep.addedLetter, index: nextStep.addedIndex };
            }

            state.chain.push({
                word: nextStep.word,
                source: 'ai',
                addedLetter: letterInfo.letter,
                addedIndex: letterInfo.index
            });

            sound.step();
            renderLadder();
            elements.currentLength.textContent = state.chain.length;
            index++;
        }, 320);
    }

    // Hint: reveals the added letter of the next optimal step
    function giveHint() {
        if (state.isRevealing || state.optimalSubChain.length === 0) return;
        const nextWord = state.optimalSubChain[0].word;
        const prevWord = state.currentWord;
        let addedChar = '';
        if (state.mode === 'anagram') {
            addedChar = findAddedLetterInfo(prevWord, nextWord).letter;
        } else {
            addedChar = state.optimalSubChain[0].addedLetter;
        }

        showFeedback(`💡 Hint: Try adding the letter "${addedChar.toUpperCase()}"!`, 'info');
        sound.accept();
    }

    // Undo last step
    function undo() {
        if (state.isRevealing || state.chain.length <= 1) return;
        state.chain.pop();
        state.currentWord = state.chain[state.chain.length - 1].word;
        recalculateOptimal();
        renderLadder();
        elements.wordInput.value = '';
        elements.wordInput.focus();
        showFeedback('Undid last word.', 'info');
        sound.step();
    }

    // Pick new random starter
    function newGame() {
        const pool = state.starters;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        startGame(pick);
    }

    // Custom starter submission
    function startCustom() {
        const custom = elements.customWordInput.value.trim().toLowerCase();
        if (custom.length !== 3) {
            alert('Starting word must be exactly 3 letters.');
            return;
        }
        if (!state.wordSet.has(custom)) {
            alert(`"${custom.toUpperCase()}" is not a recognized 3-letter word in the dictionary.`);
            return;
        }
        elements.modalCustom.classList.remove('open');
        startGame(custom);
    }

    // Switch game mode
    function setMode(newMode) {
        if (state.mode === newMode) return;
        state.mode = newMode;
        localStorage.setItem('letter_game_mode', newMode);

        elements.modeAnagram.classList.toggle('active', newMode === 'anagram');
        elements.modeInorder.classList.toggle('active', newMode === 'inorder');

        // Restart current game with current starter in new mode
        const starter = state.chain.length > 0 ? state.chain[0].word : state.starters[0];
        startGame(starter);
    }

    // Event Listeners
    function setupEvents() {
        elements.submitBtn.addEventListener('click', submitWord);
        elements.wordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitWord();
            } else if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
                sound.type();
            }
        });

        elements.btnNextWord.addEventListener('click', showNextWord);
        elements.btnShowMe.addEventListener('click', showMe);
        elements.btnHint.addEventListener('click', giveHint);
        elements.btnUndo.addEventListener('click', undo);
        elements.btnNew.addEventListener('click', newGame);

        elements.btnCustom.addEventListener('click', () => {
            elements.modalCustom.classList.add('open');
            elements.customWordInput.value = '';
            elements.customWordInput.focus();
        });

        elements.customWordSubmit.addEventListener('click', startCustom);
        elements.customWordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') startCustom();
        });

        // Mode toggles
        elements.modeAnagram.addEventListener('click', () => setMode('anagram'));
        elements.modeInorder.addEventListener('click', () => setMode('inorder'));

        // Sound toggle
        elements.soundToggle.addEventListener('click', () => {
            state.soundEnabled = !state.soundEnabled;
            localStorage.setItem('letter_game_sound', state.soundEnabled);
            elements.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
        });
        elements.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';

        // Help Modal
        document.getElementById('btn-help').addEventListener('click', () => {
            elements.modalHelp.classList.add('open');
        });
        document.getElementById('modal-help-close').addEventListener('click', () => {
            elements.modalHelp.classList.remove('open');
        });
        document.getElementById('modal-custom-close').addEventListener('click', () => {
            elements.modalCustom.classList.remove('open');
        });

        // Close modals on backdrop click
        [elements.modalHelp, elements.modalCustom].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('open');
            });
        });

        // Keyboard shortcuts: Escape closes modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                elements.modalHelp.classList.remove('open');
                elements.modalCustom.classList.remove('open');
            }
        });
    }

    // Initialize
    window.addEventListener('DOMContentLoaded', () => {
        if (!initData()) return;
        
        // Restore mode toggle UI
        elements.modeAnagram.classList.toggle('active', state.mode === 'anagram');
        elements.modeInorder.classList.toggle('active', state.mode === 'inorder');

        setupEvents();

        // Start initial game
        newGame();
    });

})();
