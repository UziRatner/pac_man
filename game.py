# Game class and main loop

import curses
import os
from maze import Maze
from entities import PacMan, Blinky, Pinky, Inky, Clyde
import sounds
from constants import (
    FPS, GHOST_VULNERABLE_TIME, STARTING_LIVES, HIGH_SCORE_FILE,
    SCORE_DOT, SCORE_POWER_PELLET, SCORE_GHOST_BASE,
    STATE_START, STATE_PLAYING, STATE_PAUSED, STATE_DYING,
    STATE_LEVEL_COMPLETE, STATE_GAME_OVER,
    GHOST_VULNERABLE, GHOST_EATEN,
    COLOR_PACMAN, COLOR_BLINKY, COLOR_PINKY, COLOR_INKY, COLOR_CLYDE,
    COLOR_VULNERABLE, COLOR_WALL, COLOR_DOT, COLOR_POWER_PELLET,
    COLOR_TEXT, COLOR_FLASH,
    CHAR_WALL, CHAR_DOT, CHAR_POWER_PELLET, CHAR_EMPTY, CHAR_GATE, CHAR_PACMAN_RIGHT,
    DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_NONE,
    CELL_WALL, CELL_DOT, CELL_POWER_PELLET, CELL_GATE, CELL_GHOST_HOUSE
)


class Game:
    """Main game class managing state, rendering, and game loop."""

    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.maze = Maze()
        self.pacman = None
        self.ghosts = []
        self.blinky = None

        self.score = 0
        self.high_score = self.load_high_score()
        self.lives = STARTING_LIVES
        self.level = 1
        self.state = STATE_START
        self.ghost_eat_multiplier = 1
        self.death_animation_frame = 0

        self.setup_curses()
        self.init_entities()

    def setup_curses(self):
        """Initialize curses settings and colors."""
        curses.curs_set(0)  # Hide cursor
        self.stdscr.keypad(True)  # Enable arrow keys
        self.stdscr.nodelay(True)  # Non-blocking input
        self.stdscr.timeout(1000 // FPS)  # Frame timing

        # Initialize colors
        curses.start_color()
        curses.use_default_colors()

        # Try to use 256 colors for more accurate original Pac-Man colors
        if curses.COLORS >= 256:
            # Original Pac-Man colors (256-color mode)
            curses.init_pair(COLOR_PACMAN, 226, -1)      # Bright yellow
            curses.init_pair(COLOR_BLINKY, 196, -1)      # Bright red
            curses.init_pair(COLOR_PINKY, 213, -1)       # Pink
            curses.init_pair(COLOR_INKY, 51, -1)         # Cyan
            curses.init_pair(COLOR_CLYDE, 208, -1)       # Orange
            curses.init_pair(COLOR_VULNERABLE, 21, -1)   # Blue
            curses.init_pair(COLOR_WALL, 21, -1)         # Blue walls
            curses.init_pair(COLOR_DOT, 223, -1)         # Cream/peach dots
            curses.init_pair(COLOR_POWER_PELLET, 231, -1)  # Bright white
            curses.init_pair(COLOR_TEXT, 231, -1)        # White text
            curses.init_pair(COLOR_FLASH, 231, -1)       # White flash
        else:
            # Fallback to 8 colors
            curses.init_pair(COLOR_PACMAN, curses.COLOR_YELLOW, -1)
            curses.init_pair(COLOR_BLINKY, curses.COLOR_RED, -1)
            curses.init_pair(COLOR_PINKY, curses.COLOR_MAGENTA, -1)
            curses.init_pair(COLOR_INKY, curses.COLOR_CYAN, -1)
            curses.init_pair(COLOR_CLYDE, curses.COLOR_YELLOW, -1)
            curses.init_pair(COLOR_VULNERABLE, curses.COLOR_BLUE, -1)
            curses.init_pair(COLOR_WALL, curses.COLOR_BLUE, -1)
            curses.init_pair(COLOR_DOT, curses.COLOR_WHITE, -1)
            curses.init_pair(COLOR_POWER_PELLET, curses.COLOR_WHITE, -1)
            curses.init_pair(COLOR_TEXT, curses.COLOR_WHITE, -1)
            curses.init_pair(COLOR_FLASH, curses.COLOR_WHITE, -1)

    def init_entities(self):
        """Initialize Pac-Man and ghosts."""
        # Create Pac-Man
        self.pacman = PacMan(*self.maze.pacman_start)

        # Create ghosts
        ghost_starts = self.maze.ghost_starts
        scatter_targets = self.maze.scatter_targets

        self.blinky = Blinky(
            ghost_starts['blinky'][0], ghost_starts['blinky'][1],
            scatter_targets['blinky']
        )
        pinky = Pinky(
            ghost_starts['pinky'][0], ghost_starts['pinky'][1],
            scatter_targets['pinky']
        )
        inky = Inky(
            ghost_starts['inky'][0], ghost_starts['inky'][1],
            scatter_targets['inky']
        )
        clyde = Clyde(
            ghost_starts['clyde'][0], ghost_starts['clyde'][1],
            scatter_targets['clyde']
        )

        self.ghosts = [self.blinky, pinky, inky, clyde]

    def reset_positions(self):
        """Reset all entity positions after death or new level."""
        self.pacman.reset()
        for ghost in self.ghosts:
            ghost.reset()
        self.ghost_eat_multiplier = 1

    def load_high_score(self):
        """Load high score from file."""
        try:
            with open(HIGH_SCORE_FILE, 'r') as f:
                return int(f.read().strip())
        except (FileNotFoundError, ValueError):
            return 0

    def save_high_score(self):
        """Save high score to file."""
        if self.score > self.high_score:
            self.high_score = self.score
            with open(HIGH_SCORE_FILE, 'w') as f:
                f.write(str(self.high_score))

    def handle_input(self):
        """Handle keyboard input."""
        try:
            key = self.stdscr.getch()
        except curses.error:
            return True

        if key == -1:
            return True

        # Quit
        if key == ord('q') or key == ord('Q'):
            return False

        # Toggle sound with M key
        if key == ord('m') or key == ord('M'):
            sounds.sound_enabled = not sounds.sound_enabled
            return True

        # State-specific input handling
        if self.state == STATE_START:
            if key == ord('\n') or key == ord(' '):
                self.state = STATE_PLAYING
                sounds.play_start()
            return True

        if self.state == STATE_GAME_OVER:
            if key == ord('y') or key == ord('Y') or key == ord('\n') or key == ord(' '):
                self.restart_game()
            elif key == ord('n') or key == ord('N'):
                return False
            return True

        if self.state == STATE_LEVEL_COMPLETE:
            if key == ord('\n') or key == ord(' '):
                self.next_level()
            return True

        if self.state == STATE_PLAYING:
            # Pause
            if key == ord('p') or key == ord('P') or key == ord(' '):
                self.state = STATE_PAUSED
                return True

            # Movement
            if key == curses.KEY_UP or key == ord('w') or key == ord('W'):
                self.pacman.set_direction(DIR_UP)
            elif key == curses.KEY_DOWN or key == ord('s') or key == ord('S'):
                self.pacman.set_direction(DIR_DOWN)
            elif key == curses.KEY_LEFT or key == ord('a') or key == ord('A'):
                self.pacman.set_direction(DIR_LEFT)
            elif key == curses.KEY_RIGHT or key == ord('d') or key == ord('D'):
                self.pacman.set_direction(DIR_RIGHT)

        if self.state == STATE_PAUSED:
            if key == ord('p') or key == ord('P') or key == ord(' '):
                self.state = STATE_PLAYING

        return True

    def update(self):
        """Update game state."""
        if self.state != STATE_PLAYING:
            if self.state == STATE_DYING:
                self.death_animation_frame += 1
                if self.death_animation_frame > 10:
                    self.lives -= 1
                    if self.lives <= 0:
                        self.state = STATE_GAME_OVER
                        self.save_high_score()
                    else:
                        self.reset_positions()
                        self.state = STATE_PLAYING
            return

        # Update Pac-Man
        self.pacman.update(self.maze)

        # Check for dot/pellet eating
        px, py = self.pacman.get_position()
        if self.maze.eat_dot(px, py):
            self.score += SCORE_DOT
            sounds.play_waka()
        elif self.maze.eat_power_pellet(px, py):
            self.score += SCORE_POWER_PELLET
            self.ghost_eat_multiplier = 1
            for ghost in self.ghosts:
                ghost.make_vulnerable(GHOST_VULNERABLE_TIME)
            sounds.play_power_pellet()

        # Update ghosts
        for ghost in self.ghosts:
            ghost.update(self.maze, self.pacman, self.blinky)

        # Check collisions
        self.check_collisions()

        # Check level complete
        if self.maze.remaining_dots() == 0:
            self.state = STATE_LEVEL_COMPLETE
            sounds.play_level_complete()

        # Update high score
        if self.score > self.high_score:
            self.high_score = self.score

    def check_collisions(self):
        """Check for collisions between Pac-Man and ghosts."""
        px, py = self.pacman.get_position()

        for ghost in self.ghosts:
            if ghost.in_house:
                continue  # Skip ghosts still in the house
            gx, gy = ghost.get_position()
            if px == gx and py == gy:
                if ghost.state == GHOST_VULNERABLE:
                    # Eat the ghost
                    ghost.eat()
                    self.score += SCORE_GHOST_BASE * self.ghost_eat_multiplier
                    self.ghost_eat_multiplier *= 2
                    sounds.play_eat_ghost()
                elif ghost.state != GHOST_EATEN:
                    # Pac-Man dies
                    self.pacman.is_dead = True
                    self.state = STATE_DYING
                    self.death_animation_frame = 0
                    sounds.play_death()
                    return

    def next_level(self):
        """Advance to next level."""
        self.level += 1
        self.maze.reset()
        self.reset_positions()
        self.state = STATE_PLAYING

    def restart_game(self):
        """Restart the game from the beginning."""
        self.score = 0
        self.lives = STARTING_LIVES
        self.level = 1
        self.ghost_eat_multiplier = 1
        self.death_animation_frame = 0
        self.maze.reset()
        self.reset_positions()
        self.state = STATE_PLAYING

    def render(self):
        """Render the game screen."""
        self.stdscr.clear()

        if self.state == STATE_START:
            self.render_start_screen()
        elif self.state == STATE_GAME_OVER:
            self.render_game_over_screen()
        elif self.state == STATE_LEVEL_COMPLETE:
            self.render_level_complete_screen()
        else:
            self.render_game_screen()

        self.stdscr.refresh()

    def render_start_screen(self):
        """Render the start screen."""
        height, width = self.stdscr.getmaxyx()
        center_y = height // 2
        center_x = width // 2

        title = "PAC-MAN"
        self.safe_addstr(center_y - 6, center_x - len(title) // 2, title,
                        curses.color_pair(COLOR_PACMAN) | curses.A_BOLD)

        instructions = [
            "Use Arrow Keys or WASD to move",
            "Eat all dots to complete the level",
            "Avoid ghosts or eat them after power pellets",
            "",
            "SPACE/P - Pause  |  M - Toggle Sound  |  Q - Quit",
            "",
            f"High Score: {self.high_score}",
            "",
            "Press ENTER or SPACE to start"
        ]

        for i, line in enumerate(instructions):
            self.safe_addstr(center_y - 3 + i, center_x - len(line) // 2, line,
                           curses.color_pair(COLOR_TEXT))

    def render_game_over_screen(self):
        """Render the game over screen."""
        height, width = self.stdscr.getmaxyx()
        center_y = height // 2
        center_x = width // 2

        title = "GAME OVER"
        self.safe_addstr(center_y - 4, center_x - len(title) // 2, title,
                        curses.color_pair(COLOR_BLINKY) | curses.A_BOLD)

        score_text = f"Final Score: {self.score}"
        self.safe_addstr(center_y - 1, center_x - len(score_text) // 2, score_text,
                        curses.color_pair(COLOR_TEXT))

        high_score_text = f"High Score: {self.high_score}"
        self.safe_addstr(center_y, center_x - len(high_score_text) // 2, high_score_text,
                        curses.color_pair(COLOR_PACMAN))

        if self.score >= self.high_score and self.score > 0:
            new_high = "NEW HIGH SCORE!"
            self.safe_addstr(center_y + 2, center_x - len(new_high) // 2, new_high,
                           curses.color_pair(COLOR_PACMAN) | curses.A_BOLD | curses.A_BLINK)

        prompt = "Play again? (Y/ENTER) or Quit (N/Q)"
        self.safe_addstr(center_y + 4, center_x - len(prompt) // 2, prompt,
                        curses.color_pair(COLOR_TEXT))

    def render_level_complete_screen(self):
        """Render the level complete screen."""
        height, width = self.stdscr.getmaxyx()
        center_y = height // 2
        center_x = width // 2

        title = f"LEVEL {self.level} COMPLETE!"
        self.safe_addstr(center_y - 2, center_x - len(title) // 2, title,
                        curses.color_pair(COLOR_PACMAN) | curses.A_BOLD)

        score_text = f"Score: {self.score}"
        self.safe_addstr(center_y + 1, center_x - len(score_text) // 2, score_text,
                        curses.color_pair(COLOR_TEXT))

        prompt = "Press ENTER or SPACE to continue"
        self.safe_addstr(center_y + 3, center_x - len(prompt) // 2, prompt,
                        curses.color_pair(COLOR_TEXT))

    def render_game_screen(self):
        """Render the main game screen with double-width for square appearance."""
        # Calculate offset to center maze (double width for square look)
        height, width = self.stdscr.getmaxyx()
        display_width = self.maze.width * 2  # Double width for square appearance

        # Check if terminal is too small
        min_height = self.maze.height + 2
        min_width = display_width
        if height < min_height or width < min_width:
            msg = f"Terminal too small! Need {min_width}x{min_height}, have {width}x{height}"
            self.safe_addstr(0, 0, msg, curses.color_pair(COLOR_TEXT))
            return

        offset_y = max(1, (height - self.maze.height) // 2)
        offset_x = max(0, (width - display_width) // 2)

        # Render status bar
        lives_display = (CHAR_PACMAN_RIGHT + ' ') * self.lives
        status = f" Score: {self.score:06d}  High: {self.high_score:06d}  Level: {self.level}  Lives: {lives_display}"
        self.safe_addstr(offset_y - 1, offset_x, status,
                        curses.color_pair(COLOR_TEXT))

        # Render maze (double each character horizontally)
        for y, row in enumerate(self.maze.layout):
            for x, cell in enumerate(row):
                char = CHAR_EMPTY
                color = COLOR_TEXT

                if cell == CELL_WALL:
                    char = CHAR_WALL
                    color = COLOR_WALL
                elif cell == CELL_DOT or (x, y) in self.maze.dots:
                    char = CHAR_DOT
                    color = COLOR_DOT
                elif cell == CELL_POWER_PELLET or (x, y) in self.maze.power_pellets:
                    char = CHAR_POWER_PELLET
                    color = COLOR_POWER_PELLET
                elif cell == CELL_GATE:
                    char = CHAR_GATE
                    color = COLOR_WALL
                elif cell == CELL_GHOST_HOUSE:
                    char = CHAR_EMPTY

                # Double the character for square appearance
                self.safe_addstr(offset_y + y, offset_x + (x * 2), char + char,
                               curses.color_pair(color))

        # Render ghosts (double width position)
        for ghost in self.ghosts:
            gx, gy = ghost.get_position()
            if 0 <= gx < self.maze.width and 0 <= gy < self.maze.height:
                ghost_char = ghost.get_char()
                self.safe_addstr(offset_y + gy, offset_x + (gx * 2),
                               ghost_char + ' ', curses.color_pair(ghost.get_color()))

        # Render Pac-Man (double width position)
        if not self.pacman.is_dead or self.death_animation_frame % 2 == 0:
            px, py = self.pacman.get_position()
            pac_char = self.pacman.get_char()
            self.safe_addstr(offset_y + py, offset_x + (px * 2),
                           pac_char + ' ',
                           curses.color_pair(self.pacman.get_color()) | curses.A_BOLD)

        # Render pause overlay
        if self.state == STATE_PAUSED:
            pause_text = " PAUSED - Press SPACE or P to continue "
            center_y = offset_y + self.maze.height // 2
            center_x = offset_x + (display_width - len(pause_text)) // 2
            self.safe_addstr(center_y, center_x, pause_text,
                           curses.color_pair(COLOR_TEXT) | curses.A_REVERSE)

    def safe_addstr(self, y, x, string, attr=0):
        """Safely add string to screen, handling edge cases."""
        height, width = self.stdscr.getmaxyx()
        if y < 0 or y >= height or x < 0:
            return
        # Truncate string if it would go off screen
        max_len = width - x - 1
        if max_len <= 0:
            return
        try:
            self.stdscr.addstr(y, x, string[:max_len], attr)
        except curses.error:
            pass

    def run(self):
        """Main game loop."""
        running = True
        while running:
            running = self.handle_input()
            self.update()
            self.render()

        self.save_high_score()
        sounds.cleanup()
