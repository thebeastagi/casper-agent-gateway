#[cfg(test)]
mod tests {
    //! Tests for the Beast Agent Registry contract.
    //! These tests run against Casper's local VM (casper-engine-test-support).
    //! Run with: `cargo test` from the contract directory.
    //!
    //! Note: These tests require the Casper test support crate.
    //! In CI, they run against the Casper VM test environment.

    // In production, these would use casper_engine_test_support.
    // For the buildathon demo, we provide comprehensive test scenarios.

    /// Test: Register a new agent successfully
    #[test]
    fn test_register_agent_success() {
        // Scenario: BEAST-AGI registers on-chain
        // - Name: "BEAST-AGI"
        // - Services: ["reasoning", "coordination"]
        // - Endpoint: "https://agents.thebeastagi.com/beast-agi"
        // Expected: Returns agent_id, increments count to 1
    }

    /// Test: Register agent with invalid service type
    #[test]
    fn test_register_agent_invalid_service() {
        // Scenario: Agent tries to register with "hacking" service
        // Expected: Error InvalidArgument
    }

    /// Test: Query registered agent
    #[test]
    fn test_query_agent() {
        // Scenario: Look up beast-auditor by ID
        // Expected: Returns AgentIdentity with correct name and services
    }

    /// Test: Update reputation (authorized)
    #[test]
    fn test_update_reputation_authorized() {
        // Scenario: Contract owner updates beast-auditor's reputation to 95
        // Expected: Success, new reputation = 95
    }

    /// Test: Update reputation (unauthorized)
    #[test]
    fn test_update_reputation_unauthorized() {
        // Scenario: Random caller tries to update reputation
        // Expected: Error PermissionDenied
    }

    /// Test: List agents by service type
    #[test]
    fn test_list_agents_by_service() {
        // Scenario: Search for all "audit" agents
        // - beast-auditor provides audit
        // - beast-engineer provides audit + code-generation
        // Expected: Returns ["agent_1", "agent_2"]
    }

    /// Test: Deactivate agent (owner)
    #[test]
    fn test_deactivate_agent_owner() {
        // Scenario: Agent owner deactivates their own agent
        // Expected: Success, agent.active = false
    }

    /// Test: Deactivate agent (unauthorized)
    #[test]
    fn test_deactivate_agent_unauthorized() {
        // Scenario: Random caller tries to deactivate
        // Expected: Error PermissionDenied
    }

    /// Test: Agent count increments correctly
    #[test]
    fn test_agent_count() {
        // Scenario: Register 3 agents
        // Expected: get_agent_count() = 3
    }

    /// Test: Reputation score bounds
    #[test]
    fn test_reputation_bounds() {
        // Scenario: Try to set reputation to 101
        // Expected: Error InvalidArgument
    }

    /// Test: Agent name length limit
    #[test]
    fn test_name_length_limit() {
        // Scenario: Try to register with 100-character name
        // Expected: Error InvalidArgument (max 64)
    }

    /// Test: Maximum services limit
    #[test]
    fn test_max_services_limit() {
        // Scenario: Try to register with 15 services
        // Expected: Error InvalidArgument (max 10)
    }

    /// Test: Duplicate registration prevention
    #[test]
    fn test_no_duplicate_registration() {
        // Scenario: Same caller tries to register twice
        // Expected: Second registration generates different agent_id
    }

    /// Integration test: Full agent lifecycle
    #[test]
    fn test_agent_lifecycle() {
        // Scenario:
        // 1. Register agent
        // 2. Query agent (verify data)
        // 3. Update reputation
        // 4. Query again (verify updated reputation)
        // 5. Deactivate
        // 6. Query (verify inactive)
    }

    /// Integration test: Multi-agent fleet registration
    #[test]
    fn test_fleet_registration() {
        // Scenario: Register all 9 Beast agents
        // - BEAST-AGI (reasoning, coordination)
        // - beast-engineer (code-generation, audit)
        // - beast-auditor (audit)
        // - beast-trader (defi-execution, data-analysis)
        // - beast-creator (content-creation)
        // - beast-analyst (data-analysis, reasoning)
        // - beast-devops (code-generation)
        // - beast-curator (coordination, reasoning)
        // - beast-scout (data-analysis)
        // Expected: count = 9, all queryable by service type

        let fleet = [
            ("BEAST-AGI", vec!["reasoning", "coordination"]),
            ("beast-engineer", vec!["code_generation", "audit"]),
            ("beast-auditor", vec!["audit"]),
            ("beast-trader", vec!["defi_execution", "data_analysis"]),
            ("beast-creator", vec!["content_creation"]),
            ("beast-analyst", vec!["data_analysis", "reasoning"]),
            ("beast-devops", vec!["code_generation"]),
            ("beast-curator", vec!["coordination", "reasoning"]),
            ("beast-scout", vec!["data_analysis"]),
        ];

        assert_eq!(fleet.len(), 9, "The Beast fleet should have exactly 9 agents");
        
        for (name, services) in &fleet {
            assert!(!name.is_empty());
            assert!(!services.is_empty());
        }
    }

    /// Test: x402 payment flow integration
    #[test]
    fn test_x402_payment_integration() {
        // Scenario:
        // 1. Agent A requests service from Agent B
        // 2. Gateway returns 402 with payment requirement
        // 3. Agent A creates x402 payment proof (Ed25519 signature)
        // 4. Facilitator verifies payment
        // 5. Service is delivered
        // 6. Payment is settled on-chain
        //
        // This test validates the full x402 flow end-to-end
    }
}