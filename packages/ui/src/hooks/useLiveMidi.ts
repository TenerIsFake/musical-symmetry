import { useState, useCallback, useEffect, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';
import { useMidiInput } from './useMidiInput';
import { useUser } from '../context/UserContext';

const FREE_TIER_LIMIT_SECONDS = 5 * 60; // 5 minutes
const DEBOUNCE_MS = 80;

export interface LiveMidiState {
  pitchClasses: PitchClass[];
  isLive: boolean;
  toggleLive: () => void;
  sustained: boolean;
  toggleSustain: () => void;
  deviceName: string | null;
  sessionElapsed: number;
  sessionLimitReached: boolean;
  isAvailable: boolean;
}

export function useLiveMidi(): LiveMidiState {
  const { user } = useUser();
  const midi = useMidiInput();

  const [isLive, setIsLive] = useState(false);
  const [sustained, setSustained] = useState(false);
  const [debouncedPCs, setDebouncedPCs] = useState<PitchClass[]>([]);
  const [frozenPCs, setFrozenPCs] = useState<PitchClass[]>([]);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionLimitReached, setSessionLimitReached] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const isAvailable = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

  // Debounce incoming pitch class changes from the MIDI hook
  useEffect(() => {
    if (!isLive || sustained) return;

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedPCs(midi.pitchClasses);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [midi.pitchClasses, isLive, sustained]);

  // Freeze notes when sustain is toggled on
  useEffect(() => {
    if (sustained) {
      setFrozenPCs(debouncedPCs);
    }
  }, [sustained]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session timer for free tier
  useEffect(() => {
    if (!isLive) {
      if (sessionIntervalRef.current !== null) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
      }
      return;
    }

    const isFree = !user || user.tier === 'free';
    if (!isFree) return; // unlimited for pro/research

    sessionStartRef.current = Date.now();
    setSessionElapsed(0);
    setSessionLimitReached(false);

    sessionIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (sessionStartRef.current ?? Date.now())) / 1000);
      setSessionElapsed(elapsed);

      if (elapsed >= FREE_TIER_LIMIT_SECONDS) {
        setSessionLimitReached(true);
        setIsLive(false);
      }
    }, 1000);

    return () => {
      if (sessionIntervalRef.current !== null) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
      }
    };
  }, [isLive, user]);

  const toggleLive = useCallback(() => {
    setIsLive(prev => {
      const next = !prev;
      if (next) {
        // Connect MIDI when turning on
        if (!midi.connected) {
          midi.connect();
        }
        // Reset sustain and elapsed on activation
        setSustained(false);
        setSessionElapsed(0);
        setSessionLimitReached(false);
      }
      return next;
    });
  }, [midi]);

  const toggleSustain = useCallback(() => {
    setSustained(prev => !prev);
  }, []);

  const outputPCs = sustained ? frozenPCs : debouncedPCs;

  return {
    pitchClasses: outputPCs,
    isLive,
    toggleLive,
    sustained,
    toggleSustain,
    deviceName: midi.deviceName,
    sessionElapsed,
    sessionLimitReached,
    isAvailable,
  };
}
