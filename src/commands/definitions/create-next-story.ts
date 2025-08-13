import { CommandDefinition, CommandContext } from '../base.js';

/**
 * Defines the slash command for starting the story creation workflow.
 * When a user types `/create-next-story`, this command will:
 * 1. Switch the active AI persona to the 'sm' (Scrum Master) agent.
 * 2. Instruct the 'sm' agent to begin its primary task, 'create-next-story'.
 * This command is the main trigger to advance the development process from one story to the next.
 */
export const createNextStoryCommand: CommandDefinition = {
  command: 'create-next-story',
  description: 'Launch the Scrum Master to prepare the next actionable development story.',
  handler: async ({ agent, addMessage }: CommandContext, args: string[]) => {
    // 1. Switch to the 'sm' agent persona to ensure it uses the correct context and tools.
    await agent.setActiveBmadAgent('sm');
    addMessage({ role: 'system', content: 'Agent persona switched to: sm (Scrum Master)' });

    // 2. Instruct the agent to start the create-next-story task.
    // The AI will receive this prompt and use its tools to execute the sequential steps
    // defined in the `create-next-story.md` task file.
    const prompt = "Please execute the `create-next-story` task now.";

    // Add the instruction to the chat history for clarity
    addMessage({ role: 'user', content: prompt });

    // Kick off the chat with the new instruction.
    await agent.chat(prompt);
  }
};
