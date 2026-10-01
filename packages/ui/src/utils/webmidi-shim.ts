/**
 * A Web MIDI polyfill for iOS, backed by CoreMIDI.
 *
 * WebKit refuses the Web MIDI *JavaScript API* on fingerprinting grounds. Every
 * iOS browser is WebKit, and Capacitor's WKWebView inherits that — so
 * `navigator.requestMIDIAccess` is absent and the app's four MIDI files quietly
 * do nothing. CoreMIDI itself works fine on iOS: USB, Lightning/USB-C and
 * Bluetooth LE controllers all deliver events. Only the doorway is missing.
 *
 * So this installs the doorway. The seam sits at the PLATFORM boundary rather
 * than the application boundary: `useMidiInput`, `useLiveMidi`, `useMidiOutput`
 * and `MidiIOPage` are untouched and never learn that iOS is different. Web and
 * Android keep the real API — the shim installs on neither.
 *
 * It is disposable by design. When WebKit ships Web MIDI, delete this file and
 * its one call site; nothing else changes. An adapter layered into the four
 * consumers could never be removed that cleanly.
 *
 * SCOPE. Exactly the six members those files use:
 *   requestMIDIAccess() · inputs/outputs Maps · onmidimessage · onstatechange ·
 *   send() · MIDIOutput.id and .name
 * Everything else THROWS rather than silently no-opping. A consumer reaching past
 * this subset should be told, not misled.
 */

export interface MidiPortInfo {
  id: string;
  name: string;
}

/** The native surface, implemented by packages/capacitor-coremidi. */
export interface CoreMidiBridge {
  enumerate(): Promise<{ inputs: MidiPortInfo[]; outputs: MidiPortInfo[] }>;
  openInput(options: { id: string }): Promise<void>;
  closeInput(options: { id: string }): Promise<void>;
  send(options: { outputId: string; data: number[] }): Promise<void>;
  addListener(
    event: 'midimessage' | 'statechange',
    fn: (payload: never) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const notImplemented = (member: string): never => {
  throw new Error(
    `MIDI${member} is not implemented by Chrometria's iOS Web MIDI shim. ` +
      'Only requestMIDIAccess, inputs/outputs, onmidimessage, onstatechange and send() are supported.',
  );
};

class ShimInput extends EventTarget {
  onmidimessage: ((ev: WebMidi.MIDIMessageEvent) => void) | null = null;
  readonly type = 'input';
  readonly state = 'connected';
  readonly connection = 'open';
  readonly manufacturer = null;
  readonly version = null;

  constructor(readonly id: string, readonly name: string | null) {
    super();
  }

  // Present so that reaching for them fails loudly. A no-op would let a caller
  // believe it had opened a port it has not.
  open(): never { return notImplemented('Input.open()'); }
  close(): never { return notImplemented('Input.close()'); }

  /** @internal */
  deliver(data: number[]): void {
    if (!this.onmidimessage) return;
    // The real API hands over a Uint8Array and consumers index it; a plain array
    // would pass these tests by luck and differ subtly in production.
    const event = new Event('midimessage') as Event & { data: Uint8Array };
    event.data = new Uint8Array(data);
    this.onmidimessage(event as unknown as WebMidi.MIDIMessageEvent);
  }
}

class ShimOutput extends EventTarget {
  readonly type = 'output';
  readonly state = 'connected';
  readonly connection = 'open';
  readonly manufacturer = null;
  readonly version = null;

  constructor(
    readonly id: string,
    readonly name: string | null,
    private readonly bridge: CoreMidiBridge,
  ) {
    super();
  }

  open(): never { return notImplemented('Output.open()'); }
  close(): never { return notImplemented('Output.close()'); }
  clear(): never { return notImplemented('Output.clear()'); }

  /**
   * Web MIDI's send() is synchronous and returns void; the bridge is async. The
   * rejection is swallowed on purpose — a controller unplugged mid-send must not
   * surface as an unhandled promise rejection in an app that cannot act on it.
   */
  send(data: number[] | Uint8Array, _timestamp?: number): void {
    void this.bridge
      .send({ outputId: this.id, data: Array.from(data) })
      .catch(() => { /* device vanished between enumerate and send */ });
  }
}

class ShimAccess extends EventTarget {
  inputs = new Map<string, ShimInput>();
  outputs = new Map<string, ShimOutput>();
  onstatechange: ((event: Event) => void) | null = null;
  readonly sysexEnabled = false;

  constructor(private readonly bridge: CoreMidiBridge) {
    super();
  }

  /** @internal Rebuilds both maps from the device list. */
  async refresh(): Promise<void> {
    const { inputs, outputs } = await this.bridge.enumerate();

    const nextInputs = new Map<string, ShimInput>();
    for (const info of inputs) {
      // Reuse the existing port object when the device is still there, so an
      // onmidimessage handler assigned before a hot-plug survives it.
      const existing = this.inputs.get(info.id);
      nextInputs.set(info.id, existing ?? new ShimInput(info.id, info.name));
    }

    // CoreMIDI delivers nothing from a source until it is connected. A Web MIDI
    // consumer never calls open() — it assigns onmidimessage and expects data —
    // so every input is opened eagerly here.
    for (const [id] of nextInputs) {
      if (!this.inputs.has(id)) {
        await this.bridge.openInput({ id }).catch(() => { /* raced a disconnect */ });
      }
    }
    for (const [id] of this.inputs) {
      if (!nextInputs.has(id)) {
        await this.bridge.closeInput({ id }).catch(() => { /* already gone */ });
      }
    }

    this.inputs = nextInputs;
    this.outputs = new Map(
      outputs.map(info => [info.id, this.outputs.get(info.id) ?? new ShimOutput(info.id, info.name, this.bridge)]),
    );
  }

  /** @internal */
  dispatchStateChange(): void {
    const event = new Event('statechange');
    this.onstatechange?.(event);
    this.dispatchEvent(event);
  }
}

/**
 * Installs the shim. Call once, from the app entry point, and only on native iOS.
 *
 * @param bridge the CoreMIDI plugin — injected rather than imported so the shim
 *               is testable against a fake on a machine with no CoreMIDI.
 */
export function installWebMidiShim(bridge: CoreMidiBridge): void {
  // If a real implementation exists, leave it alone. The day WebKit ships Web
  // MIDI, this shim must step aside rather than shadow something better.
  if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) return;

  let accessPromise: Promise<ShimAccess> | null = null;

  const requestMIDIAccess = (options?: { sysex?: boolean }): Promise<WebMidi.MIDIAccess> => {
    if (options?.sysex) {
      // Refusing is the honest answer: the plugin sends one MIDI 1.0 channel
      // voice message per packet and cannot carry a SysEx stream.
      return Promise.reject(new Error('SysEx is not supported by Chrometria\'s iOS Web MIDI shim'));
    }
    if (!accessPromise) {
      accessPromise = (async () => {
        const access = new ShimAccess(bridge);
        await access.refresh();

        await bridge.addListener('midimessage', ((payload: { inputId: string; data: number[] }) => {
          access.inputs.get(payload.inputId)?.deliver(payload.data);
        }) as (p: never) => void);

        await bridge.addListener('statechange', ((() => {
          // Re-enumerate BEFORE telling anyone: useMidiOutput's handler reads
          // access.outputs immediately and trusts what it finds.
          void access.refresh().then(() => access.dispatchStateChange());
        }) as unknown) as (p: never) => void);

        return access;
      })();
    }
    return accessPromise as unknown as Promise<WebMidi.MIDIAccess>;
  };

  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: requestMIDIAccess,
    configurable: true,
    writable: true,
  });
}
