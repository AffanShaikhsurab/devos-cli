import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  port?: number;
}

interface Config {
  groqApiKey?: string;
  defaultModel?: string;
  mcpServers?: McpServerConfig[];
}

const CONFIG_DIR = '.groq'; // In home directory
const CONFIG_FILE = 'local-settings.json';

export class ConfigManager {
  private configPath: string;

  constructor() {
    const homeDir = os.homedir();
    this.configPath = path.join(homeDir, CONFIG_DIR, CONFIG_FILE);
  }

  private ensureConfigDir(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  public getApiKey(): string | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      return config.groqApiKey || null;
    } catch (error) {
      console.warn('Failed to read config file:', error);
      return null;
    }
  }

  public setApiKey(apiKey: string): void {
    try {
      this.ensureConfigDir();

      let config: Config = {};
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        config = JSON.parse(configData);
      }

      config.groqApiKey = apiKey;

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
        mode: 0o600 // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to save API key: ${error}`);
    }
  }

  public clearApiKey(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        return;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      delete config.groqApiKey;

      if (Object.keys(config).length === 0) {
        fs.unlinkSync(this.configPath);
      } else {
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
          mode: 0o600
        });
      }
    } catch (error) {
      console.warn('Failed to clear API key:', error);
    }
  }

  public getDefaultModel(): string | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      return config.defaultModel || null;
    } catch (error) {
      console.warn('Failed to read default model:', error);
      return null;
    }
  }

  public setDefaultModel(model: string): void {
    try {
      this.ensureConfigDir();

      let config: Config = {};
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        config = JSON.parse(configData);
      }

      config.defaultModel = model;

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
        mode: 0o600 // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to save default model: ${error}`);
    }
  }

  public getMcpServers(): McpServerConfig[] {
    try {
      if (!fs.existsSync(this.configPath)) {
        return [];
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      return config.mcpServers || [];
    } catch (error) {
      console.warn('Failed to read MCP servers:', error);
      return [];
    }
  }

  public getMcpServersRecord(): Record<string, McpServerConfig> {
    const servers = this.getMcpServers();
    const record: Record<string, McpServerConfig> = {};
    for (const server of servers) {
      record[server.name] = server;
    }
    return record;
  }

  public addMcpServer(server: McpServerConfig): void {
    try {
      this.ensureConfigDir();

      let config: Config = {};
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        config = JSON.parse(configData);
      }

      config.mcpServers = config.mcpServers || [];
      
      // Remove existing server with same name if it exists
      config.mcpServers = config.mcpServers.filter(s => s.name !== server.name);
      
      // Add the new server
      config.mcpServers.push(server);

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
        mode: 0o600 // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to save MCP server: ${error}`);
    }
  }

  public removeMcpServer(name: string): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        return;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      
      if (config.mcpServers) {
        config.mcpServers = config.mcpServers.filter(s => s.name !== name);
        
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
          mode: 0o600 // Read/write for owner only
        });
      }
    } catch (error) {
      throw new Error(`Failed to remove MCP server: ${error}`);
    }
  }

  public removeAllMcpServers(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        return;
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config: Config = JSON.parse(configData);
      
      config.mcpServers = [];
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
        mode: 0o600 // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to remove all MCP servers: ${error}`);
    }
  }
}