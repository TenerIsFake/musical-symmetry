declare namespace WebMidi {
  interface MIDIMessageEvent extends Event {
    data: Uint8Array | null;
  }

  interface MIDIInput extends EventTarget {
    name: string | null;
    onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
  }

  interface MIDIOutput extends EventTarget {
    id: string;
    name: string | null;
    send(data: number[] | Uint8Array, timestamp?: number): void;
  }

  interface MIDIAccess extends EventTarget {
    inputs: Map<string, MIDIInput>;
    outputs: Map<string, MIDIOutput>;
    onstatechange: ((event: Event) => void) | null;
  }
}

interface Navigator {
  requestMIDIAccess?: () => Promise<WebMidi.MIDIAccess>;
}
