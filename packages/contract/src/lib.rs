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
//! Written against `casper-contract` 1.4.4 / `casper-types` 1.5.0.

#![no_std]
#![no_main]

extern crate alloc;

use alloc::format;
use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;

use casper_contract::contract_api::{runtime, storage};
use casper_contract::unwrap_or_revert::UnwrapOrRevert;
use casper_types::{
    bytesrepr::{self, FromBytes, ToBytes},
    contracts::NamedKeys,
    ApiError, CLType, CLTyped, CLValue, EntryPoint, EntryPointAccess, EntryPointType,
    EntryPoints, Key, Parameter,
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
/// Maximum agent name length
const MAX_NAME_LEN: usize = 64;
/// Maximum endpoint URL length
const MAX_ENDPOINT_LEN: usize = 256;
/// Upper bound on agents scanned during service discovery (gas guard)
const MAX_DISCOVERY_SCAN: u64 = 100;

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
    /// Block timestamp of registration (milliseconds)
    pub registered_at: u64,
    /// Key of the account that owns this agent
    pub owner: Key,
    /// Whether the agent is active
    pub active: bool,
}

impl ToBytes for AgentIdentity {
    fn to_bytes(&self) -> Result<Vec<u8>, bytesrepr::Error> {
        let mut buffer = bytesrepr::allocate_buffer(self)?;
        buffer.extend(self.name.to_bytes()?);
        buffer.extend(self.services.to_bytes()?);
        buffer.extend(self.endpoint.to_bytes()?);
        buffer.extend(self.reputation.to_bytes()?);
        buffer.extend(self.registered_at.to_bytes()?);
        buffer.extend(self.owner.to_bytes()?);
        buffer.extend(self.active.to_bytes()?);
        Ok(buffer)
    }

    fn serialized_length(&self) -> usize {
        self.name.serialized_length()
            + self.services.serialized_length()
            + self.endpoint.serialized_length()
            + self.reputation.serialized_length()
            + self.registered_at.serialized_length()
            + self.owner.serialized_length()
            + self.active.serialized_length()
    }
}

impl FromBytes for AgentIdentity {
    fn from_bytes(bytes: &[u8]) -> Result<(Self, &[u8]), bytesrepr::Error> {
        let (name, remainder) = String::from_bytes(bytes)?;
        let (services, remainder) = Vec::<String>::from_bytes(remainder)?;
        let (endpoint, remainder) = String::from_bytes(remainder)?;
        let (reputation, remainder) = u8::from_bytes(remainder)?;
        let (registered_at, remainder) = u64::from_bytes(remainder)?;
        let (owner, remainder) = Key::from_bytes(remainder)?;
        let (active, remainder) = bool::from_bytes(remainder)?;
        Ok((
            AgentIdentity {
                name,
                services,
                endpoint,
                reputation,
                registered_at,
                owner,
                active,
            },
            remainder,
        ))
    }
}

impl CLTyped for AgentIdentity {
    fn cl_type() -> CLType {
        CLType::Any
    }
}

// === Storage helpers ===

fn get_uref(name: &str) -> Result<casper_types::URef, ApiError> {
    runtime::get_key(name)
        .ok_or(ApiError::MissingKey)?
        .into_uref()
        .ok_or(ApiError::UnexpectedKeyVariant)
}

fn read_owner() -> Result<Key, ApiError> {
    let owner_uref = get_uref(OWNER_KEY)?;
    storage::read(owner_uref)
        .map_err(|_| ApiError::Deserialize)?
        .ok_or(ApiError::MissingKey)
}

fn read_count() -> Result<u64, ApiError> {
    let count_uref = get_uref(AGENT_COUNT)?;
    Ok(storage::read(count_uref)
        .map_err(|_| ApiError::Deserialize)?
        .unwrap_or(0u64))
}

// === Core logic ===

/// Register a new AI agent on-chain
fn register_agent_impl(
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

    // Validate service types against the known catalogue
    for service in &services {
        if ServiceType::from_str(service).is_none() {
            return Err(ApiError::InvalidArgument);
        }
    }

    let caller = runtime::get_caller();
    let timestamp: u64 = runtime::get_blocktime().into();

    // Agent IDs are sequential: agent_0, agent_1, ... (enables discovery scans)
    let count = read_count()?;
    let agent_id = format!("agent_{}", count);

    let agents_dict = get_uref(AGENTS_DICT)?;

    // Create identity
    let identity = AgentIdentity {
        name,
        services,
        endpoint,
        reputation: 50, // Initial neutral reputation
        registered_at: timestamp,
        owner: Key::from(caller),
        active: true,
    };

    // Store in dictionary
    storage::dictionary_put(agents_dict, &agent_id, identity);

    // Increment agent count
    let count_uref = get_uref(AGENT_COUNT)?;
    storage::add(count_uref, 1u64);

    Ok(agent_id)
}

/// Query an agent by ID
fn query_agent_impl(agent_id: &str) -> Result<AgentIdentity, ApiError> {
    let agents_dict = get_uref(AGENTS_DICT)?;

    let identity: AgentIdentity = storage::dictionary_get(agents_dict, agent_id)
        .map_err(|_| ApiError::Deserialize)?
        .ok_or(ApiError::MissingKey)?;

    Ok(identity)
}

/// Update an agent's reputation score (registry owner only)
fn update_reputation_impl(agent_id: &str, new_score: u8) -> Result<(), ApiError> {
    // Validate score range
    if new_score > 100 {
        return Err(ApiError::InvalidArgument);
    }

    let caller = runtime::get_caller();

    // Only the registry owner can update reputation (extendable to DAO voting)
    let owner = read_owner()?;
    if Key::from(caller) != owner {
        return Err(ApiError::PermissionDenied);
    }

    // Get and update agent
    let agents_dict = get_uref(AGENTS_DICT)?;
    let mut identity: AgentIdentity = storage::dictionary_get(agents_dict, agent_id)
        .map_err(|_| ApiError::Deserialize)?
        .ok_or(ApiError::MissingKey)?;

    identity.reputation = new_score;

    // Write back
    storage::dictionary_put(agents_dict, agent_id, identity);

    Ok(())
}

/// List all active agents providing a specific service
fn list_agents_by_service_impl(service_type: &str) -> Vec<String> {
    let agents_dict = match get_uref(AGENTS_DICT) {
        Ok(uref) => uref,
        Err(_) => return Vec::new(),
    };

    let count = read_count().unwrap_or(0);
    let scan_limit = core::cmp::min(count, MAX_DISCOVERY_SCAN);

    let mut matching: Vec<String> = Vec::new();
    for id in 0..scan_limit {
        let agent_id = format!("agent_{}", id);
        if let Ok(Some(identity)) =
            storage::dictionary_get::<AgentIdentity>(agents_dict, &agent_id)
        {
            if identity.active && identity.services.iter().any(|s| s == service_type) {
                matching.push(agent_id);
            }
        }
    }

    matching
}

/// Deactivate an agent (agent owner or registry owner)
fn deactivate_agent_impl(agent_id: &str) -> Result<(), ApiError> {
    let caller = runtime::get_caller();

    let agents_dict = get_uref(AGENTS_DICT)?;
    let mut identity: AgentIdentity = storage::dictionary_get(agents_dict, agent_id)
        .map_err(|_| ApiError::Deserialize)?
        .ok_or(ApiError::MissingKey)?;

    // Only the agent's owner or the registry owner can deactivate
    if Key::from(caller) != identity.owner {
        let owner = read_owner()?;
        if Key::from(caller) != owner {
            return Err(ApiError::PermissionDenied);
        }
    }

    identity.active = false;
    storage::dictionary_put(agents_dict, agent_id, identity);

    Ok(())
}

// === Entry points (wasm exports must match entry point names) ===

#[no_mangle]
pub extern "C" fn register_agent() {
    let name: String = runtime::get_named_arg("name");
    let services: Vec<String> = runtime::get_named_arg("services");
    let endpoint: String = runtime::get_named_arg("endpoint");

    match register_agent_impl(name, services, endpoint) {
        Ok(agent_id) => runtime::ret(CLValue::from_t(agent_id).unwrap_or_revert()),
        Err(e) => runtime::revert(e),
    }
}

#[no_mangle]
pub extern "C" fn query_agent() {
    let agent_id: String = runtime::get_named_arg("agent_id");

    match query_agent_impl(&agent_id) {
        Ok(identity) => runtime::ret(CLValue::from_t(identity).unwrap_or_revert()),
        Err(e) => runtime::revert(e),
    }
}

#[no_mangle]
pub extern "C" fn update_reputation() {
    let agent_id: String = runtime::get_named_arg("agent_id");
    let new_score: u8 = runtime::get_named_arg("new_score");
    // Reason is recorded in the deploy for auditability; not stored on-chain.
    let _reason: String = runtime::get_named_arg("reason");

    if let Err(e) = update_reputation_impl(&agent_id, new_score) {
        runtime::revert(e);
    }
}

#[no_mangle]
pub extern "C" fn list_agents_by_service() {
    let service_type: String = runtime::get_named_arg("service_type");
    let agents = list_agents_by_service_impl(&service_type);
    runtime::ret(CLValue::from_t(agents).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn deactivate_agent() {
    let agent_id: String = runtime::get_named_arg("agent_id");

    if let Err(e) = deactivate_agent_impl(&agent_id) {
        runtime::revert(e);
    }
}

#[no_mangle]
pub extern "C" fn get_agent_count() {
    let count = read_count().unwrap_or_revert_with(ApiError::MissingKey);
    runtime::ret(CLValue::from_t(count).unwrap_or_revert());
}

// === Deploy (session) code ===

#[no_mangle]
pub extern "C" fn call() {
    // Create contract storage in the deploying account's context,
    // then hand the URefs to the contract via named keys.
    let agents_dict_uref = storage::new_dictionary(AGENTS_DICT).unwrap_or_revert();
    let count_uref = storage::new_uref(0u64);
    let owner_uref = storage::new_uref(Key::from(runtime::get_caller()));

    let mut named_keys = NamedKeys::new();
    named_keys.insert(String::from(AGENTS_DICT), agents_dict_uref.into());
    named_keys.insert(String::from(AGENT_COUNT), count_uref.into());
    named_keys.insert(String::from(OWNER_KEY), owner_uref.into());

    // Define entry points
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "register_agent",
        vec![
            Parameter::new("name", CLType::String),
            Parameter::new("services", CLType::List(alloc::boxed::Box::new(CLType::String))),
            Parameter::new("endpoint", CLType::String),
        ],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "query_agent",
        vec![Parameter::new("agent_id", CLType::String)],
        AgentIdentity::cl_type(),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "update_reputation",
        vec![
            Parameter::new("agent_id", CLType::String),
            Parameter::new("new_score", CLType::U8),
            Parameter::new("reason", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "list_agents_by_service",
        vec![Parameter::new("service_type", CLType::String)],
        CLType::List(alloc::boxed::Box::new(CLType::String)),
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "deactivate_agent",
        vec![Parameter::new("agent_id", CLType::String)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "get_agent_count",
        vec![],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // Store the contract, versioned under a package
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some(String::from("beast_agent_registry_package")),
        Some(String::from("beast_agent_registry_access")),
    );

    runtime::put_key("beast_agent_registry", contract_hash.into());
}
