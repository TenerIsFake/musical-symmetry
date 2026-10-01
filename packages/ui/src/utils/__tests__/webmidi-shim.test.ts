/**
 * The Web MIDI shim, exercised over a fake plugin.
 *
 * This is the half of the iOS MIDI bridge that can be proven on Linux. The Swift
 * cannot: CoreMIDI does not exist here, and a macOS CI runner has no MIDI devices
 * attached, so the native side compiles in CI and is only truly proven by a
 * controller plugged into a real device.
 *
 * So these tests carry the weight. They assert the shim satisfies exactly what the
 * four consuming files use — nothing more, and deliberately nothing less:
 *
 *   requestMIDIAccess() · inputs/outputs Maps · onmidimessage · onstatechange ·
 *   output.send([status, note, velocity]) · MIDIOutput.id and .name
 *
 * The contract was read out of the consumers (useMidiInput, useLiveMidi,
 * useMidiOutput, MidiIOPage), not out of the W3C spec. Anything the app does not
 * use is NOT implemented, and must throw rather than silently no-op — see the last
 * block. A future consumer reaching past our subset should be told, not misled.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installWebMidiShim, type CoreMidiBridge } from '../webmidi-shim';

type Listener = (payload: unknown) => void;

/** Stands in for the Swift plugin. */
function fakePlugin(overrides: Partial<CoreMidiBridge> = {}) {
  const listeners = new Map<string, Listener[]>();
  const sent: Array<{ outputId: string; data: number[] }> = [];
  const opened: string[] = [];
  let devices = {
    inputs: [{ id: '101', name: 'Keystep' }],
    outputs: [{ id: '202', name: 'Volca' }],
  };

  const plugin: CoreMidiBridge & {
    emit: (event: string, payload: unknown) => void;
    sent: typeof sent;
    opened: typeof opened;
    setDevices: (d: typeof devices) => void;
  } = {
    enumerate: vi.fn(async () => devices),
    openInput: vi.fn(async ({ id }) => { opened.push(id); }),
    closeInput: vi.fn(async () => {}),
    send: vi.fn(async ({ outputId, data }) => { sent.push({ outputId, data }); }),
    addListener: vi.fn(async (event: string, fn: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), fn]);
      return { remove: async () => {} };
    }),
    ...overrides,
    emit: (event, payload) => (listeners.get(event) ?? []).forEach(fn => fn(payload)),
    sent,
    opened,
    setDevices: d => { devices = d; },
  };
  return plugin;
}

const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'requestMIDIAccess');

afterEach(() => {
  if (originalDescriptor) Object.defineProperty(navigator, 'requestMIDIAccess', originalDescriptor);
  else delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess;
});

describe('installation', () => {
  it('puts requestMIDIAccess on navigator, which is the feature check the app uses', async () => {
    // MidiIOPage.tsx:261 gates the whole screen on `'requestMIDIAccess' in navigator`.
    expect('requestMIDIAccess' in navigator && navigator.requestMIDIAccess).toBeFalsy();
    installWebMidiShim(fakePlugin());
    expect('requestMIDIAccess' in navigator).toBe(true);
    expect(typeof navigator.requestMIDIAccess).toBe('function');
  });

  it('does not clobber a real implementation if one ever appears', async () => {
    // If WebKit ships Web MIDI, the shim must get out of the way rather than
    // shadow a better implementation with ours.
    const real = vi.fn();
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: real, configurable: true, writable: true });
    installWebMidiShim(fakePlugin());
    expect(navigator.requestMIDIAccess).toBe(real);
  });
});

describe('MIDIAccess', () => {
  beforeEach(() => {
    delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess;
  });

  it('exposes inputs and outputs as Maps keyed by id', async () => {
    installWebMidiShim(fakePlugin());
    const access = await navigator.requestMIDIAccess!();

    // useMidiInput does [...access.inputs.values()]; MidiIOPage does the same and
    // then .find(o => o.id === value) over outputs.
    const inputs = [...access.inputs.values()];
    const outputs = [...access.outputs.values()];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.name).toBe('Keystep');
    expect(outputs[0]!.id).toBe('202');
    expect(outputs[0]!.name).toBe('Volca');
    expect(access.outputs.get('202')).toBe(outputs[0]);
  });

  it('opens each input so messages actually flow', async () => {
    // CoreMIDI delivers nothing until the source is connected. A Web MIDI consumer
    // never calls open() — it just assigns onmidimessage — so the shim must have
    // opened the port already.
    const plugin = fakePlugin();
    installWebMidiShim(plugin);
    await navigator.requestMIDIAccess!();
    expect(plugin.opened).toEqual(['101']);
  });
});

describe('receiving', () => {
  beforeEach(() => { delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess; });

  it('delivers onmidimessage with a Uint8Array, to the right port', async () => {
    const plugin = fakePlugin();
    installWebMidiShim(plugin);
    const access = await navigator.requestMIDIAccess!();
    const input = [...access.inputs.values()][0]!;

    const seen: Array<number[]> = [];
    input.onmidimessage = ev => { seen.push([...(ev.data ?? [])]); };

    plugin.emit('midimessage', { inputId: '101', data: [0x90, 60, 100] });
    // useMidiInput reads event.data[0..2] and indexes it — a plain array would
    // work by luck; the type says Uint8Array and the real API gives one.
    expect(seen).toEqual([[0x90, 60, 100]]);
  });

  it('ignores a message for a port nobody is listening to', async () => {
    const plugin = fakePlugin();
    installWebMidiShim(plugin);
    const access = await navigator.requestMIDIAccess!();
    const input = [...access.inputs.values()][0]!;
    const seen: number[][] = [];
    input.onmidimessage = ev => { seen.push([...(ev.data ?? [])]); };

    plugin.emit('midimessage', { inputId: '999', data: [0x90, 60, 100] });
    expect(seen).toEqual([]);
  });
});

describe('sending', () => {
  beforeEach(() => { delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess; });

  it('passes the raw bytes and the target port through', async () => {
    const plugin = fakePlugin();
    installWebMidiShim(plugin);
    const access = await navigator.requestMIDIAccess!();
    const out = [...access.outputs.values()][0]!;

    // Exactly what useMidiOutput sends: note on, then note off.
    out.send([0x90 | 0, 60, 100]);
    out.send([0x80 | 0, 60, 0]);
    expect(plugin.sent).toEqual([
      { outputId: '202', data: [0x90, 60, 100] },
      { outputId: '202', data: [0x80, 60, 0] },
    ]);
  });

  it('accepts a Uint8Array too, since the type allows it', async () => {
    const plugin = fakePlugin();
    installWebMidiShim(plugin);
    const access = await navigator.requestMIDIAccess!();
    [...access.outputs.values()][0]!.send(new Uint8Array([0xb0, 7, 64]));
    expect(plugin.sent[0]!.data).toEqual([0xb0, 7, 64]);
  });

  it('does not reject into an unhandled promise when the device vanishes', async () => {
    // send() is synchronous in Web MIDI and async underneath. A controller
    // unplugged mid-send must not produce an unhandled rejection.
    const plugin = fakePlugin({ send: vi.fn(async () => { throw new Error('gone'); }) });
    installWebMidiShim(plugin);
    const access = await navigator.requestMIDIAccess!();
    expect(() => [...access.outputs.values()][0]!.send([0x90, 60, 100])).not.toThrow();
    await Promise.resolve();
  });
});

describe('hot-plug', () => {
  beforeEach(() => { delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess; });

  it('re-enumerates and fires onstatechange when a device appears', async () => {
    const plugin = fakePlugin();
    installWebMidiShim(plugin);
    const access = await navigator.requestMIDIAccess!();
    expect([...access.outputs.values()]).toHaveLength(1);

    const fired: number[] = [];
    access.onstatechange = () => { fired.push([...access.outputs.values()].length); };

    plugin.setDevices({
      inputs: [{ id: '101', name: 'Keystep' }],
      outputs: [{ id: '202', name: 'Volca' }, { id: '303', name: 'Digitakt' }],
    });
    plugin.emit('statechange', {});
    await vi.waitFor(() => expect(fired.length).toBeGreaterThan(0));

    // The handler must see the UPDATED maps — useMidiOutput's onstatechange does
    // Array.from(access.outputs.values()) and trusts what it finds.
    expect(fired[0]).toBe(2);
    expect(access.outputs.get('303')!.name).toBe('Digitakt');
  });
});

describe('the subset is honest about its edges', () => {
  beforeEach(() => { delete (navigator as { requestMIDIAccess?: unknown }).requestMIDIAccess; });

  it('throws on Web MIDI members it does not implement', async () => {
    // Deliberate: silently no-oping open()/close() would make a future consumer
    // believe it had a port it does not have. Same principle as canUseServer
    // taking no unlock parameter — make the unsupported case unrepresentable.
    installWebMidiShim(fakePlugin());
    const access = await navigator.requestMIDIAccess!();
    const input = [...access.inputs.values()][0]! as unknown as { open: () => void; close: () => void };
    expect(() => input.open()).toThrow(/not implemented/i);
    expect(() => input.close()).toThrow(/not implemented/i);
  });

  it('refuses SysEx rather than pretending', async () => {
    installWebMidiShim(fakePlugin());
    await expect(navigator.requestMIDIAccess!({ sysex: true } as never)).rejects.toThrow(/sysex/i);
  });
});
