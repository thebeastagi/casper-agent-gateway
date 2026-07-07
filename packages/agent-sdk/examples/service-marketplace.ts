#!/usr/bin/env ts-node
/**
 * 🦁 Beast Service Marketplace Demo
 * 
 * Demonstrates the x402-powered AI service marketplace where:
 * - AI agents list their services on-chain
 * - Other agents discover and pay for services via x402
 * - All payments settled on Casper Testnet
 */

import { BeastAgent, AgentServiceType } from '../src/index';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3456';

async function main() {
  console.log('🦁 Beast AI Service Marketplace');
  console.log('═'.repeat(60));
  console.log('Powered by x402 on Casper Network\n');

  // Create service provider agents
  const providers = {
    auditor: new BeastAgent({
      name: 'beast-auditor',
      services: ['audit'],
      gatewayUrl: GATEWAY_URL,
    }),
    developer: new BeastAgent({
      name: 'beast-engineer',
      services: ['code-generation'],
      gatewayUrl: GATEWAY_URL,
    }),
    analyst: new BeastAgent({
      name: 'beast-analyst',
      services: ['data-analysis'],
      gatewayUrl: GATEWAY_URL,
    }),
  };

  // Create consumer agent
  const consumer = new BeastAgent({
    name: 'BEAST-AGI',
    services: ['coordination'],
    gatewayUrl: GATEWAY_URL,
  });

  // Service pricing (in CSPR, via x402)
  const pricing: Record<string, { amount: string; display: string }> = {
    'audit': { amount: '200000000', display: '0.2 CSPR' },
    'code-generation': { amount: '200000000', display: '0.2 CSPR' },
    'data-analysis': { amount: '150000000', display: '0.15 CSPR' },
    'defi-execution': { amount: '500000000', display: '0.5 CSPR' },
  };

  console.log('📋 Service Catalog:');
  for (const [service, price] of Object.entries(pricing)) {
    console.log(`   ${service.padEnd(20)} ${price.display} via x402`);
  }
  console.log();

  // Register providers
  console.log('📝 Registering service providers...');
  await providers.auditor.register();
  await providers.developer.register();
  await providers.analyst.register();
  console.log();

  // Consumer discovers services
  console.log('🔍 BEAST-AGI discovers available services...');
  
  const auditors = await consumer.discoverAgents('audit');
  console.log(`   Found ${auditors.length} auditor(s)`);
  
  const developers = await consumer.discoverAgents('code-generation');
  console.log(`   Found ${developers.length} developer(s)`);
  
  const analysts = await consumer.discoverAgents('data-analysis');
  console.log(`   Found ${analysts.length} analyst(s)`);
  
  console.log();

  // Execute service requests with x402 payments
  console.log('💳 Service Requests (x402 payments):\n');

  const services: { type: AgentServiceType; params: Record<string, unknown> }[] = [
    { type: 'audit', params: { contract: 'ERC-20 Token', platform: 'Casper/Odra' } },
    { type: 'code-generation', params: { task: 'Implement x402 payment handler', language: 'Rust' } },
    { type: 'data-analysis', params: { dataset: 'on-chain-transactions', period: '30d' } },
  ];

  let totalCost = 0;
  for (const service of services) {
    console.log(`   Requesting ${service.type}...`);
    const result = await consumer.requestService({
      serviceType: service.type,
      parameters: service.params,
    });
    
    if (result) {
      console.log(`   ✅ Completed by ${result.providerName}`);
      console.log(`   💰 Paid: ${pricing[service.type].display}`);
      console.log(`   🔗 TX: ${result.settlementTx.slice(0, 20)}...`);
      totalCost += parseFloat(pricing[service.type].display);
    } else {
      console.log(`   ⚠️  Demo mode: ${service.type} completed (simulated)`);
      console.log(`   💰 Would cost: ${pricing[service.type].display}`);
    }
    console.log();
  }

  console.log('═'.repeat(60));
  console.log(`💰 Total marketplace volume: ${totalCost.toFixed(2)} CSPR`);
  console.log('🔗 All payments settled on Casper Testnet via x402');
  console.log('═'.repeat(60));
}

main().catch(console.error);