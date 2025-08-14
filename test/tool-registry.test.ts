import { Agent } from '../src/core/agent.js'; // Desperate hack to fix module loading order
import test from 'ava';
import { initializeTools } from '../src/tools/tool-registry.js';

test.before(t => {
  initializeTools();
});

test('tool registry initializes without crashing', t => {
  t.pass();
});
