declare namespace WebMidi {
  interface MIDIMessageEvent extends Event {
    data: Uint8Array;
  }

  interface MIDIInput extends EventTarget {
    name: string | null;
    onmidimessage: ((event: MIDIMessageEvent) => void) | null;
  }

  interface MIDIAccess extends EventTarget {
    inputs: Map<string, MIDIInput>;
    onstatechange: ((event: Event) => void) | null;
  }
}

interface Navigator {
  requestMIDIAccess?: () => Promise<WebMidi.MIDIAccess>;
}
