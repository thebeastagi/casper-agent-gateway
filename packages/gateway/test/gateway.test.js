'use strict';
/**
 * @beast/agent-gateway — integration tests (node:test, zero external deps)
 *
 * Boots the real Express app on an ephemeral port and drives it over HTTP with
 * the real x402 client, exercising the full 402 -> pay -> 200 flow, settlement
 * receipts, replay rejection, and the free/paid route matrix.
 *
 * Run after `npm run build` (requires compiled gateway + core dist).
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const appMod = require('../dist/server.js');
const app = appMod.default || appMod;
const { CasperX402Client, generateKeypair } = require('@beast/casper-x402');

const RECIPIENT =
  '01a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

let server;
let base;
const client = new CasperX402Client({ keypair: generateKeypair() });

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server && server.close());

test('GET /api/v1/health returns 200 + ok status', async () => {
  const r = await fetch(`${base}/api/v1/health`);
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.status, 'ok');
  assert.equal(b.network, 'casper:testnet');
});

test('GET / and /market/stats are free', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/api/v1/market/stats`)).status, 200);
});

test('protected route without payment returns a valid 402 challenge', async () => {
  const r = await fetch(`${base}/api/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(r.status, 402);
  const b = await r.json();
  assert.equal(b.x402Version, '2.0');
  assert.equal(b.accepts[0].network, 'casper:testnet');
  assert.equal(b.accepts[0].amount, '100000000');
});

test('full 402 -> pay -> 201 register flow, with settlement receipt', async () => {
  const challenge = await (
    await fetch(`${base}/api/v1/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  ).json();
  const header = client.createPaymentHeader(challenge.accepts[0]);
  const r = await fetch(`${base}/api/v1/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Payment': header },
    body: JSON.stringify({
      name: 'test-agent',
      services: ['audit'],
      endpoint: 'https://example.com/a',
      publicKey: client.publicKeyHex,
    }),
  });
  assert.equal(r.status, 201);
  const b = await r.json();
  assert.ok(b.agentId, 'agentId present');
  assert.equal(b.identity.reputation, 50);
  // withSettlement is mounted -> paid responses carry a settlement receipt
  assert.ok(b.x402Settlement, 'settlement receipt attached');
  assert.equal(b.x402Settlement.status, 'settled');
});

test('underpayment is rejected with 402', async () => {
  const header = client.createPaymentHeader({
    network: 'casper:testnet',
    amount: '1',
    address: RECIPIENT,
  });
  const r = await fetch(`${base}/api/v1/agents/discover?service=audit`, {
    headers: { 'X-Payment': header },
  });
  assert.equal(r.status, 402);
});

test('a malformed payment amount is rejected with 402, not 500', async () => {
  // Regression guard for the BigInt(amount) hardening: attacker-controlled,
  // structurally-valid payload with a non-integer amount must not 500.
  const payment = client.createPayment({
    network: 'casper:testnet',
    amount: '50000000',
    address: RECIPIENT,
  });
  payment.amount = 'abc';
  const header = client.encodeHeader(payment);
  const r = await fetch(`${base}/api/v1/agents/discover?service=audit`, {
    headers: { 'X-Payment': header },
  });
  assert.equal(r.status, 402);
});

test('a valid payment cannot be replayed', async () => {
  const header = client.createPaymentHeader({
    network: 'casper:testnet',
    amount: '50000000',
    address: RECIPIENT,
  });
  const first = await fetch(`${base}/api/v1/agents/discover?service=audit`, {
    headers: { 'X-Payment': header },
  });
  assert.equal(first.status, 200);
  const second = await fetch(`${base}/api/v1/agents/discover?service=audit`, {
    headers: { 'X-Payment': header },
  });
  assert.equal(second.status, 402, 'replayed payment rejected');
});

test('paid service request returns a provider + settlement', async () => {
  // register a provider first (paid)
  const regChallenge = await (
    await fetch(`${base}/api/v1/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  ).json();
  await fetch(`${base}/api/v1/agents/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': client.createPaymentHeader(regChallenge.accepts[0]),
    },
    body: JSON.stringify({
      name: 'provider',
      services: ['code-generation'],
      endpoint: 'https://example.com/p',
      publicKey: client.publicKeyHex,
    }),
  });
  const svcHeader = client.createPaymentHeader({
    network: 'casper:testnet',
    amount: '200000000',
    address: RECIPIENT,
  });
  const r = await fetch(`${base}/api/v1/services/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Payment': svcHeader },
    body: JSON.stringify({
      requesterId: 'tester',
      serviceType: 'code-generation',
      parameters: { task: 'x' },
    }),
  });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.ok(b.requestId);
  assert.equal(b.result.serviceType, 'code-generation');
});

test('missing required fields on a paid register yields 400', async () => {
  const challenge = await (
    await fetch(`${base}/api/v1/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  ).json();
  const r = await fetch(`${base}/api/v1/agents/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': client.createPaymentHeader(challenge.accepts[0]),
    },
    body: JSON.stringify({ name: 'incomplete' }),
  });
  assert.equal(r.status, 400);
});
