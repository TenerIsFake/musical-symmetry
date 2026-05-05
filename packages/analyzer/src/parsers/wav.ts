import { parseAudio } from './audio.js';
import type { AudioParseResult } from './audio.js';

export function parseWav(buffer: Buffer): AudioParseResult {
  // Manual WAV header parsing (no external dependency)
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Verify RIFF header
  const riff = String.fromCharCode(buffer[0]!, buffer[1]!, buffer[2]!, buffer[3]!);
  if (riff !== 'RIFF') throw new Error('Not a valid WAV file');

  const wave = String.fromCharCode(buffer[8]!, buffer[9]!, buffer[10]!, buffer[11]!);
  if (wave !== 'WAVE') throw new Error('Not a valid WAV file');

  // Find fmt chunk
  let offset = 12;
  let sampleRate = 44100;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataStart = 0;
  let dataSize = 0;

  while (offset < buffer.length - 8) {
    const chunkId = String.fromCharCode(buffer[offset]!, buffer[offset+1]!, buffer[offset+2]!, buffer[offset+3]!);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkSize === 0 || chunkSize > buffer.length - offset) break;

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataStart = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (dataStart === 0) throw new Error('No data chunk found in WAV');
  if (bitsPerSample !== 16 && bitsPerSample !== 24 && bitsPerSample !== 32) {
    throw new Error(`Unsupported bits per sample: ${bitsPerSample}`);
  }
  if (numChannels < 1 || numChannels > 16) {
    throw new Error(`Invalid channel count: ${numChannels}`);
  }
  if (sampleRate < 1 || sampleRate > 384000) {
    throw new Error(`Invalid sample rate: ${sampleRate}`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.min(
    Math.floor(dataSize / (bytesPerSample * numChannels)),
    Math.floor((buffer.length - dataStart) / (bytesPerSample * numChannels)),
  );
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const sampleOffset = dataStart + i * bytesPerSample * numChannels;
    let value = 0;

    if (bitsPerSample === 16) {
      value = view.getInt16(sampleOffset, true) / 32768;
    } else if (bitsPerSample === 24) {
      const b0 = buffer[sampleOffset]!;
      const b1 = buffer[sampleOffset + 1]!;
      const b2 = buffer[sampleOffset + 2]!;
      const raw = (b2 << 16) | (b1 << 8) | b0;
      value = (raw > 0x7FFFFF ? raw - 0x1000000 : raw) / 8388608;
    } else if (bitsPerSample === 32) {
      value = view.getFloat32(sampleOffset, true);
    }

    samples[i] = value;
  }

  return parseAudio(samples, sampleRate);
}
