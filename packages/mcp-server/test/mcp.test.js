'use strict';
/**
 * @beast/casper-mcp-server — tests (node:test, zero external deps)
 *
 * Exercises the exported tool registry and the handleToolCall dispatcher for
 * every one of the 6 Casper tools, plus the unknown-tool error path. Does not
 * open the stdio transport (main() is guarded behind require.main === module).
 *
 * Run after `npm run build` (requires compiled dist).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { tools, handleToolCall } = require('../dist/server.js');

const EXPECTED = [
  'GetAccountBalance',
  'QueryAgentRegistry',
  'GetTransactionStatus',
  'GetNetworkStats',
  'ExecuteTransfer',
  'QueryDeFiPool',
];

test('exposes exactly the 6 documented tools with valid schemas', () => {
  assert.equal(tools.length, 6);
  assert.deepEqual(tools.map((t) => t.name).sort(), [...EXPECTED].sort());
  for (const t of tools) {
    assert.ok(t.description && t.description.length > 0, `${t.name} has description`);
    assert.equal(t.inputSchema.type, 'object');
  }
});

const CALLS = {
  GetAccountBalance: { publicKey: '01a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' },
  QueryAgentRegistry: { serviceType: 'audit', minReputation: 90 },
  GetTransactionStatus: { transactionHash: '0xabc123' },
  GetNetworkStats: {},
  ExecuteTransfer: { recipient: '01dead', amount: '10.5', senderPublicKey: '01beef' },
  QueryDeFiPool: { tokenIn: 'CSPR', tokenOut: 'sCSPR', amount: '1000' },
};

for (const name of EXPECTED) {
  test(`tool ${name} returns valid text content (JSON)`, async () => {
    const res = await handleToolCall(name, CALLS[name]);
    assert.ok(res.content && res.content.length > 0);
    assert.equal(res.content[0].type, 'text');
    const parsed = JSON.parse(res.content[0].text); // must be valid JSON
    assert.equal(typeof parsed, 'object');
  });
}

test('QueryAgentRegistry filters by reputation threshold', async () => {
  const res = await handleToolCall('QueryAgentRegistry', { minReputation: 95 });
  const parsed = JSON.parse(res.content[0].text);
  assert.ok(parsed.agents.every((a) => a.reputation >= 95));
});

test('QueryDeFiPool echoes the requested pair', async () => {
  const res = await handleToolCall('QueryDeFiPool', {
    tokenIn: 'CSPR',
    tokenOut: 'sCSPR',
    amount: '100',
  });
  const parsed = JSON.parse(res.content[0].text);
  assert.equal(parsed.pool, 'CSPR/sCSPR');
});

test('unknown tool rejects', async () => {
  await assert.rejects(() => handleToolCall('NoSuchTool', {}), /Unknown tool/);
});
