import { useState, useEffect, useCallback } from 'react';

export function useMidiOutput() {
  const [outputs, setOutputs] = useState<WebMidi.MIDIOutput[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<WebMidi.MIDIOutput | null>(null);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then(access => {
      const updateOutputs = () => {
        setOutputs(Array.from(access.outputs.values()));
      };
      updateOutputs();
      access.onstatechange = updateOutputs;
    }).catch(() => {});
  }, []);

  const sendNoteOn = useCallback((note: number, velocity: number = 100, channel: number = 0) => {
    if (!selectedOutput) return;
    selectedOutput.send([0x90 | channel, note, velocity]);
  }, [selectedOutput]);

  const sendNoteOff = useCallback((note: number, channel: number = 0) => {
    if (!selectedOutput) return;
    selectedOutput.send([0x80 | channel, note, 0]);
  }, [selectedOutput]);

  return { outputs, selectedOutput, setSelectedOutput, sendNoteOn, sendNoteOff };
}
