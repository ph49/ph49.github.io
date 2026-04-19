// Say When! - Game Logic

let EVENT_POOL = [];
let placedEvents = [];
let pendingEvents = [];
let score = 0;
let highScore = 0;
let anachronisms = 0;
let currentCategory = 'lucky-dip';
let selectedEvent = null;

const DEFAULT_SETTINGS = {
    prefixCategory: false,
    monthAccuracy: false,
    darkMode: false,
    pendingCount: 3,
    showEventCounts: false
};

const categoryCounts = {};

const CATEGORY_EMOJIS = {};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getEventDateString(event) {
    if (event.isIncorrect) return '????';
    let str = event.displayYear || String(event.year);
    if (settings.monthAccuracy && event.month !== undefined) {
        str = `${MONTH_NAMES[event.month - 1]} ${str}`;
    }
    return str;
}

let settings = { ...DEFAULT_SETTINGS };

const COOKIE_MAGIC = "V1_";

function loadSettings() {
    const cookie = getCookie('saywhensettings');
    if (cookie) {
        if (cookie.startsWith(COOKIE_MAGIC)) {
            const jsonStr = cookie.substring(COOKIE_MAGIC.length);
            try {
                settings = { ...DEFAULT_SETTINGS, ...JSON.parse(jsonStr) };
            } catch (e) {
                console.error('Failed to parse settings cookie:', e);
                settings = { ...DEFAULT_SETTINGS };
            }
        } else {
            console.log('Invalid or old version cookie found, ignoring.');
            settings = { ...DEFAULT_SETTINGS };
        }
    }
    applySettings();
}

function saveSettings() {
    const jsonStr = JSON.stringify(settings);
    setCookie('saywhensettings', COOKIE_MAGIC + jsonStr, 365);
}

function applySettings() {
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    const prefixCheck = document.getElementById('setting-prefix-category');
    const monthCheck = document.getElementById('setting-month-accuracy');
    const darkCheck = document.getElementById('setting-dark-mode');
    const countsCheck = document.getElementById('setting-show-event-counts');
    
    if (prefixCheck) prefixCheck.checked = settings.prefixCategory;
    if (monthCheck) monthCheck.checked = settings.monthAccuracy;
    if (darkCheck) darkCheck.checked = settings.darkMode;
    if (countsCheck) countsCheck.checked = settings.showEventCounts;
    
    const slider = document.getElementById('setting-pending-count');
    const valueSpan = document.getElementById('pending-count-value');
    if (slider) {
        slider.value = settings.pendingCount;
        if (valueSpan) valueSpan.textContent = settings.pendingCount;
    }
    
    updateDropdown();
}

function updateDropdown() {
    const options = categorySelectEl.options;
    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const cat = opt.value;
        if (cat !== 'lucky-dip') {
            const emoji = CATEGORY_EMOJIS[cat] || '❓';
            let text = `${emoji} ${cat.toUpperCase().replace('-', ' ')}`;
            if (settings.showEventCounts && categoryCounts[cat] !== undefined) {
                text += ` (${categoryCounts[cat]})`;
            }
            opt.textContent = text;
        }
    }
}



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
        const response = await fetch('events/categories.txt?v=' + Date.now());
        const text = await response.text();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        
        // Clear dynamic options, keep Lucky Dip
        categorySelectEl.innerHTML = '<option value="lucky-dip">🎲 LUCKY DIP</option>';
        
        const promises = lines.map(async (line) => {
            const parts = line.split(/\s+/);
            const file = parts[0];
            const emoji = parts[1] || '❓'; // Fallback
            
            const category = file.replace('.txt', '');
            CATEGORY_EMOJIS[category] = emoji; // Store in map
            
            // Add option to dropdown
            const option = document.createElement('option');
            option.value = category;
            option.textContent = `${emoji} ${category.toUpperCase().replace('-', ' ')}`;
            categorySelectEl.appendChild(option);
            
            const res = await fetch(`events/${file}?v=` + Date.now());
            const content = await res.text();
            const fileLines = content.split('\n').map(l => l.trim()).filter(l => l);
            
            categoryCounts[category] = fileLines.length;
            
            return fileLines.map(line => {
                const match = line.match(/^(-?\d+(?:-\d{2}){0,2})\s+(.+)$/);
                if (match) {
                    const datePart = match[1];
                    const description = match[2];
                    const dateParts = datePart.split('-');
                    const year = parseInt(dateParts[0], 10);
                    const month = dateParts[1] ? parseInt(dateParts[1], 10) : undefined;
                    const day = dateParts[2] ? parseInt(dateParts[2], 10) : undefined;
                    return {
                        id: 0, // Temporary
                        description,
                        year,
                        month,
                        day,
                        category
                    };
                }
                return null;
            }).filter(e => e);
        });
        
        const results = await Promise.all(promises);
        EVENT_POOL = results.flat();
        EVENT_POOL.forEach((e, i) => e.id = i + 1);
        updateDropdown();
        
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
    while (pendingEvents.length < settings.pendingCount && availableEvents.length > 0) {
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
        
        let text = event.description;
        if (settings.prefixCategory) {
            const emoji = CATEGORY_EMOJIS[event.category] || '';
            text = `${emoji} ${text}`;
        }
        el.textContent = text;
        el.draggable = true;
        
        el.addEventListener('click', () => {
            selectedEvent = event;
            renderPending();
        });
        
        el.addEventListener('dragstart', (e) => {
            el.classList.remove('selected');
            e.dataTransfer.setData('text/plain', JSON.stringify({ eventId: event.id, source: 'pending' }));
            setTimeout(() => {
                el.classList.add('dragging-origin');
            }, 0);
        });
        
        el.addEventListener('dragend', (e) => {
            el.classList.remove('dragging-origin');
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
        let text = event.description;
        if (settings.prefixCategory) {
            const emoji = CATEGORY_EMOJIS[event.category] || '';
            text = `${emoji} ${text}`;
        }
        descEl.textContent = text;
        
        const yearEl = document.createElement('span');
        yearEl.textContent = getEventDateString(event);
        
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
    
    let enterCounter = 0;
    zone.addEventListener('dragenter', (e) => {
        enterCounter++;
        zone.classList.add('hovered');
    });
    
    zone.addEventListener('dragleave', (e) => {
        enterCounter--;
        if (enterCounter === 0) {
            zone.classList.remove('hovered');
        }
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        enterCounter = 0;
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
                li.textContent = `${ev.description}: ${getEventDateString({...ev, isIncorrect: false})}`;
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
    
    if (prevEvent) {
        if (event.year < prevEvent.year) return false;
        if (settings.monthAccuracy && event.year === prevEvent.year && event.month !== undefined && prevEvent.month !== undefined) {
            if (event.month < prevEvent.month) return false;
        }
    }
    if (nextEvent) {
        if (event.year > nextEvent.year) return false;
        if (settings.monthAccuracy && event.year === nextEvent.year && event.month !== undefined && nextEvent.month !== undefined) {
            if (event.month > nextEvent.month) return false;
        }
    }
    
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

// Settings Event Listeners
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        const modal = document.getElementById('settings-modal');
        modal.style.display = 'flex';
    });
}

const closeSettingsBtn = document.getElementById('close-settings-btn');
if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
        const modal = document.getElementById('settings-modal');
        modal.style.display = 'none';
    });
}

const saveSettingsBtn = document.getElementById('save-settings-btn');
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        const prefixCheck = document.getElementById('setting-prefix-category');
        const monthCheck = document.getElementById('setting-month-accuracy');
        const darkCheck = document.getElementById('setting-dark-mode');
        const countsCheck = document.getElementById('setting-show-event-counts');
        const slider = document.getElementById('setting-pending-count');
        
        settings.prefixCategory = prefixCheck ? prefixCheck.checked : false;
        settings.monthAccuracy = monthCheck ? monthCheck.checked : false;
        settings.darkMode = darkCheck ? darkCheck.checked : false;
        settings.showEventCounts = countsCheck ? countsCheck.checked : false;
        settings.pendingCount = slider ? parseInt(slider.value, 10) : 3;
        
        saveSettings();
        applySettings();
        
        const modal = document.getElementById('settings-modal');
        modal.style.display = 'none';
        
        initGame();
    });
}

const sliderEl = document.getElementById('setting-pending-count');
const valueSpanEl = document.getElementById('pending-count-value');
if (sliderEl) {
    sliderEl.addEventListener('input', (e) => {
        if (valueSpanEl) valueSpanEl.textContent = e.target.value;
    });
}

// Start
loadEvents().then(() => {
    loadSettings();
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
