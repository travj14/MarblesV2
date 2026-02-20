"""
Database module - SQLite setup and game persistence
"""
import sqlite3
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

# Database path
DB_PATH = Path(__file__).parent / "instance" / "marbles.db"


def get_db_connection():
    """Get database connection with row factory"""
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database tables"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            state TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            winner INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def create_game(state: Dict[str, Any]) -> str:
    """Create a new game and return its ID"""
    game_id = str(uuid.uuid4())[:8]  # Short UUID
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO games (id, state, status) VALUES (?, ?, ?)",
        (game_id, json.dumps(state), "active")
    )

    conn.commit()
    conn.close()
    return game_id


def get_game(game_id: str) -> Optional[Dict[str, Any]]:
    """Get game by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM games WHERE id = ?", (game_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "id": row["id"],
            "state": json.loads(row["state"]),
            "status": row["status"],
            "winner": row["winner"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }
    return None


def update_game(game_id: str, state: Dict[str, Any], status: str = None,
                winner: int = None):
    """Update game state"""
    conn = get_db_connection()
    cursor = conn.cursor()

    if status and winner is not None:
        cursor.execute(
            """UPDATE games
               SET state = ?, status = ?, winner = ?, updated_at = ?
               WHERE id = ?""",
            (json.dumps(state), status, winner, datetime.now(), game_id)
        )
    elif status:
        cursor.execute(
            """UPDATE games
               SET state = ?, status = ?, updated_at = ?
               WHERE id = ?""",
            (json.dumps(state), status, datetime.now(), game_id)
        )
    else:
        cursor.execute(
            """UPDATE games
               SET state = ?, updated_at = ?
               WHERE id = ?""",
            (json.dumps(state), datetime.now(), game_id)
        )

    conn.commit()
    conn.close()


def delete_game(game_id: str) -> bool:
    """Delete a game"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))
    deleted = cursor.rowcount > 0

    conn.commit()
    conn.close()
    return deleted


def get_all_games(limit: int = 10) -> list:
    """Get recent games"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT id, status, winner, created_at, updated_at
           FROM games ORDER BY updated_at DESC LIMIT ?""",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


# Initialize database on module load
init_db()
