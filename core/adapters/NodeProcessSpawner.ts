import { IProcessSpawner } from '../interfaces/IVideoProcessing';
import { spawn, ChildProcess } from 'child_process';

/**
 * Node.js child_process spawner implementation
 * Abstracts process spawning to enable dependency injection and testing
 */
export class NodeProcessSpawner implements IProcessSpawner {
  private static readonly MAX_CAPTURE_BYTES = 1_000_000;
  private static activeProcess: ChildProcess | null = null;
  private static cancellationRequested = false;

  cancelRunningProcess(): boolean {
    const active = NodeProcessSpawner.activeProcess;
    if (!active || active.killed) {
      return false;
    }

    NodeProcessSpawner.cancellationRequested = true;

    try {
      active.kill('SIGTERM');
      return true;
    } catch {
      try {
        active.kill();
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Spawn a child process
   * @param command - Command to execute
   * @param args - Command arguments
   * @param onStdout - Optional callback for stdout stream data
   * @param onStderr - Optional callback for stderr stream data
   * @returns Promise resolving to process output
   */
  async spawn(
    command: string,
    args: string[],
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      NodeProcessSpawner.activeProcess = process;
      NodeProcessSpawner.cancellationRequested = false;

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        if (stdout.length > NodeProcessSpawner.MAX_CAPTURE_BYTES) {
          stdout = stdout.slice(-NodeProcessSpawner.MAX_CAPTURE_BYTES);
        }
        if (onStdout) onStdout(str);
      });

      process.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        if (stderr.length > NodeProcessSpawner.MAX_CAPTURE_BYTES) {
          stderr = stderr.slice(-NodeProcessSpawner.MAX_CAPTURE_BYTES);
        }
        if (onStderr) onStderr(str);
      });

      process.on('close', (code, signal) => {
        const wasCancelled = NodeProcessSpawner.cancellationRequested;
        const exitCode = typeof code === 'number' ? code : (signal ? 1 : 0);
        if (wasCancelled && !stderr.includes('Merge cancelled by user.')) {
          stderr = `${stderr ? `${stderr}\n` : ''}Merge cancelled by user.`;
        }

        if (NodeProcessSpawner.activeProcess === process) {
          NodeProcessSpawner.activeProcess = null;
        }
        NodeProcessSpawner.cancellationRequested = false;

        resolve({
          stdout,
          stderr,
          exitCode,
        });
      });

      process.on('error', (error) => {
        if (NodeProcessSpawner.activeProcess === process) {
          NodeProcessSpawner.activeProcess = null;
        }
        NodeProcessSpawner.cancellationRequested = false;
        reject(error);
      });
    });
  }
}
