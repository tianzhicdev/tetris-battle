// Audio Manager - Handles all game sounds and music

export type SoundEffect =
  | 'piece_move'
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
  private soundEffects: Map<SoundEffect, HTMLAudioElement> = new Map();
  private musicTracks: Map<MusicTrack, HTMLAudioElement> = new Map();
  private currentMusic: HTMLAudioElement | null = null;
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
      const audio = new Audio(`/audio/${sfx}.wav`);
      audio.volume = this.sfxVolume * this.masterVolume;
      audio.preload = 'auto';
      this.soundEffects.set(sfx, audio);
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
      const audio = new Audio(`/audio/${track}.wav`);
      audio.volume = this.musicVolume * this.masterVolume;
      audio.loop = true;
      audio.preload = 'auto';
      this.musicTracks.set(track, audio);
    });
  }

  // Play a sound effect
  playSfx(effect: SoundEffect, volume: number = 1.0) {
    if (!this.isSfxEnabled || this.isMuted) return;

    const audio = this.soundEffects.get(effect);
    if (!audio) {
      console.warn(`Sound effect not found: ${effect}`);
      return;
    }

    // Clone the audio to allow multiple instances
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = this.sfxVolume * this.masterVolume * volume;

    clone.play().catch(err => {
      console.warn(`Failed to play sound: ${effect}`, err);
    });
  }

  // Play or switch music track
  playMusic(track: MusicTrack, fadeIn: boolean = true) {
    if (!this.isMusicEnabled || this.isMuted) return;

    // Don't restart if already playing
    if (this.currentMusicTrack === track && this.currentMusic && !this.currentMusic.paused) {
      return;
    }

    // Stop current music
    if (this.currentMusic) {
      this.stopMusic(fadeIn);
    }

    const audio = this.musicTracks.get(track);
    if (!audio) {
      console.warn(`Music track not found: ${track}`);
      return;
    }

    this.currentMusic = audio;
    this.currentMusicTrack = track;

    if (fadeIn) {
      audio.volume = 0;
      audio.play().catch(err => {
        console.warn(`Failed to play music: ${track}`, err);
      });

      // Fade in over 1 second
      const targetVolume = this.musicVolume * this.masterVolume;
      const fadeStep = targetVolume / 20;
      const fadeInterval = setInterval(() => {
        if (audio.volume < targetVolume) {
          audio.volume = Math.min(audio.volume + fadeStep, targetVolume);
        } else {
          clearInterval(fadeInterval);
        }
      }, 50);
    } else {
      audio.volume = this.musicVolume * this.masterVolume;
      audio.play().catch(err => {
        console.warn(`Failed to play music: ${track}`, err);
      });
    }
  }

  // Stop current music
  stopMusic(fadeOut: boolean = true) {
    if (!this.currentMusic) return;

    if (fadeOut) {
      const fadeStep = this.currentMusic.volume / 20;
      const fadeInterval = setInterval(() => {
        if (this.currentMusic && this.currentMusic.volume > fadeStep) {
          this.currentMusic.volume -= fadeStep;
        } else {
          if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
          }
          clearInterval(fadeInterval);
        }
      }, 50);
    } else {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
    }

    this.currentMusic = null;
    this.currentMusicTrack = null;
  }

  // Pause/Resume music
  pauseMusic() {
    if (this.currentMusic && !this.currentMusic.paused) {
      this.currentMusic.pause();
    }
  }

  resumeMusic() {
    if (this.currentMusic && this.currentMusic.paused && this.isMusicEnabled && !this.isMuted) {
      this.currentMusic.play().catch(err => {
        console.warn('Failed to resume music', err);
      });
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
    this.soundEffects.forEach(audio => {
      audio.volume = this.sfxVolume * this.masterVolume;
    });

    // Update music tracks
    this.musicTracks.forEach(audio => {
      audio.volume = this.musicVolume * this.masterVolume;
    });

    // Update current music if playing
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume * this.masterVolume;
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
