import { IProcessSpawner } from '../interfaces/IVideoProcessing';
import { spawn, ChildProcess } from 'child_process';

/**
 * Node.js child_process spawner implementation
 * Abstracts process spawning to enable dependency injection and testing
 */
export class NodeProcessSpawner implements IProcessSpawner {
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

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        if (onStdout) onStdout(str);
      });

      process.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        if (onStderr) onStderr(str);
      });

      process.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }
}
