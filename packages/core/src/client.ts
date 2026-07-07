/**
 * Casper x402 Payment Protocol — Client
 * 
 * Implements the client-side of x402 for Casper Network.
 * Agents use this to pay for services automatically.
 */

import {
  PaymentRequirement,
  PaymentPayload,
  XPaymentHeader,
  PaymentRequiredResponse,
} from './types';
import {
  CasperKeypair,
  signMessage,
  createPaymentHash,
  generateNonce,
  encodePaymentHeader,
  publicKeyToAddress,
} from './crypto';

/** Configuration for the Casper x402 client */
export interface CasperX402ClientConfig {
  /** Agent's keypair for signing payments */
  keypair: CasperKeypair;
  /** Default network (casper:mainnet or casper:testnet) */
  defaultNetwork?: string;
  /** Maximum amount willing to pay (in motes) */
  maxPayment?: string;
}

/**
 * Casper x402 Client — enables AI agents to automatically pay for
 * x402-protected endpoints on Casper Network.
 */
export class CasperX402Client {
  private keypair: CasperKeypair;
  private defaultNetwork: string;
  private maxPayment: string;

  constructor(config: CasperX402ClientConfig) {
    this.keypair = config.keypair;
    this.defaultNetwork = config.defaultNetwork || 'casper:testnet';
    this.maxPayment = config.maxPayment || '10000000000'; // 10 CSPR default
  }

  /** The agent's public address */
  get address(): string {
    return publicKeyToAddress(this.keypair.publicKey);
  }

  /** The agent's public key (hex, without prefix) */
  get publicKeyHex(): string {
    return Buffer.from(this.keypair.publicKey).toString('hex');
  }

  /**
   * Create a payment for a given requirement.
   * Called when receiving a 402 Payment Required response.
   */
  createPayment(requirement: PaymentRequirement): PaymentPayload {
    const nonce = generateNonce();
    const timestamp = Math.floor(Date.now() / 1000);

    const payload: Omit<PaymentPayload, 'signature'> = {
      network: requirement.network,
      amount: requirement.amount,
      address: requirement.address,
      sender: this.address,
      timestamp,
      nonce,
    };

    // Create payment hash
    const hash = createPaymentHash(payload);
    
    // Sign the payment hash with Ed25519
    const signature = signMessage(hash, this.keypair.secretKey);

    return {
      ...payload,
      signature,
    };
  }

  /**
   * Encode a payment as an X-Payment header value.
   */
  encodeHeader(payment: PaymentPayload): string {
    return encodePaymentHeader({
      version: '2.0',
      ...payment,
    });
  }

  /**
   * Create the full X-Payment header string for HTTP requests.
   */
  createPaymentHeader(requirement: PaymentRequirement): string {
    const payment = this.createPayment(requirement);
    return this.encodeHeader(payment);
  }

  /**
   * Check if a payment amount is within the agent's spending limit.
   */
  isWithinBudget(amount: string): boolean {
    return BigInt(amount) <= BigInt(this.maxPayment);
  }

  /**
   * Parse a 402 Payment Required response and find an acceptable
   * payment requirement for this agent.
   */
  parsePaymentRequired(
    body: PaymentRequiredResponse
  ): PaymentRequirement | null {
    for (const req of body.accepts) {
      // Check if we support this network
      if (req.network === this.defaultNetwork || req.network.startsWith('casper:')) {
        // Check budget
        if (this.isWithinBudget(req.amount)) {
          return req;
        }
      }
    }
    return null;
  }
}