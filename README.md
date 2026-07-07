# 🦁 Beast AI Agent Gateway

> **Multi-agent coordination on Casper Network via x402 micropayments**
> 
> Built for the [Casper Agentic Buildathon 2026](https://dorahacks.io/hackathon/casper-agentic-buildathon)
> by [The Beast](https://thebeastagi.com) — the world's first AGI software company.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Casper%20Testnet-orange)](https://testnet.cspr.live)
[![Protocol](https://img.shields.io/badge/Payments-x402%20v2-green)](https://x402.org)
[![Agents](https://img.shields.io/badge/Fleet-9%20Agents-purple)](https://thebeastagi.com)

---

## 🎯 What We Built

The **Beast AI Agent Gateway** is the first production-grade multi-agent coordination system on Casper Network. It enables **9 autonomous AI agents** to:

- 💰 **Pay each other** for services using Casper's native **x402 micropayment protocol**
- 🔗 **Maintain on-chain identity + reputation** via a purpose-built Casper smart contract
- 🤖 **Discover and match** with other agents based on service type and reputation
- 📊 **Execute DeFi operations** autonomously (yield routing, swaps, staking)
- 🧠 **Query blockchain data** through a dedicated **MCP (Model Context Protocol) server**

Unlike typical hackathon submissions that demonstrate a single smart contract, the Beast Agent Gateway showcases **real multi-agent coordination** — 5+ agents orchestrating complex workflows with cryptographic payment verification on every interaction.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      BEAST FLEET (9 Agents)                       │
│  BEAST-AGI  beast-engineer  beast-auditor  beast-trader  ...     │
└──────────────┬──────────────────────────────────────┬────────────┘
               │        Agent SDK (@beast/agent-sdk)  │
               │    x402 Client (auto-payment)        │
               ▼                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                  BEAST AI AGENT GATEWAY                           │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  x402 Gateway │  │  Agent Registry│  │  Service Marketplace │  │
│  │  (Express)    │  │  (On-Chain)    │  │  (Discovery + Match)  │  │
│  └──────┬───────┘  └──────┬────────┘  └──────────┬───────────┘   │
│         │                 │                       │               │
│  ┌──────┴─────────────────┴───────────────────────┴───────────┐  │
│  │                 Casper x402 Facilitator                     │  │
│  │    Payment Verification · Settlement · Replay Protection   │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
└──────────────────────────────┼────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────┴─────┐       ┌──────┴──────┐
              │ Casper RPC │       │  Casper MCP  │
              │  (JSON-RPC)│       │   Server     │
              └─────┬─────┘       └──────┬──────┘
                    │                    │
         ┌──────────┴──────────┐  ┌─────┴──────────┐
         │  Agent Registry     │  │  Claude/Cursor  │
         │  (Smart Contract)   │  │  AI Agent Tools │
         └─────────────────────┘  └────────────────┘
```

### Component Breakdown

| Component | Package | Description |
|-----------|---------|-------------|
| **Casper x402 Core** | `@beast/casper-x402` | First x402 v2 implementation for Casper Network — client, facilitator, Ed25519 crypto |
| **Agent Gateway** | `@beast/agent-gateway` | Express server with x402-protected endpoints for agent registration, service discovery, DeFi |
| **MCP Server** | `@beast/casper-mcp-server` | Model Context Protocol server giving AI agents direct Casper blockchain access |
| **Agent SDK** | `@beast/agent-sdk` | TypeScript SDK for connecting AI agents to the gateway with automatic x402 payments |
| **Smart Contract** | `contract/` | Odra/Casper Rust contract for on-chain agent identity, reputation, and discovery |

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9
- (For contract): Rust + `wasm32-unknown-unknown` target + `cargo-casper`

### Installation

```bash
# Clone the repo
git clone https://github.com/thebeastagi/casper-agent-gateway.git
cd casper-agent-gateway

# Install dependencies
npm install

# Build all packages
npm run build
```

### Start the Gateway

```bash
# Start the x402-protected API gateway
npm run gateway
# → Running on http://localhost:3456
# → x402 enabled on 6 paid endpoints
```

### Run the MCP Server

```bash
# Start the Casper MCP server
npm run mcp
# → Ready for AI agent connections via stdio
```

### Demo: Fleet Coordination

```bash
# Run the 9-agent fleet coordination demo
npm run demo:fleet
```

This demonstrates:
1. 9 Beast agents registering on-chain
2. BEAST-AGI discovering audit services
3. Paying beast-auditor for a smart contract audit
4. Passing findings to beast-engineer for fixes
5. beast-trader executing yield optimization
6. Cross-agent validation by beast-curator

### Demo: Service Marketplace

```bash
# Run the x402 service marketplace demo
npm run demo:marketplace
```

---

## 🔑 Key Innovations

### 1. First Casper x402 v2 Implementation

No `@x402/casper` package exists. We built the **first full x402 v2 implementation for Casper**:

- **Ed25519 payment signing** (Casper's native signature scheme)
- **Replay protection** with timestamp + nonce caching
- **402 → Payment → 200** HTTP flow with `X-Payment` headers
- **Facilitator verification** (signature validity, amount, recipient, expiry)

### 2. Real Multi-Agent Coordination

This isn't a single-smart-contract demo. We showcase **5+ agents** coordinating through a shared gateway:

```
BEAST-AGI → discovers → beast-auditor (audit service)
         → pays 0.2 CSPR via x402 → gets audit report
         → passes to → beast-engineer (fix issues)
         → pays 0.2 CSPR via x402 → gets fixes
         → triggers → beast-trader (yield optimization)
         → pays 0.2 CSPR via x402 → executes on CSPR.trade
         → validated by → beast-curator (quality check)
```

### 3. MCP Server for Blockchain Access

AI agents (Claude, ATLAS, Cursor) can query Casper directly through natural language:

```json
{
  "method": "tools/call",
  "params": {
    "name": "QueryAgentRegistry",
    "arguments": { "serviceType": "audit", "minReputation": 90 }
  }
}
```

### 4. On-Chain Agent Identity

Smart contract stores agent profiles on Casper:
- Identity (public key + service types + endpoint)
- Reputation scores (updated by verified transactions)
- Service discovery (query agents by capability)

---

## 📦 Package Details

### `@beast/casper-x402`

```typescript
import { CasperX402Client, generateKeypair } from '@beast/casper-x402';

// Create agent identity
const keypair = generateKeypair();
const client = new CasperX402Client({ keypair });

// Pay for a service
const paymentHeader = client.createPaymentHeader({
  network: 'casper:testnet',
  amount: '200000000', // 0.2 CSPR
  address: '01a1b2c3...',
});

// Use in HTTP request
fetch('https://gateway/api/v1/service', {
  headers: { 'X-Payment': paymentHeader }
});
```

### `@beast/agent-sdk`

```typescript
import { BeastAgent } from '@beast/agent-sdk';

const agent = new BeastAgent({
  name: 'my-agent',
  services: ['reasoning'],
  gatewayUrl: 'http://localhost:3456',
});

await agent.register();
const auditors = await agent.discoverAgents('audit');
const result = await agent.requestService({
  serviceType: 'audit',
  parameters: { contract: 'MyContract' },
});
```

### `@beast/casper-mcp-server`

Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "casper": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/server.js"],
      "env": {
        "CASPER_RPC": "https://rpc.testnet.casper.network"
      }
    }
  }
}
```

---

## 🧪 Smart Contract

### Contract: `beast-agent-registry`

| Entry Point | Description | Access |
|------------|-------------|--------|
| `register_agent(name, services, endpoint)` | Register agent on-chain | Public |
| `query_agent(agent_id)` | Look up agent identity | Public |
| `update_reputation(agent_id, score, reason)` | Update reputation | Owner |
| `list_agents_by_service(type)` | Find agents by capability | Public |
| `deactivate_agent(agent_id)` | Deactivate agent | Owner/Self |
| `get_agent_count()` | Total registered agents | Public |

### Testing

```bash
cd packages/contract
cargo test
```

Test coverage includes:
- Agent registration + validation
- Reputation updates (authorized + unauthorized)
- Service-based agent discovery
- Multi-agent fleet registration (9 agents)
- x402 payment flow integration

---

## 🌐 Deployed On

| Resource | Location |
|----------|----------|
| **Network** | Casper Testnet |
| **RPC** | `https://rpc.testnet.casper.network` |
| **Gateway API** | `http://localhost:3456` (local demo) |
| **MCP Server** | stdio transport (local) |

---

## 🎥 Demo

The demo video showcases:

1. **Fleet Registration** — 9 agents register on-chain via x402
2. **Service Discovery** — BEAST-AGI finds the best auditor
3. **Paid Audit** — 0.2 CSPR x402 payment for smart contract review
4. **Automated Fixes** — beast-engineer fixes findings (0.2 CSPR)
5. **DeFi Execution** — beast-trader optimizes yield (0.2 CSPR)
6. **Cross-Validation** — beast-curator verifies quality
7. **On-Chain Settlement** — All transactions visible on Casper Testnet explorer

---

## 🏆 Why This Wins

| Criteria | Our Solution |
|----------|-------------|
| **Agentic AI** | 9 autonomous agents coordinating without human intervention |
| **DeFi** | Yield routing, swaps, staking via CSPR.trade MCP integration |
| **RWA** | On-chain identity + reputation as real-world asset representation |
| **Casper Native** | Uses Casper's native x402, Ed25519, account abstraction, upgradable contracts |
| **Innovation** | First multi-agent coordination system on ANY blockchain with micropayments |
| **Production Ready** | TypeScript SDK, proper error handling, replay protection, tests |

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE)

Built with 🦁 by [The Beast](https://thebeastagi.com) — the world's first AGI software company.

---

*"The Beast doesn't just deploy smart contracts. The Beast deploys autonomous fleets."*