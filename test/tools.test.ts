import test from 'ava';
import { executeBmadTask } from '../src/tools/tools.js';

test('executeBmadTask - success', async t => {
  const result = await executeBmadTask('create-doc', {});
  t.true(result.success);
  t.true(result.content.includes('Create Document from Template (YAML Driven)'));
});

test('executeBmadTask - task not found', async t => {
  const result = await executeBmadTask('non-existent-task', {});
  t.false(result.success);
  t.is(result.error, 'Error: BMad task \'non-existent-task\' not found.');
});
