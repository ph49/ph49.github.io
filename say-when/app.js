// Say When! - Game Logic

let EVENT_POOL = [];
let placedEvents = [];
let pendingEvents = [];
let score = 0;
let highScore = 0;
let anachronisms = 0;
let currentCategory = 'lucky-dip';
let selectedEvent = null;

// DOM Elements
const scoreCurrentEl = document.getElementById('score-current');
const scoreHighEl = document.getElementById('score-high');
const livesCountEl = document.getElementById('lives-count');
const nextEventContainerEl = document.getElementById('next-event-container');
const timelineEl = document.getElementById('timeline');
const categorySelectEl = document.getElementById('category-select');

// Audio Context
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'failure') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'gameover') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

// Cookie Helpers
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Load High Score
const savedHighScore = getCookie('saywhenhighscore');
if (savedHighScore) {
    highScore = parseInt(savedHighScore, 10);
    scoreHighEl.textContent = String(highScore).padStart(2, '0');
}

async function loadEvents() {
    try {
        const response = await fetch('events.json?v=' + Date.now());
        EVENT_POOL = await response.json();
    } catch (error) {
        console.error("Failed to load events", error);
        alert("SYSTEM ERROR: FAILED TO LOAD GAME DATA.");
    }
}

function initGame() {
    score = 0;
    anachronisms = 0;
    placedEvents = [];
    pendingEvents = [];
    selectedEvent = null;
    
    scoreCurrentEl.textContent = '00';
    livesCountEl.textContent = '0/3';
    
    // Filter events by category
    let availableEvents = [];
    if (currentCategory === 'lucky-dip') {
        availableEvents = [...EVENT_POOL];
    } else {
        availableEvents = EVENT_POOL.filter(e => e.category === currentCategory);
    }
    
    if (availableEvents.length === 0) {
        alert("NO EVENTS FOUND FOR THIS CATEGORY.");
        return;
    }
    
    // Pick random start event
    const startIndex = Math.floor(Math.random() * availableEvents.length);
    const startEvent = availableEvents.splice(startIndex, 1)[0];
    placedEvents.push(startEvent);
    
    // Fill pending
    fillPending(availableEvents);
    
    renderGame();
}

function fillPending(availableEvents) {
    while (pendingEvents.length < 2 && availableEvents.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableEvents.length);
        pendingEvents.push(availableEvents.splice(randomIndex, 1)[0]);
    }
}

function renderGame() {
    renderPending();
    renderTimeline();
}

function renderPending() {
    nextEventContainerEl.innerHTML = '';
    pendingEvents.forEach(event => {
        const el = document.createElement('div');
        el.className = `card ${selectedEvent === event ? 'selected' : ''} ${event.isIncorrect ? 'incorrect' : ''}`;
        el.textContent = event.description;
        el.draggable = true;
        
        el.addEventListener('click', () => {
            selectedEvent = event;
            renderPending();
        });
        
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ eventId: event.id, source: 'pending' }));
            setTimeout(() => {
                el.classList.add('dragging');
            }, 0);
        });
        
        el.addEventListener('dragend', (e) => {
            el.classList.remove('dragging');
        });
        
        nextEventContainerEl.appendChild(el);
    });
}

function renderTimeline() {
    timelineEl.innerHTML = '';
    
    // Top drop zone
    timelineEl.appendChild(createDropZone(0));
    
    placedEvents.forEach((event, index) => {
        const item = document.createElement('div');
        item.className = `timeline-item ${event.isIncorrect ? 'incorrect' : ''}`;
        item.dataset.id = event.id;
        
        const descEl = document.createElement('span');
        descEl.textContent = event.description;
        
        const yearEl = document.createElement('span');
        yearEl.textContent = event.isIncorrect ? '????' : (event.displayYear || event.year);
        
        item.appendChild(descEl);
        item.appendChild(yearEl);
        
        timelineEl.appendChild(item);
        
        // Drop zone after item
        timelineEl.appendChild(createDropZone(index + 1));
    });
}

function createDropZone(index) {
    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    
    let label = 'BETWEEN';
    if (index === 0) {
        label = 'BEFORE';
    } else if (index === placedEvents.length) {
        label = 'AFTER';
    }
    
    zone.textContent = `[ ${label} ]`;
    zone.addEventListener('click', (e) => handlePlacement(index, e));
    
    // Drag and Drop
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    zone.addEventListener('dragenter', (e) => {
        zone.classList.add('hovered');
    });
    
    zone.addEventListener('dragleave', (e) => {
        zone.classList.remove('hovered');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('hovered');
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.source === 'pending') {
            const event = pendingEvents.find(ev => ev.id === data.eventId);
            if (event) {
                selectedEvent = event;
                handlePlacement(index, e);
            }
        }
    });
    
    return zone;
}

function handlePlacement(index, clickEvent) {
    if (!selectedEvent) {
        alert("SELECT AN EVENT FIRST.");
        return;
    }
    
    const eventToPlace = selectedEvent;
    
    // Validate
    const correct = validatePlacement(eventToPlace, index);
    
    // Insert into timeline
    placedEvents.splice(index, 0, eventToPlace);
    
    // Remove from pending
    pendingEvents = pendingEvents.filter(e => e !== eventToPlace);
    selectedEvent = null;
    
    // Record cursor position if event provided
    let cursorY = null;
    let containerRect = null;
    if (clickEvent) {
        containerRect = timelineEl.getBoundingClientRect();
        cursorY = clickEvent.clientY - containerRect.top;
    }
    
    if (correct) {
        playSound('success');
        eventToPlace.isIncorrect = false; // Reset incorrect state
        score++;
        scoreCurrentEl.textContent = String(score).padStart(2, '0');
        if (score > highScore) {
            highScore = score;
            scoreHighEl.textContent = String(highScore).padStart(2, '0');
            setCookie('saywhenhighscore', highScore, 365);
        }
    } else {
        playSound('failure');
        eventToPlace.isIncorrect = true;
        anachronisms++;
        livesCountEl.textContent = `${anachronisms}/3`;
        
        if (anachronisms === 3) {
            playSound('gameover');
            
            const modal = document.getElementById('game-over-modal');
            const list = document.getElementById('outstanding-cards-list');
            list.innerHTML = '';
            
            const allOutstanding = [...pendingEvents, eventToPlace];
            const sortedAll = allOutstanding.sort((a, b) => a.year - b.year);
            sortedAll.forEach(ev => {
                const li = document.createElement('li');
                li.textContent = `${ev.description}: ${ev.displayYear || ev.year}`;
                list.appendChild(li);
            });
            
            modal.style.display = 'flex';
            return;
        }
        
        // Automatic return logic
        setTimeout(() => {
            placedEvents = placedEvents.filter(e => e !== eventToPlace);
            pendingEvents.push(eventToPlace);
            renderGame();
            
            const cards = nextEventContainerEl.querySelectorAll('.card');
            const newCard = Array.from(cards).find(c => c.textContent === eventToPlace.description);
            if (newCard) {
                newCard.classList.add('returning');
                setTimeout(() => newCard.classList.remove('returning'), 500);
            }
        }, 1000);
    }
    
    // Refill pending
    let availableEvents = [];
    if (currentCategory === 'lucky-dip') {
        availableEvents = [...EVENT_POOL];
    } else {
        availableEvents = EVENT_POOL.filter(e => e.category === currentCategory);
    }
    const usedIds = new Set([...placedEvents, ...pendingEvents].map(e => e.id));
    availableEvents = availableEvents.filter(e => !usedIds.has(e.id));
    
    fillPending(availableEvents);
    renderGame();
    
    // Scroll manipulation
    if (clickEvent && cursorY !== null) {
        const newItemEl = timelineEl.querySelector(`.timeline-item[data-id="${eventToPlace.id}"]`);
        if (newItemEl) {
            const cardRect = newItemEl.getBoundingClientRect();
            const cardCenterOffset = cardRect.height / 2;
            
            const currentOffset = cardRect.top - containerRect.top;
            const targetOffset = cursorY - cardCenterOffset;
            
            timelineEl.scrollTop += (currentOffset - targetOffset);
        }
    }
}

function validatePlacement(event, index) {
    // Find closest correct neighbors
    let prevEvent = null;
    for (let i = index - 1; i >= 0; i--) {
        if (!placedEvents[i].isIncorrect) {
            prevEvent = placedEvents[i];
            break;
        }
    }
    
    let nextEvent = null;
    for (let i = index; i < placedEvents.length; i++) {
        if (!placedEvents[i].isIncorrect) {
            nextEvent = placedEvents[i];
            break;
        }
    }
    
    if (prevEvent && event.year < prevEvent.year) return false;
    if (nextEvent && event.year > nextEvent.year) return false;
    
    return true;
}

// Event Listeners
categorySelectEl.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    window.location.hash = `c=${currentCategory}`;
    initGame();
});

// Modal "New Game" button
const newGameBtnEl = document.getElementById('new-game-btn');
if (newGameBtnEl) {
    newGameBtnEl.addEventListener('click', () => {
        const modal = document.getElementById('game-over-modal');
        modal.style.display = 'none';
        initGame();
    });
}

// Reset High Score
const bestScoreContainerEl = document.getElementById('best-score-container');
if (bestScoreContainerEl) {
    bestScoreContainerEl.addEventListener('click', () => {
        const modal = document.getElementById('reset-score-modal');
        modal.style.display = 'flex';
    });
}

// Modal "Yes" button for reset
const confirmResetBtnEl = document.getElementById('confirm-reset-btn');
if (confirmResetBtnEl) {
    confirmResetBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        highScore = 0;
        scoreHighEl.textContent = '00';
        setCookie('saywhenhighscore', highScore, 365);
        const modal = document.getElementById('reset-score-modal');
        modal.style.display = 'none';
    });
}

// Modal "No" button for reset
const cancelResetBtnEl = document.getElementById('cancel-reset-btn');
if (cancelResetBtnEl) {
    cancelResetBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const modal = document.getElementById('reset-score-modal');
        modal.style.display = 'none';
    });
}



// Start
loadEvents().then(() => {
    const hash = window.location.hash;
    if (hash) {
        const match = hash.match(/c=([^&]+)/i);
        if (match) {
            const cat = match[1].toLowerCase();
            currentCategory = cat;
            if (categorySelectEl) {
                categorySelectEl.value = cat;
            }
        }
    }
    initGame();
});
