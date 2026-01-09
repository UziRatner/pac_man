# Maze class and level data

from constants import (
    CELL_WALL, CELL_DOT, CELL_POWER_PELLET, CELL_EMPTY, CELL_GATE, CELL_GHOST_HOUSE,
    DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT, ALL_DIRECTIONS
)

# Compact Pac-Man maze layout (19 rows to fit smaller terminals)
# # = wall, . = dot, O = power pellet, ' ' = empty, - = ghost gate, G = ghost house
MAZE_LAYOUT = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#O####.#####.##.#####.####O#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "     #.##          ##.#     ",
    "     #.## ###--### ##.#     ",
    "######.## #GGGGGG# ##.######",
    "      .   #GGGGGG#   .      ",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#O..##.......  .......##..O#",
    "###.##.##.########.##.##.###",
    "#..........................#",
    "############################",
]


class Maze:
    def __init__(self):
        self.layout = [list(row) for row in MAZE_LAYOUT]
        self.height = len(self.layout)
        self.width = len(self.layout[0])
        self.dots = set()
        self.power_pellets = set()
        self.total_dots = 0
        self.pacman_start = None
        self.ghost_house_positions = []
        self.ghost_gate = None

        self._parse_maze()

    def _parse_maze(self):
        """Parse the maze layout and identify special positions."""
        for y, row in enumerate(self.layout):
            for x, cell in enumerate(row):
                if cell == CELL_DOT:
                    self.dots.add((x, y))
                    self.total_dots += 1
                elif cell == CELL_POWER_PELLET:
                    self.power_pellets.add((x, y))
                    self.total_dots += 1
                elif cell == CELL_GHOST_HOUSE:
                    self.ghost_house_positions.append((x, y))
                elif cell == CELL_GATE:
                    if self.ghost_gate is None:
                        self.ghost_gate = (x, y)

        # Default Pac-Man start position (center bottom area)
        self.pacman_start = (14, 15)

        # Ghost starting positions (inside ghost house)
        self.ghost_starts = {
            'blinky': (14, 8),   # Above ghost house
            'pinky': (14, 11),   # Center of ghost house
            'inky': (12, 11),    # Left side of ghost house
            'clyde': (16, 11),   # Right side of ghost house
        }

        # Scatter corners for each ghost
        self.scatter_targets = {
            'blinky': (self.width - 3, 0),      # Top right
            'pinky': (2, 0),                     # Top left
            'inky': (self.width - 1, self.height - 1),  # Bottom right
            'clyde': (0, self.height - 1),      # Bottom left
        }

    def reset(self):
        """Reset dots and power pellets for a new level."""
        self.layout = [list(row) for row in MAZE_LAYOUT]
        self.dots = set()
        self.power_pellets = set()
        self.total_dots = 0
        self._parse_maze()

    def get_cell(self, x, y):
        """Get the cell type at position (x, y)."""
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.layout[y][x]
        return CELL_WALL

    def is_wall(self, x, y):
        """Check if position is a wall."""
        cell = self.get_cell(x, y)
        return cell == CELL_WALL

    def is_gate(self, x, y):
        """Check if position is the ghost gate."""
        cell = self.get_cell(x, y)
        return cell == CELL_GATE

    def is_ghost_house(self, x, y):
        """Check if position is inside the ghost house."""
        cell = self.get_cell(x, y)
        return cell == CELL_GHOST_HOUSE

    def is_walkable(self, x, y, is_ghost=False, is_eaten=False):
        """Check if a position is walkable."""
        if x < 0 or x >= self.width:
            # Allow tunnel wrapping
            return True
        if y < 0 or y >= self.height:
            return False

        cell = self.get_cell(x, y)
        if cell == CELL_WALL:
            return False
        if cell == CELL_GATE:
            # Only ghosts can pass through the gate
            return is_ghost
        if cell == CELL_GHOST_HOUSE:
            # Only eaten ghosts or ghosts leaving can be in ghost house
            return is_ghost
        return True

    def has_dot(self, x, y):
        """Check if there's a dot at position."""
        return (x, y) in self.dots

    def has_power_pellet(self, x, y):
        """Check if there's a power pellet at position."""
        return (x, y) in self.power_pellets

    def eat_dot(self, x, y):
        """Remove dot at position. Returns True if dot was eaten."""
        if (x, y) in self.dots:
            self.dots.discard((x, y))
            self.layout[y][x] = CELL_EMPTY
            return True
        return False

    def eat_power_pellet(self, x, y):
        """Remove power pellet at position. Returns True if pellet was eaten."""
        if (x, y) in self.power_pellets:
            self.power_pellets.discard((x, y))
            self.layout[y][x] = CELL_EMPTY
            return True
        return False

    def remaining_dots(self):
        """Return total remaining dots and power pellets."""
        return len(self.dots) + len(self.power_pellets)

    def wrap_position(self, x, y):
        """Wrap position for tunnel effect."""
        if x < 0:
            x = self.width - 1
        elif x >= self.width:
            x = 0
        return x, y

    def get_valid_moves(self, x, y, is_ghost=False, is_eaten=False, current_dir=None):
        """Get list of valid directions from position."""
        valid = []
        for direction in ALL_DIRECTIONS:
            # Ghosts can't reverse direction (except when state changes)
            if is_ghost and current_dir and not is_eaten:
                reverse = (-current_dir[0], -current_dir[1])
                if direction == reverse:
                    continue

            new_x = x + direction[0]
            new_y = y + direction[1]

            # Handle tunnel wrapping
            new_x, new_y = self.wrap_position(new_x, new_y)

            if self.is_walkable(new_x, new_y, is_ghost, is_eaten):
                valid.append(direction)

        return valid

    def get_ghost_exit_target(self):
        """Get the target position for ghosts leaving the house."""
        if self.ghost_gate:
            return (self.ghost_gate[0], self.ghost_gate[1] - 1)
        return (14, 11)  # Default position above gate

    def distance(self, pos1, pos2):
        """Calculate Manhattan distance between two positions."""
        return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])
