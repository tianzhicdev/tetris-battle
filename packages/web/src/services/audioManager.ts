// Audio Manager - Handles all game sounds and music
// Uses Howler.js for low-latency Web Audio API with HTML5 Audio fallback

import { Howl } from 'howler';

export type SoundEffect =
  | 'piece_move'
  | 'piece_move_left'
  | 'piece_move_right'
  | 'piece_rotate'
  | 'soft_drop'
  | 'hard_drop'
  | 'line_clear_single'
  | 'line_clear_double'
  | 'line_clear_triple'
  | 'line_clear_tetris'
  | 'combo'
  | 'star_earned'
  | 'ability_buff_activate'
  | 'ability_debuff_activate'
  | 'ability_ultra_activate'
  | 'ability_bomb_explode'
  | 'ability_ready'
  | 'countdown_beep'
  | 'countdown_go'
  | 'button_click'
  | 'button_hover'
  | 'warning_high_stack'
  | 'match_found'
  | 'game_over'
  | 'pause'
  | 'resume';

export type MusicTrack =
  | 'menu_theme'
  | 'matchmaking_waiting'
  | 'gameplay_normal'
  | 'gameplay_intense'
  | 'victory_theme'
  | 'defeat_theme';

class AudioManager {
  private soundEffects: Map<SoundEffect, Howl> = new Map();
  private musicTracks: Map<MusicTrack, Howl> = new Map();
  private currentMusic: Howl | null = null;
  private currentMusicTrack: MusicTrack | null = null;

  private masterVolume: number = 0.7;
  private sfxVolume: number = 0.6;
  private musicVolume: number = 0.4;
  private isMuted: boolean = false;
  private isMusicEnabled: boolean = true;
  private isSfxEnabled: boolean = true;

  constructor() {
    this.preloadAudio();
  }

  private preloadAudio() {
    // Preload sound effects
    const sfxList: SoundEffect[] = [
      'piece_move',
      'piece_move_left',
      'piece_move_right',
      'piece_rotate',
      'soft_drop',
      'hard_drop',
      'line_clear_single',
      'line_clear_double',
      'line_clear_triple',
      'line_clear_tetris',
      'combo',
      'star_earned',
      'ability_buff_activate',
      'ability_debuff_activate',
      'ability_ultra_activate',
      'ability_bomb_explode',
      'ability_ready',
      'countdown_beep',
      'countdown_go',
      'button_click',
      'button_hover',
      'warning_high_stack',
      'match_found',
      'game_over',
      'pause',
      'resume',
    ];

    sfxList.forEach(sfx => {
      const howl = new Howl({
        src: [`/audio/${sfx}.wav`],
        volume: this.sfxVolume * this.masterVolume,
        preload: true,
        html5: false, // Use Web Audio API for low latency
      });
      this.soundEffects.set(sfx, howl);
    });

    // Preload music tracks
    const musicList: MusicTrack[] = [
      'menu_theme',
      'matchmaking_waiting',
      'gameplay_normal',
      'gameplay_intense',
      'victory_theme',
      'defeat_theme',
    ];

    musicList.forEach(track => {
      const howl = new Howl({
        src: [`/audio/${track}.wav`],
        volume: this.musicVolume * this.masterVolume,
        loop: true,
        preload: true,
        html5: true, // Use HTML5 Audio for streaming large files
      });
      this.musicTracks.set(track, howl);
    });
  }

  // Play a sound effect
  playSfx(effect: SoundEffect, volume: number = 1.0) {
    if (!this.isSfxEnabled || this.isMuted) return;

    const howl = this.soundEffects.get(effect);
    if (!howl) {
      console.warn(`Sound effect not found: ${effect}`);
      return;
    }

    // Howler automatically manages multiple instances
    howl.volume(this.sfxVolume * this.masterVolume * volume);
    howl.play();
  }

  // Play or switch music track
  playMusic(track: MusicTrack, fadeIn: boolean = true) {
    if (!this.isMusicEnabled || this.isMuted) return;

    // Don't restart if already playing
    if (this.currentMusicTrack === track && this.currentMusic && this.currentMusic.playing()) {
      return;
    }

    // Stop current music
    if (this.currentMusic) {
      this.stopMusic(fadeIn);
    }

    const howl = this.musicTracks.get(track);
    if (!howl) {
      console.warn(`Music track not found: ${track}`);
      return;
    }

    this.currentMusic = howl;
    this.currentMusicTrack = track;

    if (fadeIn) {
      // Howler has built-in fade support
      howl.volume(0);
      howl.play();
      howl.fade(0, this.musicVolume * this.masterVolume, 1000); // Fade in over 1 second
    } else {
      howl.volume(this.musicVolume * this.masterVolume);
      howl.play();
    }
  }

  // Stop current music
  stopMusic(fadeOut: boolean = true) {
    if (!this.currentMusic) return;

    if (fadeOut) {
      // Fade out over 1 second, then stop
      this.currentMusic.fade(this.currentMusic.volume(), 0, 1000);
      setTimeout(() => {
        if (this.currentMusic) {
          this.currentMusic.stop();
        }
      }, 1000);
    } else {
      this.currentMusic.stop();
    }

    this.currentMusic = null;
    this.currentMusicTrack = null;
  }

  // Pause/Resume music
  pauseMusic() {
    if (this.currentMusic && this.currentMusic.playing()) {
      this.currentMusic.pause();
    }
  }

  resumeMusic() {
    if (this.currentMusic && !this.currentMusic.playing() && this.isMusicEnabled && !this.isMuted) {
      this.currentMusic.play();
    }
  }

  // Volume controls
  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  private updateAllVolumes() {
    // Update sound effects
    this.soundEffects.forEach(howl => {
      howl.volume(this.sfxVolume * this.masterVolume);
    });

    // Update music tracks
    this.musicTracks.forEach(howl => {
      howl.volume(this.musicVolume * this.masterVolume);
    });

    // Update current music if playing
    if (this.currentMusic) {
      this.currentMusic.volume(this.musicVolume * this.masterVolume);
    }
  }

  // Toggle controls
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.pauseMusic();
    } else {
      this.resumeMusic();
    }
    return this.isMuted;
  }

  toggleMusic() {
    this.isMusicEnabled = !this.isMusicEnabled;
    if (!this.isMusicEnabled) {
      this.stopMusic();
    } else if (this.currentMusicTrack) {
      this.playMusic(this.currentMusicTrack);
    }
    return this.isMusicEnabled;
  }

  toggleSfx() {
    this.isSfxEnabled = !this.isSfxEnabled;
    return this.isSfxEnabled;
  }

  // Getters
  getMasterVolume() { return this.masterVolume; }
  getSfxVolume() { return this.sfxVolume; }
  getMusicVolume() { return this.musicVolume; }
  getIsMuted() { return this.isMuted; }
  getIsMusicEnabled() { return this.isMusicEnabled; }
  getIsSfxEnabled() { return this.isSfxEnabled; }
  getCurrentTrack() { return this.currentMusicTrack; }
}

// Singleton instance
export const audioManager = new AudioManager();
