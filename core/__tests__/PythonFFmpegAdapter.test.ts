import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import { PythonFFmpegAdapter } from '../adapters/PythonFFmpegAdapter';
import {
  IProcessSpawner,
  IAppConfig,
  IVideoMergeOptions,
} from '../interfaces/IVideoProcessing';

function createMockSpawner(): IProcessSpawner {
  return {
    spawn: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    cancelRunningProcess: vi.fn().mockReturnValue(false),
  };
}

function createConfig(): IAppConfig {
  return {
    pythonPath: 'python',
    pythonScriptPath: '/path/to/video_processor_cli.py',
    supportedFormats: ['mp4'],
  };
}

describe('PythonFFmpegAdapter clipEdits handling', () => {
  let tmpFilesCreated: string[] = [];

  beforeEach(() => {
    tmpFilesCreated = [];
  });

  afterEach(() => {
    // Clean any leftover temp clip JSON files in case the adapter's
    // cleanup ran asynchronously after the test finished.
    for (const p of tmpFilesCreated) {
      try { fs.unlinkSync(p); } catch { /* noop */ }
    }
  });

  it('omits --clips-json when clipEdits is missing', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());
    const options: IVideoMergeOptions = {
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
    };

    await adapter.mergeVideos(options);

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--clips-json');
  });

  it('omits --clips-json when clipEdits is empty array', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());
    const options: IVideoMergeOptions = {
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      clipEdits: [],
    };

    await adapter.mergeVideos(options);

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--clips-json');
  });

  it('writes JSON tempfile and passes --clips-json when edits provided', async () => {
    let capturedJsonPath: string | undefined;
    const spawner: IProcessSpawner = {
      spawn: vi.fn().mockImplementation(async (_cmd: string, args: string[]) => {
        const idx = args.indexOf('--clips-json');
        if (idx >= 0) {
          capturedJsonPath = args[idx + 1];
          // Capture file contents BEFORE the adapter's finally-cleanup runs.
          if (capturedJsonPath && fs.existsSync(capturedJsonPath)) {
            const contents = fs.readFileSync(capturedJsonPath, 'utf-8');
            (spawner as any)._capturedContents = contents;
          }
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }),
      cancelRunningProcess: vi.fn().mockReturnValue(false),
    };
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());
    const options: IVideoMergeOptions = {
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      clipEdits: [
        { trimStart: 1.5, volume: 0.8 },
        { aspectRatio: '9:16', brightness: 0.1 },
      ],
    };

    await adapter.mergeVideos(options);

    expect(capturedJsonPath).toBeDefined();
    expect(capturedJsonPath!).toContain(os.tmpdir());
    expect(capturedJsonPath!.endsWith('.json')).toBe(true);
    if (capturedJsonPath) tmpFilesCreated.push(capturedJsonPath);

    const written = JSON.parse((spawner as any)._capturedContents);
    expect(written.clips).toHaveLength(2);
    expect(written.clips[0]).toEqual({
      path: 'a.mp4',
      edits: { trimStart: 1.5, volume: 0.8 },
    });
    expect(written.clips[1]).toEqual({
      path: 'b.mp4',
      edits: { aspectRatio: '9:16', brightness: 0.1 },
    });
  });

  it('cleans up the tempfile after merge completes', async () => {
    let capturedJsonPath: string | undefined;
    const spawner: IProcessSpawner = {
      spawn: vi.fn().mockImplementation(async (_cmd: string, args: string[]) => {
        const idx = args.indexOf('--clips-json');
        if (idx >= 0) {
          capturedJsonPath = args[idx + 1];
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      }),
      cancelRunningProcess: vi.fn().mockReturnValue(false),
    };
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4'],
      outputPath: 'out.mp4',
      clipEdits: [{ trimStart: 1 }],
    });

    // The adapter unlinks asynchronously in finally; give the event loop a tick.
    await new Promise((resolve) => setImmediate(resolve));

    expect(capturedJsonPath).toBeDefined();
    expect(fs.existsSync(capturedJsonPath!)).toBe(false);
  });

  it('forwards loudnorm flags when loudnorm.enabled is true', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      loudnorm: {
        enabled: true,
        targetLufs: -14,
        truePeak: -1,
        loudnessRange: 7,
      },
    });

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).toContain('--loudnorm');
    expect(callArgs).toContain('--loudnorm-target');
    expect(callArgs[callArgs.indexOf('--loudnorm-target') + 1]).toBe('-14');
    expect(callArgs).toContain('--loudnorm-true-peak');
    expect(callArgs[callArgs.indexOf('--loudnorm-true-peak') + 1]).toBe('-1');
    expect(callArgs).toContain('--loudnorm-lra');
    expect(callArgs[callArgs.indexOf('--loudnorm-lra') + 1]).toBe('7');
  });

  it('omits loudnorm flags when loudnorm is undefined', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
    });

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--loudnorm');
    expect(callArgs).not.toContain('--loudnorm-target');
  });

  it('omits loudnorm flags when loudnorm.enabled is false', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      loudnorm: { enabled: false, targetLufs: -16 },
    });

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--loudnorm');
  });

  it('forwards autoSilenceTrim flag with custom threshold + min duration', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      autoSilenceTrim: {
        enabled: true,
        thresholdDb: -40,
        minDurationSec: 1.0,
      },
    });

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).toContain('--auto-silence-trim');
    expect(callArgs).toContain('--silence-threshold-db');
    expect(callArgs[callArgs.indexOf('--silence-threshold-db') + 1]).toBe('-40');
    expect(callArgs).toContain('--silence-min-duration');
    expect(callArgs[callArgs.indexOf('--silence-min-duration') + 1]).toBe('1');
  });

  it('omits autoSilenceTrim flags when disabled', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      autoSilenceTrim: { enabled: false, thresholdDb: -40 },
    });

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--auto-silence-trim');
  });

  it('forwards captions flags when captions.enabled is true', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      captions: {
        enabled: true,
        model: 'small',
        language: 'en',
        computeType: 'int8',
      },
    });

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).toContain('--captions');
    expect(callArgs[callArgs.indexOf('--caption-model') + 1]).toBe('small');
    expect(callArgs[callArgs.indexOf('--caption-language') + 1]).toBe('en');
    expect(callArgs[callArgs.indexOf('--caption-compute-type') + 1]).toBe('int8');
  });

  it('omits captions flags when captions.enabled is false', async () => {
    const spawner = createMockSpawner();
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    await adapter.mergeVideos({
      inputPaths: ['a.mp4', 'b.mp4'],
      outputPath: 'out.mp4',
      captions: { enabled: false, model: 'base' },
    });

    const callArgs = (spawner.spawn as any).mock.calls[0][1] as string[];
    expect(callArgs).not.toContain('--captions');
    expect(callArgs).not.toContain('--caption-model');
  });

  it('still cleans up the tempfile when the spawn rejects', async () => {
    let capturedJsonPath: string | undefined;
    const spawner: IProcessSpawner = {
      spawn: vi.fn().mockImplementation(async (_cmd: string, args: string[]) => {
        const idx = args.indexOf('--clips-json');
        if (idx >= 0) {
          capturedJsonPath = args[idx + 1];
        }
        throw new Error('spawn boom');
      }),
      cancelRunningProcess: vi.fn().mockReturnValue(false),
    };
    const adapter = new PythonFFmpegAdapter(spawner, createConfig());

    const result = await adapter.mergeVideos({
      inputPaths: ['a.mp4'],
      outputPath: 'out.mp4',
      clipEdits: [{ trimStart: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('spawn boom');

    await new Promise((resolve) => setImmediate(resolve));
    expect(capturedJsonPath).toBeDefined();
    expect(fs.existsSync(capturedJsonPath!)).toBe(false);
  });
});
