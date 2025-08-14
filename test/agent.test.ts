import test from 'ava';
import { Agent } from '../src/core/agent.js';

import { initializeTools } from '../src/tools/tool-registry.js';

test.before(t => {
  initializeTools();
});

test('Agent persona switching', async t => {
  const agent = await Agent.create('groq-llama3-70b', 0.1, null, false);

  // Check the default persona
  let systemMessage = agent.getSystemMessage();
  t.true(systemMessage.includes('You are now operating as the Master Task Executor & BMad Method Expert.'));

  // Switch to pm
  await agent.setActiveBmadAgent('pm');
  systemMessage = agent.getSystemMessage();
  t.true(systemMessage.includes('You are now operating as the Investigative Product Strategist & Market-Savvy PM.'));

  // Switch back to bmad-master
  await agent.setActiveBmadAgent('bmad-master');
  systemMessage = agent.getSystemMessage();
  t.true(systemMessage.includes('You are now operating as the Master Task Executor & BMad Method Expert.'));
});
