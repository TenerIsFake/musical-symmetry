declare namespace WebMidi {
  interface MIDIMessageEvent extends Event {
    data: Uint8Array | null;
  }

  interface MIDIInput extends EventTarget {
    name: string | null;
    onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
  }

  interface MIDIAccess extends EventTarget {
    inputs: Map<string, MIDIInput>;
    onstatechange: ((event: Event) => void) | null;
  }
}

interface Navigator {
  requestMIDIAccess?: () => Promise<WebMidi.MIDIAccess>;
}
