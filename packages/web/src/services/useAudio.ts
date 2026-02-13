// React hooks for audio playback
// Provides easy access to audioManager from React components

import { useCallback } from 'react';
import { audioManager } from './audioManager';
import type { SoundEffect, MusicTrack } from './audioManager';

/**
 * Hook to play sound effects
 * @returns playSfx function
 */
export function useSfx() {
  const playSfx = useCallback((effect: SoundEffect, volume?: number) => {
    audioManager.playSfx(effect, volume);
  }, []);

  return playSfx;
}

/**
 * Hook to control music playback
 * @returns Music control functions
 */
export function useMusic() {
  const playMusic = useCallback((track: MusicTrack, fadeIn?: boolean) => {
    audioManager.playMusic(track, fadeIn);
  }, []);

  const stopMusic = useCallback((fadeOut?: boolean) => {
    audioManager.stopMusic(fadeOut);
  }, []);

  const pauseMusic = useCallback(() => {
    audioManager.pauseMusic();
  }, []);

  const resumeMusic = useCallback(() => {
    audioManager.resumeMusic();
  }, []);

  return { playMusic, stopMusic, pauseMusic, resumeMusic };
}

/**
 * Hook to control audio settings
 * @returns Audio settings control functions
 */
export function useAudioSettings() {
  const setMasterVolume = useCallback((volume: number) => {
    audioManager.setMasterVolume(volume);
  }, []);

  const setSfxVolume = useCallback((volume: number) => {
    audioManager.setSfxVolume(volume);
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    audioManager.setMusicVolume(volume);
  }, []);

  const toggleMute = useCallback(() => {
    return audioManager.toggleMute();
  }, []);

  const toggleMusic = useCallback(() => {
    return audioManager.toggleMusic();
  }, []);

  const toggleSfx = useCallback(() => {
    return audioManager.toggleSfx();
  }, []);

  const getSettings = useCallback(() => {
    return {
      masterVolume: audioManager.getMasterVolume(),
      sfxVolume: audioManager.getSfxVolume(),
      musicVolume: audioManager.getMusicVolume(),
      isMuted: audioManager.getIsMuted(),
      isMusicEnabled: audioManager.getIsMusicEnabled(),
      isSfxEnabled: audioManager.getIsSfxEnabled(),
      currentTrack: audioManager.getCurrentTrack(),
    };
  }, []);

  return {
    setMasterVolume,
    setSfxVolume,
    setMusicVolume,
    toggleMute,
    toggleMusic,
    toggleSfx,
    getSettings,
  };
}
