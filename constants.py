# Pac-Man Game Constants and Configurations

# Game timing
FPS = 10  # Frames per second
GHOST_VULNERABLE_TIME = 50  # Frames ghosts stay vulnerable
GHOST_FLASH_TIME = 20  # Frames before vulnerability ends (flash warning)
GHOST_RELEASE_DELAY = 30  # Frames between ghost releases

# Scoring
SCORE_DOT = 10
SCORE_POWER_PELLET = 50
SCORE_GHOST_BASE = 200  # Doubles for each ghost eaten in sequence

# Lives
STARTING_LIVES = 3

# Colors (curses color pair IDs)
COLOR_DEFAULT = 0
COLOR_PACMAN = 1
COLOR_BLINKY = 2  # Red
COLOR_PINKY = 3   # Pink/Magenta
COLOR_INKY = 4    # Cyan
COLOR_CLYDE = 5   # Orange/Yellow
COLOR_VULNERABLE = 6  # Blue
COLOR_WALL = 7
COLOR_DOT = 8
COLOR_POWER_PELLET = 9
COLOR_TEXT = 10
COLOR_FLASH = 11  # White for flashing ghosts

# Characters for rendering (Original Pac-Man style)
CHAR_PACMAN_RIGHT = 'ᗧ'
CHAR_PACMAN_LEFT = 'ᗤ'
CHAR_PACMAN_UP = 'ᗢ'
CHAR_PACMAN_DOWN = 'ᗣ'
CHAR_PACMAN_CLOSED = '●'
CHAR_GHOST = 'ᗣ'
CHAR_GHOST_VULNERABLE = '᎒'
CHAR_GHOST_EYES = '⋮'
CHAR_WALL = '█'
CHAR_DOT = '·'
CHAR_POWER_PELLET = '●'
CHAR_EMPTY = ' '
CHAR_GATE = '═'

# Directions
DIR_NONE = (0, 0)
DIR_UP = (0, -1)
DIR_DOWN = (0, 1)
DIR_LEFT = (-1, 0)
DIR_RIGHT = (1, 0)

ALL_DIRECTIONS = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT]

# Ghost states
GHOST_CHASE = 'chase'
GHOST_SCATTER = 'scatter'
GHOST_VULNERABLE = 'vulnerable'
GHOST_EATEN = 'eaten'

# Game states
STATE_START = 'start'
STATE_PLAYING = 'playing'
STATE_PAUSED = 'paused'
STATE_DYING = 'dying'
STATE_LEVEL_COMPLETE = 'level_complete'
STATE_GAME_OVER = 'game_over'

# Ghost names
GHOST_BLINKY = 'blinky'
GHOST_PINKY = 'pinky'
GHOST_INKY = 'inky'
GHOST_CLYDE = 'clyde'

# High score file
HIGH_SCORE_FILE = 'highscore.txt'

# Maze cell types (for parsing - keep ASCII for maze definition)
CELL_WALL = '#'
CELL_DOT = '.'
CELL_POWER_PELLET = 'O'
CELL_EMPTY = ' '
CELL_GATE = '-'
CELL_GHOST_HOUSE = 'G'
