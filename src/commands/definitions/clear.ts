import { CommandDefinition, CommandContext } from '../base.js';

export const clearCommand: CommandDefinition = {
  command: 'clear',
  description: 'Clear chat history and context',
  handler: ({ addMessage, clearHistory }: CommandContext, args: string[]) => {
    clearHistory();
    addMessage({
      role: 'system',
      content: 'Chat history and context cleared.',
    });
  }
};