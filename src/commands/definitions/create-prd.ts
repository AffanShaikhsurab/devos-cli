import { CommandDefinition, CommandContext } from '../base.js';

/**
 * Defines the slash command for starting the Product Requirements Document (PRD) creation workflow.
 * When a user types `/create-prd`, this command will:
 * 1. Switch the active AI persona to the 'pm' (Product Manager) agent.
 * 2. Instruct the 'pm' agent to begin its primary task, 'create-doc', using the correct PRD template.
 * This simplifies the user experience by bundling multiple steps into one command.
 */
export const createPrdCommand: CommandDefinition = {
  command: 'create-prd',
  description: 'Launch the Product Manager to start creating a new Product Requirements Document.',
  handler: async ({ agent, addMessage }: CommandContext, args: string[]) => {
    // 1. Switch to the 'pm' agent persona to ensure the correct context and tools are available.
    await agent.setActiveBmadAgent('pm');
    addMessage({ role: 'system', content: 'Agent persona switched to: pm (Product Manager)' });

    // 2. Instruct the agent to start the create-doc task with the specific PRD template.
    // This prompt is sent to the AI, which will then use its tools to execute the task.
    const prompt = "Please start the `create-doc` task using the `prd-tmpl.yaml` template to create a new Product Requirements Document.";

    // Add the instruction to the chat history for clarity
    addMessage({ role: 'user', content: prompt });

    // Kick off the chat with the new instruction, starting the interactive document creation process.
    await agent.chat(prompt);
  }
};
