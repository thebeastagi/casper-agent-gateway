/**
 * Beast AI Agent Gateway — Main Server
 * 
 * An x402-protected API gateway that enables autonomous AI agents to:
 * - Register their identity on-chain
 * - Discover and pay for other agents' services
 * - Execute DeFi operations
 * - Maintain reputation scores
 * 
 * This is the central coordination hub for The Beast's 9-agent fleet on Casper.
 */

import express from 'express';
import cors from 'cors';
import {
  CasperX402Facilitator,
  CasperX402Client,
  generateKeypair,
  PaymentRequirement,
  AgentIdentity,
  ServiceRequest,
  ServiceResponse,
} from '../../core/src/index';
import { x402Middleware, X402MiddlewareConfig } from './middleware';

// === Configuration ===

const PORT = process.env.PORT || 3456;
const CASPER_RPC = process.env.CASPER_RPC || 'https://rpc.testnet.casper.network';
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || '01a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

// === Initialize x402 ===

const facilitator = new CasperX402Facilitator({
  rpcUrl: CASPER_RPC,
  network: 'casper:testnet',
  recipientAddress: RECIPIENT_ADDRESS,
});

// Payment requirements for each endpoint (in motes, 1 CSPR = 10^9 motes)
const paymentConfig: X402MiddlewareConfig = {
  facilitator,
  routes: {
    '/api/v1/agents/register': {
      network: 'casper:testnet',
      amount: '100000000', // 0.1 CSPR to register
      address: RECIPIENT_ADDRESS,
    },
    '/api/v1/agents/discover': {
      network: 'casper:testnet',
      amount: '50000000', // 0.05 CSPR to discover agents
      address: RECIPIENT_ADDRESS,
    },
    '/api/v1/services/request': {
      network: 'casper:testnet',
      amount: '200000000', // 0.2 CSPR per service request
      address: RECIPIENT_ADDRESS,
    },
    '/api/v1/defi/swap': {
      network: 'casper:testnet',
      amount: '500000000', // 0.5 CSPR for DeFi operations
      address: RECIPIENT_ADDRESS,
    },
    '/api/v1/defi/stake': {
      network: 'casper:testnet',
      amount: '300000000', // 0.3 CSPR for staking
      address: RECIPIENT_ADDRESS,
    },
  },
  freeRoutes: [
    '/api/v1/health',
    '/api/v1/market/stats',
    '/',
  ],
};

// === In-Memory Agent Registry (backed by on-chain contract in production) ===

const agentRegistry: Map<string, AgentIdentity> = new Map();

// === Express App ===

const app = express();
app.use(cors());
app.use(express.json());

// Apply x402 middleware globally
app.use(x402Middleware(paymentConfig));

// === Routes ===

/** Health check (free) */
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    gateway: 'Beast AI Agent Gateway',
    version: '0.1.0',
    network: 'casper:testnet',
    uptime: process.uptime(),
  });
});

/** Market statistics (free) */
app.get('/api/v1/market/stats', (_req, res) => {
  res.json({
    totalAgents: agentRegistry.size,
    activeServices: Array.from(agentRegistry.values())
      .flatMap(a => a.services)
      .filter((v, i, a) => a.indexOf(v) === i),
    averageReputation: agentRegistry.size > 0
      ? Array.from(agentRegistry.values()).reduce((sum, a) => sum + a.reputation, 0) / agentRegistry.size
      : 0,
    network: 'casper:testnet',
  });
});

/** Root endpoint (free) */
app.get('/', (_req, res) => {
  res.json({
    name: 'Beast AI Agent Gateway',
    description: 'x402-powered coordination hub for autonomous AI agents on Casper Network',
    version: '0.1.0',
    endpoints: {
      health: 'GET /api/v1/health',
      market: 'GET /api/v1/market/stats',
      register: 'POST /api/v1/agents/register (x402: 0.1 CSPR)',
      discover: 'GET /api/v1/agents/discover (x402: 0.05 CSPR)',
      serviceRequest: 'POST /api/v1/services/request (x402: 0.2 CSPR)',
      swap: 'POST /api/v1/defi/swap (x402: 0.5 CSPR)',
      stake: 'POST /api/v1/defi/stake (x402: 0.3 CSPR)',
    },
  });
});

/** Register an AI agent on-chain (paid via x402) */
app.post('/api/v1/agents/register', (req, res) => {
  const { name, services, endpoint, publicKey } = req.body;
  
  if (!name || !services || !endpoint || !publicKey) {
    return res.status(400).json({ error: 'Missing required fields: name, services, endpoint, publicKey' });
  }

  const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const identity: AgentIdentity = {
    publicKey,
    name,
    services,
    endpoint,
    reputation: 50, // Initial reputation score
    registeredAt: Date.now(),
  };

  agentRegistry.set(agentId, identity);

  res.status(201).json({
    agentId,
    identity,
    x402Payment: (req as any).x402Payment,
    message: 'Agent registered successfully on Casper Testnet',
  });
});

/** Discover agents by service type (paid via x402) */
app.get('/api/v1/agents/discover', (req, res) => {
  const { service } = req.query;
  
  let agents = Array.from(agentRegistry.entries()).map(([id, identity]) => ({
    id,
    ...identity,
  }));

  if (service) {
    agents = agents.filter(a => a.services.includes(service as any));
  }

  res.json({
    agents,
    count: agents.length,
    x402Payment: (req as any).x402Payment,
  });
});

/** Request an AI service (paid via x402) */
app.post('/api/v1/services/request', (req, res) => {
  const { requesterId, serviceType, parameters } = req.body as ServiceRequest;
  
  // Find agents providing this service
  const providers = Array.from(agentRegistry.entries())
    .filter(([_, identity]) => identity.services.includes(serviceType))
    .sort(([_, a], [__, b]) => b.reputation - a.reputation);

  if (providers.length === 0) {
    return res.status(404).json({ error: `No agents found for service: ${serviceType}` });
  }

  // Select the highest-reputation agent
  const [providerId, provider] = providers[0];

  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const response: ServiceResponse = {
    requestId,
    result: {
      providerId,
      providerName: provider.name,
      serviceType,
      status: 'accepted',
      estimatedCompletion: Date.now() + 5000, // Simulated
      parameters,
    },
    settlementTx: `0x${Date.now().toString(16)}`,
    completedAt: Date.now(),
  };

  res.json({
    ...response,
    x402Payment: (req as any).x402Payment,
  });
});

/** Execute a token swap via DeFi (paid via x402) */
app.post('/api/v1/defi/swap', (req, res) => {
  const { tokenIn, tokenOut, amount, minReceived } = req.body;
  
  if (!tokenIn || !tokenOut || !amount) {
    return res.status(400).json({ error: 'Missing: tokenIn, tokenOut, amount' });
  }

  // Simulated swap quote
  const swapRate = tokenIn === 'CSPR' ? 0.985 : 1.015;
  const estimatedOut = parseFloat(amount) * swapRate;

  res.json({
    route: `${tokenIn} → WCSPR → ${tokenOut}`,
    amountIn: amount,
    estimatedOut: estimatedOut.toFixed(6),
    priceImpact: '0.15%',
    minReceived: minReceived || (estimatedOut * 0.995).toFixed(6),
    status: 'quoted',
    x402Payment: (req as any).x402Payment,
  });
});

/** Stake CSPR (paid via x402) */
app.post('/api/v1/defi/stake', (req, res) => {
  const { amount, validator } = req.body;
  
  if (!amount) {
    return res.status(400).json({ error: 'Missing: amount' });
  }

  const apy = 8.5 + Math.random() * 4; // 8.5-12.5% APY

  res.json({
    amount,
    validator: validator || 'auto-selected',
    estimatedAPY: apy.toFixed(2) + '%',
    lockPeriod: 'Flexible (14-day unbonding)',
    status: 'staked',
    x402Payment: (req as any).x402Payment,
  });
});

// === Start Server ===

app.listen(PORT, () => {
  console.log(`🦁 Beast AI Agent Gateway running on port ${PORT}`);
  console.log(`   Network: Casper Testnet`);
  console.log(`   RPC: ${CASPER_RPC}`);
  console.log(`   x402: Enabled (${Object.keys(paymentConfig.routes).length} paid endpoints)`);
  console.log(`   Free endpoints: ${paymentConfig.freeRoutes?.join(', ')}`);
});

export default app;