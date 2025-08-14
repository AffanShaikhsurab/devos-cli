import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { createToolResponse, ToolResult } from './tool-utils.js';

const execAsync = promisify(exec);

export async function executeCommand(command: string, commandType: string, workingDirectory?: string, timeout: number = 30000): Promise<ToolResult> {
  try {
    if (!['bash', 'python', 'setup', 'run'].includes(commandType)) {
      return createToolResponse(false, undefined, '', 'Error: Invalid command_type');
    }

    let originalCwd: string | undefined;
    if (workingDirectory) {
      const wdPath = path.resolve(workingDirectory);
      const exists = await fs.promises.access(wdPath).then(() => true).catch(() => false);
      if (!exists) {
        return createToolResponse(false, undefined, '', 'Error: Working directory not found');
      }
      originalCwd = process.cwd();
      process.chdir(workingDirectory);
    }

    try {
      let execCommand: string;
      if (commandType === 'python') {
        execCommand = `python -c "${command.replace(/"/g, '\\"')}"`;
      } else {
        execCommand = command;
      }

      const { stdout, stderr } = await execAsync(execCommand, { timeout });
      const success = true;

      return createToolResponse(
        success,
        `stdout: ${stdout}\nstderr: ${stderr}`,
        `Command executed successfully`
      );

    } finally {
      if (originalCwd) {
        process.chdir(originalCwd);
      }
    }

  } catch (error: any) {
    const isTimeout = error.killed && error.signal === 'SIGTERM';
    if (isTimeout) {
      return createToolResponse(false, undefined, '', 'Error: Command timed out');
    }
    return createToolResponse(false, undefined, '', 'Error: Failed to execute command');
  }
}
