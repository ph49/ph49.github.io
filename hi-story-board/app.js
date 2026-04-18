// Timeline Master - Game Logic

// --- Event Pool ---
// A mix of history, science, culture, etc.
const EVENT_POOL = [
    { id: 1, description: "Magna Carta signed", year: 1215 },
    { id: 2, description: "Black Death peaks in Europe", year: 1347 },
    { id: 3, description: "Gutenberg invents the printing press", year: 1440 },
    { id: 4, description: "Columbus reaches the Americas", year: 1492 },
    { id: 5, description: "Shakespeare writes Hamlet", year: 1601 },
    { id: 6, description: "Newton publishes Principia", year: 1687 },
    { id: 7, description: "US Declaration of Independence", year: 1776 },
    { id: 8, description: "French Revolution begins", year: 1789 },
    { id: 9, description: "Darwin publishes On the Origin of Species", year: 1859 },
    { id: 10, description: "Wright Brothers' first powered flight", year: 1903 },
    { id: 11, description: "World War I begins", year: 1914 },
    { id: 12, description: "Alexander Fleming discovers penicillin", year: 1928 },
    { id: 13, description: "World War II begins", year: 1939 },
    { id: 14, description: "DNA double helix described by Watson & Crick", year: 1953 },
    { id: 15, description: "First human in space (Yuri Gagarin)", year: 1961 },
    { id: 16, description: "Apollo 11 moon landing", year: 1969 },
    { id: 17, description: "Fall of the Berlin Wall", year: 1989 },
    { id: 18, description: "Tim Berners-Lee invents the World Wide Web", year: 1989 },
    { id: 19, description: "First iPhone released", year: 2007 },
    { id: 20, description: "End of the Western Roman Empire", year: 476 },
    { id: 21, description: "Charlemagne crowned Emperor", year: 800 },
    { id: 22, description: "Battle of Hastings", year: 1066 },
    { id: 23, description: "Galileo uses telescope for astronomy", year: 1609 },
    { id: 24, description: "Steam engine patented by James Watt", year: 1769 },
    { id: 25, description: "Beethoven composes Symphony No. 5", year: 1808 },
    { id: 26, description: "Albert Einstein publishes General Relativity", year: 1915 },
    { id: 27, description: "Russian Revolution", year: 1917 },
    { id: 28, description: "First heart transplant", year: 1967 },
    { id: 29, description: "Dissolution of the Soviet Union", year: 1991 },
    { id: 30, description: "Curiosity rover lands on Mars", year: 2012 }
];

const VIBE_EMOJIS = ['❤️', '🚲', '🍌', '🎵', '🧠'];

// --- Game State ---
let score = 0;
let highScore = 0;
let anachronisms = 0;
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

function initGame() {
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
    
    // Reset events
    availableEvents = [...EVENT_POOL];
    placedEvents = [];
    pendingEvents = [];
    selectedEvent = null;
    
    // Pick a random starting event and place it
    const startIndex = Math.floor(Math.random() * availableEvents.length);
    const startEvent = availableEvents.splice(startIndex, 1)[0];
    placedEvents.push(startEvent);
    
    fillPendingEvents();
    renderGame();
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
        card.addEventListener('click', () => {
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
        
        // Render card
        const card = document.createElement('div');
        card.className = `card placed-card ${event.isIncorrect ? 'incorrect' : ''}`;
        card.innerHTML = `
            <div class="card-content">
                <span class="event-year">${event.isIncorrect ? '????' : event.year}</span>
                <span class="event-description">${event.description}</span>
            </div>
        `;
        
        if (event.isIncorrect) {
            card.draggable = true;
            card.addEventListener('dragstart', (e) => handleDragStart(e, event, i));
        }
        
        timelineEl.appendChild(card);
        
        // Render drop zone after card (position before this event in original array)
        const dropZone = createDropZone(i);
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
        const newCardEl = timelineEl.children[index * 2 + 1];
        if (newCardEl) {
            const newTop = newCardEl.getBoundingClientRect().top;
            timelineEl.scrollTop += (newTop - oldTop);
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
