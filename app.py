"""
Marbles Game - Flask Application
Main entry point with API routes
"""
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from game_engine import GameEngine
from ai_player import get_ai_move
import database as db

app = Flask(__name__,
            static_folder='static',
            template_folder='templates')
CORS(app)

# In-memory game engines (for active games)
active_games = {}


def get_engine(game_id: str) -> GameEngine:
    """Get or create engine for a game"""
    if game_id not in active_games:
        game_data = db.get_game(game_id)
        if not game_data:
            return None
        engine = GameEngine()
        engine.load_state(game_data["state"])
        active_games[game_id] = engine
    return active_games[game_id]


def save_engine(game_id: str, engine: GameEngine):
    """Save engine state to database"""
    state = engine.get_state()
    status = "finished" if engine.status == "finished" else "active"
    db.update_game(game_id, state, status, engine.winner)


# =============================================================================
# Page Routes
# =============================================================================

@app.route('/')
def index():
    """Landing page"""
    return render_template('index.html')


@app.route('/game/<game_id>')
def game_page(game_id):
    """Game page"""
    game = db.get_game(game_id)
    if not game:
        return render_template('index.html', error="Game not found")
    return render_template('game.html', game_id=game_id)


# =============================================================================
# API Routes
# =============================================================================

@app.route('/api/game/new', methods=['POST'])
def create_game():
    """Create a new game"""
    data = request.get_json()

    num_players = data.get('num_players', 2)
    player_names = data.get('player_names', [])
    ai_players = data.get('ai_players', [])
    ai_difficulty = data.get('ai_difficulty', 'medium')
    mode = data.get('mode', 'local')  # 'ai' or 'local'

    # For AI mode, make all players except first AI
    if mode == 'ai':
        ai_players = list(range(1, num_players))

    # Ensure we have enough names
    while len(player_names) < num_players:
        player_names.append(f"Player {len(player_names) + 1}")

    # Create engine and game
    engine = GameEngine()
    state = engine.create_game(
        num_players=num_players,
        player_names=player_names,
        ai_players=ai_players,
        ai_difficulty=ai_difficulty
    )

    # Save to database
    game_id = db.create_game(state)
    active_games[game_id] = engine

    return jsonify({
        "game_id": game_id,
        "state": state
    })


@app.route('/api/game/<game_id>', methods=['GET'])
def get_game(game_id):
    """Get current game state"""
    engine = get_engine(game_id)
    if not engine:
        return jsonify({"error": "Game not found"}), 404

    return jsonify({
        "game_id": game_id,
        "state": engine.get_state()
    })


@app.route('/api/game/<game_id>/roll', methods=['POST'])
def roll_dice(game_id):
    """Roll dice for current player"""
    engine = get_engine(game_id)
    if not engine:
        return jsonify({"error": "Game not found"}), 404

    try:
        dice_value, valid_moves = engine.roll_dice()
        save_engine(game_id, engine)

        return jsonify({
            "dice_value": dice_value,
            "valid_moves": [m.to_dict() for m in valid_moves],
            "state": engine.get_state()
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/game/<game_id>/move', methods=['POST'])
def make_move(game_id):
    """Make a move"""
    engine = get_engine(game_id)
    if not engine:
        return jsonify({"error": "Game not found"}), 404

    data = request.get_json()
    marble_id = data.get('marble_id')
    to_position = data.get('to_position')

    if marble_id is None or to_position is None:
        return jsonify({"error": "Missing marble_id or to_position"}), 400

    try:
        result = engine.make_move(marble_id, to_position)
        save_engine(game_id, engine)

        return jsonify({
            **result,
            "state": engine.get_state()
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/game/<game_id>/ai-turn', methods=['POST'])
def ai_turn(game_id):
    """Execute AI player's turn"""
    engine = get_engine(game_id)
    if not engine:
        return jsonify({"error": "Game not found"}), 404

    if not engine.is_ai_turn():
        return jsonify({"error": "Not AI's turn"}), 400

    result = get_ai_move(engine)
    save_engine(game_id, engine)

    return jsonify({
        **result,
        "state": engine.get_state()
    })


@app.route('/api/game/<game_id>', methods=['DELETE'])
def delete_game(game_id):
    """Delete a game"""
    if game_id in active_games:
        del active_games[game_id]

    deleted = db.delete_game(game_id)
    if deleted:
        return jsonify({"success": True})
    return jsonify({"error": "Game not found"}), 404


# =============================================================================
# Run
# =============================================================================

if __name__ == '__main__':
    print("Starting Marbles Game Server...")
    print("Open http://localhost:5000 in your browser")
    app.run(debug=True, port=5000)
