import { CommandDefinition, CommandContext } from '../base.js';

export const agentCommand: CommandDefinition = {
  command: 'agent',
  description: 'Switch the active BMad agent persona (e.g., /agent pm).',
  handler: async ({ addMessage, agent }: CommandContext, args: string[]) => {
    const agentId = args[0];
    if (!agentId) {
      addMessage({ role: 'system', content: 'Usage: /agent <agent_id>. Example: /agent pm' });
      return;
    }

    try {
        await agent.setActiveBmadAgent(agentId);
        addMessage({ role: 'system', content: `Agent persona switched to: ${agentId}` });
    } catch (e) {
        addMessage({ role: 'system', content: `Error: Could not switch to agent '${agentId}'. Please check the agent ID. Type /help for more info.` });
    }
  }
};
