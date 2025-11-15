// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TreasuryDAOPermissionless
 * @notice PERMISSIONLESS treasury for DAO House demo - NO ACCESS CONTROL
 * @dev ⚠️ WARNING: This contract has NO security restrictions - anyone can call any function
 *      This is ONLY for hackathon demo purposes to allow easy interaction
 *
 * Features:
 * - Share-based profit distribution (proportional to ownership)
 * - Fixed salary payments (not share-based)
 * - Bonus payments with on-chain reasoning
 * - Dynamic share allocation updates
 * - Multi-officer support
 * - Circle Gateway integration for cross-chain USDC
 * - NO OWNER - fully permissionless
 */
contract TreasuryDAOPermissionless is ReentrancyGuard {
    // USDC token on Arc Testnet
    IERC20 public immutable usdc;

    // Share tracking
    mapping(address => uint256) public shares;
    address[] public officers;
    uint256 public totalShares;

    // Payment tracking
    struct Payment {
        address recipient;
        uint256 amount;
        string paymentType; // "dividend", "salary", "bonus"
        string reason;
        uint256 timestamp;
        bytes32 documentHash;
    }

    Payment[] public paymentHistory;

    // Events
    event SharesUpdated(address indexed officer, uint256 oldShares, uint256 newShares, uint256 newTotalShares);
    event ProfitsDistributed(uint256 totalAmount, uint256 timestamp, bytes32 documentHash);
    event SalaryPaid(address indexed officer, uint256 amount, uint256 timestamp, bytes32 documentHash);
    event BonusPaid(address indexed officer, uint256 amount, string reason, uint256 timestamp, bytes32 documentHash);
    event OfficerPayment(address indexed officer, uint256 amount, string paymentType);

    /**
     * @notice Initialize treasury with USDC token address
     * @param _usdc Address of USDC token on Arc Testnet (0x3600...0000)
     */
    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
        totalShares = 100; // Start with 100 total shares
    }

    /**
     * @notice Initialize officer shares - CAN BE CALLED BY ANYONE
     * @param _officers Array of officer addresses
     * @param _shares Array of share amounts for each officer
     * @dev ⚠️ NO ACCESS CONTROL - anyone can call this
     */
    function initializeShares(address[] calldata _officers, uint256[] calldata _shares) external {
        require(_officers.length == _shares.length, "Arrays must match");
        require(officers.length == 0, "Already initialized");

        uint256 sum = 0;
        for (uint256 i = 0; i < _officers.length; i++) {
            require(_officers[i] != address(0), "Invalid officer address");
            require(_shares[i] > 0, "Shares must be positive");

            shares[_officers[i]] = _shares[i];
            officers.push(_officers[i]);
            sum += _shares[i];

            emit SharesUpdated(_officers[i], 0, _shares[i], sum);
        }

        totalShares = sum;
    }

    /**
     * @notice Get share percentage for an officer
     * @param officer Address of the officer
     * @return Percentage (0-100) with 2 decimal precision (e.g., 6000 = 60.00%)
     */
    function getSharePercentage(address officer) public view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[officer] * 10000) / totalShares;
    }

    /**
     * @notice Distribute profits to all shareholders - CAN BE CALLED BY ANYONE
     * @param totalAmount Total USDC amount to distribute
     * @param documentHash Hash of the source document (P&L report)
     * @dev ⚠️ NO ACCESS CONTROL - anyone can trigger distribution
     */
    function distributeProfits(uint256 totalAmount, bytes32 documentHash) external nonReentrant {
        require(totalAmount > 0, "Amount must be positive");
        require(usdc.balanceOf(address(this)) >= totalAmount, "Insufficient treasury balance");

        uint256 distributed = 0;

        for (uint256 i = 0; i < officers.length; i++) {
            address officer = officers[i];
            uint256 officerShares = shares[officer];

            if (officerShares > 0) {
                // Calculate proportional amount: (shares / totalShares) * totalAmount
                uint256 payout = (officerShares * totalAmount) / totalShares;

                if (payout > 0) {
                    require(usdc.transfer(officer, payout), "USDC transfer failed");

                    paymentHistory.push(Payment({
                        recipient: officer,
                        amount: payout,
                        paymentType: "dividend",
                        reason: "Profit distribution",
                        timestamp: block.timestamp,
                        documentHash: documentHash
                    }));

                    emit OfficerPayment(officer, payout, "dividend");
                    distributed += payout;
                }
            }
        }

        emit ProfitsDistributed(distributed, block.timestamp, documentHash);
    }

    /**
     * @notice Pay fixed salary to a specific officer - CAN BE CALLED BY ANYONE
     * @param officer Address of the officer
     * @param amount USDC amount to pay
     * @param documentHash Hash of the payroll document
     * @dev ⚠️ NO ACCESS CONTROL - anyone can trigger salary payments
     */
    function paySalary(address officer, uint256 amount, bytes32 documentHash) external nonReentrant {
        require(officer != address(0), "Invalid officer address");
        require(amount > 0, "Amount must be positive");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient treasury balance");

        require(usdc.transfer(officer, amount), "USDC transfer failed");

        paymentHistory.push(Payment({
            recipient: officer,
            amount: amount,
            paymentType: "salary",
            reason: "Monthly salary",
            timestamp: block.timestamp,
            documentHash: documentHash
        }));

        emit SalaryPaid(officer, amount, block.timestamp, documentHash);
        emit OfficerPayment(officer, amount, "salary");
    }

    /**
     * @notice Pay bonus to a specific officer - CAN BE CALLED BY ANYONE
     * @param officer Address of the officer
     * @param amount USDC amount to pay
     * @param reason Description of the bonus (e.g., "Q4 Performance")
     * @param documentHash Hash of the director resolution document
     * @dev ⚠️ NO ACCESS CONTROL - anyone can trigger bonus payments
     */
    function payBonus(address officer, uint256 amount, string calldata reason, bytes32 documentHash)
        external
        nonReentrant
    {
        require(officer != address(0), "Invalid officer address");
        require(amount > 0, "Amount must be positive");
        require(bytes(reason).length > 0, "Reason required");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient treasury balance");

        require(usdc.transfer(officer, amount), "USDC transfer failed");

        paymentHistory.push(Payment({
            recipient: officer,
            amount: amount,
            paymentType: "bonus",
            reason: reason,
            timestamp: block.timestamp,
            documentHash: documentHash
        }));

        emit BonusPaid(officer, amount, reason, block.timestamp, documentHash);
        emit OfficerPayment(officer, amount, "bonus");
    }

    /**
     * @notice Update share allocation for an officer - CAN BE CALLED BY ANYONE
     * @param officer Address of the officer
     * @param newShares New share amount for the officer
     * @dev ⚠️ NO ACCESS CONTROL - anyone can modify share allocations
     */
    function updateShares(address officer, uint256 newShares) external {
        require(officer != address(0), "Invalid officer address");

        uint256 oldShares = shares[officer];

        // Add officer to array if new
        if (oldShares == 0 && newShares > 0) {
            officers.push(officer);
        }

        // Update total shares
        totalShares = totalShares - oldShares + newShares;
        shares[officer] = newShares;

        emit SharesUpdated(officer, oldShares, newShares, totalShares);
    }

    /**
     * @notice Get total number of officers
     */
    function getOfficerCount() external view returns (uint256) {
        return officers.length;
    }

    /**
     * @notice Get all officers and their shares
     */
    function getAllOfficers() external view returns (address[] memory, uint256[] memory) {
        uint256[] memory sharesArray = new uint256[](officers.length);

        for (uint256 i = 0; i < officers.length; i++) {
            sharesArray[i] = shares[officers[i]];
        }

        return (officers, sharesArray);
    }

    /**
     * @notice Get payment history count
     */
    function getPaymentCount() external view returns (uint256) {
        return paymentHistory.length;
    }

    /**
     * @notice Get treasury USDC balance
     */
    function getTreasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get officer info
     * @param officer Address of the officer
     * @return officerShares Number of shares owned
     * @return percentage Ownership percentage (with 2 decimals)
     */
    function getOfficerInfo(address officer) external view returns (uint256 officerShares, uint256 percentage) {
        officerShares = shares[officer];
        percentage = getSharePercentage(officer);
    }

    /**
     * @notice Emergency withdraw - CAN BE CALLED BY ANYONE
     * @param amount Amount of USDC to withdraw
     * @param recipient Address to send USDC to
     * @dev ⚠️ NO ACCESS CONTROL - anyone can drain the treasury
     *      This is intentional for demo purposes only!
     */
    function emergencyWithdraw(uint256 amount, address recipient) external {
        require(recipient != address(0), "Invalid recipient");
        require(usdc.transfer(recipient, amount), "USDC transfer failed");
    }
}
