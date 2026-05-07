/**
 * Minimal MIDI file writer for chord progressions.
 * Produces a valid Type-0 SMF (single track) MIDI file.
 */

function writeVarLen(value: number): number[] {
  if (value < 0x80) return [value];
  const bytes: number[] = [];
  let v = value;
  while (v > 0) {
    bytes.unshift(v & 0x7f);
    v >>= 7;
  }
  for (let i = 0; i < bytes.length - 1; i++) {
    bytes[i]! |= 0x80;
  }
  return bytes;
}

function uint32BE(val: number): number[] {
  return [(val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff];
}

function uint16BE(val: number): number[] {
  return [(val >> 8) & 0xff, val & 0xff];
}

/**
 * Convert a chord progression (array of pitch-class arrays) to a MIDI file Blob.
 * Each chord occupies one full beat. Pitch classes are mapped to octave 4 (middle C = 60).
 */
export function progressionToMidi(chords: number[][], bpm: number = 120): Blob {
  const ppq = 480; // pulses per quarter note
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);

  const trackEvents: number[] = [];

  // Tempo event at tick 0
  trackEvents.push(
    ...writeVarLen(0),      // delta time = 0
    0xff, 0x51, 0x03,       // meta event: set tempo
    ...uint32BE(microsecondsPerBeat).slice(1), // 3 bytes (drop high byte)
  );

  let currentTick = 0;

  for (let ci = 0; ci < chords.length; ci++) {
    const pcs = chords[ci]!;
    const midiNotes = pcs.map(pc => 60 + pc); // map to octave 4

    // Note-on events for all notes in chord
    for (let ni = 0; ni < midiNotes.length; ni++) {
      const delta = ni === 0 ? 0 : 0;
      trackEvents.push(
        ...writeVarLen(delta),
        0x90,           // note on, channel 1
        midiNotes[ni]!,
        0x64,           // velocity 100
      );
    }
    currentTick += ppq;

    // Note-off events one beat later
    for (let ni = 0; ni < midiNotes.length; ni++) {
      const delta = ni === 0 ? ppq : 0;
      trackEvents.push(
        ...writeVarLen(delta),
        0x80,           // note off, channel 1
        midiNotes[ni]!,
        0x00,
      );
    }
    currentTick += 0; // already advanced above
    void currentTick;
  }

  // End of track
  trackEvents.push(...writeVarLen(0), 0xff, 0x2f, 0x00);

  const trackLength = trackEvents.length;

  const header = [
    0x4d, 0x54, 0x68, 0x64,   // MThd
    ...uint32BE(6),             // header length = 6
    ...uint16BE(0),             // format = 0 (single track)
    ...uint16BE(1),             // num tracks = 1
    ...uint16BE(ppq),           // division = ppq
    0x4d, 0x54, 0x72, 0x6b,   // MTrk
    ...uint32BE(trackLength),
    ...trackEvents,
  ];

  return new Blob([new Uint8Array(header)], { type: 'audio/midi' });
}

export interface MultiTrackNote {
  midiNote: number;
  startTick: number;
  durationTicks: number;
  velocity: number;
}

export interface MidiTrack {
  name: string;
  channel: number;
  notes: MultiTrackNote[];
}

/**
 * Convert multiple tracks to a Type-1 (multi-track) MIDI file Blob.
 * One MTrk chunk is produced per track, plus a tempo track at index 0.
 */
export function multiTrackToMidi(
  tracks: MidiTrack[],
  bpm: number,
  ppq: number = 480,
): Blob {
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);

  // --- Tempo track (track 0) ---
  const tempoEvents: number[] = [
    ...writeVarLen(0),       // delta = 0
    0xff, 0x51, 0x03,
    ...uint32BE(microsecondsPerBeat).slice(1),
    ...writeVarLen(0),       // delta = 0
    0xff, 0x2f, 0x00,        // end of track
  ];

  // --- Encode each track ---
  function encodeTrack(track: MidiTrack): number[] {
    // Build flat event list: [tick, type, note, velocity]
    type RawEvent = { tick: number; data: number[] };
    const events: RawEvent[] = [];

    // Track name meta event
    const nameBytes = Array.from(track.name).map(c => c.charCodeAt(0));
    events.push({
      tick: 0,
      data: [0xff, 0x03, nameBytes.length, ...nameBytes],
    });

    for (const n of track.notes) {
      const ch = (track.channel - 1) & 0x0f;
      events.push({
        tick: n.startTick,
        data: [0x90 | ch, n.midiNote & 0x7f, n.velocity & 0x7f],
      });
      events.push({
        tick: n.startTick + n.durationTicks,
        data: [0x80 | ch, n.midiNote & 0x7f, 0x00],
      });
    }

    events.sort((a, b) => a.tick - b.tick);

    const trackBytes: number[] = [];
    let prevTick = 0;
    for (const ev of events) {
      const delta = ev.tick - prevTick;
      prevTick = ev.tick;
      trackBytes.push(...writeVarLen(delta), ...ev.data);
    }
    // End of track
    trackBytes.push(...writeVarLen(0), 0xff, 0x2f, 0x00);
    return trackBytes;
  }

  const encodedTracks = tracks.map(encodeTrack);
  const numTracks = 1 + encodedTracks.length; // tempo track + data tracks

  const header = [
    0x4d, 0x54, 0x68, 0x64,   // MThd
    ...uint32BE(6),             // header length = 6
    ...uint16BE(1),             // format = 1 (multi-track)
    ...uint16BE(numTracks),
    ...uint16BE(ppq),
  ];

  function makeChunk(trackData: number[]): number[] {
    return [0x4d, 0x54, 0x72, 0x6b, ...uint32BE(trackData.length), ...trackData];
  }

  const allBytes: number[] = [
    ...header,
    ...makeChunk(tempoEvents),
    ...encodedTracks.flatMap(makeChunk),
  ];

  return new Blob([new Uint8Array(allBytes)], { type: 'audio/midi' });
}

export function downloadMidi(chords: number[][], bpm: number = 120, filename = 'progression.mid'): void {
  const blob = progressionToMidi(chords, bpm);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
