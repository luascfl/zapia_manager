import assert from 'node:assert/strict';
import test from 'node:test';
import { CliError, parseArgs, resolveThread } from '../scripts/zapia-cli.mjs';

const threads = [
  { id: 'ape@aaa', label: '💬 Assistente de WhatsApp' },
  { id: 'ape@bbb', label: '📅 Assistente de agenda' },
  { id: 'ape@ccc', label: 'Plano de ação' },
  { id: 'ape@ddd', label: 'plano de ação' },
  { id: 'ape@eee', label: null },
];

test('thread resolution prefers id, then exact title, then a unique fragment', () => {
  assert.equal(resolveThread(threads, 'ape@bbb').id, 'ape@bbb');
  assert.equal(resolveThread(threads, 'Plano de ação').id, 'ape@ccc');
  assert.equal(resolveThread(threads, 'WhatsApp').id, 'ape@aaa');
});

test('an ambiguous fragment is refused with the candidates instead of guessing', () => {
  assert.throws(() => resolveThread(threads, 'Assistente'), (error) => {
    assert.equal(error.code, 'ambiguous_thread');
    assert.deepEqual(error.extra.candidates.map((c) => c.id), ['ape@aaa', 'ape@bbb']);
    return true;
  });
});

test('unknown and empty thread queries fail with distinct codes', () => {
  assert.throws(() => resolveThread(threads, 'does not exist'), { code: 'thread_not_found' });
  assert.throws(() => resolveThread(threads, '  '), { code: 'usage' });
});

test('untitled threads are never matched by a text fragment', () => {
  assert.throws(() => resolveThread([{ id: 'ape@eee', label: null }], 'null'), { code: 'thread_not_found' });
});

test('argument parsing separates flags from the message text', () => {
  const { positional, flags } = parseArgs(['--new', 'hello world', '--wait', '30']);
  assert.deepEqual(positional, ['hello world']);
  assert.deepEqual(flags, { new: true, wait: '30' });
  assert.throws(() => parseArgs(['--wait']), (error) => error instanceof CliError && error.code === 'usage');
  assert.throws(() => parseArgs(['--unknown']), { code: 'usage' });
});
