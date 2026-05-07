import { spawn } from 'child_process';
import { mkdtemp, rm, readdir } from 'fs/promises';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com', 'open.spotify.com'];

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are supported');
  }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    throw new Error('Only YouTube and Spotify URLs are supported');
  }
}

export async function fetchAudioFromUrl(
  url: string,
  onProgress?: (msg: string) => void,
): Promise<Buffer> {
  validateUrl(url);

  const tempDir = await mkdtemp(join(tmpdir(), 'chrometria-audio-'));

  try {
    const outputTemplate = join(tempDir, 'audio.%(ext)s');

    await new Promise<void>((resolve, reject) => {
      let proc: ReturnType<typeof spawn>;

      try {
        proc = spawn('yt-dlp', [
          '--extract-audio',
          '--audio-format', 'wav',
          '--audio-quality', '0',
          '--max-filesize', '50M',
          '--match-filter', 'duration <= 600',
          '--no-playlist',
          '--output', outputTemplate,
          url,
        ]);
      } catch (err: unknown) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          reject(new Error('yt-dlp is not installed on this server. Audio URL analysis is unavailable.'));
        } else {
          reject(err);
        }
        return;
      }

      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          onProgress?.(line.trim());
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          onProgress?.(line.trim());
        }
      });

      proc.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          reject(new Error('yt-dlp is not installed on this server. Audio URL analysis is unavailable.'));
        } else {
          reject(new Error(`Failed to start yt-dlp: ${err.message}`));
        }
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const detail = stderr.slice(-500).trim();
          reject(new Error(`yt-dlp exited with code ${code}. ${detail}`));
        }
      });
    });

    // Find the output WAV file
    const files = await readdir(tempDir);
    const wavFile = files.find(f => f.endsWith('.wav'));

    if (!wavFile) {
      throw new Error('yt-dlp did not produce a WAV file. The URL may not be supported or the audio format conversion failed.');
    }

    const buffer = await readFile(join(tempDir, wavFile));
    return buffer;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Best-effort cleanup
    });
  }
}
