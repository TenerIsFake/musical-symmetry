import { useState, useCallback, useRef } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

interface MidiInputState {
  connected: boolean;
  deviceName: string | null;
  activeNotes: Set<number>;
  pitchClasses: PitchClass[];
  error: string | null;
}

export function useMidiInput() {
  const [state, setState] = useState<MidiInputState>({
    connected: false,
    deviceName: null,
    activeNotes: new Set(),
    pitchClasses: [],
    error: null,
  });

  const activeNotesRef = useRef(new Set<number>());

  const updatePitchClasses = useCallback(() => {
    const pcs = [...new Set(
      [...activeNotesRef.current].map(n => (n % 12) as PitchClass)
    )].sort((a, b) => a - b);
    setState(prev => ({ ...prev, pitchClasses: pcs, activeNotes: new Set(activeNotesRef.current) }));
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!navigator.requestMIDIAccess) {
        setState(prev => ({ ...prev, error: 'Web MIDI not supported in this browser' }));
        return;
      }

      const access = await navigator.requestMIDIAccess();

      function onMidiMessage(event: WebMidi.MIDIMessageEvent) {
        const [status, note] = event.data;
        const command = status! & 0xf0;

        if (command === 0x90 && event.data[2]! > 0) {
          activeNotesRef.current.add(note!);
          updatePitchClasses();
        } else if (command === 0x80 || (command === 0x90 && event.data[2] === 0)) {
          activeNotesRef.current.delete(note!);
          updatePitchClasses();
        }
      }

      const inputs = [...access.inputs.values()];
      if (inputs.length === 0) {
        setState(prev => ({ ...prev, error: 'No MIDI devices found' }));
        return;
      }

      const input = inputs[0]!;
      input.onmidimessage = onMidiMessage;

      setState(prev => ({
        ...prev,
        connected: true,
        deviceName: input.name || 'MIDI Device',
        error: null,
      }));

      access.onstatechange = () => {
        const current = [...access.inputs.values()];
        if (current.length === 0) {
          setState(prev => ({ ...prev, connected: false, deviceName: null }));
        }
      };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to connect MIDI',
      }));
    }
  }, [updatePitchClasses]);

  const disconnect = useCallback(() => {
    activeNotesRef.current.clear();
    setState({ connected: false, deviceName: null, activeNotes: new Set(), pitchClasses: [], error: null });
  }, []);

  return { ...state, connect, disconnect };
}
