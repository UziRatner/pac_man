#!/usr/bin/env python3
"""
Pac-Man Game
A classic Pac-Man game implementation using Python curses library.

Controls:
    Arrow Keys / WASD - Move Pac-Man
    SPACE / P - Pause
    Q - Quit
"""

import curses
import sys
from game import Game


def main(stdscr):
    """Main entry point wrapped by curses."""
    game = Game(stdscr)
    game.run()


if __name__ == "__main__":
    try:
        # Wrap the main function with curses wrapper for proper terminal handling
        curses.wrapper(main)
    except KeyboardInterrupt:
        # Handle Ctrl+C gracefully
        print("\nGame terminated by user.")
        sys.exit(0)
    except Exception as e:
        # Ensure terminal is restored on any error
        print(f"\nError: {e}")
        sys.exit(1)
