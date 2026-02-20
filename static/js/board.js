/**
 * Board Renderer for Marbles Game
 * Handles canvas drawing of the cross-shaped Aggravation board
 */
const BoardRenderer = {
    canvas: null,
    ctx: null,
    width: 560,
    height: 560,
    cellSize: 35,
    marbleRadius: 14,

    // Position coordinates for each board space
    positions: {},

    // Player colors
    colors: {
        red: '#e74c3c',
        blue: '#3498db',
        green: '#2ecc71',
        yellow: '#f1c40f'
    },

    // Board styling
    boardBg: '#2c3e50',
    spaceBg: '#34495e',
    spaceStroke: '#1a252f',
    safeBg: '#1abc9c',
    homeBg: '#9b59b6',
    highlightColor: '#e94560',

    /**
     * Initialize the board renderer
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.calculatePositions();
    },

    /**
     * Calculate pixel coordinates for all board positions
     * Board layout is a cross shape with 4 arms
     */
    calculatePositions() {
        const cx = this.width / 2;
        const cy = this.height / 2;
        const armLength = 7;  // 7 spaces per arm on each side of center
        const spacing = this.cellSize;

        // Track positions (0-55): Goes around the cross clockwise
        // Starting from top arm, going right

        // Top arm (positions 0-6, going down from top)
        for (let i = 0; i < 7; i++) {
            this.positions[i] = {
                x: cx,
                y: 40 + i * spacing,
                type: i === 0 ? 'safe' : 'normal'
            };
        }

        // Top-right corner to right arm (positions 7-13)
        for (let i = 0; i < 7; i++) {
            this.positions[7 + i] = {
                x: cx + (i + 1) * spacing,
                y: cy - spacing,
                type: 'normal'
            };
        }

        // Right arm down (positions 14-20)
        this.positions[14] = { x: cx + 7 * spacing, y: cy, type: 'safe' };
        for (let i = 1; i < 7; i++) {
            this.positions[14 + i] = {
                x: cx + 7 * spacing,
                y: cy + i * spacing,
                type: 'normal'
            };
        }

        // Bottom-right corner to bottom (positions 21-27)
        for (let i = 0; i < 7; i++) {
            this.positions[21 + i] = {
                x: cx + (6 - i) * spacing,
                y: cy + 7 * spacing,
                type: 'normal'
            };
        }

        // Bottom arm up (positions 28-34)
        this.positions[28] = { x: cx, y: cy + 7 * spacing, type: 'safe' };
        for (let i = 1; i < 7; i++) {
            this.positions[28 + i] = {
                x: cx,
                y: cy + 7 * spacing - i * spacing,
                type: 'normal'
            };
        }

        // Bottom-left corner to left (positions 35-41)
        for (let i = 0; i < 7; i++) {
            this.positions[35 + i] = {
                x: cx - (i + 1) * spacing,
                y: cy + spacing,
                type: 'normal'
            };
        }

        // Left arm up (positions 42-48)
        this.positions[42] = { x: cx - 7 * spacing, y: cy, type: 'safe' };
        for (let i = 1; i < 7; i++) {
            this.positions[42 + i] = {
                x: cx - 7 * spacing,
                y: cy - i * spacing,
                type: 'normal'
            };
        }

        // Top-left corner back to top (positions 49-55)
        for (let i = 0; i < 7; i++) {
            this.positions[49 + i] = {
                x: cx - (6 - i) * spacing,
                y: cy - 7 * spacing,
                type: 'normal'
            };
        }

        // Home stretches (positions 56-71)
        // Red home (56-59): Goes down from top center
        for (let i = 0; i < 4; i++) {
            this.positions[56 + i] = {
                x: cx,
                y: 75 + i * spacing,
                type: 'home',
                owner: 'red'
            };
        }

        // Blue home (60-63): Goes left from right center
        for (let i = 0; i < 4; i++) {
            this.positions[60 + i] = {
                x: cx + (6 - i) * spacing,
                y: cy,
                type: 'home',
                owner: 'blue'
            };
        }

        // Green home (64-67): Goes up from bottom center
        for (let i = 0; i < 4; i++) {
            this.positions[64 + i] = {
                x: cx,
                y: cy + (6 - i) * spacing,
                type: 'home',
                owner: 'green'
            };
        }

        // Yellow home (68-71): Goes right from left center
        for (let i = 0; i < 4; i++) {
            this.positions[68 + i] = {
                x: cx - (6 - i) * spacing,
                y: cy,
                type: 'home',
                owner: 'yellow'
            };
        }

        // Start areas (off-board, position -1 for each player)
        // These are visual only, positioned in corners
        this.startAreas = {
            red: { x: 80, y: 80 },
            blue: { x: this.width - 80, y: 80 },
            green: { x: this.width - 80, y: this.height - 80 },
            yellow: { x: 80, y: this.height - 80 }
        };
    },

    /**
     * Draw the complete board
     */
    drawBoard(gameState, validMoves = []) {
        this.ctx.fillStyle = this.boardBg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw all spaces
        for (let pos = 0; pos < 72; pos++) {
            this.drawSpace(pos);
        }

        // Draw start areas
        this.drawStartAreas(gameState);

        // Draw home indicators in center
        this.drawCenterArea();

        // Draw valid move highlights
        validMoves.forEach(move => {
            this.highlightSpace(move.to_position);
        });

        // Draw marbles
        if (gameState && gameState.marbles) {
            this.drawMarbles(gameState.marbles);
        }
    },

    /**
     * Draw a single board space
     */
    drawSpace(position) {
        const pos = this.positions[position];
        if (!pos) return;

        const x = pos.x;
        const y = pos.y;
        const r = this.cellSize / 2 - 2;

        // Determine fill color based on space type
        let fillColor = this.spaceBg;
        if (pos.type === 'safe') {
            fillColor = this.safeBg;
        } else if (pos.type === 'home') {
            fillColor = this.colors[pos.owner] || this.homeBg;
        }

        // Draw space circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
        this.ctx.strokeStyle = this.spaceStroke;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw inner shadow for depth
        this.ctx.beginPath();
        this.ctx.arc(x, y, r - 4, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fill();
    },

    /**
     * Highlight a space for valid moves
     */
    highlightSpace(position) {
        const pos = this.positions[position];
        if (!pos) return;

        const r = this.cellSize / 2;

        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.highlightColor;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Pulsing animation
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, r + 2, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(233, 69, 96, 0.3)';
        this.ctx.fill();
    },

    /**
     * Draw start areas for each player
     */
    drawStartAreas(gameState) {
        const colors = ['red', 'blue', 'green', 'yellow'];
        const numPlayers = gameState ? gameState.players.length : 4;

        colors.slice(0, numPlayers).forEach(color => {
            const area = this.startAreas[color];

            // Draw start area background
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(area.x - 40, area.y - 40, 80, 80);

            this.ctx.strokeStyle = this.colors[color];
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(area.x - 40, area.y - 40, 80, 80);

            // Draw "START" label
            this.ctx.fillStyle = this.colors[color];
            this.ctx.font = '10px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('START', area.x, area.y + 45);
        });
    },

    /**
     * Draw center area with home labels
     */
    drawCenterArea() {
        const cx = this.width / 2;
        const cy = this.height / 2;

        // Center circle
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fill();
        this.ctx.strokeStyle = '#e94560';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // "HOME" text
        this.ctx.fillStyle = '#e94560';
        this.ctx.font = 'bold 12px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('HOME', cx, cy);
    },

    /**
     * Draw all marbles
     */
    drawMarbles(marbles) {
        // Group marbles by position for stacking in start areas
        const startMarbles = { red: [], blue: [], green: [], yellow: [] };

        marbles.forEach(marble => {
            if (marble.position === -1) {
                startMarbles[marble.color].push(marble);
            } else {
                this.drawMarble(marble);
            }
        });

        // Draw start area marbles
        Object.keys(startMarbles).forEach(color => {
            const area = this.startAreas[color];
            const marbleList = startMarbles[color];

            marbleList.forEach((marble, index) => {
                const row = Math.floor(index / 2);
                const col = index % 2;
                const x = area.x - 15 + col * 30;
                const y = area.y - 15 + row * 30;

                this.drawMarbleAt(x, y, color, marble.id);
            });
        });
    },

    /**
     * Draw a single marble at its position
     */
    drawMarble(marble) {
        const pos = this.positions[marble.position];
        if (!pos) return;

        this.drawMarbleAt(pos.x, pos.y, marble.color, marble.id);
    },

    /**
     * Draw a marble at specific coordinates
     */
    drawMarbleAt(x, y, color, id, highlighted = false) {
        const r = this.marbleRadius;

        // Marble body
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, Math.PI * 2);

        // Gradient for 3D effect
        const gradient = this.ctx.createRadialGradient(
            x - r/3, y - r/3, 0,
            x, y, r
        );
        gradient.addColorStop(0, this.lightenColor(this.colors[color], 40));
        gradient.addColorStop(0.7, this.colors[color]);
        gradient.addColorStop(1, this.darkenColor(this.colors[color], 30));

        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Border
        this.ctx.strokeStyle = this.darkenColor(this.colors[color], 40);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Highlight shine
        this.ctx.beginPath();
        this.ctx.arc(x - r/3, y - r/3, r/3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
        this.ctx.fill();

        // Selection highlight
        if (highlighted) {
            this.ctx.beginPath();
            this.ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
    },

    /**
     * Get position from click coordinates
     */
    getPositionFromClick(clickX, clickY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = clickX - rect.left;
        const y = clickY - rect.top;

        // Check board positions
        for (let pos = 0; pos < 72; pos++) {
            const posData = this.positions[pos];
            if (!posData) continue;

            const dx = x - posData.x;
            const dy = y - posData.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.cellSize / 2) {
                return { type: 'position', position: pos };
            }
        }

        // Check start areas
        for (const [color, area] of Object.entries(this.startAreas)) {
            if (x >= area.x - 40 && x <= area.x + 40 &&
                y >= area.y - 40 && y <= area.y + 40) {
                return { type: 'start', color: color };
            }
        }

        return null;
    },

    /**
     * Find marble at position
     */
    findMarbleAtPosition(marbles, position) {
        return marbles.find(m => m.position === position);
    },

    /**
     * Find marble in start area by color
     */
    findMarbleInStart(marbles, color) {
        return marbles.find(m => m.position === -1 && m.color === color);
    },

    /**
     * Animate marble movement
     */
    animateMove(marble, fromPos, toPos, gameState, callback) {
        const fromCoords = fromPos === -1
            ? this.getStartCoords(marble.color, gameState.marbles)
            : this.positions[fromPos];
        const toCoords = this.positions[toPos];

        if (!fromCoords || !toCoords) {
            callback();
            return;
        }

        const duration = 300;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const eased = 1 - Math.pow(1 - progress, 3);

            const currentX = fromCoords.x + (toCoords.x - fromCoords.x) * eased;
            const currentY = fromCoords.y + (toCoords.y - fromCoords.y) * eased;

            // Redraw board without the moving marble
            const tempMarbles = gameState.marbles.filter(m => m.id !== marble.id);
            this.drawBoard({ ...gameState, marbles: tempMarbles });

            // Draw moving marble at current position
            this.drawMarbleAt(currentX, currentY, marble.color, marble.id);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                callback();
            }
        };

        requestAnimationFrame(animate);
    },

    /**
     * Get start area coordinates for a marble
     */
    getStartCoords(color, marbles) {
        const area = this.startAreas[color];
        const startMarbles = marbles.filter(m => m.position === -1 && m.color === color);
        const index = startMarbles.length > 0 ? 0 : 0;
        const row = Math.floor(index / 2);
        const col = index % 2;
        return {
            x: area.x - 15 + col * 30,
            y: area.y - 15 + row * 30
        };
    },

    /**
     * Utility: Lighten a color
     */
    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R},${G},${B})`;
    },

    /**
     * Utility: Darken a color
     */
    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `rgb(${R},${G},${B})`;
    }
};
