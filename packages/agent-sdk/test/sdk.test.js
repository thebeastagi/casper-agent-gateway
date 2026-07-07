'use strict';
/**
 * @beast/agent-sdk — tests (node:test, zero external deps)
 *
 * Unit-tests the BeastAgent wrapper: identity derivation, keypair persistence,
 * and the graceful-failure behaviour of the network methods when no gateway is
 * reachable (they must resolve to empty/null rather than throw).
 *
 * Run after `npm run build` (requires compiled dist).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { BeastAgent } = require('../dist/index.js');

// An address that refuses connections -> exercises the catch/graceful path.
const DEAD_GATEWAY = 'http://127.0.0.1:1'; // port 1 is not listening

test('BeastAgent derives a Casper address and persists its keypair', () => {
  const agent = new BeastAgent({
    name: 'beast-tester',
    services: ['audit'],
    gatewayUrl: DEAD_GATEWAY,
  });
  assert.equal(agent.name, 'beast-tester');
  assert.ok(agent.address.startsWith('01'));
  assert.equal(agent.address.length, 66);

  const hex = agent.getKeypairHex();
  assert.match(hex.publicKey, /^[0-9a-f]{64}$/);

  // Reconstructing from the persisted keypair yields the same identity.
  const restored = new BeastAgent({
    name: 'beast-tester',
    services: ['audit'],
    gatewayUrl: DEAD_GATEWAY,
    keypair: hex,
  });
  assert.equal(restored.address, agent.address);
});

test('discoverAgents resolves to [] when the gateway is unreachable', async () => {
  const agent = new BeastAgent({
    name: 'x',
    services: ['audit'],
    gatewayUrl: DEAD_GATEWAY,
  });
  const found = await agent.discoverAgents('audit');
  assert.deepEqual(found, []);
});

test('requestService resolves to null when the gateway is unreachable', async () => {
  const agent = new BeastAgent({
    name: 'x',
    services: ['audit'],
    gatewayUrl: DEAD_GATEWAY,
  });
  const res = await agent.requestService({ serviceType: 'audit', parameters: {} });
  assert.equal(res, null);
});

test('register reports failure (not a throw) when the gateway is unreachable', async () => {
  const agent = new BeastAgent({
    name: 'x',
    services: ['audit'],
    gatewayUrl: DEAD_GATEWAY,
  });
  const res = await agent.register();
  assert.equal(res.success, false);
});
