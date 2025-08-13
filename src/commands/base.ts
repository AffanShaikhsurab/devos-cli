import { Agent } from '../core/agent.js';

export interface CommandContext {
  addMessage: (message: any) => void;
  clearHistory: () => void;
  setShowLogin: (show: boolean) => void;
  setShowModelSelector?: (show: boolean) => void;
  toggleReasoning?: () => void;
  showReasoning?: boolean;
  agent: Agent;
}

export interface CommandDefinition {
  command: string;
  description: string;
  handler: (context: CommandContext, args: string[]) => void | Promise<void>;
}

export abstract class BaseCommand implements CommandDefinition {
  abstract command: string;
  abstract description: string;
  abstract handler(context: CommandContext, args: string[]): void | Promise<void>;
}