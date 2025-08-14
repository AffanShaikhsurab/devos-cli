import { CommandDefinition, CommandContext } from './base.js';
import { helpCommand } from './definitions/help.js';
import { loginCommand } from './definitions/login.js';
import { modelCommand } from './definitions/model.js';
import { clearCommand } from './definitions/clear.js';
import { reasoningCommand } from './definitions/reasoning.js';
import { agentCommand } from './definitions/agent.js';
import { qaCommand } from './definitions/qa.js';
import { repairCommand } from './definitions/repair.js';
import { createPrdCommand } from './definitions/create-prd.js';
import { createNextStoryCommand } from './definitions/create-next-story.js';
import { bmadInitCommand } from './definitions/bmad-init.js';

const availableCommands: CommandDefinition[] = [
  helpCommand,
  loginCommand,
  modelCommand,
  clearCommand,
  reasoningCommand,
  agentCommand,
  qaCommand,
  repairCommand,
  createPrdCommand,
  createNextStoryCommand,
  bmadInitCommand,
];

export function getAvailableCommands(): CommandDefinition[] {
  return [...availableCommands];
}

export function getCommandNames(): string[] {
  return getAvailableCommands().map(cmd => cmd.command);
}

export function handleSlashCommand(
  command: string, 
  context: CommandContext
) {
  // Extract the command part, everything up to the first space or end of string
  const fullCommand = command.slice(1).trim();
  const parts = fullCommand.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  const commandDef = getAvailableCommands().find(c => c.command === cmd);
  
  // Add user message for the command
  context.addMessage({
    role: 'user',
    content: command,
  });
  
  if (commandDef) {
    commandDef.handler(context, args);
  }
}

export { CommandDefinition, CommandContext } from './base.js';