// Sources flattened with hardhat v3.0.14 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/IncrementalMerkleTree.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @notice Incremental Merkle Tree module
 *
 * This implementation is a modification of the Incremental Merkle Tree data structure described
 * in [Deposit Contract Verification](https://github.com/runtimeverification/deposit-contract-verification/blob/master/deposit-contract-verification.pdf).
 *
 * This implementation aims to optimize and improve the original data structure.
 *
 * The main differences are:
 * - No explicit constructor; the tree is initialized when the first element is added
 * - Growth is not constrained; the height of the tree automatically increases as elements are added
 *
 * Zero hashes are computed each time the getRoot function is called.
 *
 * Gas usage for _add and _root functions (where count is the number of elements added to the tree):
 *
 * | Statistic | _add         | _root            |
 * | --------- | ------------ | ---------------- |
 * | count     | 49999        | 49999            |
 * | mean      | 38972 gas    | 60213 gas        |
 * | std       | 3871 gas     | 4996 gas         |
 * | min       | 36251 gas    | 31238 gas        |
 * | 25%       | 36263 gas    | 57020 gas        |
 * | 50%       | 38954 gas    | 60292 gas        |
 * | 75%       | 41657 gas    | 63564 gas        |
 * | max       | 96758 gas    | 78071 gas        |
 *
 * ## Usage example:
 *
 * ```
 * using IncrementalMerkleTree for IncrementalMerkleTree.UintIMT;
 *
 * IncrementalMerkleTree.UintIMT internal uintTree;
 *
 * ................................................
 *
 * uintTree.add(1234);
 *
 * uintTree.root();
 *
 * uintTree.height();
 *
 * uintTree.length();
 * ```
 */
library IncrementalMerkleTree {
    /**
     *********************
     *      UintIMT      *
     *********************
     */

    struct UintIMT {
        IMT _tree;
    }

    error NewHeightMustBeGreater(uint256 currentHeight, uint256 newHeight);
    error TreeIsNotEmpty();
    error TreeIsFull();

    /**
     * @notice The function to set the height of the uint256 tree.
     * Complexity is O(1).
     *
     * @param tree self.
     * @param height_ The new height of the Merkle tree. Should be greater than the current one.
     */
    function setHeight(UintIMT storage tree, uint256 height_) internal {
        _setHeight(tree._tree, height_);
    }

    /**
     * @notice The function to add a new element to the uint256 tree.
     * Complexity is O(log(n)), where n is the number of elements in the tree.
     *
     * @param tree self.
     * @param element_ The new element to add.
     */
    function add(UintIMT storage tree, uint256 element_) internal {
        _add(tree._tree, bytes32(element_));
    }

    /**
     * @notice The function to set a custom hash functions, that will be used to build the Merkle Tree.
     *
     * @param tree self.
     * @param hash1_ The hash function that accepts one argument.
     * @param hash2_ The hash function that accepts two arguments.
     */
    function setHashers(
        UintIMT storage tree,
        function(bytes32) view returns (bytes32) hash1_,
        function(bytes32, bytes32) view returns (bytes32) hash2_
    ) internal {
        _setHashers(tree._tree, hash1_, hash2_);
    }

    /**
     * @notice The function to return the root hash of the uint256 tree.
     * Complexity is O(log(n) + h), where n is the number of elements in the tree and
     * h is the height of the tree.
     *
     * @param tree self.
     * @return The root hash of the Merkle tree.
     */
    function root(UintIMT storage tree) internal view returns (bytes32) {
        return _root(tree._tree);
    }

    /**
     * @notice The function to verify a proof of a leaf's existence in the uint256 tree.
     * Complexity is O(log(n)), where n is the number of elements in the tree.
     *
     * @param tree self.
     * @param siblings_ The siblings of the leaf.
     * @param directionBits_ The direction bits of the leaf.
     * @param leaf_ The leaf.
     * @param root_ The root hash of the tree to verify against.
     * @return True if the proof is valid, false otherwise.
     */
    function verifyProof(
        UintIMT storage tree,
        bytes32[] memory siblings_,
        uint256 directionBits_,
        bytes32 leaf_,
        bytes32 root_
    ) internal view returns (bool) {
        return _verifyProof(tree._tree, siblings_, directionBits_, leaf_, root_);
    }

    /**
     * @notice The function to return the height of the uint256 tree. Complexity is O(1).
     * @param tree self.
     * @return The height of the Merkle tree.
     */
    function height(UintIMT storage tree) internal view returns (uint256) {
        return _height(tree._tree);
    }

    /**
     * @notice The function to return the number of elements in the uint256 tree. Complexity is O(1).
     * @param tree self.
     * @return The number of elements in the Merkle tree.
     */
    function length(UintIMT storage tree) internal view returns (uint256) {
        return _length(tree._tree);
    }

    /**
     * @notice The function to check whether the custom hash functions are set.
     * @param tree self.
     * @return True if the custom hash functions are set, false otherwise.
     */
    function isCustomHasherSet(UintIMT storage tree) internal view returns (bool) {
        return tree._tree.isCustomHasherSet;
    }

    /**
     **********************
     *     Bytes32IMT     *
     **********************
     */

    struct Bytes32IMT {
        IMT _tree;
    }

    /**
     * @notice The function to set the height of the bytes32 tree.
     * Complexity is O(1).
     *
     * @param tree self.
     * @param height_ The new height of the Merkle tree. Should be greater than the current one.
     */
    function setHeight(Bytes32IMT storage tree, uint256 height_) internal {
        _setHeight(tree._tree, height_);
    }

    /**
     * @notice The function to add a new element to the bytes32 tree.
     * Complexity is O(log(n)), where n is the number of elements in the tree.
     */
    function add(Bytes32IMT storage tree, bytes32 element_) internal {
        _add(tree._tree, element_);
    }

    /**
     * @notice The function to set a custom hash functions, that will be used to build the Merkle Tree.
     *
     * @param tree self.
     * @param hash1_ The hash function that accepts one argument.
     * @param hash2_ The hash function that accepts two arguments.
     */
    function setHashers(
        Bytes32IMT storage tree,
        function(bytes32) view returns (bytes32) hash1_,
        function(bytes32, bytes32) view returns (bytes32) hash2_
    ) internal {
        _setHashers(tree._tree, hash1_, hash2_);
    }

    /**
     * @notice The function to return the root hash of the bytes32 tree.
     * Complexity is O(log(n) + h), where n is the number of elements in the tree and
     * h is the height of the tree.
     */
    function root(Bytes32IMT storage tree) internal view returns (bytes32) {
        return _root(tree._tree);
    }

    /**
     * @notice The function to verify a proof of a leaf's existence in the bytes32 tree.
     * Complexity is O(log(n)), where n is the number of elements in the tree.
     *
     * @param tree self.
     * @param siblings_ The siblings of the leaf.
     * @param directionBits_ The direction bits of the leaf.
     * @param leaf_ The leaf.
     * @param root_ The root hash of the tree to verify against.
     * @return True if the proof is valid, false otherwise.
     */
    function verifyProof(
        Bytes32IMT storage tree,
        bytes32[] memory siblings_,
        uint256 directionBits_,
        bytes32 leaf_,
        bytes32 root_
    ) internal view returns (bool) {
        return _verifyProof(tree._tree, siblings_, directionBits_, leaf_, root_);
    }

    /**
     * @notice The function to process the proof for inclusion or exclusion of a leaf in the tree.
     * Complexity is O(log(n)), where n is the number of elements in the tree.
     *
     * @param hash2_ The hash function that accepts two arguments.
     * @param siblings_ The siblings of the leaf.
     * @param directionBits_ The direction bits of the leaf.
     * @param leaf_ The leaf.
     * @return The calculated root hash from the proof.
     */
    function processProof(
        function(bytes32, bytes32) view returns (bytes32) hash2_,
        bytes32[] memory siblings_,
        uint256 directionBits_,
        bytes32 leaf_
    ) internal view returns (bytes32) {
        return _processProof(hash2_, siblings_, directionBits_, leaf_);
    }

    /**
     * @notice The function to return the height of the bytes32 tree. Complexity is O(1).
     */
    function height(Bytes32IMT storage tree) internal view returns (uint256) {
        return _height(tree._tree);
    }

    /**
     * @notice The function to return the number of elements in the bytes32 tree. Complexity is O(1).
     */
    function length(Bytes32IMT storage tree) internal view returns (uint256) {
        return _length(tree._tree);
    }

    /**
     * @notice The function to check whether the custom hash functions are set.
     * @param tree self.
     * @return True if the custom hash functions are set, false otherwise.
     */
    function isCustomHasherSet(Bytes32IMT storage tree) internal view returns (bool) {
        return tree._tree.isCustomHasherSet;
    }

    /**
     ************************
     *      AddressIMT      *
     ************************
     */

    struct AddressIMT {
        IMT _tree;
    }

    /**
     * @notice The function to set the height of the address tree.
     * Complexity is O(1).
     *
     * @param tree self.
     * @param height_ The new height of the Merkle tree. Should be greater than the current one.
     */
    function setHeight(AddressIMT storage tree, uint256 height_) internal {
        _setHeight(tree._tree, height_);
    }

    /**
     * @notice The function to add a new element to the address tree.
     * Complexity is O(log(n)), where n is the number of elements in the tree.
     */
    function add(AddressIMT storage tree, address element_) internal {
        _add(tree._tree, bytes32(uint256(uint160(element_))));
    }

    /**
     * @notice The function to set a custom hash functions, that will be used to build the Merkle Tree.
     *
     * @param tree self.
     * @param hash1_ The hash function that accepts one argument.
     * @param hash2_ The hash function that accepts two arguments.
     */
    function setHashers(
        AddressIMT storage tree,
        function(bytes32) view returns (bytes32) hash1_,
        function(bytes32, bytes32) view returns (bytes32) hash2_
    ) internal {
        _setHashers(tree._tree, hash1_, hash2_);
    }

    /**
     * @notice The function to return the root hash of the address tree.
     * Complexity is O(log(n) + h), where n is the number of elements in the tree and
     * h is the height of the tree.
     */
    function root(AddressIMT storage tree) internal view returns (bytes32) {
        return _root(tree._tree);
    }

    /**
     * @notice The function to verify a proof of a leaf's existence in the address tree.
     * Complexity is O(log(n)), where n is the number of elements in the tree.
     *
     * @param tree self.
     * @param siblings_ The siblings of the leaf.
     * @param directionBits_ The direction bits of the leaf.
     * @param leaf_ The leaf.
     * @param root_ The root hash of the tree to verify against.
     * @return True if the proof is valid, false otherwise.
     */
    function verifyProof(
        AddressIMT storage tree,
        bytes32[] memory siblings_,
        uint256 directionBits_,
        bytes32 leaf_,
        bytes32 root_
    ) internal view returns (bool) {
        return _verifyProof(tree._tree, siblings_, directionBits_, leaf_, root_);
    }

    /**
     * @notice The function to return the height of the address tree. Complexity is O(1).
     */
    function height(AddressIMT storage tree) internal view returns (uint256) {
        return _height(tree._tree);
    }

    /**
     * @notice The function to return the number of elements in the address tree. Complexity is O(1).
     */
    function length(AddressIMT storage tree) internal view returns (uint256) {
        return _length(tree._tree);
    }

    /**
     * @notice The function to check whether the custom hash functions are set.
     * @param tree self.
     * @return True if the custom hash functions are set, false otherwise.
     */
    function isCustomHasherSet(AddressIMT storage tree) internal view returns (bool) {
        return tree._tree.isCustomHasherSet;
    }

    /**
     ************************
     *       InnerIMT       *
     ************************
     */

    struct IMT {
        bytes32[] branches;
        uint256 leavesCount;
        bool isStrictHeightSet;
        bool isCustomHasherSet;
        function(bytes32) view returns (bytes32) hash1;
        function(bytes32, bytes32) view returns (bytes32) hash2;
    }

    function _setHeight(IMT storage tree, uint256 height_) private {
        uint256 currentHeight_ = _height(tree);

        if (height_ <= currentHeight_) revert NewHeightMustBeGreater(currentHeight_, height_);

        tree.isStrictHeightSet = true;

        assembly {
            sstore(tree.slot, height_)
        }
    }

    function _setHashers(
        IMT storage tree,
        function(bytes32) view returns (bytes32) hash1_,
        function(bytes32, bytes32) view returns (bytes32) hash2_
    ) private {
        if (_length(tree) != 0) revert TreeIsNotEmpty();

        tree.isCustomHasherSet = true;

        tree.hash1 = hash1_;
        tree.hash2 = hash2_;
    }

    function _add(IMT storage tree, bytes32 element_) private {
        function(bytes32) view returns (bytes32) hash1_ = tree.isCustomHasherSet
            ? tree.hash1
            : _hash1;
        function(bytes32, bytes32) view returns (bytes32) hash2_ = tree.isCustomHasherSet
            ? tree.hash2
            : _hash2;

        bytes32 resultValue_ = hash1_(element_);

        uint256 index_ = 0;
        uint256 size_ = ++tree.leavesCount;
        uint256 treeHeight_ = tree.branches.length;

        while (index_ < treeHeight_) {
            if (size_ & 1 == 1) {
                break;
            }

            bytes32 branch_ = tree.branches[index_];
            resultValue_ = hash2_(branch_, resultValue_);

            size_ >>= 1;
            ++index_;
        }

        if (index_ == treeHeight_) {
            if (tree.isStrictHeightSet) revert TreeIsFull();

            tree.branches.push(resultValue_);
        } else {
            tree.branches[index_] = resultValue_;
        }
    }

    function _root(IMT storage tree) private view returns (bytes32) {
        function(bytes32) view returns (bytes32) hash1_ = tree.isCustomHasherSet
            ? tree.hash1
            : _hash1;
        function(bytes32, bytes32) view returns (bytes32) hash2_ = tree.isCustomHasherSet
            ? tree.hash2
            : _hash2;

        uint256 treeHeight_ = tree.branches.length;

        if (treeHeight_ == 0) {
            return hash1_(bytes32(0));
        }

        uint256 height_;
        uint256 size_ = tree.leavesCount;
        bytes32 root_ = hash1_(bytes32(0));
        bytes32[] memory zeroHashes_ = _getZeroHashes(tree, treeHeight_);

        while (height_ < treeHeight_) {
            if (size_ & 1 == 1) {
                bytes32 branch_ = tree.branches[height_];

                root_ = hash2_(branch_, root_);
            } else {
                bytes32 zeroHash_ = zeroHashes_[height_];

                root_ = hash2_(root_, zeroHash_);
            }

            size_ >>= 1;
            ++height_;
        }

        return root_;
    }

    function _verifyProof(
        IMT storage tree,
        bytes32[] memory siblings_,
        uint256 directionBits,
        bytes32 leaf_,
        bytes32 root_
    ) private view returns (bool) {
        function(bytes32, bytes32) view returns (bytes32) hash2_ = tree.isCustomHasherSet
            ? tree.hash2
            : _hash2;

        return _processProof(hash2_, siblings_, directionBits, leaf_) == root_;
    }

    function _processProof(
        function(bytes32, bytes32) view returns (bytes32) hash2_,
        bytes32[] memory siblings_,
        uint256 directionBits,
        bytes32 leaf_
    ) private view returns (bytes32) {
        bytes32 computedHash_ = leaf_;

        for (uint256 i = 0; i < siblings_.length; ++i) {
            if ((directionBits >> i) & 1 != 0) {
                computedHash_ = hash2_(siblings_[i], computedHash_);
            } else {
                computedHash_ = hash2_(computedHash_, siblings_[i]);
            }
        }

        return computedHash_;
    }

    function _height(IMT storage tree) private view returns (uint256) {
        return tree.branches.length;
    }

    function _length(IMT storage tree) private view returns (uint256) {
        return tree.leavesCount;
    }

    function _getZeroHashes(
        IMT storage tree,
        uint256 height_
    ) private view returns (bytes32[] memory) {
        function(bytes32) view returns (bytes32) hash1_ = tree.isCustomHasherSet
            ? tree.hash1
            : _hash1;
        function(bytes32, bytes32) view returns (bytes32) hash2_ = tree.isCustomHasherSet
            ? tree.hash2
            : _hash2;

        bytes32[] memory zeroHashes_ = new bytes32[](height_);

        zeroHashes_[0] = hash1_(bytes32(0));

        for (uint256 i = 1; i < height_; ++i) {
            bytes32 prevHash_ = zeroHashes_[i - 1];

            zeroHashes_[i] = hash2_(prevHash_, prevHash_);
        }

        return zeroHashes_;
    }

    function _hash1(bytes32 a) private pure returns (bytes32 result) {
        assembly {
            mstore(0, a)

            result := keccak256(0, 32)
        }
    }

    function _hash2(bytes32 a, bytes32 b) private pure returns (bytes32 result) {
        assembly {
            mstore(0, a)
            mstore(32, b)

            result := keccak256(0, 64)
        }
    }
}


// File contracts/IncrementalVerifiableClaim.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.28;

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

