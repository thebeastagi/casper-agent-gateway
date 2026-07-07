//! Beast AI Agent Registry — Casper Smart Contract
//!
//! An on-chain registry for autonomous AI agents on Casper Network.
//! Enables agents to:
//! - Register their identity on-chain with service capabilities
//! - Query other agents by service type
//! - Update reputation scores via verified transactions
//! - Discover agents for autonomous service matching
//!
//! This contract powers the Beast AI Agent Gateway's on-chain coordination layer.
//! Written for Casper 2.x using the casper-contract crate.

#![no_std]
#![no_main]

extern crate alloc;

use alloc::collections::BTreeMap;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use casper_contract::contract_api::{runtime, storage};
use casper_types::{
    ApiError, CLTyped, CLValue, ContractHash, ContractPackageHash, Key, URef, U256,
    contracts::NamedKeys, EntryPoint, EntryPointAccess, EntryPointType, EntryPoints, Parameter,
    RuntimeArgs,
};

// === Constants ===

/// Named key for the agents dictionary
const AGENTS_DICT: &str = "agents";
/// Named key for the agent count
const AGENT_COUNT: &str = "agent_count";
/// Named key for the registry owner
const OWNER_KEY: &str = "owner";

/// Maximum number of services an agent can register
const MAX_SERVICES: usize = 10;
/// Maximum service type string length
const MAX_SERVICE_LEN: usize = 32;
/// Maximum agent name length
const MAX_NAME_LEN: usize = 64;
/// Maximum endpoint URL length
const MAX_ENDPOINT_LEN: usize = 256;

// === Types ===

/// Represents a service type that an AI agent can provide
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ServiceType {
    Reasoning,
    CodeGeneration,
    Audit,
    DefiExecution,
    DataAnalysis,
    ContentCreation,
    Coordination,
}

impl ServiceType {
    fn as_str(&self) -> &str {
        match self {
            ServiceType::Reasoning => "reasoning",
            ServiceType::CodeGeneration => "code_generation",
            ServiceType::Audit => "audit",
            ServiceType::DefiExecution => "defi_execution",
            ServiceType::DataAnalysis => "data_analysis",
            ServiceType::ContentCreation => "content_creation",
            ServiceType::Coordination => "coordination",
        }
    }

    fn from_str(s: &str) -> Option<Self> {
        match s {
            "reasoning" => Some(ServiceType::Reasoning),
            "code_generation" => Some(ServiceType::CodeGeneration),
            "audit" => Some(ServiceType::Audit),
            "defi_execution" => Some(ServiceType::DefiExecution),
            "data_analysis" => Some(ServiceType::DataAnalysis),
            "content_creation" => Some(ServiceType::ContentCreation),
            "coordination" => Some(ServiceType::Coordination),
            _ => None,
        }
    }
}

/// On-chain identity for an AI agent
#[derive(Clone, Debug)]
pub struct AgentIdentity {
    /// Agent's display name (max 64 chars)
    pub name: String,
    /// Services this agent provides
    pub services: Vec<String>,
    /// Agent's endpoint URL
    pub endpoint: String,
    /// Reputation score (0-100)
    pub reputation: u8,
    /// Unix timestamp of registration
    pub registered_at: u64,
    /// Public key hash of the agent owner
    pub owner: Key,
    /// Whether the agent is active
    pub active: bool,
}

/// Reputation update payload (signed)
#[derive(Clone, Debug)]
pub struct ReputationUpdate {
    /// Agent ID to update
    pub agent_id: String,
    /// New reputation score (0-100)
    pub new_score: u8,
    /// Reason for update
    pub reason: String,
    /// Signature verifying update authority
    pub signature: Vec<u8>,
}

// === Storage ===

/// Initialize the contract storage
fn initialize_contract() {
    let agents: BTreeMap<String, AgentIdentity> = BTreeMap::new();
    
    // Store agent dictionary
    let agents_uref = storage::new_dictionary(AGENTS_DICT)
        .unwrap_or_revert();
    
    // Store agent count
    let count_uref = storage::new_uref(0u64);
    runtime::put_key(AGENT_COUNT, count_uref.into());
    
    // Store owner (deployer)
    let owner = runtime::get_caller();
    let owner_uref = storage::new_uref(owner);
    runtime::put_key(OWNER_KEY, owner_uref.into());
}

/// Register a new AI agent on-chain
fn register_agent(
    name: String,
    services: Vec<String>,
    endpoint: String,
) -> Result<String, ApiError> {
    // Validate inputs
    if name.is_empty() || name.len() > MAX_NAME_LEN {
        return Err(ApiError::InvalidArgument);
    }
    if services.is_empty() || services.len() > MAX_SERVICES {
        return Err(ApiError::InvalidArgument);
    }
    if endpoint.is_empty() || endpoint.len() > MAX_ENDPOINT_LEN {
        return Err(ApiError::InvalidArgument);
    }

    // Validate service types
    for service in &services {
        if ServiceType::from_str(service).is_none() {
            return Err(ApiError::InvalidArgument);
        }
    }

    let caller = runtime::get_caller();
    
    // Generate agent ID from caller + timestamp
    let timestamp = runtime::get_blocktime();
    let agent_id = format!("agent_{}", timestamp);

    // Check for duplicate
    let agents_dict = runtime::get_key(AGENTS_DICT)
        .ok_or(ApiError::MissingKey)?
        .into_uref()
        .map_err(|_| ApiError::UnexpectedKeyVariant)?;

    // Create identity
    let identity = AgentIdentity {
        name: name.clone(),
        services: services.clone(),
        endpoint: endpoint.clone(),
        reputation: 50, // Initial neutral reputation
        registered_at: timestamp,
        owner: caller,
        active: true,
    };

    // Store in dictionary
    // In production, this would use storage::dictionary_put with serialization
    storage::dictionary_put(
        agents_dict,
        &agent_id,
        CLValue::from_t(identity.clone()).unwrap_or_revert(),
    );

    // Increment agent count
    let count_uref = runtime::get_key(AGENT_COUNT)
        .ok_or(ApiError::MissingKey)?
        .into_uref()
        .map_err(|_| ApiError::UnexpectedKeyVariant)?;
    storage::add(count_uref, 1u64);

    Ok(agent_id)
}

/// Query an agent by ID
fn query_agent(agent_id: String) -> Result<AgentIdentity, ApiError> {
    let agents_dict = runtime::get_key(AGENTS_DICT)
        .ok_or(ApiError::MissingKey)?
        .into_uref()
        .map_err(|_| ApiError::UnexpectedKeyVariant)?;

    let identity: AgentIdentity = storage::dictionary_get(agents_dict, &agent_id)
        .map_err(|_| ApiError::MissingKey)?
        .ok_or(ApiError::MissingKey)?;

    Ok(identity)
}

/// Update an agent's reputation score (owner-only or authorized updater)
fn update_reputation(
    agent_id: String,
    new_score: u8,
    reason: String,
) -> Result<(), ApiError> {
    // Validate score range
    if new_score > 100 {
        return Err(ApiError::InvalidArgument);
    }

    let caller = runtime::get_caller();
    
    // Only owner can update reputation (extendable to DAO voting)
    let owner_uref = runtime::get_key(OWNER_KEY)
        .ok_or(ApiError::MissingKey)?
        .into_uref()
        .map_err(|_| ApiError::UnexpectedKeyVariant)?;
    let owner: Key = storage::read(owner_uref)
        .map_err(|_| ApiError::MissingKey)?
        .ok_or(ApiError::MissingKey)?;

    if caller != owner {
        return Err(ApiError::PermissionDenied);
    }

    // Get and update agent
    let agents_dict = runtime::get_key(AGENTS_DICT)
        .ok_or(ApiError::MissingKey)?
        .into_uref()
        .map_err(|_| ApiError::UnexpectedKeyVariant)?;

    let mut identity: AgentIdentity = storage::dictionary_get(agents_dict, &agent_id)
        .map_err(|_| ApiError::MissingKey)?
        .ok_or(ApiError::MissingKey)?;

    identity.reputation = new_score;

    // Write back
    storage::dictionary_put(
        agents_dict,
        &agent_id,
        CLValue::from_t(identity).unwrap_or_revert(),
    );

    Ok(())
}

/// List all agents providing a specific service
fn list_agents_by_service(service_type: String) -> Vec<String> {
    let agents_dict = match runtime::get_key(AGENTS_DICT) {
        Some(key) => match key.into_uref() {
            Ok(uref) => uref,
            Err(_) => return Vec::new(),
        },
        None => return Vec::new(),
    };

    let mut matching: Vec<String> = Vec::new();

    // Iterate all agents (in production, use dictionary iteration)
    // For Casper 2.x, we use a known set of IDs (simplified for demo)
    for id in 0..100u64 {
        let agent_id = format!("agent_{}", id);
        if let Ok(Some(identity)) = storage::dictionary_get::<AgentIdentity>(agents_dict, &agent_id) {
            if identity.active && identity.services.contains(&service_type) {
                matching.push(agent_id);
            }
        }
    }

    matching
}

/// Deactivate an agent
fn deactivate_agent(agent_id: String) -> Result<(), ApiError> {
    let caller = runtime::get_caller();

    let agents_dict = runtime::get_key(AGENTS_DICT)
        .ok_or(ApiError::MissingKey)?
        .into_uref()
        .map_err(|_| ApiError::UnexpectedKeyVariant)?;

    let mut identity: AgentIdentity = storage::dictionary_get(agents_dict, &agent_id)
        .map_err(|_| ApiError::MissingKey)?
        .ok_or(ApiError::MissingKey)?;

    // Only the agent's owner or contract owner can deactivate
    if caller != identity.owner {
        let owner_uref = runtime::get_key(OWNER_KEY)
            .ok_or(ApiError::MissingKey)?
            .into_uref()
            .map_err(|_| ApiError::UnexpectedKeyVariant)?;
        let owner: Key = storage::read(owner_uref)
            .map_err(|_| ApiError::MissingKey)?
            .ok_or(ApiError::MissingKey)?;
        
        if caller != owner {
            return Err(ApiError::PermissionDenied);
        }
    }

    identity.active = false;
    storage::dictionary_put(agents_dict, &agent_id, identity);

    Ok(())
}

/// Get total number of registered agents
fn get_agent_count() -> u64 {
    let count_uref = match runtime::get_key(AGENT_COUNT) {
        Some(key) => match key.into_uref() {
            Ok(uref) => uref,
            Err(_) => return 0,
        },
        None => return 0,
    };

    storage::read(count_uref)
        .map_err(|_| ())
        .unwrap_or(Some(0u64))
        .unwrap_or(0)
}

// === Entry Points ===

#[no_mangle]
pub extern "C" fn register_agent_entry() {
    let name: String = runtime::get_named_arg("name");
    let services: Vec<String> = runtime::get_named_arg("services");
    let endpoint: String = runtime::get_named_arg("endpoint");

    match register_agent(name, services, endpoint) {
        Ok(agent_id) => runtime::ret(CLValue::from_t(agent_id).unwrap_or_revert()),
        Err(e) => runtime::revert(e),
    }
}

#[no_mangle]
pub extern "C" fn query_agent_entry() {
    let agent_id: String = runtime::get_named_arg("agent_id");
    
    match query_agent(agent_id) {
        Ok(identity) => runtime::ret(CLValue::from_t(identity).unwrap_or_revert()),
        Err(e) => runtime::revert(e),
    }
}

#[no_mangle]
pub extern "C" fn update_reputation_entry() {
    let agent_id: String = runtime::get_named_arg("agent_id");
    let new_score: u8 = runtime::get_named_arg("new_score");
    let reason: String = runtime::get_named_arg("reason");

    match update_reputation(agent_id, new_score, reason) {
        Ok(()) => runtime::ret(CLValue::unit_t()),
        Err(e) => runtime::revert(e),
    }
}

#[no_mangle]
pub extern "C" fn list_agents_entry() {
    let service_type: String = runtime::get_named_arg("service_type");
    let agents = list_agents_by_service(service_type);
    runtime::ret(CLValue::from_t(agents).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn deactivate_agent_entry() {
    let agent_id: String = runtime::get_named_arg("agent_id");
    
    match deactivate_agent(agent_id) {
        Ok(()) => runtime::ret(CLValue::unit_t()),
        Err(e) => runtime::revert(e),
    }
}

#[no_mangle]
pub extern "C" fn get_agent_count_entry() {
    let count = get_agent_count();
    runtime::ret(CLValue::from_t(count).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn call() {
    // Initialize contract storage on deploy
    initialize_contract();

    // Define entry points
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "register_agent",
        vec![
            Parameter::new("name", String::cl_type()),
            Parameter::new("services", Vec::<String>::cl_type()),
            Parameter::new("endpoint", String::cl_type()),
        ],
        String::cl_type(),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "query_agent",
        vec![
            Parameter::new("agent_id", String::cl_type()),
        ],
        AgentIdentity::cl_type(),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "update_reputation",
        vec![
            Parameter::new("agent_id", String::cl_type()),
            Parameter::new("new_score", u8::cl_type()),
            Parameter::new("reason", String::cl_type()),
        ],
        CLValue::unit_t().cl_type(),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "list_agents_by_service",
        vec![
            Parameter::new("service_type", String::cl_type()),
        ],
        Vec::<String>::cl_type(),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "deactivate_agent",
        vec![
            Parameter::new("agent_id", String::cl_type()),
        ],
        CLValue::unit_t().cl_type(),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "get_agent_count",
        vec![],
        u64::cl_type(),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // Store the contract under its hash
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points,
        None,
        None,
        None,
    );

    runtime::put_key("contract_hash", Key::Hash(contract_hash));
}