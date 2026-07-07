/**
 * Casper x402 Payment Protocol — Cryptography
 * 
 * Implements Ed25519 key management and signing for Casper Network.
 * Casper uses Ed25519 keys with hex encoding (prefixed with 01 for type).
 */

import * as nacl from 'tweetnacl';
import { blake2b } from 'blakejs';
import { randomBytes } from 'crypto';

/** A Casper keypair (Ed25519) */
export interface CasperKeypair {
  /** 32-byte public key (no type prefix) */
  publicKey: Uint8Array;
  /** 32-byte secret key (seed) */
  secretKey: Uint8Array;
}

/** Generate a new Casper Ed25519 keypair */
export function generateKeypair(): CasperKeypair {
  const seed = randomBytes(32);
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKey: keypair.publicKey,
    secretKey: keypair.secretKey,
  };
}

/** Generate keypair from existing seed (32 bytes) */
export function keypairFromSeed(seed: Uint8Array): CasperKeypair {
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKey: keypair.publicKey,
    secretKey: keypair.secretKey,
  };
}

/** Convert public key to Casper hex address format (01 + key hex) */
export function publicKeyToAddress(publicKey: Uint8Array): string {
  return '01' + Buffer.from(publicKey).toString('hex');
}

/** Convert Casper address back to raw public key bytes */
export function addressToPublicKey(address: string): Uint8Array {
  // Strip '01' prefix
  const hex = address.startsWith('01') ? address.slice(2) : address;
  return Buffer.from(hex, 'hex');
}

/** Convert keypair to hex strings (for storage) */
export function keypairToHex(kp: CasperKeypair): { publicKey: string; secretKey: string } {
  return {
    publicKey: Buffer.from(kp.publicKey).toString('hex'),
    secretKey: Buffer.from(kp.secretKey).toString('hex'),
  };
}

/** Convert hex strings back to keypair */
export function keypairFromHex(publicKeyHex: string, secretKeyHex: string): CasperKeypair {
  return {
    publicKey: Buffer.from(publicKeyHex, 'hex'),
    secretKey: Buffer.from(secretKeyHex, 'hex'),
  };
}

/** 
 * Sign a message with Ed25519 (Casper native signing).
 * Returns the 64-byte signature as hex.
 */
export function signMessage(message: Uint8Array, secretKey: Uint8Array): string {
  const signature = nacl.sign.detached(message, secretKey);
  return Buffer.from(signature).toString('hex');
}

/** Verify an Ed25519 signature */
export function verifySignature(
  message: Uint8Array,
  signatureHex: string,
  publicKey: Uint8Array
): boolean {
  const signature = Buffer.from(signatureHex, 'hex');
  return nacl.sign.detached.verify(message, signature, publicKey);
}

/** Create a payment hash for signing (deterministic payment ID) */
export function createPaymentHash(payload: {
  amount: string;
  address: string;
  sender: string;
  timestamp: number;
  nonce: string;
  network: string;
}): Uint8Array {
  const preimage = [
    payload.network,
    payload.amount,
    payload.address,
    payload.sender,
    payload.timestamp.toString(),
    payload.nonce,
  ].join(':');
  
  // Blake2b-256 hash — Casper's native hashing scheme (via blakejs).
  return blake2b(Buffer.from(preimage, 'utf-8'), undefined, 32);
}

/** Generate a unique nonce */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/** 
 * Encode a payment payload as base64url for the X-Payment header.
 * x402 v2 uses base64url-encoded JSON.
 */
export function encodePaymentHeader(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64url');
}

/** Decode a base64url-encoded payment header */
export function decodePaymentHeader(header: string): Record<string, unknown> {
  const json = Buffer.from(header, 'base64url').toString('utf-8');
  return JSON.parse(json);
}