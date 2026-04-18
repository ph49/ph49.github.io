// Timeline Master - Game Logic

// --- Event Pool ---
// A mix of history, science, culture, etc.
let EVENT_POOL = [];

const VIBE_EMOJIS = ['❤️', '🚲', '🍌', '🎵', '🧠'];

const CATEGORY_EMOJIS = {
    'science': '🔬',
    'history': '📜',
    '20th-century': '🚀',
    'pop-culture': '🍿',
    'literature': '📚',
    'music': '🎵',
    'sport': '⚽',
    'lucky-dip': '🎲'
};

// --- Game State ---
let score = 0;
let highScore = 0;
let anachronisms = 0;
let currentCategory = 'lucky-dip';
let placedEvents = [];
let availableEvents = [];
let pendingEvents = [];
let selectedEvent = null;

// --- DOM Elements ---
const scoreCurrentEl = document.getElementById('score-current');
const scoreHighEl = document.getElementById('score-high');
const livesCountEl = document.getElementById('lives-count');
const nextEventContainerEl = document.getElementById('next-event-container');
const timelineEl = document.getElementById('timeline');

const bestScoreItemEl = document.getElementById('best-score-item');
if (bestScoreItemEl) {
    bestScoreItemEl.style.cursor = 'pointer';
    bestScoreItemEl.addEventListener('click', () => {
        if (confirm("Do you want to clear your high score?")) {
            highScore = 0;
            scoreHighEl.textContent = highScore;
            setCookie('historyboardhighscore', highScore, 365);
        }
    });
}

nextEventContainerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
});

nextEventContainerEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    try {
        const parsedData = JSON.parse(data);
        const { event, sourceIndex } = parsedData;
        
        if (sourceIndex !== undefined) {
            // Remove from placed
            placedEvents.splice(sourceIndex, 1);
            
            // Reset incorrect status
            const eventObj = placedEvents.find(ev => ev.id === event.id) || EVENT_POOL.find(ev => ev.id === event.id);
            // Wait, if it's in placedEvents, I just spliced it! So it's not there anymore.
            // I should use the `event` object from parsedData or find it in EVENT_POOL.
            // The parsedData has the event object!
            // But I need to make sure I use the reference to the object in the pool or a clean copy.
            // Let's find it in EVENT_POOL to get the clean object.
            const cleanEvent = EVENT_POOL.find(ev => ev.id === event.id);
            if (cleanEvent) {
                cleanEvent.isIncorrect = false; // Reset
                pendingEvents.push(cleanEvent);
            }
            
            renderGame();
        }
    } catch (error) {
        console.error("Error parsing dropped data in next event area", error);
    }
});

// Click to return selected red card to pending
nextEventContainerEl.addEventListener('click', () => {
    if (selectedEvent && selectedEvent.isIncorrect) {
        const sourceIndex = placedEvents.indexOf(selectedEvent);
        if (sourceIndex > -1) {
            placedEvents.splice(sourceIndex, 1);
            selectedEvent.isIncorrect = false;
            pendingEvents.push(selectedEvent);
            selectedEvent = null;
            renderGame();
        }
    }
});

const categorySelectEl = document.getElementById('category-select');
if (categorySelectEl) {
    categorySelectEl.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        initGame(); // Reset game with new category
    });
}

// --- Cookie Helpers ---
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

// --- Load Events ---
async function loadEvents() {
    try {
        const response = await fetch('events.json');
        EVENT_POOL = await response.json();
    } catch (error) {
        console.error("Failed to load events", error);
        alert("Failed to load game data. Please try refreshing.");
    }
}

// --- Audio Helpers ---
let audioCtx;

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
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'failure') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'gameover') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    }
}

// --- Game Functions ---

async function initGame() {
    if (EVENT_POOL.length === 0) {
        await loadEvents();
    }

    // Load high score from cookie
    const savedHighScore = getCookie('historyboardhighscore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore, 10);
        scoreHighEl.textContent = highScore;
    }

    score = 0;
    scoreCurrentEl.textContent = score;
    
    anachronisms = 0;
    if (livesCountEl) livesCountEl.textContent = `${anachronisms}/3`;
    
    // Reset events and filter by category
    if (currentCategory === 'lucky-dip') {
        availableEvents = [...EVENT_POOL];
    } else {
        availableEvents = EVENT_POOL.filter(event => event.category === currentCategory);
    }
    
    placedEvents = [];
    pendingEvents = [];
    selectedEvent = null;
    
    // Pick a random starting event and place it
    if (availableEvents.length > 0) {
        const startIndex = Math.floor(Math.random() * availableEvents.length);
        const startEvent = availableEvents.splice(startIndex, 1)[0];
        placedEvents.push(startEvent);
        
        fillPendingEvents();
        renderGame();
    } else {
        alert("No events found for this category!");
    }
    
    setRandomVibeEmoji();
}

function setRandomVibeEmoji() {
    const emojiEl = document.getElementById('vibe-emoji');
    if (emojiEl) {
        const randomIndex = Math.floor(Math.random() * VIBE_EMOJIS.length);
        emojiEl.textContent = VIBE_EMOJIS[randomIndex];
    }
}

function fillPendingEvents() {
    while (pendingEvents.length < 2 && availableEvents.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableEvents.length);
        const event = availableEvents.splice(randomIndex, 1)[0];
        pendingEvents.push(event);
    }
    
    if (pendingEvents.length === 0 && placedEvents.length > 1) {
        alert("Wow! You placed all events correctly! You win!");
        initGame();
    }
}

function renderGame() {
    renderTimeline();
    renderNextEvent();
}

function renderNextEvent() {
    const headingEl = document.getElementById('next-event-heading');
    if (headingEl) {
        headingEl.textContent = pendingEvents.length > 1 ? "Events To Place" : "Next Event to Place";
    }
    
    nextEventContainerEl.innerHTML = '';
    
    pendingEvents.forEach((event, index) => {
        const card = document.createElement('div');
        card.className = `card next-card ${selectedEvent === event ? 'selected' : ''}`;
        card.draggable = true;
        card.innerHTML = `
            <div class="card-content">
                <p class="event-description">${event.description}</p>
            </div>
        `;
        
        // Click to select
        card.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling to container
            selectedEvent = event;
            renderNextEvent(); // Re-render to show selection
        });
        
        // Add drag events
        card.addEventListener('dragstart', (e) => handleDragStart(e, event, undefined));
        
        nextEventContainerEl.appendChild(card);
    });
}

function renderTimeline() {
    // Clear timeline but keep line
    timelineEl.innerHTML = '<div class="timeline-line"></div>';
    
    // Render top drop zone (insert at end of original array)
    const topDropZone = createDropZone(placedEvents.length);
    timelineEl.appendChild(topDropZone);
    
    // Loop backwards through placedEvents
    for (let i = placedEvents.length - 1; i >= 0; i--) {
        const event = placedEvents[i];
        
        // Render timeline item (year + card)
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="event-year-floating">${event.isIncorrect ? '????' : event.year}</div>
            <div class="card placed-card ${event.isIncorrect ? 'incorrect' : ''}">
                <div class="card-content">
                    <span class="event-description">${currentCategory === 'lucky-dip' ? CATEGORY_EMOJIS[event.category] + ' ' : ''}${event.description}</span>
                </div>
            </div>
        `;
        
        const card = item.querySelector('.card');
        if (event.isIncorrect) {
            card.draggable = true;
            card.addEventListener('dragstart', (e) => handleDragStart(e, event, i));
            // Click to select red card
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedEvent = event;
                renderGame(); // Re-render to show selection glow
            });
        }
        
        timelineEl.appendChild(item);
        
        // Render drop zone after card (position before this event in original array)
        const dropZone = createDropZone(i);
        if (i === 0) {
            dropZone.classList.add('fill-space');
        }
        timelineEl.appendChild(dropZone);
    }
}

function createDropZone(index) {
    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.index = index;
    
    // Click to place
    zone.addEventListener('click', (e) => handlePlacement(index, null, e.target));
    
    // Drag and drop events
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('drop', (e) => handleDrop(e, index));
    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragleave', handleDragLeave);
    
    return zone;
}

// --- Interaction Handlers ---

function handlePlacement(index, eventToPlace, dropZoneEl, sourceIndex) {
    if (!eventToPlace) {
        if (selectedEvent) {
            eventToPlace = selectedEvent;
        } else {
            alert("Please select an event first!");
            return;
        }
    }
    
    // Record position before render
    let oldTop = 0;
    if (dropZoneEl) {
        oldTop = dropZoneEl.getBoundingClientRect().top;
    }
    
    // If it's a move within the timeline
    if (sourceIndex !== undefined) {
        // Remove from old position
        placedEvents.splice(sourceIndex, 1);
        // Adjust target index if it shifted!
        if (index > sourceIndex) {
            index--;
        }
    }
    
    // Validate placement
    const isCorrect = validatePlacement(eventToPlace, index);
    
    // Always insert the card where user placed it
    placedEvents.splice(index, 0, eventToPlace);
    
    // Remove from pending if it was there
    if (sourceIndex === undefined) {
        const pendingIndex = pendingEvents.indexOf(eventToPlace);
        if (pendingIndex > -1) {
            pendingEvents.splice(pendingIndex, 1);
        }
        // Reset selection if the placed event was selected
        if (selectedEvent === eventToPlace) {
            selectedEvent = null;
        }
    }
    
    if (isCorrect) {
        playSound('success');
        eventToPlace.isIncorrect = false; // Mark as correct now!
        score++;
        scoreCurrentEl.textContent = score;
        
        if (score > highScore) {
            highScore = score;
            scoreHighEl.textContent = highScore;
            setCookie('historyboardhighscore', highScore, 365);
        }
        
        fillPendingEvents();
        renderGame();
    } else {
        playSound('failure');
        eventToPlace.isIncorrect = true; // Keep as incorrect
        anachronisms++;
        if (livesCountEl) livesCountEl.textContent = `${anachronisms}/3`;
        
        if (anachronisms === 3) {
            playSound('gameover');
            renderTimeline(); // Show the red card
            setTimeout(() => {
                alert(`Game Over! You reached 3 anachronisms. Your score: ${score}`);
                initGame();
            }, 100);
        } else {
            fillPendingEvents();
            renderGame();
        }
    }
    
    // Scroll correction
    if (dropZoneEl) {
        const itemIndex = (placedEvents.length - 1 - index) * 2 + 2;
        const newItemEl = timelineEl.children[itemIndex];
        if (newItemEl) {
            const newCardEl = newItemEl.querySelector('.card');
            if (newCardEl) {
                const newTop = newCardEl.getBoundingClientRect().top;
                timelineEl.scrollTop += (newTop - oldTop);
            }
        }
    }
}

function validatePlacement(event, index) {
    // Check if placement is correct relative to valid neighbors
    // We need to find the closest valid (not incorrect) neighbors
    
    let prevEvent = null;
    for (let i = index - 1; i >= 0; i--) {
        if (!placedEvents[i].isIncorrect) {
            prevEvent = placedEvents[i];
            break;
        }
    }
    
    let nextEvent = null;
    for (let i = index; i < placedEvents.length; i++) {
        if (placedEvents[i] && !placedEvents[i].isIncorrect) {
            nextEvent = placedEvents[i];
            break;
        }
    }
    
    let correct = true;
    
    if (prevEvent && event.year < prevEvent.year) {
        correct = false;
    }
    
    if (nextEvent && event.year > nextEvent.year) {
        correct = false;
    }
    
    return correct;
}

// --- Drag and Drop Handlers ---

let scrollInterval = null;

function handleDragStart(e, event, sourceIndex) {
    const data = {
        event: event,
        sourceIndex: sourceIndex
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow drop
    
    const timelineContainer = timelineEl;
    const rect = timelineContainer.getBoundingClientRect();
    const y = e.clientY - rect.top; // Y position relative to container
    
    const threshold = 50; // px from edge
    const speed = 10; // px per interval
    
    clearInterval(scrollInterval);
    
    if (y < threshold) {
        // Scroll up
        scrollInterval = setInterval(() => {
            timelineContainer.scrollTop -= speed;
        }, 50);
    } else if (y > rect.height - threshold) {
        // Scroll down
        scrollInterval = setInterval(() => {
            timelineContainer.scrollTop += speed;
        }, 50);
    }
}

function handleDragEnter(e) {
    e.target.classList.add('hovered');
}

function handleDragLeave(e) {
    e.target.classList.remove('hovered');
    clearInterval(scrollInterval);
}

function handleDrop(e, index) {
    e.preventDefault();
    e.target.classList.remove('hovered');
    clearInterval(scrollInterval);
    
    const data = e.dataTransfer.getData('text/plain');
    try {
        const parsedData = JSON.parse(data);
        const { event, sourceIndex } = parsedData;
        
        if (sourceIndex !== undefined) {
            // It's moving within timeline
            const placedEvent = placedEvents[sourceIndex];
            if (placedEvent) {
                handlePlacement(index, placedEvent, e.target, sourceIndex);
            }
        } else {
            // It's from pending
            const pendingEvent = pendingEvents.find(ev => ev.id === event.id);
            if (pendingEvent) {
                handlePlacement(index, pendingEvent, e.target);
            }
        }
    } catch (error) {
        console.error("Error parsing dropped data", error);
    }
}

// --- Initialize ---
initGame();
