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
   * @returns Promise resolving to process output
   */
  async spawn(
    command: string,
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
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
