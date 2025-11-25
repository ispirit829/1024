document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.querySelector('.grid-container');
    const tileContainer = document.querySelector('.tile-container');
    const scoreElement = document.getElementById('score');
    const bestScoreElement = document.getElementById('best-score');
    const messageContainer = document.querySelector('.game-message');
    const messageText = messageContainer.querySelector('p');
    const retryButton = document.querySelector('.retry-button');
    const keepPlayingButton = document.querySelector('.keep-playing-button');
    const newGameButton = document.getElementById('new-game-btn');

    const gridSize = 4;
    let grid = [];
    let score = 0;
    let bestScore = localStorage.getItem('1024-best-score') || 0;
    let won = false;
    let keepPlaying = false;

    // Initialize best score
    bestScoreElement.textContent = bestScore;

    // Input handling
    let touchStartX = 0;
    let touchStartY = 0;

    function initGame() {
        // Create grid cells
        gridContainer.innerHTML = '';
        for (let i = 0; i < gridSize * gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            gridContainer.appendChild(cell);
        }

        setupInput();
        startNewGame();
    }

    function startNewGame() {
        grid = Array(gridSize).fill().map(() => Array(gridSize).fill(null));
        score = 0;
        won = false;
        keepPlaying = false;
        updateScore(0);
        clearTiles();
        messageContainer.classList.remove('game-won', 'game-over');
        messageContainer.style.display = 'none';

        addRandomTile();
        addRandomTile();
    }

    function clearTiles() {
        tileContainer.innerHTML = '';
    }

    function addRandomTile() {
        const emptyCells = [];
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (!grid[r][c]) {
                    emptyCells.push({ r, c });
                }
            }
        }

        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4;
            grid[r][c] = {
                value: value,
                id: Math.random().toString(36).substr(2, 9),
                mergedFrom: null
            };
            renderTile(r, c, grid[r][c], true);
        }
    }

    function renderTile(r, c, tile, isNew = false) {
        const tileElement = document.createElement('div');
        tileElement.className = `tile tile-${tile.value} ${isNew ? 'tile-new' : ''}`;

        // Calculate position
        const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap'));
        const size = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-size'));

        const x = c * (size + gap);
        const y = r * (size + gap);

        tileElement.style.transform = `translate(${x}px, ${y}px)`;

        const inner = document.createElement('div');
        inner.className = 'tile-inner';
        inner.textContent = tile.value;
        tileElement.appendChild(inner);

        tileContainer.appendChild(tileElement);

        return tileElement;
    }

    function updateView() {
        // Clear container but we might want to keep elements for animation in a more advanced version.
        // For now, simple re-render is easier to implement robustly without a framework.
        // To support movement animations, we need to keep track of tile identities.
        // Let's do a full re-render for simplicity first, but we can optimize.

        tileContainer.innerHTML = '';

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c]) {
                    const tile = grid[r][c];
                    const element = renderTile(r, c, tile);

                    if (tile.mergedFrom) {
                        element.classList.add('tile-merged');
                        // Render the tiles that merged so they can "pop"
                        // In a full implementation we'd animate them moving to this spot first.
                    }
                }
            }
        }
    }

    function move(direction) {
        if (won && !keepPlaying) return;

        // 0: up, 1: right, 2: down, 3: left
        const vector = getVector(direction);
        const traversals = buildTraversals(vector);
        let moved = false;

        // Save current grid state for animation/logic
        prepareTiles();

        traversals.row.forEach(row => {
            traversals.col.forEach(col => {
                const tile = grid[row][col];

                if (tile) {
                    const positions = findFarthestPosition({ row, col }, vector);
                    const next = positions.next ? grid[positions.next.row]?.[positions.next.col] : null;

                    if (next && next.value === tile.value && !next.mergedFrom) {
                        const merged = {
                            value: tile.value * 2,
                            id: Math.random().toString(36).substr(2, 9),
                            mergedFrom: [tile, next]
                        };

                        grid[positions.next.row][positions.next.col] = merged;
                        grid[row][col] = null;

                        // Update score
                        score += merged.value;
                        updateScore(score);

                        if (merged.value === 1024 && !won) {
                            won = true;
                            messageText.textContent = 'You Win!';
                            messageContainer.classList.add('game-won');
                            messageContainer.style.display = 'flex';
                        }

                        moved = true;
                    } else {
                        // Move to farthest position
                        if (row !== positions.farthest.row || col !== positions.farthest.col) {
                            grid[positions.farthest.row][positions.farthest.col] = tile;
                            grid[row][col] = null;
                            moved = true;
                        }
                    }
                }
            });
        });

        if (moved) {
            addRandomTile();
            updateView();

            if (!movesAvailable()) {
                messageText.textContent = 'Game Over!';
                messageContainer.classList.add('game-over');
                messageContainer.style.display = 'flex';
            }
        }
    }

    function getVector(direction) {
        const map = {
            0: { row: -1, col: 0 },  // Up
            1: { row: 0, col: 1 },   // Right
            2: { row: 1, col: 0 },   // Down
            3: { row: 0, col: -1 }   // Left
        };
        return map[direction];
    }

    function buildTraversals(vector) {
        const traversals = { row: [], col: [] };

        for (let pos = 0; pos < gridSize; pos++) {
            traversals.row.push(pos);
            traversals.col.push(pos);
        }

        // Always traverse from the farthest cell in the chosen direction
        if (vector.row === 1) traversals.row.reverse();
        if (vector.col === 1) traversals.col.reverse();

        return traversals;
    }

    function findFarthestPosition(cell, vector) {
        let previous;

        // Progress towards the vector direction until an obstacle is found
        do {
            previous = cell;
            cell = { row: previous.row + vector.row, col: previous.col + vector.col };
        } while (withinBounds(cell) && !grid[cell.row][cell.col]);

        return {
            farthest: previous,
            next: cell // Used to check if a merge is required
        };
    }

    function withinBounds(position) {
        return position.row >= 0 && position.row < gridSize &&
            position.col >= 0 && position.col < gridSize;
    }

    function prepareTiles() {
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (grid[row][col]) {
                    grid[row][col].mergedFrom = null;
                }
            }
        }
    }

    function movesAvailable() {
        return !!grid.some((rowArray, row) => {
            return rowArray.some((cell, col) => {
                return !cell || // Cell is empty
                    (row > 0 && grid[row - 1][col] && grid[row - 1][col].value === cell.value) || // Up
                    (row < 3 && grid[row + 1][col] && grid[row + 1][col].value === cell.value) || // Down
                    (col > 0 && grid[row][col - 1] && grid[row][col - 1].value === cell.value) || // Left
                    (col < 3 && grid[row][col + 1] && grid[row][col + 1].value === cell.value);   // Right
            });
        });
    }

    function updateScore(newScore) {
        scoreElement.textContent = newScore;
        if (newScore > bestScore) {
            bestScore = newScore;
            bestScoreElement.textContent = bestScore;
            localStorage.setItem('1024-best-score', bestScore);
        }
    }

    function setupInput() {
        document.addEventListener('keydown', (event) => {
            const map = {
                38: 0, // Up
                39: 1, // Right
                40: 2, // Down
                37: 3, // Left
                75: 0, // Vim k
                76: 1, // Vim l
                74: 2, // Vim j
                72: 3, // Vim h
                87: 0, // W
                68: 1, // D
                83: 2, // S
                65: 3  // A
            };

            const modifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
            const direction = map[event.which];

            if (!modifiers && direction !== undefined) {
                event.preventDefault();
                move(direction);
            }
        });

        // Button controls
        document.getElementById('btn-up').addEventListener('click', () => move(0));
        document.getElementById('btn-right').addEventListener('click', () => move(1));
        document.getElementById('btn-down').addEventListener('click', () => move(2));
        document.getElementById('btn-left').addEventListener('click', () => move(3));

        newGameButton.addEventListener('click', startNewGame);
        retryButton.addEventListener('click', startNewGame);
        keepPlayingButton.addEventListener('click', () => {
            keepPlaying = true;
            messageContainer.style.display = 'none';
        });

        // Touch events
        const gameContainer = document.querySelector('.game-container');

        gameContainer.addEventListener('touchstart', (event) => {
            if (event.touches.length > 1) return;
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            event.preventDefault();
        }, { passive: false });

        gameContainer.addEventListener('touchend', (event) => {
            if (event.changedTouches.length > 0) {
                const touchEndX = event.changedTouches[0].clientX;
                const touchEndY = event.changedTouches[0].clientY;

                const dx = touchEndX - touchStartX;
                const dy = touchEndY - touchStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);

                if (Math.max(absDx, absDy) > 10) { // Threshold
                    if (absDx > absDy) {
                        move(dx > 0 ? 1 : 3);
                    } else {
                        move(dy > 0 ? 2 : 0);
                    }
                }
            }
        }, { passive: false });
    }

    initGame();
});
