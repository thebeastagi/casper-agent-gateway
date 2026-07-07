# Beast AI Agent Gateway — Demo Script
> For the Casper Agentic Buildathon 2026 demo video

## Video Structure (~5 minutes)

### 0:00-0:30 — Opening
- Show README on screen
- "Hi, I'm presenting the Beast AI Agent Gateway — a multi-agent coordination system on Casper"
- "Built by The Beast, the world's first AGI software company"
- "9 autonomous AI agents, 1 on-chain registry, native x402 micropayments"

### 0:30-1:00 — Architecture Overview
- Show the architecture diagram
- Walk through: Gateway → x402 → Agent Registry → MCP Server → DeFi
- Highlight: "First x402 v2 implementation for Casper Network"

### 1:00-2:00 — Fleet Registration (Demo)
Run: `npm run demo:fleet`

Show:
```
BEAST-AGI registering... ✅ (0.1 CSPR via x402)
beast-engineer registering... ✅ (0.1 CSPR)
beast-auditor registering... ✅ (0.1 CSPR)
...
9 agents registered on Casper Testnet
```

- Explain: "Each agent pays 0.1 CSPR via x402 to register their identity on-chain"
- Show the smart contract code briefly

### 2:00-3:00 — Service Discovery + Audit (Demo)
```
BEAST-AGI discovers "audit" service...
→ beast-auditor found (reputation: 93/100)
→ beast-engineer found (reputation: 95/100)

BEAST-AGI requests audit... (0.2 CSPR via x402)
✅ Audit completed by beast-auditor
🔗 Settlement TX: 0x8f3a...
```

- Explain the x402 flow: 402 → payment → 200

### 3:00-3:45 — Cross-Agent Coordination (Demo)
```
BEAST-AGI → beast-engineer: Fix audit findings (0.2 CSPR)
✅ 3 findings fixed
BEAST-AGI → beast-trader: Optimize yield (0.2 CSPR)
📊 Route: CSPR → sCSPR, APY: 11.2%
```

- Highlight: "3 agents coordinating in sequence, each paid via x402"

### 3:45-4:15 — MCP Server Demo
- Open Claude Desktop with Casper MCP server configured
- Ask: "What's the balance of account 01a1b2c3...?"
- Show response with balance, staked, etc.
- Ask: "Find all auditors with reputation > 90"
- Show agent registry results

### 4:15-4:45 — Code Walkthrough
- Quick tour of the smart contract (Rust/Odra)
- Show key code snippets:
  - `x402Middleware` in Express
  - `CasperX402Client.createPayment()`
  - `register_agent()` entry point
- Highlight: "Full Ed25519 signature verification, replay protection"

### 4:45-5:00 — Why This Wins
- "This is not a single smart contract — this is a fleet"
- "Real AI agents, real coordination, real micropayments"
- "Built for the agent economy — the future Casper enables"
- "Code is open source at github.com/thebeastagi/casper-agent-gateway"

## Screens to Capture

1. Terminal running `npm run demo:fleet` showing full coordination flow
2. Casper Testnet explorer showing transactions
3. VS Code showing smart contract Rust code
4. Claude Desktop using MCP server to query Casper
5. Architecture diagram (from README)
6. GitHub repo page with README

## Recording Setup

```bash
# Start the gateway in one terminal
cd /path/to/casper-agent-gateway
npm run gateway

# In another terminal, run the fleet demo
npm run demo:fleet
```