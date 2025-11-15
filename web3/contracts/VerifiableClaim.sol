// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title VerifiableClaim
 * @notice ERC721-like NFT for tokenized workflow claims with Merkle proof verification
 * @dev Stores Merkle roots for full ledger and sink-specific events
 */
contract VerifiableClaim {
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Token ID counter
    uint256 private _tokenIdCounter;

    /// @notice Mapping from token ID to claim data
    mapping(uint256 => ClaimData) public claims;

    /// @notice Mapping from token ID to owner address
    mapping(uint256 => address) public ownerOf;

    /// @notice Mapping from owner to token count
    mapping(address => uint256) public balanceOf;

    /// @notice Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    /// @notice Contract owner
    address public owner;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct ClaimData {
        string claimId;              // Off-chain claim ID
        string workflowId;           // Template/workflow ID
        string executionId;          // Execution instance ID
        bytes32 fullLedgerRoot;      // Merkle root of ALL execution events
        bytes32 sinkRoot;            // Merkle root of sink-specific events
        uint256 fullLedgerCount;     // Number of events in full ledger
        uint256 sinkEventCount;      // Number of events in sink
        string aggregateValue;       // Computed claim value (stringified JSON)
        uint256 issuedAt;            // Timestamp of issuance
        string metadataUri;          // URI to off-chain metadata (IPFS)
        bool verified;               // Whether claim has been verified
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    event ClaimMinted(
        uint256 indexed tokenId,
        address indexed to,
        string claimId,
        bytes32 fullLedgerRoot,
        bytes32 sinkRoot
    );

    event ClaimVerified(
        uint256 indexed tokenId,
        bool verified
    );

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );

    event Approval(
        address indexed owner,
        address indexed approved,
        uint256 indexed tokenId
    );

    // ============================================================================
    // MODIFIERS
    // ============================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(ownerOf[tokenId] != address(0), "Token does not exist");
        _;
    }

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    constructor() {
        owner = msg.sender;
        _tokenIdCounter = 1;
    }

    // ============================================================================
    // MINTING FUNCTIONS
    // ============================================================================

    /**
     * @notice Mints a new claim NFT
     * @param to Address to mint the claim to
     * @param claimId Off-chain claim ID
     * @param workflowId Workflow template ID
     * @param executionId Execution instance ID
     * @param fullLedgerRoot Merkle root of full execution ledger
     * @param sinkRoot Merkle root of sink events
     * @param fullLedgerCount Total events in full ledger
     * @param sinkEventCount Total events in sink
     * @param aggregateValue Computed claim value
     * @param metadataUri IPFS URI to claim metadata
     * @return tokenId The minted token ID
     */
    function mintClaim(
        address to,
        string memory claimId,
        string memory workflowId,
        string memory executionId,
        bytes32 fullLedgerRoot,
        bytes32 sinkRoot,
        uint256 fullLedgerCount,
        uint256 sinkEventCount,
        string memory aggregateValue,
        string memory metadataUri
    ) public onlyOwner returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(fullLedgerRoot != bytes32(0), "Full ledger root cannot be empty");
        require(sinkRoot != bytes32(0), "Sink root cannot be empty");

        uint256 tokenId = _tokenIdCounter++;

        claims[tokenId] = ClaimData({
            claimId: claimId,
            workflowId: workflowId,
            executionId: executionId,
            fullLedgerRoot: fullLedgerRoot,
            sinkRoot: sinkRoot,
            fullLedgerCount: fullLedgerCount,
            sinkEventCount: sinkEventCount,
            aggregateValue: aggregateValue,
            issuedAt: block.timestamp,
            metadataUri: metadataUri,
            verified: false
        });

        ownerOf[tokenId] = to;
        balanceOf[to]++;

        emit ClaimMinted(tokenId, to, claimId, fullLedgerRoot, sinkRoot);
        emit Transfer(address(0), to, tokenId);

        return tokenId;
    }

    // ============================================================================
    // VERIFICATION FUNCTIONS
    // ============================================================================

    /**
     * @notice Verifies a Merkle proof against the full ledger root
     * @param tokenId Token ID to verify against
     * @param eventHash Hash of the event to verify
     * @param proof Array of sibling hashes
     * @param path Binary path (0=left, 1=right)
     * @return bool Whether the proof is valid
     */
    function verifyEventInFullLedger(
        uint256 tokenId,
        bytes32 eventHash,
        bytes32[] memory proof,
        uint256[] memory path
    ) public view tokenExists(tokenId) returns (bool) {
        require(proof.length == path.length, "Proof and path length mismatch");

        bytes32 computedHash = eventHash;

        for (uint256 i = 0; i < proof.length; i++) {
            if (path[i] == 1) {
                // We are left child, sibling is right
                computedHash = keccak256(abi.encodePacked(computedHash, proof[i]));
            } else {
                // We are right child, sibling is left
                computedHash = keccak256(abi.encodePacked(proof[i], computedHash));
            }
        }

        return computedHash == claims[tokenId].fullLedgerRoot;
    }

    /**
     * @notice Verifies a Merkle proof against the sink root
     * @param tokenId Token ID to verify against
     * @param eventHash Hash of the event to verify
     * @param proof Array of sibling hashes
     * @param path Binary path (0=left, 1=right)
     * @return bool Whether the proof is valid
     */
    function verifyEventInSink(
        uint256 tokenId,
        bytes32 eventHash,
        bytes32[] memory proof,
        uint256[] memory path
    ) public view tokenExists(tokenId) returns (bool) {
        require(proof.length == path.length, "Proof and path length mismatch");

        bytes32 computedHash = eventHash;

        for (uint256 i = 0; i < proof.length; i++) {
            if (path[i] == 1) {
                computedHash = keccak256(abi.encodePacked(computedHash, proof[i]));
            } else {
                computedHash = keccak256(abi.encodePacked(proof[i], computedHash));
            }
        }

        return computedHash == claims[tokenId].sinkRoot;
    }

    /**
     * @notice Marks a claim as verified (admin only)
     * @param tokenId Token ID to verify
     */
    function markAsVerified(uint256 tokenId) public onlyOwner tokenExists(tokenId) {
        claims[tokenId].verified = true;
        emit ClaimVerified(tokenId, true);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Gets the claim data for a token
     * @param tokenId Token ID
     * @return ClaimData struct
     */
    function getClaim(uint256 tokenId) public view tokenExists(tokenId) returns (ClaimData memory) {
        return claims[tokenId];
    }

    /**
     * @notice Gets the metadata URI for a token
     * @param tokenId Token ID
     * @return string metadata URI
     */
    function tokenURI(uint256 tokenId) public view tokenExists(tokenId) returns (string memory) {
        return claims[tokenId].metadataUri;
    }

    /**
     * @notice Returns the total supply of tokens
     * @return uint256 total supply
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter - 1;
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
    function transferFrom(address from, address to, uint256 tokenId) public tokenExists(tokenId) {
        require(ownerOf[tokenId] == from, "From address is not owner");
        require(to != address(0), "Cannot transfer to zero address");
        require(
            msg.sender == from || msg.sender == _tokenApprovals[tokenId],
            "Not authorized to transfer"
        );

        // Clear approval
        _tokenApprovals[tokenId] = address(0);

        // Update balances
        balanceOf[from]--;
        balanceOf[to]++;

        // Transfer ownership
        ownerOf[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    /**
     * @notice Approves an address to transfer a token
     * @param to Address to approve
     * @param tokenId Token to approve
     */
    function approve(address to, uint256 tokenId) public tokenExists(tokenId) {
        address tokenOwner = ownerOf[tokenId];
        require(msg.sender == tokenOwner, "Not token owner");
        require(to != tokenOwner, "Cannot approve to current owner");

        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    /**
     * @notice Gets the approved address for a token
     * @param tokenId Token ID
     * @return address approved address
     */
    function getApproved(uint256 tokenId) public view tokenExists(tokenId) returns (address) {
        return _tokenApprovals[tokenId];
    }
}
