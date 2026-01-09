# Pac-Man and Ghost entity classes

import random
from constants import (
    DIR_NONE, DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT, ALL_DIRECTIONS,
    GHOST_CHASE, GHOST_SCATTER, GHOST_VULNERABLE, GHOST_EATEN,
    GHOST_BLINKY, GHOST_PINKY, GHOST_INKY, GHOST_CLYDE,
    CHAR_PACMAN_RIGHT, CHAR_PACMAN_LEFT, CHAR_PACMAN_UP, CHAR_PACMAN_DOWN,
    CHAR_PACMAN_CLOSED, CHAR_GHOST, CHAR_GHOST_VULNERABLE, CHAR_GHOST_EYES,
    COLOR_PACMAN, COLOR_BLINKY, COLOR_PINKY, COLOR_INKY, COLOR_CLYDE,
    COLOR_VULNERABLE, COLOR_FLASH
)


class PacMan:
    """Player-controlled Pac-Man character."""

    def __init__(self, x, y):
        self.start_x = x
        self.start_y = y
        self.x = x
        self.y = y
        self.direction = DIR_NONE
        self.next_direction = DIR_NONE  # Queued direction change
        self.animation_frame = 0
        self.is_dead = False

    def reset(self):
        """Reset Pac-Man to starting position."""
        self.x = self.start_x
        self.y = self.start_y
        self.direction = DIR_NONE
        self.next_direction = DIR_NONE
        self.animation_frame = 0
        self.is_dead = False

    def set_direction(self, direction):
        """Queue a direction change."""
        self.next_direction = direction

    def update(self, maze):
        """Update Pac-Man position."""
        if self.is_dead:
            return

        # Try to change to queued direction
        if self.next_direction != DIR_NONE:
            new_x = self.x + self.next_direction[0]
            new_y = self.y + self.next_direction[1]
            new_x, new_y = maze.wrap_position(new_x, new_y)
            if maze.is_walkable(new_x, new_y):
                self.direction = self.next_direction
                self.next_direction = DIR_NONE

        # Move in current direction
        if self.direction != DIR_NONE:
            new_x = self.x + self.direction[0]
            new_y = self.y + self.direction[1]
            new_x, new_y = maze.wrap_position(new_x, new_y)
            if maze.is_walkable(new_x, new_y):
                self.x = new_x
                self.y = new_y

        # Update animation
        self.animation_frame = (self.animation_frame + 1) % 4

    def get_char(self):
        """Get the character to display based on direction and animation."""
        # Mouth open/closed animation
        if self.animation_frame < 2:
            if self.direction == DIR_RIGHT or self.direction == DIR_NONE:
                return CHAR_PACMAN_RIGHT
            elif self.direction == DIR_LEFT:
                return CHAR_PACMAN_LEFT
            elif self.direction == DIR_UP:
                return CHAR_PACMAN_UP
            elif self.direction == DIR_DOWN:
                return CHAR_PACMAN_DOWN
        else:
            return CHAR_PACMAN_CLOSED

    def get_color(self):
        """Get the color pair for Pac-Man."""
        return COLOR_PACMAN

    def get_position(self):
        """Get current position as tuple."""
        return (self.x, self.y)

    def get_ahead_position(self, tiles=4):
        """Get position ahead of Pac-Man (for ghost targeting)."""
        ahead_x = self.x + self.direction[0] * tiles
        ahead_y = self.y + self.direction[1] * tiles
        return (ahead_x, ahead_y)


class Ghost:
    """Base class for ghost enemies."""

    def __init__(self, name, x, y, color, scatter_target):
        self.name = name
        self.start_x = x
        self.start_y = y
        self.x = x
        self.y = y
        self.color = color
        self.scatter_target = scatter_target
        self.direction = DIR_UP
        self.state = GHOST_CHASE
        self.vulnerable_timer = 0
        self.in_house = True
        self.release_timer = 0
        self.speed_modifier = 1.0
        self.move_counter = 0

    def reset(self):
        """Reset ghost to starting position."""
        self.x = self.start_x
        self.y = self.start_y
        self.direction = DIR_UP
        self.state = GHOST_CHASE
        self.vulnerable_timer = 0
        self.in_house = True
        self.move_counter = 0

    def make_vulnerable(self, duration):
        """Make ghost vulnerable (after power pellet)."""
        if self.state != GHOST_EATEN:
            self.state = GHOST_VULNERABLE
            self.vulnerable_timer = duration
            # Reverse direction when becoming vulnerable
            self.direction = (-self.direction[0], -self.direction[1])

    def update_vulnerability(self):
        """Update vulnerability timer."""
        if self.state == GHOST_VULNERABLE:
            self.vulnerable_timer -= 1
            if self.vulnerable_timer <= 0:
                self.state = GHOST_CHASE

    def eat(self):
        """Ghost was eaten, return to ghost house."""
        self.state = GHOST_EATEN

    def get_target(self, pacman, blinky=None, maze=None):
        """Get target position for this ghost. Override in subclasses."""
        return pacman.get_position()

    def choose_direction(self, maze, target):
        """Choose best direction toward target at intersections."""
        valid_moves = maze.get_valid_moves(
            self.x, self.y,
            is_ghost=True,
            is_eaten=(self.state == GHOST_EATEN),
            current_dir=self.direction
        )

        if not valid_moves:
            # Stuck, allow reversing
            valid_moves = maze.get_valid_moves(
                self.x, self.y,
                is_ghost=True,
                is_eaten=(self.state == GHOST_EATEN),
                current_dir=None
            )

        if not valid_moves:
            return self.direction

        # If only one option, take it
        if len(valid_moves) == 1:
            return valid_moves[0]

        # Choose direction that minimizes distance to target
        best_dir = valid_moves[0]
        best_dist = float('inf')

        for direction in valid_moves:
            new_x = self.x + direction[0]
            new_y = self.y + direction[1]
            new_x, new_y = maze.wrap_position(new_x, new_y)
            dist = maze.distance((new_x, new_y), target)
            if dist < best_dist:
                best_dist = dist
                best_dir = direction

        return best_dir

    def update(self, maze, pacman, blinky=None):
        """Update ghost position and state."""
        self.update_vulnerability()

        # Handle ghost house exit
        if self.in_house:
            if self.release_timer > 0:
                self.release_timer -= 1
                return
            # Move toward exit
            target = maze.get_ghost_exit_target()
            if (self.x, self.y) == target:
                self.in_house = False
                self.direction = DIR_LEFT
            else:
                self.direction = self.choose_direction(maze, target)
                new_x = self.x + self.direction[0]
                new_y = self.y + self.direction[1]
                if maze.is_walkable(new_x, new_y, is_ghost=True, is_eaten=True):
                    self.x = new_x
                    self.y = new_y
            return

        # Handle returning to ghost house after being eaten
        if self.state == GHOST_EATEN:
            target = maze.get_ghost_exit_target()
            if maze.distance((self.x, self.y), target) <= 1:
                # Reached ghost house, respawn
                self.x = self.start_x
                self.y = self.start_y
                self.state = GHOST_CHASE
                self.in_house = True
                self.release_timer = 10  # Brief delay before leaving again
                return

            self.direction = self.choose_direction(maze, target)
            # Eaten ghosts move faster (every frame)
            new_x = self.x + self.direction[0]
            new_y = self.y + self.direction[1]
            new_x, new_y = maze.wrap_position(new_x, new_y)
            if maze.is_walkable(new_x, new_y, is_ghost=True, is_eaten=True):
                self.x = new_x
                self.y = new_y
            return

        # Vulnerable ghosts move slower
        if self.state == GHOST_VULNERABLE:
            self.move_counter += 1
            if self.move_counter < 2:
                return
            self.move_counter = 0

        # Normal movement - choose target based on state
        if self.state == GHOST_SCATTER:
            target = self.scatter_target
        elif self.state == GHOST_VULNERABLE:
            # Move randomly when vulnerable
            target = (random.randint(0, maze.width - 1), random.randint(0, maze.height - 1))
        else:
            target = self.get_target(pacman, blinky, maze)

        self.direction = self.choose_direction(maze, target)

        new_x = self.x + self.direction[0]
        new_y = self.y + self.direction[1]
        new_x, new_y = maze.wrap_position(new_x, new_y)

        if maze.is_walkable(new_x, new_y, is_ghost=True):
            self.x = new_x
            self.y = new_y

    def get_char(self):
        """Get the character to display."""
        if self.state == GHOST_EATEN:
            return CHAR_GHOST_EYES
        elif self.state == GHOST_VULNERABLE:
            return CHAR_GHOST_VULNERABLE
        return CHAR_GHOST

    def get_color(self):
        """Get the color pair for this ghost."""
        if self.state == GHOST_EATEN:
            return COLOR_FLASH  # White eyes
        elif self.state == GHOST_VULNERABLE:
            # Flash between blue and white near end of vulnerability
            if self.vulnerable_timer < 20 and self.vulnerable_timer % 4 < 2:
                return COLOR_FLASH
            return COLOR_VULNERABLE
        return self.color

    def get_position(self):
        """Get current position as tuple."""
        return (self.x, self.y)


class Blinky(Ghost):
    """Red ghost - direct chaser."""

    def __init__(self, x, y, scatter_target):
        super().__init__(GHOST_BLINKY, x, y, COLOR_BLINKY, scatter_target)
        self.release_timer = 0  # Blinky starts immediately

    def get_target(self, pacman, blinky=None, maze=None):
        """Target Pac-Man's current position directly."""
        return pacman.get_position()


class Pinky(Ghost):
    """Pink ghost - ambusher."""

    def __init__(self, x, y, scatter_target):
        super().__init__(GHOST_PINKY, x, y, COLOR_PINKY, scatter_target)
        self.release_timer = 30  # Short delay

    def get_target(self, pacman, blinky=None, maze=None):
        """Target 4 tiles ahead of Pac-Man."""
        return pacman.get_ahead_position(4)


class Inky(Ghost):
    """Cyan ghost - unpredictable."""

    def __init__(self, x, y, scatter_target):
        super().__init__(GHOST_INKY, x, y, COLOR_INKY, scatter_target)
        self.release_timer = 60  # Medium delay

    def get_target(self, pacman, blinky=None, maze=None):
        """
        Target is calculated using Blinky's position:
        Get position 2 tiles ahead of Pac-Man, then double the vector from Blinky to that position.
        """
        if blinky is None:
            return pacman.get_position()

        ahead = pacman.get_ahead_position(2)
        blinky_pos = blinky.get_position()

        # Vector from Blinky to ahead position, doubled
        target_x = ahead[0] + (ahead[0] - blinky_pos[0])
        target_y = ahead[1] + (ahead[1] - blinky_pos[1])

        return (target_x, target_y)


class Clyde(Ghost):
    """Orange ghost - random/shy."""

    def __init__(self, x, y, scatter_target):
        super().__init__(GHOST_CLYDE, x, y, COLOR_CLYDE, scatter_target)
        self.release_timer = 90  # Long delay

    def get_target(self, pacman, blinky=None, maze=None):
        """
        Target Pac-Man when far away (> 8 tiles),
        otherwise retreat to scatter corner.
        """
        pacman_pos = pacman.get_position()
        distance = abs(self.x - pacman_pos[0]) + abs(self.y - pacman_pos[1])

        if distance > 8:
            return pacman_pos
        else:
            return self.scatter_target
