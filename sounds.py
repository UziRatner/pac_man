# Sound system for Pac-Man game

import os
import subprocess
import threading

# Try to import pygame for better sound support
PYGAME_AVAILABLE = False
try:
    import pygame
    pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
    PYGAME_AVAILABLE = True
except ImportError:
    pass

# Sound enabled flag
sound_enabled = True


def set_sound_enabled(enabled):
    """Enable or disable all sounds."""
    global sound_enabled
    sound_enabled = enabled


def _play_beep_macos(frequency, duration_ms):
    """Play a beep sound on macOS using afplay or say."""
    try:
        # Use osascript to play a beep
        subprocess.Popen(
            ['osascript', '-e', 'beep'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception:
        pass


def _generate_pygame_sound(frequency, duration_ms, volume=0.3):
    """Generate a simple tone using pygame."""
    if not PYGAME_AVAILABLE:
        return None

    import math
    import array

    sample_rate = 22050
    n_samples = int(sample_rate * duration_ms / 1000)

    # Generate sine wave
    samples = array.array('h', [0] * n_samples)
    for i in range(n_samples):
        # Sine wave with envelope
        t = i / sample_rate
        envelope = min(1.0, min(i / 500, (n_samples - i) / 500))  # Attack/release
        value = int(32767 * volume * envelope * math.sin(2 * math.pi * frequency * t))
        samples[i] = value

    # Create pygame sound
    sound = pygame.mixer.Sound(buffer=samples)
    return sound


# Pre-generated sounds (will be created on first use)
_sounds = {}


def _get_sound(name):
    """Get or create a sound by name."""
    if name in _sounds:
        return _sounds[name]

    if not PYGAME_AVAILABLE:
        return None

    # Define sound parameters
    sound_params = {
        'chomp': (440, 50),      # Eating dot
        'power': (220, 200),     # Power pellet
        'ghost': (880, 100),     # Eating ghost
        'death': (150, 500),     # Pac-Man dies
        'start': (523, 200),     # Game start
        'level': (660, 300),     # Level complete
    }

    if name in sound_params:
        freq, duration = sound_params[name]
        _sounds[name] = _generate_pygame_sound(freq, duration)
        return _sounds[name]

    return None


def play_chomp():
    """Play dot eating sound."""
    if not sound_enabled:
        return
    _play_sound_async('chomp')


def play_power_pellet():
    """Play power pellet sound."""
    if not sound_enabled:
        return
    _play_sound_async('power')


def play_eat_ghost():
    """Play ghost eating sound."""
    if not sound_enabled:
        return
    _play_sound_async('ghost')


def play_death():
    """Play death sound."""
    if not sound_enabled:
        return
    _play_sound_async('death')


def play_start():
    """Play game start sound."""
    if not sound_enabled:
        return
    _play_sound_async('start')


def play_level_complete():
    """Play level complete sound."""
    if not sound_enabled:
        return
    _play_sound_async('level')


def _play_sound_async(name):
    """Play a sound asynchronously."""
    def play():
        if PYGAME_AVAILABLE:
            sound = _get_sound(name)
            if sound:
                sound.play()
        else:
            # Fallback to system beep on macOS
            _play_beep_macos(440, 50)

    # Run in background thread to not block game
    thread = threading.Thread(target=play, daemon=True)
    thread.start()


def play_waka():
    """Play the classic waka-waka sound (alternating pitches)."""
    if not sound_enabled:
        return
    
    def play():
        if PYGAME_AVAILABLE:
            # Alternate between two pitches for waka-waka effect
            import time
            freq = 440 if int(time.time() * 10) % 2 == 0 else 520
            sound = _generate_pygame_sound(freq, 30, volume=0.2)
            if sound:
                sound.play()
        else:
            # Fallback to system beep on macOS
            _play_beep_macos(440, 50)
    
    # Run in background thread to not block game
    thread = threading.Thread(target=play, daemon=True)
    thread.start()


def cleanup():
    """Clean up sound resources."""
    if PYGAME_AVAILABLE:
        pygame.mixer.quit()
