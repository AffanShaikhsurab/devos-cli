import { spawn } from 'cross-spawn';
import { ChildProcess } from 'child_process';
import getPort from 'get-port';
import net from 'net';
import { ConfigManager, McpServerConfig } from '../utils/local-settings.js';

interface RunningServerInfo {
  process: ChildProcess | null;
  port: number;
  config: McpServerConfig;
  isExternalProcess?: boolean;
}

// Helper function to check if a port is in use
const isPortInUse = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: any) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
};

// Helper function to find process by port (simplified check)
const findProcessByPort = async (port: number): Promise<boolean> => {
  return await isPortInUse(port);
};

export class McpManager {
  private runningServers = new Map<string, RunningServerInfo>();

  public async startManagedServers(forceRestart: boolean = false): Promise<void> {
    const configManager = new ConfigManager();
    const serversToStart = configManager.getMcpServers();

    if (serversToStart.length === 0) {
      return;
    }

    console.log(`Checking status of ${serversToStart.length} managed MCP server(s)...`);

    const startPromises = serversToStart.map(config => this.initializeServer(config, forceRestart));
    await Promise.all(startPromises);
  }

  private async initializeServer(config: McpServerConfig, forceRestart: boolean = false): Promise<void> {
    // Check if server is already running in our managed list
    const existingServer = this.runningServers.get(config.name);
    if (existingServer) {
      if (forceRestart) {
        console.log(`🔄 Restarting MCP server '${config.name}'...`);
        if (existingServer.process) {
          existingServer.process.kill();
        }
        this.runningServers.delete(config.name);
        // Wait a moment for the process to fully terminate
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`✅ MCP server '${config.name}' is already running on port ${existingServer.port}.`);
        return;
      }
    }

    // Check if a user-defined port is already in use by another process
    if (config.port) {
      const inUse = await isPortInUse(config.port);
      if (inUse) {
        if (forceRestart) {
          console.log(`⚠️  Port ${config.port} is in use. Cannot force restart external process. Skipping '${config.name}'.`);
          return;
        } else {
          console.log(`✅ Connecting to existing MCP server '${config.name}' on user-defined port ${config.port}.`);
          this.runningServers.set(config.name, { 
            process: null, 
            port: config.port, 
            config,
            isExternalProcess: true 
          });
          return;
        }
      }
    }

    // If no port is defined or the defined port is free, spawn a new process
    const port = config.port || await getPort();
    return this.spawnServer(config, port);
  }

  private spawnServer(config: McpServerConfig, port?: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const serverPort = port || await getPort();
      const fullArgs = [...config.args, `--port=${serverPort}`];

      const serverProcess = spawn(config.command, fullArgs, {
        env: { ...process.env, ...config.env },
        // Use 'pipe' to listen to stdio, 'inherit' to see output in terminal
        stdio: 'pipe',
      });

      const serverInfo: RunningServerInfo = { process: serverProcess, port: serverPort, config };
      this.runningServers.set(config.name, serverInfo);

      const onReady = (data: Buffer) => {
        const output = data.toString();
        // This is a convention. The MCP server should log this when ready.
        if (output.includes('Server listening on port')) {
          console.log(`✅ MCP server '${config.name}' is running on port ${serverPort}.`);
          serverProcess.stdout?.removeListener('data', onReady); // Clean up listener
          resolve();
        }
      };

      serverProcess.stdout?.on('data', onReady);

      serverProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[${config.name} MCP ERR]: ${data.toString()}`);
      });

      serverProcess.on('error', (err: Error) => {
        console.error(`Failed to start MCP server '${config.name}': ${err.message}`);
        reject(err);
      });

      serverProcess.on('exit', (code: number | null) => {
        console.log(`MCP server '${config.name}' exited with code ${code}.`);
        this.runningServers.delete(config.name);
      });

      // Timeout if the server doesn't report ready
      setTimeout(() => {
        reject(new Error(`Timeout waiting for MCP server '${config.name}' to start.`));
      }, 15000); // 15-second timeout
    });
  }

  public stopAllServers(): void {
    console.log('\nStopping all managed MCP servers...');
    for (const [name, serverInfo] of this.runningServers.entries()) {
      if (serverInfo.process && !serverInfo.isExternalProcess) {
        serverInfo.process.kill();
        console.log(`Stopped '${name}'.`);
      } else if (serverInfo.isExternalProcess) {
        console.log(`Skipped external process '${name}' on port ${serverInfo.port}.`);
      }
    }
  }

  public async restartServer(serverName: string): Promise<void> {
    const serverInfo = this.runningServers.get(serverName);
    if (!serverInfo) {
      throw new Error(`Server '${serverName}' is not running.`);
    }

    if (serverInfo.isExternalProcess) {
      throw new Error(`Cannot restart external process '${serverName}'. Please restart it manually.`);
    }

    console.log(`🔄 Restarting MCP server '${serverName}'...`);
    if (serverInfo.process) {
      serverInfo.process.kill();
    }
    this.runningServers.delete(serverName);
    
    // Wait for process to terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Restart the server
    await this.initializeServer(serverInfo.config, true);
  }
  
  public getRunningServers(): Map<string, RunningServerInfo> {
    return this.runningServers;
  }
}