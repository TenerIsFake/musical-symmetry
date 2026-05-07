import { useState, useRef, useCallback, useEffect } from 'react';
import type { PitchClass } from '@musical-symmetry/core';

const MIN_FREQ = 65;
const MAX_FREQ = 2093;

function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i]! * buffer[i]!;
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  const maxLag = Math.floor(sampleRate / MIN_FREQ);
  const minLag = Math.floor(sampleRate / MAX_FREQ);
  const diff = new Float32Array(maxLag);

  for (let lag = minLag; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) {
      const d = buffer[i]! - buffer[i + lag]!;
      sum += d * d;
    }
    diff[lag] = sum;
  }

  const cmndf = new Float32Array(maxLag);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let lag = minLag; lag < maxLag; lag++) {
    runningSum += diff[lag]!;
    cmndf[lag] = diff[lag]! * lag / runningSum;
  }

  const threshold = 0.15;
  let bestLag = -1;
  for (let lag = minLag; lag < maxLag - 1; lag++) {
    if (cmndf[lag]! < threshold) {
      while (lag + 1 < maxLag && cmndf[lag + 1]! < cmndf[lag]!) lag++;
      bestLag = lag;
      break;
    }
  }

  if (bestLag === -1) return null;
  const freq = sampleRate / bestLag;
  if (freq < MIN_FREQ || freq > MAX_FREQ) return null;
  return freq;
}

function freqToPitchClass(freq: number): PitchClass {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  return (midi % 12) as PitchClass;
}

export function useMicPitchDetect() {
  const [isListening, setIsListening] = useState(false);
  const [detectedPC, setDetectedPC] = useState<PitchClass | null>(null);
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const detect = useCallback(() => {
    if (!analyserRef.current || !contextRef.current) return;

    const analyser = analyserRef.current;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const freq = autoCorrelate(buffer, contextRef.current.sampleRate);
    if (freq !== null) {
      setDetectedPC(freqToPitchClass(freq));
      setDetectedFreq(freq);
    } else {
      setDetectedPC(null);
      setDetectedFreq(null);
    }

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [detect]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    contextRef.current?.close();
    contextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setDetectedPC(null);
    setDetectedFreq(null);
  }, []);

  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return { isListening, detectedPC, detectedFreq, error, start, stop };
}
