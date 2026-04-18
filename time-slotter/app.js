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

// --- Game State ---
let score = 0;
let highScore = 0;
let placedEvents = [];
let availableEvents = [];
let currentEvent = null;

// --- DOM Elements ---
const scoreCurrentEl = document.getElementById('score-current');
const scoreHighEl = document.getElementById('score-high');
const nextEventContainerEl = document.getElementById('next-event-container');
const timelineEl = document.getElementById('timeline');

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

// --- Game Functions ---

function initGame() {
    // Load high score from cookie
    const savedHighScore = getCookie('timeSlotterHighScore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore, 10);
        scoreHighEl.textContent = highScore;
    }

    score = 0;
    scoreCurrentEl.textContent = score;
    
    // Reset events
    availableEvents = [...EVENT_POOL];
    placedEvents = [];
    
    // Pick a random starting event and place it
    const startIndex = Math.floor(Math.random() * availableEvents.length);
    const startEvent = availableEvents.splice(startIndex, 1)[0];
    placedEvents.push(startEvent);
    
    pickNextEvent();
    renderGame();
}

function pickNextEvent() {
    if (availableEvents.length === 0) {
        alert("Wow! You placed all events correctly! You win!");
        initGame();
        return;
    }
    const randomIndex = Math.floor(Math.random() * availableEvents.length);
    currentEvent = availableEvents.splice(randomIndex, 1)[0];
}

function renderGame() {
    renderTimeline();
    renderNextEvent();
}

function renderNextEvent() {
    nextEventContainerEl.innerHTML = '';
    
    const card = document.createElement('div');
    card.className = 'card next-card';
    card.id = 'next-event-card';
    card.draggable = true;
    card.innerHTML = `
        <div class="card-content">
            <p class="event-description">${currentEvent.description}</p>
        </div>
    `;
    
    // Add drag events
    card.addEventListener('dragstart', handleDragStart);
    
    nextEventContainerEl.appendChild(card);
}

function renderTimeline() {
    // Clear timeline but keep line
    timelineEl.innerHTML = '<div class="timeline-line"></div>';
    
    // Render initial drop zone
    const initialDropZone = createDropZone(0);
    timelineEl.appendChild(initialDropZone);
    
    placedEvents.forEach((event, index) => {
        // Render card
        const card = document.createElement('div');
        card.className = 'card placed-card';
        card.innerHTML = `
            <div class="card-content">
                <p class="event-description">${event.description}</p>
                <p class="event-year">${event.year}</p>
            </div>
        `;
        timelineEl.appendChild(card);
        
        // Render drop zone after card
        const dropZone = createDropZone(index + 1);
        timelineEl.appendChild(dropZone);
    });
}

function createDropZone(index) {
    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.index = index;
    zone.innerHTML = '+';
    
    // Click to place
    zone.addEventListener('click', () => handlePlacement(index));
    
    // Drag and drop events
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('drop', (e) => handleDrop(e, index));
    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragleave', handleDragLeave);
    
    return zone;
}

// --- Interaction Handlers ---

function handlePlacement(index) {
    // Validate placement
    const isCorrect = validatePlacement(currentEvent, index);
    
    if (isCorrect) {
        // Insert event
        placedEvents.splice(index, 0, currentEvent);
        score++;
        scoreCurrentEl.textContent = score;
        
        if (score > highScore) {
            highScore = score;
            scoreHighEl.textContent = highScore;
            setCookie('timeSlotterHighScore', highScore, 365);
        }
        
        // Visual feedback (placeholder for now, CSS handles glow on add if we use class)
        // For now we just re-render
        pickNextEvent();
        renderGame();
    } else {
        alert(`Game Over! Correct year was ${currentEvent.year}. Your score: ${score}`);
        initGame();
    }
}

function validatePlacement(event, index) {
    // Check if placement is correct relative to neighbors
    const prevEvent = index > 0 ? placedEvents[index - 1] : null;
    const nextEvent = index < placedEvents.length ? placedEvents[index] : null;
    
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

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', 'next-card');
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow drop
}

function handleDragEnter(e) {
    e.target.classList.add('hovered');
}

function handleDragLeave(e) {
    e.target.classList.remove('hovered');
}

function handleDrop(e, index) {
    e.preventDefault();
    e.target.classList.remove('hovered');
    
    const data = e.dataTransfer.getData('text/plain');
    if (data === 'next-card') {
        handlePlacement(index);
    }
}

// --- Initialize ---
initGame();
