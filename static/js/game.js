/**
 * Game Controller for Marbles Game
 * Main game logic and state management
 */

// Game state
let gameState = null;
let currentGameId = null;
let validMoves = [];
let selectedMarble = null;
let isProcessing = false;

/**
 * Initialize the game
 */
async function initGame(gameId) {
    currentGameId = gameId;

    // Initialize renderer
    BoardRenderer.init('game-board');

    // Setup click handler
    BoardRenderer.canvas.addEventListener('click', handleBoardClick);

    // Load game state
    try {
        const result = await GameAPI.getGame(gameId);
        gameState = result.state;
        updateUI();
        BoardRenderer.drawBoard(gameState, []);

        // Check if it's AI's turn
        if (isAiTurn()) {
            setTimeout(handleAiTurn, 1000);
        }
    } catch (error) {
        console.error('Failed to load game:', error);
        alert('Failed to load game');
        window.location.href = '/';
    }
}

/**
 * Handle dice roll button click
 */
async function handleRollDice() {
    if (isProcessing) return;
    if (gameState.status !== 'rolling') {
        showMessage('Not your turn to roll!');
        return;
    }
    if (isAiTurn()) {
        showMessage('AI is thinking...');
        return;
    }

    isProcessing = true;
    disableRollButton();
    Audio.play('roll');

    // Animate dice
    const diceEl = document.getElementById('dice-display');
    diceEl.classList.add('rolling');

    // Simulate rolling animation
    let rollCount = 0;
    const rollInterval = setInterval(() => {
        diceEl.textContent = Math.floor(Math.random() * 6) + 1;
        rollCount++;
        if (rollCount > 10) {
            clearInterval(rollInterval);
        }
    }, 50);

    try {
        const result = await GameAPI.rollDice(currentGameId);

        // Stop animation and show result
        clearInterval(rollInterval);
        diceEl.classList.remove('rolling');
        diceEl.textContent = result.dice_value;

        gameState = result.state;
        validMoves = result.valid_moves;

        // Update instruction
        if (validMoves.length > 0) {
            showInstruction('Click a highlighted marble to move');
            BoardRenderer.drawBoard(gameState, validMoves);
        } else {
            showInstruction('No valid moves - turn skipped');
            Audio.play('error');
            BoardRenderer.drawBoard(gameState, []);

            // Wait a moment then continue
            setTimeout(() => {
                updateUI();
                checkAiTurn();
            }, 1500);
        }
    } catch (error) {
        console.error('Roll failed:', error);
        showInstruction('Error: ' + error.message);
        diceEl.classList.remove('rolling');
    }

    isProcessing = false;
    enableRollButton();
}

/**
 * Handle click on game board
 */
async function handleBoardClick(event) {
    if (isProcessing) return;
    if (gameState.status !== 'moving') return;
    if (isAiTurn()) return;

    Audio.resume();

    const clickData = BoardRenderer.getPositionFromClick(event.clientX, event.clientY);
    if (!clickData) return;

    const currentPlayer = gameState.players[gameState.current_player];

    // Check if clicking on a valid move target
    if (clickData.type === 'position') {
        const targetMove = validMoves.find(m => m.to_position === clickData.position);
        if (targetMove) {
            await executeMove(targetMove);
            return;
        }

        // Check if clicking on a marble that can move
        const marble = BoardRenderer.findMarbleAtPosition(gameState.marbles, clickData.position);
        if (marble && marble.player_id === gameState.current_player) {
            const marbleMove = validMoves.find(m => m.marble_id === marble.id);
            if (marbleMove) {
                selectedMarble = marble;
                await executeMove(marbleMove);
            }
        }
    }

    // Check if clicking start area to move marble out
    if (clickData.type === 'start') {
        if (clickData.color === currentPlayer.color) {
            const enterMove = validMoves.find(m => m.is_entering_track);
            if (enterMove) {
                await executeMove(enterMove);
            }
        }
    }
}

/**
 * Execute a move
 */
async function executeMove(move) {
    if (isProcessing) return;

    isProcessing = true;
    const marble = gameState.marbles.find(m => m.id === move.marble_id);

    // Play sound
    if (move.is_entering_track) {
        Audio.play('enter');
    } else {
        Audio.play('move');
    }

    // Animate the move
    const fromPos = move.from_position;
    const toPos = move.to_position;

    BoardRenderer.animateMove(marble, fromPos, toPos, gameState, async () => {
        try {
            const result = await GameAPI.makeMove(currentGameId, move.marble_id, move.to_position);

            gameState = result.state;
            validMoves = [];

            // Handle capture
            if (result.captured) {
                Audio.play('capture');
                addLog(`${marble.color} captured ${result.captured.color}!`);
            }

            // Handle reaching home
            if (toPos >= 56) {
                Audio.play('home');
                addLog(`${marble.color} marble reached home!`);
            }

            // Check for win
            if (result.game_over) {
                handleWin(result.winner);
                return;
            }

            // Check for extra turn
            if (result.extra_turn) {
                showInstruction('Rolled 6 - Roll again!');
                addLog(`${gameState.players[gameState.current_player].name} rolls again!`);
            }

            updateUI();
            BoardRenderer.drawBoard(gameState, []);

            // Check if AI's turn
            if (!result.extra_turn || isAiTurn()) {
                checkAiTurn();
            }

        } catch (error) {
            console.error('Move failed:', error);
            showInstruction('Error: ' + error.message);
            Audio.play('error');
        }

        isProcessing = false;
    });
}

/**
 * Check if current turn is AI and handle it
 */
function checkAiTurn() {
    if (isAiTurn()) {
        setTimeout(handleAiTurn, 1000);
    }
}

/**
 * Check if current player is AI
 */
function isAiTurn() {
    if (!gameState) return false;
    const currentPlayer = gameState.players[gameState.current_player];
    return currentPlayer && currentPlayer.is_ai;
}

/**
 * Handle AI turn
 */
async function handleAiTurn() {
    if (!isAiTurn()) return;
    if (gameState.status === 'finished') return;

    isProcessing = true;
    const currentPlayer = gameState.players[gameState.current_player];

    showInstruction(`${currentPlayer.name} is thinking...`);
    disableRollButton();

    // Show dice rolling animation
    const diceEl = document.getElementById('dice-display');
    diceEl.classList.add('rolling');
    Audio.play('roll');

    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        const result = await GameAPI.aiTurn(currentGameId);

        diceEl.classList.remove('rolling');
        diceEl.textContent = result.dice_value;

        if (result.skipped) {
            addLog(`${currentPlayer.name} rolled ${result.dice_value} - no moves`);
            gameState = result.state;
            updateUI();
            BoardRenderer.drawBoard(gameState, []);
            isProcessing = false;
            checkAiTurn();
            return;
        }

        // Get marble and animate
        const marble = gameState.marbles.find(m => m.id === result.move.marble_id);

        if (result.move.is_entering_track) {
            Audio.play('enter');
        } else {
            Audio.play('move');
        }

        addLog(`${currentPlayer.name} rolled ${result.dice_value}`);

        BoardRenderer.animateMove(
            marble,
            result.move.from_position,
            result.move.to_position,
            gameState,
            () => {
                gameState = result.state;

                // Handle capture
                if (result.result && result.result.captured) {
                    Audio.play('capture');
                    addLog(`${currentPlayer.name} captured a marble!`);
                }

                // Handle reaching home
                if (result.move.to_position >= 56) {
                    Audio.play('home');
                }

                // Check for win
                if (result.result && result.result.game_over) {
                    handleWin(result.result.winner);
                    return;
                }

                // Extra turn
                if (result.result && result.result.extra_turn) {
                    addLog(`${currentPlayer.name} rolls again!`);
                }

                updateUI();
                BoardRenderer.drawBoard(gameState, []);
                isProcessing = false;

                // Continue AI turns
                checkAiTurn();
            }
        );

    } catch (error) {
        console.error('AI turn failed:', error);
        diceEl.classList.remove('rolling');
        showInstruction('AI error - try refreshing');
        isProcessing = false;
    }
}

/**
 * Handle game win
 */
function handleWin(winnerId) {
    const winner = gameState.players[winnerId];

    Audio.play('win');

    document.getElementById('winner-text').textContent =
        `${winner.name} wins the game!`;
    document.getElementById('win-modal').classList.remove('hidden');
}

/**
 * Update UI elements
 */
function updateUI() {
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.current_player];

    // Update turn indicator
    const nameEl = document.getElementById('current-player-name');
    nameEl.textContent = currentPlayer.name;
    nameEl.style.color = BoardRenderer.colors[currentPlayer.color];

    // Update dice
    const diceEl = document.getElementById('dice-display');
    diceEl.textContent = gameState.dice_value || '?';

    // Update players list
    updatePlayersList();

    // Update instruction
    if (gameState.status === 'rolling') {
        if (isAiTurn()) {
            showInstruction(`${currentPlayer.name} is thinking...`);
            disableRollButton();
        } else {
            showInstruction('Roll the dice to start your turn');
            enableRollButton();
        }
    } else if (gameState.status === 'moving') {
        if (isAiTurn()) {
            showInstruction(`${currentPlayer.name} is moving...`);
        } else {
            showInstruction('Click a highlighted space to move');
        }
    } else if (gameState.status === 'finished') {
        showInstruction('Game Over!');
    }
}

/**
 * Update players list panel
 */
function updatePlayersList() {
    const container = document.getElementById('players-list');
    let html = '';

    gameState.players.forEach((player, index) => {
        const isActive = index === gameState.current_player;
        const playerMarbles = gameState.marbles.filter(m => m.player_id === player.id);
        const homeCount = playerMarbles.filter(m => m.position >= 56).length;
        const startCount = playerMarbles.filter(m => m.position === -1).length;

        html += `
            <div class="player-card ${player.color} ${isActive ? 'active' : ''}">
                <div class="name">${player.name}${player.is_ai ? ' (AI)' : ''}</div>
                <div class="status">Home: ${homeCount}/4 | Start: ${startCount}</div>
                <div class="marbles-info">
                    ${playerMarbles.map(m =>
                        `<span class="marble-dot ${m.position >= 56 ? 'home' : ''}"
                               style="background:${BoardRenderer.colors[m.color]}"></span>`
                    ).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Show instruction message
 */
function showInstruction(message) {
    document.getElementById('move-instruction').textContent = message;
}

/**
 * Show temporary board message
 */
function showMessage(message) {
    const msgEl = document.getElementById('board-message');
    msgEl.textContent = message;
    msgEl.classList.remove('hidden');

    setTimeout(() => {
        msgEl.classList.add('hidden');
    }, 2000);
}

/**
 * Add entry to game log
 */
function addLog(message) {
    const container = document.getElementById('log-entries');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    container.insertBefore(entry, container.firstChild);

    // Keep only last 20 entries
    while (container.children.length > 20) {
        container.removeChild(container.lastChild);
    }
}

/**
 * Disable roll button
 */
function disableRollButton() {
    const btn = document.getElementById('roll-btn');
    btn.disabled = true;
}

/**
 * Enable roll button
 */
function enableRollButton() {
    const btn = document.getElementById('roll-btn');
    btn.disabled = false;
}
