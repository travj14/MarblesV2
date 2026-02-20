/**
 * API Client for Marbles Game
 */
const GameAPI = {
    baseUrl: '/api',

    /**
     * Create a new game
     */
    async createGame(options) {
        const response = await fetch(`${this.baseUrl}/game/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create game');
        }

        return response.json();
    },

    /**
     * Get current game state
     */
    async getGame(gameId) {
        const response = await fetch(`${this.baseUrl}/game/${gameId}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get game');
        }

        return response.json();
    },

    /**
     * Roll dice for current player
     */
    async rollDice(gameId) {
        const response = await fetch(`${this.baseUrl}/game/${gameId}/roll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to roll dice');
        }

        return response.json();
    },

    /**
     * Make a move
     */
    async makeMove(gameId, marbleId, toPosition) {
        const response = await fetch(`${this.baseUrl}/game/${gameId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                marble_id: marbleId,
                to_position: toPosition
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to make move');
        }

        return response.json();
    },

    /**
     * Execute AI turn
     */
    async aiTurn(gameId) {
        const response = await fetch(`${this.baseUrl}/game/${gameId}/ai-turn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to execute AI turn');
        }

        return response.json();
    },

    /**
     * Delete a game
     */
    async deleteGame(gameId) {
        const response = await fetch(`${this.baseUrl}/game/${gameId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete game');
        }

        return response.json();
    }
};
