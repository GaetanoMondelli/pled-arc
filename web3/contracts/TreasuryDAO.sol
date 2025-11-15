// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TreasuryDAO
 * @notice Share-based treasury management for DAO House companies
 * @dev Manages ERC20-style shares and USDC distributions on Arc Testnet
 *
 * Features:
 * - Share-based profit distribution (proportional to ownership)
 * - Fixed salary payments (not share-based)
 * - Bonus payments with on-chain reasoning
 * - Dynamic share allocation updates
 * - Multi-officer support
 * - Circle Gateway integration for cross-chain USDC
 */
contract TreasuryDAO is Ownable, ReentrancyGuard {
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
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
        totalShares = 100; // Start with 100 total shares
    }

    /**
     * @notice Initialize officer shares (only callable once during setup)
     * @param _officers Array of officer addresses
     * @param _shares Array of share amounts for each officer
     */
    function initializeShares(address[] calldata _officers, uint256[] calldata _shares) external onlyOwner {
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
        return (shares[officer] * 10000) / totalShares; // Multiply by 100 for percentage, 100 for 2 decimals
    }

    /**
     * @notice Distribute profits to all shareholders based on their share allocation
     * @param totalAmount Total USDC amount to distribute
     * @param documentHash Hash of the source document (P&L report)
     * @dev This is triggered by approved Profit & Loss reports
     */
    function distributeProfits(uint256 totalAmount, bytes32 documentHash) external onlyOwner nonReentrant {
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
     * @notice Pay fixed salary to a specific officer
     * @param officer Address of the officer
     * @param amount USDC amount to pay
     * @param documentHash Hash of the payroll document
     * @dev This is triggered by approved Payroll Summary documents
     */
    function paySalary(address officer, uint256 amount, bytes32 documentHash) external onlyOwner nonReentrant {
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
     * @notice Pay bonus to a specific officer with reasoning
     * @param officer Address of the officer
     * @param amount USDC amount to pay
     * @param reason Description of the bonus (e.g., "Q4 Performance")
     * @param documentHash Hash of the director resolution document
     * @dev This is triggered by approved Director Resolution documents
     */
    function payBonus(address officer, uint256 amount, string calldata reason, bytes32 documentHash)
        external
        onlyOwner
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
     * @notice Update share allocation for an officer
     * @param officer Address of the officer
     * @param newShares New share amount for the officer
     * @dev This is triggered by approved Shareholder Update documents
     */
    function updateShares(address officer, uint256 newShares) external onlyOwner {
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
     * @notice Emergency withdrawal (owner only)
     * @param amount Amount of USDC to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(usdc.transfer(owner(), amount), "USDC transfer failed");
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
}
