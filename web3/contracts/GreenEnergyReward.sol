// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IncrementalVerifiableClaim.sol";

// ============================================================================
// INTERFACES
// ============================================================================

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GreenEnergyReward
 * @notice Escrow contract for green energy carbon credit fund rewards
 * @dev Receives verifiable claims and distributes USDC rewards based on claim value
 *
 * Reward Formula: claim number * 0.01 USDC
 * Example: claim value of 32 = 0.32 USDC reward
 *
 * Features:
 * - Escrow USDC for reward distribution
 * - Verify claims from IncrementalVerifiableClaim contract
 * - Calculate and distribute rewards based on claim aggregate value
 * - Track claimed rewards to prevent double-claiming
 * - Admin controls for funding and emergency withdrawal
 */
contract GreenEnergyReward {

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice USDC token contract on Arc (native USDC)
    /// @dev Arc uses 0x3600000000000000000000000000000000000000 for native USDC
    IERC20 public immutable usdc;

    /// @notice Reference to the IncrementalVerifiableClaim contract
    IncrementalVerifiableClaim public immutable claimContract;

    /// @notice Contract admin (can fund escrow and withdraw)
    address public immutable admin;

    /// @notice Reward rate per claim unit (0.01 USDC = 10000 units, USDC has 6 decimals)
    uint256 public constant REWARD_RATE = 10000; // 0.01 USDC (6 decimals)

    /// @notice Mapping to track if a claim has already been rewarded
    mapping(uint256 => bool) public claimedRewards;

    /// @notice Total USDC distributed as rewards
    uint256 public totalRewardsDistributed;

    /// @notice Total number of claims rewarded
    uint256 public totalClaimsRewarded;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event RewardClaimed(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 claimValue,
        uint256 rewardAmount,
        string claimId
    );

    event EscrowFunded(
        address indexed funder,
        uint256 amount,
        uint256 newBalance
    );

    event EmergencyWithdrawal(
        address indexed admin,
        uint256 amount
    );

    // ============================================================================
    // MODIFIERS
    // ============================================================================

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call");
        _;
    }

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Initialize the reward contract
     * @param _usdcAddress USDC contract address on Arc
     * @param _claimContract IncrementalVerifiableClaim contract address
     */
    constructor(address _usdcAddress, address _claimContract) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_claimContract != address(0), "Invalid claim contract");

        usdc = IERC20(_usdcAddress);
        claimContract = IncrementalVerifiableClaim(_claimContract);
        admin = msg.sender;
    }

    // ============================================================================
    // FUNDING FUNCTIONS
    // ============================================================================

    /**
     * @notice Fund the escrow with USDC
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function fundEscrow(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit EscrowFunded(msg.sender, amount, usdc.balanceOf(address(this)));
    }

    // ============================================================================
    // CLAIM REWARD FUNCTIONS
    // ============================================================================

    /**
     * @notice Claim reward for a verifiable claim
     * @param tokenId The claim token ID
     * @dev Extracts numeric value from aggregateValue and calculates reward
     */
    function claimReward(uint256 tokenId) external {
        // Check if reward already claimed
        require(!claimedRewards[tokenId], "Reward already claimed");

        // Verify token exists and get metadata
        (
            string memory claimId,
            , // workflowId
            , // executionId
            string memory aggregateValue,
            , // metadataUri
            , // createdAt
            , // lastUpdatedAt
            address owner
        ) = claimContract.getClaimMetadata(tokenId);

        // Verify caller is the claim owner
        require(msg.sender == owner, "Not claim owner");

        // Parse the aggregate value to get numeric claim value
        uint256 claimValue = parseAggregateValue(aggregateValue);
        require(claimValue > 0, "Invalid claim value");

        // Calculate reward: claimValue * 0.01 USDC
        uint256 rewardAmount = claimValue * REWARD_RATE;

        // Check escrow has sufficient balance
        require(usdc.balanceOf(address(this)) >= rewardAmount, "Insufficient escrow balance");

        // Mark as claimed
        claimedRewards[tokenId] = true;
        totalRewardsDistributed += rewardAmount;
        totalClaimsRewarded++;

        // Transfer USDC reward to claim owner
        require(usdc.transfer(owner, rewardAmount), "Reward transfer failed");

        emit RewardClaimed(tokenId, owner, claimValue, rewardAmount, claimId);
    }

    /**
     * @notice Claim rewards for multiple claims in one transaction
     * @param tokenIds Array of claim token IDs
     */
    function claimRewardBatch(uint256[] calldata tokenIds) external {
        require(tokenIds.length > 0, "Empty token IDs array");
        require(tokenIds.length <= 50, "Too many claims at once");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Skip already claimed rewards
            if (claimedRewards[tokenId]) {
                continue;
            }

            // Get metadata
            (
                string memory claimId,
                , ,
                string memory aggregateValue,
                , , ,
                address owner
            ) = claimContract.getClaimMetadata(tokenId);

            // Skip if not the owner
            if (msg.sender != owner) {
                continue;
            }

            // Parse and calculate reward
            uint256 claimValue = parseAggregateValue(aggregateValue);
            if (claimValue == 0) {
                continue;
            }

            uint256 rewardAmount = claimValue * REWARD_RATE;

            // Check balance
            if (usdc.balanceOf(address(this)) < rewardAmount) {
                break; // Stop if insufficient balance
            }

            // Mark as claimed
            claimedRewards[tokenId] = true;
            totalRewardsDistributed += rewardAmount;
            totalClaimsRewarded++;

            // Transfer reward
            require(usdc.transfer(owner, rewardAmount), "Reward transfer failed");

            emit RewardClaimed(tokenId, owner, claimValue, rewardAmount, claimId);
        }
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Calculate potential reward for a claim without claiming
     * @param tokenId The claim token ID
     * @return claimValue The parsed claim value
     * @return rewardAmount The calculated reward in USDC (6 decimals)
     * @return canClaim Whether the reward can be claimed
     */
    function calculateReward(uint256 tokenId) external view returns (
        uint256 claimValue,
        uint256 rewardAmount,
        bool canClaim
    ) {
        // Check if already claimed
        if (claimedRewards[tokenId]) {
            return (0, 0, false);
        }

        // Get aggregate value
        (, , , string memory aggregateValue, , , , ) = claimContract.getClaimMetadata(tokenId);

        // Parse claim value
        claimValue = parseAggregateValue(aggregateValue);
        if (claimValue == 0) {
            return (0, 0, false);
        }

        // Calculate reward
        rewardAmount = claimValue * REWARD_RATE;

        // Check if escrow has sufficient balance
        canClaim = usdc.balanceOf(address(this)) >= rewardAmount;

        return (claimValue, rewardAmount, canClaim);
    }

    /**
     * @notice Get escrow balance
     * @return uint256 Current USDC balance in escrow
     */
    function getEscrowBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Check if a claim has been rewarded
     * @param tokenId The claim token ID
     * @return bool True if reward already claimed
     */
    function isRewardClaimed(uint256 tokenId) external view returns (bool) {
        return claimedRewards[tokenId];
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Emergency withdrawal of USDC (admin only)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyAdmin {
        require(amount > 0, "Amount must be greater than 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");

        require(usdc.transfer(admin, amount), "Withdrawal failed");

        emit EmergencyWithdrawal(admin, amount);
    }

    // ============================================================================
    // INTERNAL HELPER FUNCTIONS
    // ============================================================================

    /**
     * @notice Parse numeric value from aggregateValue string
     * @dev Expects JSON format like: {"value": 32, ...} or simple numeric string
     * @param aggregateValue The aggregate value string
     * @return uint256 The parsed numeric value
     */
    function parseAggregateValue(string memory aggregateValue) internal pure returns (uint256) {
        bytes memory b = bytes(aggregateValue);
        uint256 result = 0;
        bool foundDigit = false;

        // Simple parser: extract first continuous sequence of digits
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];

            // Check if character is a digit (0-9)
            if (char >= 0x30 && char <= 0x39) {
                foundDigit = true;
                result = result * 10 + (uint8(char) - 48);
            } else if (foundDigit) {
                // Stop at first non-digit after finding digits
                break;
            }
        }

        return result;
    }
}
