// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IncrementalMerkleTree.sol";

/**
 * @title IncrementalVerifiableClaim
 * @notice NFT-like claims that can be updated incrementally with new events
 * @dev Uses Incremental Merkle Trees for append-only, gas-efficient updates
 *
 * Key Features:
 * - Mint claims with initial ledger and sink events
 * - Append new events securely (cannot modify old events)
 * - Verify Merkle proofs on-chain
 * - Track aggregate values and metadata
 * - Version history via events
 */
contract IncrementalVerifiableClaim {
    using IncrementalMerkleTree for IncrementalMerkleTree.Bytes32IMT;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct ClaimData {
        string claimId;              // Off-chain claim ID
        string workflowId;           // Template/workflow ID
        string executionId;          // Execution instance ID

        // Incremental Merkle Trees (secure append-only)
        IncrementalMerkleTree.Bytes32IMT ledgerTree;  // ALL execution events
        IncrementalMerkleTree.Bytes32IMT sinkTree;    // ONLY sink events

        // Aggregate & Metadata
        string aggregateValue;       // Computed claim value (stringified JSON)
        string metadataUri;          // URI to off-chain metadata (IPFS)

        // Timestamps
        uint256 createdAt;           // When claim was minted
        uint256 lastUpdatedAt;       // When last events were appended

        // Ownership
        address owner;               // Current owner
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Mapping from token ID to claim data (internal storage)
    mapping(uint256 => ClaimData) internal claims;

    /// @notice Mapping from token ID to owner address
    mapping(uint256 => address) public ownerOf;

    /// @notice Mapping from owner to token count
    mapping(uint256 => uint256) public balanceOf;

    /// @notice Contract deployer (can mint claims)
    address public immutable deployer;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event ClaimMinted(
        uint256 indexed tokenId,
        address indexed to,
        string claimId,
        uint256 initialLedgerEvents,
        uint256 initialSinkEvents
    );

    event EventsAppended(
        uint256 indexed tokenId,
        uint256 newLedgerCount,
        uint256 newSinkCount,
        bytes32 newLedgerRoot,
        bytes32 newSinkRoot,
        string newAggregateValue
    );

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );

    event AggregateUpdated(
        uint256 indexed tokenId,
        string oldValue,
        string newValue
    );

    // ============================================================================
    // MODIFIERS
    // ============================================================================

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Only deployer can call");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(ownerOf[tokenId] != address(0), "Token does not exist");
        _;
    }

    modifier onlyOwner(uint256 tokenId) {
        require(ownerOf[tokenId] == msg.sender, "Not token owner");
        _;
    }

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    constructor() {
        deployer = msg.sender;
    }

    // ============================================================================
    // MINTING FUNCTIONS
    // ============================================================================

    /**
     * @notice Mints a new claim NFT with initial events
     * @param to Address to mint the claim to
     * @param claimId Off-chain claim ID (also used to compute deterministic tokenId)
     * @param workflowId Workflow template ID
     * @param executionId Execution instance ID
     * @param initialLedgerEvents Array of event hashes for full ledger
     * @param initialSinkEvents Array of event hashes for sink
     * @param aggregateValue Computed claim value
     * @param metadataUri IPFS URI to claim metadata
     * @return tokenId The minted token ID (deterministic based on claimId)
     */
    function mintClaim(
        address to,
        string memory claimId,
        string memory workflowId,
        string memory executionId,
        bytes32[] memory initialLedgerEvents,
        bytes32[] memory initialSinkEvents,
        string memory aggregateValue,
        string memory metadataUri
    ) public returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(initialLedgerEvents.length > 0, "Need at least one ledger event");

        // Generate deterministic tokenId from claimId hash
        uint256 tokenId = uint256(keccak256(abi.encodePacked(claimId)));
        require(ownerOf[tokenId] == address(0), "Token ID already exists");

        ClaimData storage claim = claims[tokenId];
        claim.claimId = claimId;
        claim.workflowId = workflowId;
        claim.executionId = executionId;
        claim.aggregateValue = aggregateValue;
        claim.metadataUri = metadataUri;
        claim.createdAt = block.timestamp;
        claim.lastUpdatedAt = block.timestamp;
        claim.owner = to;

        // Add initial ledger events to IMT
        for (uint256 i = 0; i < initialLedgerEvents.length; i++) {
            claim.ledgerTree.add(initialLedgerEvents[i]);
        }

        // Add initial sink events to IMT
        for (uint256 i = 0; i < initialSinkEvents.length; i++) {
            claim.sinkTree.add(initialSinkEvents[i]);
        }

        // Update ownership mappings
        ownerOf[tokenId] = to;
        balanceOf[uint256(uint160(to))]++;

        emit ClaimMinted(
            tokenId,
            to,
            claimId,
            initialLedgerEvents.length,
            initialSinkEvents.length
        );
        emit Transfer(address(0), to, tokenId);

        return tokenId;
    }

    // ============================================================================
    // UPDATE FUNCTIONS
    // ============================================================================

    /**
     * @notice Appends new events to an existing claim
     * @dev This is SECURE because IMT prevents modification of old events
     * @param tokenId Token ID to update
     * @param newLedgerEvents New ledger event hashes to append
     * @param newSinkEvents New sink event hashes to append
     * @param newAggregateValue Updated aggregate value
     */
    function appendEvents(
        uint256 tokenId,
        bytes32[] memory newLedgerEvents,
        bytes32[] memory newSinkEvents,
        string memory newAggregateValue
    ) public onlyOwner(tokenId) tokenExists(tokenId) {
        ClaimData storage claim = claims[tokenId];

        string memory oldAggregate = claim.aggregateValue;

        // Append to ledger tree (O(log n) per event)
        for (uint256 i = 0; i < newLedgerEvents.length; i++) {
            claim.ledgerTree.add(newLedgerEvents[i]);
        }

        // Append to sink tree
        for (uint256 i = 0; i < newSinkEvents.length; i++) {
            claim.sinkTree.add(newSinkEvents[i]);
        }

        // Update aggregate value and timestamp
        claim.aggregateValue = newAggregateValue;
        claim.lastUpdatedAt = block.timestamp;

        emit EventsAppended(
            tokenId,
            claim.ledgerTree.length(),
            claim.sinkTree.length(),
            claim.ledgerTree.root(),
            claim.sinkTree.root(),
            newAggregateValue
        );

        emit AggregateUpdated(tokenId, oldAggregate, newAggregateValue);
    }

    /**
     * @notice Updates only the aggregate value (no new events)
     * @param tokenId Token ID to update
     * @param newAggregateValue New aggregate value
     */
    function updateAggregate(
        uint256 tokenId,
        string memory newAggregateValue
    ) public onlyOwner(tokenId) tokenExists(tokenId) {
        ClaimData storage claim = claims[tokenId];
        string memory oldValue = claim.aggregateValue;

        claim.aggregateValue = newAggregateValue;
        claim.lastUpdatedAt = block.timestamp;

        emit AggregateUpdated(tokenId, oldValue, newAggregateValue);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Gets the current state of a claim
     * @param tokenId Token ID
     * @return ledgerRoot Current root hash of ledger tree
     * @return ledgerEventCount Number of events in ledger
     * @return sinkRoot Current root hash of sink tree
     * @return sinkEventCount Number of events in sink
     * @return aggregateValue Current aggregate value
     */
    function getClaimState(uint256 tokenId) public view tokenExists(tokenId) returns (
        bytes32 ledgerRoot,
        uint256 ledgerEventCount,
        bytes32 sinkRoot,
        uint256 sinkEventCount,
        string memory aggregateValue
    ) {
        ClaimData storage claim = claims[tokenId];
        return (
            claim.ledgerTree.root(),
            claim.ledgerTree.length(),
            claim.sinkTree.root(),
            claim.sinkTree.length(),
            claim.aggregateValue
        );
    }

    /**
     * @notice Gets claim metadata
     * @param tokenId Token ID
     * @return claimId Off-chain claim identifier
     * @return workflowId Workflow template identifier
     * @return executionId Execution instance identifier
     * @return aggregateValue Current aggregate value
     * @return metadataUri IPFS metadata URI
     * @return createdAt Creation timestamp
     * @return lastUpdatedAt Last update timestamp
     * @return owner Current owner address
     */
    function getClaimMetadata(uint256 tokenId) public view tokenExists(tokenId) returns (
        string memory claimId,
        string memory workflowId,
        string memory executionId,
        string memory aggregateValue,
        string memory metadataUri,
        uint256 createdAt,
        uint256 lastUpdatedAt,
        address owner
    ) {
        ClaimData storage claim = claims[tokenId];
        return (
            claim.claimId,
            claim.workflowId,
            claim.executionId,
            claim.aggregateValue,
            claim.metadataUri,
            claim.createdAt,
            claim.lastUpdatedAt,
            claim.owner
        );
    }

    /**
     * @notice Gets the metadata URI for a token (ERC721 compatible)
     * @param tokenId Token ID
     * @return string metadata URI
     */
    function tokenURI(uint256 tokenId) public view tokenExists(tokenId) returns (string memory) {
        return claims[tokenId].metadataUri;
    }

    /**
     * @notice Returns the total supply of tokens
     * @dev With deterministic tokenIds, we can't track total supply with a counter
     * @dev This function is deprecated - use event logs to count minted tokens
     * @return uint256 always returns 0
     */
    function totalSupply() public pure returns (uint256) {
        return 0; // Deprecated - use event logs to count minted tokens
    }

    // ============================================================================
    // VERIFICATION FUNCTIONS
    // ============================================================================

    /**
     * @notice Verifies a Merkle proof for a ledger event
     * @param tokenId Token ID to verify against
     * @param siblings Array of sibling hashes (Merkle proof)
     * @param directionBits Packed bits indicating path (0=left, 1=right)
     * @param eventHash Hash of the event to verify
     * @return bool Whether the proof is valid
     */
    function verifyLedgerEvent(
        uint256 tokenId,
        bytes32[] memory siblings,
        uint256 directionBits,
        bytes32 eventHash
    ) public view tokenExists(tokenId) returns (bool) {
        ClaimData storage claim = claims[tokenId];
        bytes32 expectedRoot = claim.ledgerTree.root();

        return claim.ledgerTree.verifyProof(
            siblings,
            directionBits,
            eventHash,
            expectedRoot
        );
    }

    /**
     * @notice Verifies a Merkle proof for a sink event
     * @param tokenId Token ID to verify against
     * @param siblings Array of sibling hashes (Merkle proof)
     * @param directionBits Packed bits indicating path (0=left, 1=right)
     * @param eventHash Hash of the event to verify
     * @return bool Whether the proof is valid
     */
    function verifySinkEvent(
        uint256 tokenId,
        bytes32[] memory siblings,
        uint256 directionBits,
        bytes32 eventHash
    ) public view tokenExists(tokenId) returns (bool) {
        ClaimData storage claim = claims[tokenId];
        bytes32 expectedRoot = claim.sinkTree.root();

        return claim.sinkTree.verifyProof(
            siblings,
            directionBits,
            eventHash,
            expectedRoot
        );
    }

    // ============================================================================
    // TRANSFER FUNCTIONS
    // ============================================================================

    /**
     * @notice Transfers a token from one address to another
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token to transfer
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public tokenExists(tokenId) {
        require(ownerOf[tokenId] == from, "From address is not owner");
        require(to != address(0), "Cannot transfer to zero address");
        require(msg.sender == from, "Not authorized to transfer");

        // Update balances
        balanceOf[uint256(uint160(from))]--;
        balanceOf[uint256(uint160(to))]++;

        // Transfer ownership
        ownerOf[tokenId] = to;
        claims[tokenId].owner = to;

        emit Transfer(from, to, tokenId);
    }
}
