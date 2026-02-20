"""
AI Player module - Implements AI opponents with different difficulty levels
"""
import random
from typing import List, Optional
from game_engine import GameEngine, Move, Player, Marble, TRACK_SIZE, HOME_ENTRIES, HOME_SIZE, SAFE_SPOTS


class AIPlayer:
    """AI opponent for Marbles game"""

    def __init__(self, difficulty: str = "medium"):
        self.difficulty = difficulty

    def choose_move(self, engine: GameEngine, valid_moves: List[Move]) -> Optional[Move]:
        """Select a move based on difficulty level"""
        if not valid_moves:
            return None

        if self.difficulty == "easy":
            return self._easy_move(valid_moves)
        elif self.difficulty == "medium":
            return self._medium_move(engine, valid_moves)
        else:  # hard
            return self._hard_move(engine, valid_moves)

    def _easy_move(self, valid_moves: List[Move]) -> Move:
        """Easy AI: Random valid move"""
        return random.choice(valid_moves)

    def _medium_move(self, engine: GameEngine, valid_moves: List[Move]) -> Move:
        """Medium AI: Prioritize captures > enter home > exit start > advance"""
        scored_moves = []

        for move in valid_moves:
            score = self._score_move(engine, move)
            scored_moves.append((move, score))

        # Sort by score descending
        scored_moves.sort(key=lambda x: x[1], reverse=True)

        # Add some randomness - pick from top 2 if close scores
        if len(scored_moves) > 1:
            top_score = scored_moves[0][1]
            close_moves = [m for m, s in scored_moves if s >= top_score - 10]
            return random.choice(close_moves)

        return scored_moves[0][0]

    def _hard_move(self, engine: GameEngine, valid_moves: List[Move]) -> Move:
        """Hard AI: Strategic with look-ahead and defensive play"""
        scored_moves = []

        for move in valid_moves:
            score = self._score_move_advanced(engine, move)
            scored_moves.append((move, score))

        # Sort by score descending
        scored_moves.sort(key=lambda x: x[1], reverse=True)
        return scored_moves[0][0]

    def _score_move(self, engine: GameEngine, move: Move) -> float:
        """Score a move for medium difficulty"""
        score = 0.0
        marble = engine.marbles[move.marble_id]
        player = engine.players[marble.player_id]

        # Entering home stretch
        home_start = HOME_ENTRIES[player.color]
        if move.to_position >= home_start:
            # Higher score the closer to final home position
            home_pos = move.to_position - home_start
            score += 100 + (home_pos * 25)

        # Capturing opponent
        if move.captured_marble_id:
            captured = engine.marbles[move.captured_marble_id]
            # More valuable to capture marbles further along
            if captured.position >= 0:
                score += 50 + (captured.position * 0.5)
            else:
                score += 50

        # Exiting start area
        if move.is_entering_track:
            score += 40

        # Advancing on track
        if move.from_position >= 0 and move.to_position < home_start:
            # Prefer moving marbles that are behind
            progress = move.to_position - move.from_position
            if progress < 0:
                progress += TRACK_SIZE  # Handle wrap-around
            score += progress

        # Moving to safe spot
        if move.to_position in SAFE_SPOTS:
            score += 15

        return score

    def _score_move_advanced(self, engine: GameEngine, move: Move) -> float:
        """Advanced scoring for hard difficulty with defensive consideration"""
        score = self._score_move(engine, move)
        marble = engine.marbles[move.marble_id]
        player = engine.players[marble.player_id]

        # Defensive: Avoid positions where opponent can capture us
        if move.to_position < TRACK_SIZE and move.to_position not in SAFE_SPOTS:
            danger_score = self._calculate_danger(engine, move.to_position, player.id)
            score -= danger_score

        # Offensive: Prefer positions that block opponents
        block_score = self._calculate_blocking_value(engine, move.to_position, player.id)
        score += block_score

        # Prefer spreading marbles out rather than clustering
        spread_score = self._calculate_spread_value(engine, move, player.id)
        score += spread_score

        return score

    def _calculate_danger(self, engine: GameEngine, position: int,
                          player_id: int) -> float:
        """Calculate how dangerous a position is (can opponent capture us?)"""
        danger = 0.0

        for other_player in engine.players:
            if other_player.id == player_id:
                continue

            for marble in other_player.marbles:
                if marble.position < 0:
                    continue  # In start, can't threaten

                # Check if opponent could reach this position with dice 1-6
                for dice in range(1, 7):
                    potential_pos = (marble.position + dice) % TRACK_SIZE
                    if potential_pos == position:
                        # Weight by probability (1/6 for each dice value)
                        danger += 10 * (1/6)

        return danger

    def _calculate_blocking_value(self, engine: GameEngine, position: int,
                                  player_id: int) -> float:
        """Calculate value of blocking opponent's path"""
        block_value = 0.0

        for other_player in engine.players:
            if other_player.id == player_id:
                continue

            for marble in other_player.marbles:
                if marble.position < 0:
                    continue

                # Check if we're blocking their path to home
                other_home_entry = HOME_ENTRIES[other_player.color]
                other_start = (other_home_entry - 56) % TRACK_SIZE  # Rough start position

                # If opponent marble is approaching their home and we block
                distance_to_home = (other_start - marble.position) % TRACK_SIZE
                if 0 < distance_to_home < 14:
                    # Check if position is in their path
                    path_pos = marble.position
                    for _ in range(distance_to_home):
                        path_pos = (path_pos + 1) % TRACK_SIZE
                        if path_pos == position:
                            block_value += 5
                            break

        return block_value

    def _calculate_spread_value(self, engine: GameEngine, move: Move,
                                player_id: int) -> float:
        """Prefer spreading marbles out for more move options"""
        player = engine.players[player_id]
        spread_value = 0.0

        # Count marbles in start - penalize having many in start
        marbles_in_start = sum(1 for m in player.marbles if m.position == -1)
        if move.is_entering_track and marbles_in_start > 2:
            spread_value += 10  # Encourage getting marbles out

        return spread_value


def get_ai_move(engine: GameEngine) -> Optional[dict]:
    """Get AI move for current player"""
    player = engine.get_current_player()
    if not player.is_ai:
        return None

    # Roll dice first
    dice_value, valid_moves = engine.roll_dice()

    if not valid_moves:
        return {
            "dice_value": dice_value,
            "move": None,
            "skipped": True
        }

    # Choose move based on difficulty
    ai = AIPlayer(player.ai_difficulty)
    chosen_move = ai.choose_move(engine, valid_moves)

    if chosen_move:
        result = engine.make_move(chosen_move.marble_id, chosen_move.to_position)
        return {
            "dice_value": dice_value,
            "move": chosen_move.to_dict(),
            "result": result
        }

    return None
