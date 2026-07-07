'use strict';
/**
 * @beast/casper-x402 — unit tests (node:test, zero external deps)
 *
 * Covers the x402 v2 primitives: Ed25519 crypto round-trips, deterministic
 * payment hashing, the client payment builder, and the facilitator's full
 * verification matrix (valid / expired / replay / underpay / wrong-recipient /
 * forged-signature / network-mismatch / malformed).
 *
 * Run after `npm run build` (requires the compiled dist).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const x402 = require('../dist/index.js');
const {
  generateKeypair,
  keypairFromSeed,
  keypairToHex,
  keypairFromHex,
  publicKeyToAddress,
  addressToPublicKey,
  signMessage,
  verifySignature,
  createPaymentHash,
  generateNonce,
  encodePaymentHeader,
  decodePaymentHeader,
  CasperX402Client,
  CasperX402Facilitator,
} = x402;

const RECIPIENT =
  '01a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

// ---- crypto ----------------------------------------------------------------

test('generateKeypair produces 32-byte public / 64-byte secret', () => {
  const kp = generateKeypair();
  assert.equal(kp.publicKey.length, 32);
  assert.equal(kp.secretKey.length, 64);
});

test('keypairFromSeed is deterministic', () => {
  const seed = new Uint8Array(32).fill(7);
  const a = keypairFromSeed(seed);
  const b = keypairFromSeed(seed);
  assert.deepEqual([...a.publicKey], [...b.publicKey]);
});

test('address <-> publicKey round-trips with 01 prefix', () => {
  const kp = generateKeypair();
  const addr = publicKeyToAddress(kp.publicKey);
  assert.ok(addr.startsWith('01'));
  assert.equal(addr.length, 66); // '01' + 64 hex chars
  assert.deepEqual([...addressToPublicKey(addr)], [...kp.publicKey]);
});

test('keypair hex round-trips', () => {
  const kp = generateKeypair();
  const hex = keypairToHex(kp);
  const back = keypairFromHex(hex.publicKey, hex.secretKey);
  assert.deepEqual([...back.publicKey], [...kp.publicKey]);
  assert.deepEqual([...back.secretKey], [...kp.secretKey]);
});

test('sign then verify succeeds; tampered message fails', () => {
  const kp = generateKeypair();
  const msg = new Uint8Array([1, 2, 3, 4]);
  const sig = signMessage(msg, kp.secretKey);
  assert.equal(verifySignature(msg, sig, kp.publicKey), true);
  const tampered = new Uint8Array([1, 2, 3, 5]);
  assert.equal(verifySignature(tampered, sig, kp.publicKey), false);
});

test('createPaymentHash is deterministic and 32 bytes', () => {
  const base = {
    network: 'casper:testnet',
    amount: '100',
    address: RECIPIENT,
    sender: '01ab',
    timestamp: 1700000000,
    nonce: 'abc',
  };
  const h1 = createPaymentHash(base);
  const h2 = createPaymentHash({ ...base });
  assert.equal(h1.length, 32);
  assert.deepEqual([...h1], [...h2]);
  const h3 = createPaymentHash({ ...base, amount: '101' });
  assert.notDeepEqual([...h1], [...h3]);
});

test('generateNonce yields unique 32-hex-char values', () => {
  const a = generateNonce();
  const b = generateNonce();
  assert.equal(a.length, 32);
  assert.notEqual(a, b);
});

test('payment header base64url encode/decode round-trips', () => {
  const obj = { version: '2.0', amount: '5', nested: { x: 1 } };
  const enc = encodePaymentHeader(obj);
  assert.doesNotMatch(enc, /[+/=]/); // base64url alphabet
  assert.deepEqual(decodePaymentHeader(enc), obj);
});

// ---- client ----------------------------------------------------------------

test('client.address derives from keypair; budget check works', () => {
  const kp = generateKeypair();
  const client = new CasperX402Client({ keypair: kp, maxPayment: '1000' });
  assert.equal(client.address, publicKeyToAddress(kp.publicKey));
  assert.equal(client.isWithinBudget('1000'), true);
  assert.equal(client.isWithinBudget('1001'), false);
});

test('client.createPayment produces a self-consistent signed payload', () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const req = { network: 'casper:testnet', amount: '200000000', address: RECIPIENT };
  const p = client.createPayment(req);
  assert.equal(p.amount, req.amount);
  assert.equal(p.address, req.address);
  assert.equal(p.sender, client.address);
  assert.ok(p.signature && p.nonce && p.timestamp);
  // signature verifies against the payment hash
  const hash = createPaymentHash(p);
  const pub = addressToPublicKey(p.sender);
  assert.equal(verifySignature(hash, p.signature, pub), true);
});

test('client.parsePaymentRequired picks an affordable casper requirement', () => {
  const client = new CasperX402Client({ keypair: generateKeypair(), maxPayment: '100' });
  const ok = client.parsePaymentRequired({
    x402Version: '2.0',
    accepts: [{ network: 'casper:testnet', amount: '50', address: RECIPIENT }],
  });
  assert.ok(ok);
  const tooExpensive = client.parsePaymentRequired({
    x402Version: '2.0',
    accepts: [{ network: 'casper:testnet', amount: '5000', address: RECIPIENT }],
  });
  assert.equal(tooExpensive, null);
});

// ---- facilitator: verification matrix -------------------------------------

function makeFacilitator() {
  return new CasperX402Facilitator({
    rpcUrl: 'https://example.invalid',
    network: 'casper:testnet',
    recipientAddress: RECIPIENT,
  });
}
const REQ = { network: 'casper:testnet', amount: '50000000', address: RECIPIENT };

test('facilitator accepts a valid payment', () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const header = client.createPaymentHeader(REQ);
  const res = makeFacilitator().verify(header, REQ);
  assert.equal(res.valid, true, res.reason);
});

test('facilitator rejects a replayed payment', () => {
  const fac = makeFacilitator();
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const header = client.createPaymentHeader(REQ);
  assert.equal(fac.verify(header, REQ).valid, true);
  const second = fac.verify(header, REQ);
  assert.equal(second.valid, false);
  assert.match(second.reason, /replay/i);
});

test('facilitator rejects underpayment', () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const header = client.createPaymentHeader({ ...REQ, amount: '1' });
  const res = makeFacilitator().verify(header, REQ);
  assert.equal(res.valid, false);
  assert.match(res.reason, /insufficient/i);
});

test('facilitator rejects wrong recipient', () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const header = client.createPaymentHeader({ ...REQ, address: '01deadbeef' });
  const res = makeFacilitator().verify(header, REQ);
  assert.equal(res.valid, false);
  assert.match(res.reason, /recipient/i);
});

test('facilitator rejects network mismatch', () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const header = client.createPaymentHeader({ ...REQ, network: 'casper:mainnet' });
  const res = makeFacilitator().verify(header, REQ);
  assert.equal(res.valid, false);
  assert.match(res.reason, /network/i);
});

test('facilitator rejects a forged signature', () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const payment = client.createPayment(REQ);
  // flip the last byte of the signature
  const last = payment.signature.slice(-2);
  payment.signature = payment.signature.slice(0, -2) + (last === '00' ? '01' : '00');
  const header = client.encodeHeader(payment);
  const res = makeFacilitator().verify(header, REQ);
  assert.equal(res.valid, false);
  assert.match(res.reason, /signature/i);
});

test('facilitator rejects an expired payment', () => {
  // Build a correctly-signed payment that is one hour old, so only the
  // expiry check trips (the signature over the old timestamp stays valid).
  const kp = generateKeypair();
  const client = new CasperX402Client({ keypair: kp });
  const payment = client.createPayment(REQ);
  payment.timestamp = Math.floor(Date.now() / 1000) - 3600;
  payment.signature = signMessage(createPaymentHash(payment), kp.secretKey);
  const res = makeFacilitator().verify(client.encodeHeader(payment), REQ);
  assert.equal(res.valid, false);
  assert.match(res.reason, /expired/i);
});

test('facilitator rejects malformed / missing-field payloads', () => {
  const fac = makeFacilitator();
  assert.equal(fac.verify('!!!not-base64url!!!', REQ).valid, false);
  const partial = encodePaymentHeader({ amount: '50000000' });
  const res = fac.verify(partial, REQ);
  assert.equal(res.valid, false);
  assert.match(res.reason, /missing/i);
});

test('facilitator rejects a non-integer amount without throwing', () => {
  // Regression guard: a structurally-complete payload with a non-numeric
  // amount must return {valid:false}, never throw (would surface as HTTP 500).
  const client = new CasperX402Client({ keypair: generateKeypair() });
  for (const bad of ['abc', '1e9', '', '12.5']) {
    const payment = client.createPayment(REQ);
    payment.amount = bad;
    const res = makeFacilitator().verify(client.encodeHeader(payment), REQ);
    assert.equal(res.valid, false, `amount=${JSON.stringify(bad)} should be invalid`);
  }
});

test('facilitator rejects a non-numeric timestamp without throwing', () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const payment = client.createPayment(REQ);
  payment.timestamp = 'not-a-number';
  const res = makeFacilitator().verify(client.encodeHeader(payment), REQ);
  assert.equal(res.valid, false);
});

test('facilitator.settle returns a receipt for a verified payment', async () => {
  const client = new CasperX402Client({ keypair: generateKeypair() });
  const payment = client.createPayment(REQ);
  const settlement = await makeFacilitator().settle(payment, REQ);
  assert.equal(settlement.success, true);
  assert.ok(settlement.transactionHash);
});
