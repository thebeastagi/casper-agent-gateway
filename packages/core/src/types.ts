/**
 * Casper x402 Payment Protocol — Types
 * 
 * Implements the x402 v2 payment protocol for Casper Network.
 * Uses CAIP-2 chain identifier: "casper:1" (mainnet) or "casper:testnet"
 */

// === x402 Protocol Types (v2) ===

/** CAIP-2 network identifier for Casper */
export type CasperNetwork = 'casper:mainnet' | 'casper:testnet';

/** Payment requirement (what the server demands) */
export interface PaymentRequirement {
  /** Network identifier (CAIP-2 format) */
  network: CasperNetwork;
  /** Payment amount in motes (1 CSPR = 1,000,000,000 motes) */
  amount: string;
  /** Recipient address (hex-encoded public key or account hash) */
  address: string;
  /** Optional: token contract hash for non-native tokens */
  token?: string;
}

/** Payment payload (what the client provides) */
export interface PaymentPayload {
  /** Network identifier */
  network: CasperNetwork;
  /** Payment amount in motes */
  amount: string;
  /** Recipient address */
  address: string;
  /** Sender's public key (hex-encoded) */
  sender: string;
  /** Ed25519 signature of the payment */
  signature: string;
  /** Timestamp for replay protection */
  timestamp: number;
  /** Unique nonce */
  nonce: string;
  /** Optional token contract */
  token?: string;
}

/** x402 HTTP Header: X-Payment */
export interface XPaymentHeader {
  /** Protocol version */
  version: '2.0';
  /** Payment payload (base64url-encoded JSON) */
  payload: string;
}

/** 402 Response body */
export interface PaymentRequiredResponse {
  x402Version: '2.0';
  accepts: PaymentRequirement[];
  /** Human-readable description */
  description?: string;
}

/** Payment verification result */
export interface VerificationResult {
  valid: boolean;
  reason?: string;
  /** The payment payload if valid */
  payload?: PaymentPayload;
}

/** Payment settlement result */
export interface SettlementResult {
  success: boolean;
  /** Transaction hash on Casper */
  transactionHash?: string;
  error?: string;
}

// === Casper-Specific Types ===

/** Agent identity on Casper */
export interface AgentIdentity {
  /** Agent's public key (hex) */
  publicKey: string;
  /** Agent's display name */
  name: string;
  /** Service types this agent provides */
  services: AgentServiceType[];
  /** Agent's endpoint URL */
  endpoint: string;
  /** Reputation score (0-100) */
  reputation: number;
  /** Registration timestamp */
  registeredAt: number;
}

export type AgentServiceType = 
  | 'reasoning'
  | 'code-generation'
  | 'audit'
  | 'defi-execution'
  | 'data-analysis'
  | 'content-creation'
  | 'coordination';

/** Service request via x402 */
export interface ServiceRequest {
  /** ID of the requesting agent */
  requesterId: string;
  /** Type of service requested */
  serviceType: AgentServiceType;
  /** Service parameters */
  parameters: Record<string, unknown>;
  /** x402 payment header */
  payment: XPaymentHeader;
}

/** Service response */
export interface ServiceResponse {
  /** Request ID */
  requestId: string;
  /** Result data */
  result: Record<string, unknown>;
  /** Settlement transaction hash */
  settlementTx: string;
  /** Timestamp */
  completedAt: number;
}