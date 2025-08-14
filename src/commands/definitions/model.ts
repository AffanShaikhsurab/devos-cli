import { CommandDefinition, CommandContext } from '../base.js';

export const modelCommand: CommandDefinition = {
  command: 'model',
  description: 'Select your Groq model',
  handler: ({ setShowModelSelector }: CommandContext, args: string[]) => {
    if (setShowModelSelector) {
      setShowModelSelector(true);
    }
  }
};