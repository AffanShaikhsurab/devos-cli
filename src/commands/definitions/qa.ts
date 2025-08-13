import { CommandDefinition, CommandContext } from '../base.js';

/**
 * Defines the slash command for triggering the Quality Assurance (QA) workflow.
 * When a user types `/qa <path_to_story_file>`, this command will:
 * 1. Switch the active AI persona to the 'qa' agent.
 * 2. Instruct the 'qa' agent to begin its primary task, 'quality-assurance-review'.
 * This automates the handoff from development to the QA and documentation phase.
 */
export const qaCommand: CommandDefinition = {
  command: 'qa',
  description: 'Engage the QA Agent to review a completed story. Usage: /qa <path_to_story_file>',
  handler: async ({ agent, addMessage }: CommandContext, args: string[]) => {
    const storyFilePath = args[0];
    if (!storyFilePath) {
      addMessage({ role: 'system', content: 'Please provide the path to the completed story file for QA review.' });
      return;
    }

    // 1. Switch to the 'qa' agent persona
    await agent.setActiveBmadAgent('qa');
    addMessage({ role: 'system', content: `Agent persona switched to: qa. Reviewing ${storyFilePath}...` });

    // 2. Instruct the agent to start the quality-assurance-review task
    // This prompt is sent to the AI, which will then use its tools to execute the task.
    const prompt = `The development for the story at '${storyFilePath}' is complete. Please execute the 'quality-assurance-review' task now.`;

    // Add the instruction to the chat history for clarity
    addMessage({ role: 'user', content: prompt });

    // Kick off the chat with the new instruction
    await agent.chat(prompt);
  }
};
