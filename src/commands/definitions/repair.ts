import { CommandDefinition, CommandContext } from '../base.js';

/**
 * Defines the slash command for triggering the Repair and Learning workflow.
 * When a user types `/repair <path_to_story_file>`, this command will:
 * 1. Switch the active AI persona to the 'repair' agent.
 * 2. Instruct the 'repair' agent to begin its primary task, 'diagnose-and-fix-and-learn'.
 * This automates the process of debugging, patching, and documenting solutions to errors.
 */
export const repairCommand: CommandDefinition = {
  command: 'repair',
  description: 'Engage the Repair Agent to fix a failed implementation. Usage: /repair <path_to_story_file>',
  handler: async ({ agent, addMessage }: CommandContext, args: string[]) => {
    const storyFilePath = args[0];
    if (!storyFilePath) {
      addMessage({ role: 'system', content: 'Please provide the path to the story file that needs repair.' });
      return;
    }

    // 1. Switch to the 'repair' agent persona
    await agent.setActiveBmadAgent('repair');
    addMessage({ role: 'system', content: `Agent persona switched to: repair. Analyzing failure for ${storyFilePath}...` });

    // 2. Instruct the agent to start the diagnose-and-fix-and-learn task
    // This prompt is sent to the AI, which will then use its tools to execute the task.
    const prompt = `The implementation for the story at '${storyFilePath}' has failed. Please execute the 'diagnose-and-fix-and-learn' task immediately.`;

    // Add the instruction to the chat history for clarity
    addMessage({ role: 'user', content: prompt });

    // Kick off the chat with the new instruction
    await agent.chat(prompt);
  }
};
