// FILE: src/commands/definitions/bmad-init.ts

import { CommandDefinition, CommandContext } from '../base.js';
import { projectContext } from '../../utils/project-context.js';

export const bmadInitCommand: CommandDefinition = {
  command: 'bmad-init',
  description: 'Initializes the BMad framework in the current project directory.',
  handler: async ({ addMessage }: CommandContext, args: string[]) => {
    try {
      projectContext.initializeDirectories();
      addMessage({
        role: 'system',
        content: `✅ BMad project structure initialized successfully inside the '.bmad' directory.`
      });
    } catch (error: any) {
      addMessage({
        role: 'system',
        content: `❌ Error initializing project: ${error.message}`
      });
    }
  }
};
