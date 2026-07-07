/**
 * Beast Agent SDK
 * 
 * Connects AI agents from The Beast's 9-agent fleet to the Casper Network
 * via the Beast AI Agent Gateway. Handles x402 payments, identity management,
 * service discovery, and on-chain coordination.
 */

import {
  CasperX402Client,
  CasperKeypair,
  generateKeypair,
  keypairToHex,
  keypairFromHex,
  publicKeyToAddress,
  AgentIdentity,
  AgentServiceType,
  PaymentRequirement,
} from '@beast/casper-x402';

// === Types ===

export interface AgentConfig {
  /** Display name */
  name: string;
  /** Services this agent provides */
  services: AgentServiceType[];
  /** Gateway endpoint URL */
  gatewayUrl: string;
  /** Optional: existing keypair hex strings */
  keypair?: { publicKey: string; secretKey: string };
}

export interface ServiceQuery {
  serviceType: AgentServiceType;
  parameters: Record<string, unknown>;
}

export interface ServiceResult {
  providerId: string;
  providerName: string;
  requestId: string;
  result: Record<string, unknown>;
  settlementTx: string;
  cost: string;
}

// === BeastAgent Class ===

export class BeastAgent {
  public readonly name: string;
  public readonly services: AgentServiceType[];
  public readonly address: string;
  
  private keypair: CasperKeypair;
  private gatewayUrl: string;
  private x402Client: CasperX402Client;
  private agentId?: string;
  private registered: boolean = false;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.services = config.services;
    this.gatewayUrl = config.gatewayUrl;

    // Initialize keypair
    if (config.keypair) {
      this.keypair = keypairFromHex(config.keypair.publicKey, config.keypair.secretKey);
    } else {
      this.keypair = generateKeypair();
    }

    this.address = publicKeyToAddress(this.keypair.publicKey);

    // Initialize x402 client for automatic payment
    this.x402Client = new CasperX402Client({
      keypair: this.keypair,
      defaultNetwork: 'casper:testnet',
      maxPayment: '10000000000', // 10 CSPR budget
    });
  }

  /** Get keypair as hex strings (for persistence) */
  getKeypairHex(): { publicKey: string; secretKey: string } {
    return keypairToHex(this.keypair);
  }

  /** Register this agent with the Beast AI Agent Gateway */
  async register(): Promise<{ agentId: string; success: boolean }> {
    try {
      // First, try without payment to get 402
      let response = await fetch(`${this.gatewayUrl}/api/v1/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this.name,
          services: this.services,
          endpoint: `https://agents.thebeastagi.com/${this.name}`,
          publicKey: Buffer.from(this.keypair.publicKey).toString('hex'),
        }),
      });

      // If 402, pay and retry
      if (response.status === 402) {
        const paymentRequired = await response.json() as { accepts: PaymentRequirement[] };
        const requirement = paymentRequired.accepts[0];
        
        if (requirement) {
          const paymentHeader = this.x402Client.createPaymentHeader(requirement);
          
          response = await fetch(`${this.gatewayUrl}/api/v1/agents/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Payment': paymentHeader,
            },
            body: JSON.stringify({
              name: this.name,
              services: this.services,
              endpoint: `https://agents.thebeastagi.com/${this.name}`,
              publicKey: Buffer.from(this.keypair.publicKey).toString('hex'),
            }),
          });
        }
      }

      const result = await response.json() as { agentId: string };
      this.agentId = result.agentId;
      this.registered = true;

      console.log(`✅ Agent "${this.name}" registered: ${this.agentId}`);
      return { agentId: result.agentId, success: true };
    } catch (error) {
      console.error(`❌ Registration failed for "${this.name}":`, error);
      return { agentId: '', success: false };
    }
  }

  /** Discover agents providing a specific service */
  async discoverAgents(serviceType: AgentServiceType): Promise<(AgentIdentity & { id: string })[]> {
    try {
      let response = await fetch(
        `${this.gatewayUrl}/api/v1/agents/discover?service=${serviceType}`
      );

      if (response.status === 402) {
        const paymentRequired = await response.json() as { accepts: PaymentRequirement[] };
        const requirement = paymentRequired.accepts[0];
        
        if (requirement) {
          const paymentHeader = this.x402Client.createPaymentHeader(requirement);
          response = await fetch(
            `${this.gatewayUrl}/api/v1/agents/discover?service=${serviceType}`,
            { headers: { 'X-Payment': paymentHeader } }
          );
        }
      }

      const result = await response.json() as { agents: (AgentIdentity & { id: string })[] };
      return result.agents;
    } catch (error) {
      console.error('Failed to discover agents:', error);
      return [];
    }
  }

  /** Request a service from another agent (paid via x402) */
  async requestService(query: ServiceQuery): Promise<ServiceResult | null> {
    try {
      let response = await fetch(`${this.gatewayUrl}/api/v1/services/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: this.agentId || this.name,
          serviceType: query.serviceType,
          parameters: query.parameters,
        }),
      });

      if (response.status === 402) {
        const paymentRequired = await response.json() as { accepts: PaymentRequirement[] };
        const requirement = paymentRequired.accepts[0];
        
        if (requirement) {
          const paymentHeader = this.x402Client.createPaymentHeader(requirement);
          response = await fetch(`${this.gatewayUrl}/api/v1/services/request`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Payment': paymentHeader,
            },
            body: JSON.stringify({
              requesterId: this.agentId || this.name,
              serviceType: query.serviceType,
              parameters: query.parameters,
            }),
          });
        }
      }

      return await response.json() as ServiceResult;
    } catch (error) {
      console.error('Service request failed:', error);
      return null;
    }
  }

  /** Check gateway health */
  async checkHealth(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.gatewayUrl}/api/v1/health`);
    return response.json();
  }

  /** Get market statistics */
  async getMarketStats(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.gatewayUrl}/api/v1/market/stats`);
    return response.json();
  }
}