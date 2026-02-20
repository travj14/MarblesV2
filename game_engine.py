"""
Marbles Game Engine - Core game rules and board logic for Aggravation/Trouble
"""
import random
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class PlayerColor(Enum):
    RED = "red"
    BLUE = "blue"
    GREEN = "green"
    YELLOW = "yellow"


# Board configuration
TRACK_SIZE = 56  # Main circular track
HOME_SIZE = 4    # Each player's home stretch
MARBLES_PER_PLAYER = 4

# Starting positions on main track for each player
START_POSITIONS = {
    PlayerColor.RED: 0,
    PlayerColor.BLUE: 14,
    PlayerColor.GREEN: 28,
    PlayerColor.YELLOW: 42
}

# Home stretch starting positions (off main track)
HOME_ENTRIES = {
    PlayerColor.RED: 56,
    PlayerColor.BLUE: 60,
    PlayerColor.GREEN: 64,
    PlayerColor.YELLOW: 68
}

# Safe spots (can't be captured here)
SAFE_SPOTS = [0, 14, 28, 42]

# Colors list for indexing
COLORS = [PlayerColor.RED, PlayerColor.BLUE, PlayerColor.GREEN, PlayerColor.YELLOW]


@dataclass
class Marble:
    id: str
    player_id: int
    color: PlayerColor
    position: int  # -1 = in start area, 0-55 = on track, 56+ = in home

    def is_in_start(self) -> bool:
        return self.position == -1

    def is_on_track(self) -> bool:
        return 0 <= self.position < TRACK_SIZE

    def is_in_home(self) -> bool:
        home_start = HOME_ENTRIES[self.color]
        return home_start <= self.position < home_start + HOME_SIZE

    def is_finished(self) -> bool:
        """Marble has reached final home position"""
        home_start = HOME_ENTRIES[self.color]
        return self.position == home_start + HOME_SIZE - 1

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "player_id": self.player_id,
            "color": self.color.value,
            "position": self.position
        }

    @staticmethod
    def from_dict(data: dict) -> "Marble":
        return Marble(
            id=data["id"],
            player_id=data["player_id"],
            color=PlayerColor(data["color"]),
            position=data["position"]
        )


@dataclass
class Player:
    id: int
    name: str
    color: PlayerColor
    is_ai: bool
    ai_difficulty: str = "medium"
    marbles: List[Marble] = field(default_factory=list)

    def marbles_home(self) -> int:
        """Count marbles that have finished"""
        home_start = HOME_ENTRIES[self.color]
        home_end = home_start + HOME_SIZE
        return sum(1 for m in self.marbles if home_start <= m.position < home_end)

    def marbles_in_start(self) -> int:
        return sum(1 for m in self.marbles if m.position == -1)

    def has_won(self) -> bool:
        return self.marbles_home() == MARBLES_PER_PLAYER

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color.value,
            "is_ai": self.is_ai,
            "ai_difficulty": self.ai_difficulty,
            "marbles_home": self.marbles_home(),
            "marbles_in_start": self.marbles_in_start()
        }

    @staticmethod
    def from_dict(data: dict, marbles: List[Marble]) -> "Player":
        player = Player(
            id=data["id"],
            name=data["name"],
            color=PlayerColor(data["color"]),
            is_ai=data["is_ai"],
            ai_difficulty=data.get("ai_difficulty", "medium")
        )
        player.marbles = [m for m in marbles if m.player_id == player.id]
        return player


@dataclass
class Move:
    marble_id: str
    from_position: int
    to_position: int
    is_entering_track: bool = False
    captured_marble_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "marble_id": self.marble_id,
            "from_position": self.from_position,
            "to_position": self.to_position,
            "is_entering_track": self.is_entering_track,
            "captured_marble_id": self.captured_marble_id
        }


class GameEngine:
    """Core game logic for Aggravation/Trouble"""

    def __init__(self):
        self.players: List[Player] = []
        self.marbles: Dict[str, Marble] = {}
        self.current_player: int = 0
        self.dice_value: Optional[int] = None
        self.status: str = "waiting"  # waiting, rolling, moving, finished
        self.winner: Optional[int] = None
        self.turn_count: int = 0

    def create_game(self, num_players: int, player_names: List[str],
                    ai_players: List[int] = None, ai_difficulty: str = "medium") -> dict:
        """Initialize a new game"""
        if num_players < 2 or num_players > 4:
            raise ValueError("Must have 2-4 players")

        ai_players = ai_players or []
        self.players = []
        self.marbles = {}

        for i in range(num_players):
            color = COLORS[i]
            player = Player(
                id=i,
                name=player_names[i] if i < len(player_names) else f"Player {i+1}",
                color=color,
                is_ai=(i in ai_players),
                ai_difficulty=ai_difficulty
            )

            # Create 4 marbles per player
            for j in range(MARBLES_PER_PLAYER):
                marble_id = f"{color.value[0]}{j}"  # e.g., "r0", "r1", "b0"
                marble = Marble(
                    id=marble_id,
                    player_id=i,
                    color=color,
                    position=-1  # Start in base
                )
                player.marbles.append(marble)
                self.marbles[marble_id] = marble

            self.players.append(player)

        self.current_player = 0
        self.dice_value = None
        self.status = "rolling"
        self.winner = None
        self.turn_count = 0

        return self.get_state()

    def roll_dice(self) -> Tuple[int, List[Move]]:
        """Roll dice and calculate valid moves"""
        if self.status != "rolling":
            raise ValueError(f"Cannot roll dice in state: {self.status}")

        self.dice_value = random.randint(1, 6)
        valid_moves = self.get_valid_moves(self.current_player, self.dice_value)

        if valid_moves:
            self.status = "moving"
        else:
            # No valid moves, advance turn
            self._advance_turn(rolled_six=False)

        return self.dice_value, valid_moves

    def get_valid_moves(self, player_id: int, dice_value: int) -> List[Move]:
        """Calculate all valid moves for a player given a dice roll"""
        player = self.players[player_id]
        moves = []

        for marble in player.marbles:
            move = self._get_move_for_marble(marble, dice_value, player)
            if move:
                moves.append(move)

        return moves

    def _get_move_for_marble(self, marble: Marble, dice_value: int,
                              player: Player) -> Optional[Move]:
        """Calculate valid move for a single marble"""

        # Marble in start area
        if marble.is_in_start():
            # Can only exit on 1 or 6
            if dice_value in [1, 6]:
                start_pos = START_POSITIONS[player.color]
                # Check if start position is blocked by own marble
                if not self._is_blocked_by_own_marble(start_pos, player.id):
                    captured = self._check_capture(start_pos, player.id)
                    return Move(
                        marble_id=marble.id,
                        from_position=-1,
                        to_position=start_pos,
                        is_entering_track=True,
                        captured_marble_id=captured
                    )
            return None

        # Marble on track
        if marble.is_on_track():
            new_pos = self._calculate_track_position(marble, dice_value, player)
            if new_pos is not None:
                # Check if blocked by own marble
                if not self._is_blocked_by_own_marble(new_pos, player.id):
                    captured = self._check_capture(new_pos, player.id) if new_pos < TRACK_SIZE else None
                    return Move(
                        marble_id=marble.id,
                        from_position=marble.position,
                        to_position=new_pos,
                        captured_marble_id=captured
                    )
            return None

        # Marble in home stretch
        if marble.is_in_home():
            home_start = HOME_ENTRIES[player.color]
            home_pos = marble.position - home_start  # 0-3 within home
            new_home_pos = home_pos + dice_value

            # Can't overshoot home
            if new_home_pos < HOME_SIZE:
                new_pos = home_start + new_home_pos
                if not self._is_blocked_by_own_marble(new_pos, player.id):
                    return Move(
                        marble_id=marble.id,
                        from_position=marble.position,
                        to_position=new_pos
                    )
            return None

        return None

    def _calculate_track_position(self, marble: Marble, dice_value: int,
                                   player: Player) -> Optional[int]:
        """Calculate new position on track, handling home entry"""
        current = marble.position
        start_pos = START_POSITIONS[player.color]
        home_start = HOME_ENTRIES[player.color]

        # Calculate positions to move
        new_pos = current
        for _ in range(dice_value):
            new_pos = (new_pos + 1) % TRACK_SIZE

            # Check for home entry (pass start position coming from behind)
            # Player enters home when they complete a full loop
            if new_pos == start_pos:
                # We've completed the track, enter home stretch
                remaining = dice_value - ((new_pos - current) % TRACK_SIZE)
                if remaining > 0 and remaining <= HOME_SIZE:
                    return home_start + remaining - 1
                elif remaining == 0:
                    # Exact landing on start, still on track
                    return new_pos
                else:
                    # Would overshoot home
                    return None

        return new_pos

    def _is_blocked_by_own_marble(self, position: int, player_id: int) -> bool:
        """Check if position is occupied by player's own marble"""
        for marble in self.marbles.values():
            if marble.player_id == player_id and marble.position == position:
                return True
        return False

    def _check_capture(self, position: int, player_id: int) -> Optional[str]:
        """Check if landing on position captures opponent marble"""
        # Can't capture on safe spots
        if position in SAFE_SPOTS:
            return None

        for marble in self.marbles.values():
            if marble.player_id != player_id and marble.position == position:
                return marble.id
        return None

    def make_move(self, marble_id: str, to_position: int) -> dict:
        """Execute a move"""
        if self.status != "moving":
            raise ValueError(f"Cannot make move in state: {self.status}")

        marble = self.marbles.get(marble_id)
        if not marble:
            raise ValueError(f"Marble {marble_id} not found")

        if marble.player_id != self.current_player:
            raise ValueError("Not your marble")

        # Validate move
        valid_moves = self.get_valid_moves(self.current_player, self.dice_value)
        matching_move = None
        for move in valid_moves:
            if move.marble_id == marble_id and move.to_position == to_position:
                matching_move = move
                break

        if not matching_move:
            raise ValueError("Invalid move")

        # Execute move
        old_position = marble.position
        marble.position = to_position

        # Handle capture
        captured_marble = None
        if matching_move.captured_marble_id:
            captured = self.marbles[matching_move.captured_marble_id]
            captured.position = -1  # Send back to start
            captured_marble = captured.to_dict()

        # Check for win
        player = self.players[self.current_player]
        if player.has_won():
            self.status = "finished"
            self.winner = self.current_player
        else:
            # Advance turn (extra turn on 6)
            self._advance_turn(rolled_six=(self.dice_value == 6))

        return {
            "move": matching_move.to_dict(),
            "captured": captured_marble,
            "game_over": self.status == "finished",
            "winner": self.winner,
            "extra_turn": self.dice_value == 6 and self.status != "finished"
        }

    def _advance_turn(self, rolled_six: bool):
        """Advance to next player's turn"""
        self.turn_count += 1

        if rolled_six and self.status != "finished":
            # Same player rolls again
            self.status = "rolling"
            self.dice_value = None
        else:
            # Next player
            self.current_player = (self.current_player + 1) % len(self.players)
            self.status = "rolling"
            self.dice_value = None

    def get_state(self) -> dict:
        """Get current game state as JSON-serializable dict"""
        return {
            "players": [p.to_dict() for p in self.players],
            "marbles": [m.to_dict() for m in self.marbles.values()],
            "current_player": self.current_player,
            "dice_value": self.dice_value,
            "status": self.status,
            "winner": self.winner,
            "turn_count": self.turn_count
        }

    def load_state(self, state: dict):
        """Load game state from dict"""
        # Recreate marbles
        self.marbles = {}
        for m_data in state["marbles"]:
            marble = Marble.from_dict(m_data)
            self.marbles[marble.id] = marble

        # Recreate players
        self.players = []
        for p_data in state["players"]:
            player = Player.from_dict(p_data, list(self.marbles.values()))
            self.players.append(player)

        self.current_player = state["current_player"]
        self.dice_value = state["dice_value"]
        self.status = state["status"]
        self.winner = state["winner"]
        self.turn_count = state.get("turn_count", 0)

    def get_current_player(self) -> Player:
        """Get the current player"""
        return self.players[self.current_player]

    def is_ai_turn(self) -> bool:
        """Check if current turn is AI player"""
        return self.players[self.current_player].is_ai
