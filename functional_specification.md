# Functional Specification: Say When!

## 1. Overview
Say When! is a timeline-based quiz game where players test their knowledge by placing historical, scientific, and cultural events in chronological order. The game is designed to run as a static web application with no server-side processing or database requirements.

## 2. Core Gameplay
*   **Objective**: Place as many events as possible in the correct chronological order on a timeline.
*   **Starting State**: The game begins with a single randomly selected event already placed on the timeline with its year revealed.
*   **Event Flow**: The player is presented with a pool of "pending" events (up to 2 at a time). They must choose an event and place it in the correct position relative to the events already on the timeline.
*   **Validation**:
    *   If the player places the event in the correct chronological position, the event is locked in place, its year is revealed, the score increases, and a new event is drawn from the pool.
    *   If the placement is incorrect, the event is marked as an "anachronism" (incorrect placement). The card is highlighted in the timeline, the year remains hidden (displaying question marks), and the player loses a life.
*   **Game Over**: The game ends when the player accumulates 3 anachronisms.

## 3. Features
*   **Categories**: Players can choose to play with events from specific categories or a random mix. Available categories include:
    *   Science
    *   History
    *   Pop Culture
    *   Literature
    *   Sport
    *   Boomer Life
    *   US Politics
    *   Extinctions
    *   Fictional Events
    *   Natural Disasters
    *   Lucky Dip (All categories mixed)
*   **Scoring**:
    *   Each correct placement adds 1 point to the current score.
    *   The game tracks a "Best Score" (High Score).
*   **Audio Feedback**: The game provides distinct audio cues for success, failure, and game over states.

## 4. User Interface
The user interface is contained within a single screen layout, designed to be responsive across different device types. On small screens, the timeline section becomes scrollable independently to fit within the viewport.

### 4.1 Header
*   **Title**: Displays the game name "Say When!".
*   **Category Selector**: A dropdown menu allowing the user to select the event category. Changing the category resets the game with the new set of events.
*   **Scoreboard**:
    *   Current Score display.
    *   Best Score (High Score) display.
    *   Anachronism Count display (e.g., "0/3").

### 4.2 Game Area
*   **Pending Events Section**: Displays cards for the next events available to be placed.
*   **Timeline Section**: A visual line representing the chronology of events. It contains:
    *   Correctly placed event cards with their years displayed.
    *   Incorrectly placed event cards (highlighted, year hidden).
    *   Interactive zones between cards where new events can be placed. These zones will display labels like "BEFORE", "AFTER", or "BETWEEN" depending on their position.

## 5. User Interactions
*   **Placement**:
    *   **Drag and Drop**: Players can drag an event card from the pending area and drop it onto a valid zone on the timeline.
    *   **Click to Place**: Players can click a pending event card to select it, then click a zone on the timeline to place it.
*   **Correction**: Players can move an incorrectly placed card back to the pending area to try placing it again or clear the timeline spot.
*   **High Score Management**: Interaction with the "Best" score area allows the user to clear their high score with a confirmation prompt.

## 6. Constraints & Architecture
*   **Static Application**: The game must run entirely in the user's web browser without any server-side API or database support.
*   **Data Storage**: Event data is loaded from a static data file included with the application.
*   **Persistence**: The high score is persisted locally on the user's device to allow scores to persist across sessions without a user account system.
*   **Screen Real Estate & Mobile Compatibility**: The game must efficiently use screen real estate, particularly on mobile devices. The layout must adapt to fit small screens, with features like independent scrolling for the timeline to ensure a good user experience on mobile browsers.
