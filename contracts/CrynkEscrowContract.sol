// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface ICrynkPaymentContract {
    function releaseFundsFromEscrow(bytes32 paymentId) external;
    function refundFunds(bytes32 paymentId) external;
}

contract CrynkEscrowContract is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant DISPUTE_PERIOD = 7 days;
    uint256 public constant AUTO_RELEASE_PERIOD = 30 days;
    
    // State variables
    address public paymentContract;
    address public usdcToken;
    mapping(address => bool) public authorizedMerchants;
    mapping(address => bool) public disputeResolvers;
    
    // Escrow records
    mapping(bytes32 => EscrowRecord) public escrows;
    
    struct EscrowRecord {
        bytes32 paymentId;
        address user;
        uint256 merchantId;
        address merchantWallet;
        uint256 amount;
        uint256 depositTime;
        uint256 confirmationTime;
        EscrowStatus status;
        bool disputeRaised;
        string disputeReason;
    }
    
    enum EscrowStatus {
        DEPOSITED,
        CONFIRMED,
        DISPUTED,
        RELEASED,
        REFUNDED
    }
    
    // Events
    event FundsDeposited(bytes32 indexed paymentId, address indexed user, uint256 merchantId, uint256 amount);
    event OrderConfirmed(bytes32 indexed paymentId, address indexed merchant, uint256 confirmationTime);
    event DisputeRaised(bytes32 indexed paymentId, address indexed user, string reason);
    event DisputeResolved(bytes32 indexed paymentId, bool inFavorOfUser, address resolver);
    event FundsReleased(bytes32 indexed paymentId, address indexed merchant, uint256 amount);
    event FundsRefunded(bytes32 indexed paymentId, address indexed user, uint256 amount);
    event AutoReleaseExecuted(bytes32 indexed paymentId, uint256 amount);
    
    modifier onlyPaymentContract() {
        require(msg.sender == paymentContract, "Only payment contract");
        _;
    }
    
    modifier onlyAuthorizedMerchant(uint256 merchantId) {
        require(authorizedMerchants[msg.sender], "Not authorized merchant");
        _;
    }
    
    modifier onlyDisputeResolver() {
        require(disputeResolvers[msg.sender] || msg.sender == owner(), "Not authorized resolver");
        _;
    }
    
    constructor(address _paymentContract, address _usdcToken) {
        require(_paymentContract != address(0), "Invalid payment contract");
        require(_usdcToken != address(0), "Invalid USDC token");
        
        paymentContract = _paymentContract;
        usdcToken = _usdcToken;
    }
    
    /**
     * @dev Deposit funds to escrow (called by payment contract)
     * @param paymentId Payment ID
     * @param user User address
     * @param merchantId Merchant ID
     * @param merchantWallet Merchant wallet address
     * @param amount Amount to escrow
     */
    function depositFunds(
        bytes32 paymentId,
        address user,
        uint256 merchantId,
        address merchantWallet,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(escrows[paymentId].amount == 0, "Escrow already exists");
        require(amount > 0, "Invalid amount");
        require(merchantWallet != address(0), "Invalid merchant wallet");
        
        if (msg.sender == paymentContract) {
            // Legacy flow: funds already held by payment contract
            IERC20(usdcToken).safeTransferFrom(paymentContract, address(this), amount);
        } else {
            // Direct user flow: pull funds from the caller (must match `user` arg)
            require(msg.sender == user, "Caller must match user address");
            IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), amount);
        }
        
        // Create escrow record
        escrows[paymentId] = EscrowRecord({
            paymentId: paymentId,
            user: user,
            merchantId: merchantId,
            merchantWallet: merchantWallet,
            amount: amount,
            depositTime: block.timestamp,
            confirmationTime: 0,
            status: EscrowStatus.DEPOSITED,
            disputeRaised: false,
            disputeReason: ""
        });
        
        emit FundsDeposited(paymentId, user, merchantId, amount);
    }
    
    /**
     * @dev Confirm order completion (called by merchant)
     * @param paymentId Payment ID
     */
    function confirmOrderCompletion(bytes32 paymentId) external onlyAuthorizedMerchant(escrows[paymentId].merchantId) {
        EscrowRecord storage escrow = escrows[paymentId];
        require(escrow.status == EscrowStatus.DEPOSITED, "Invalid escrow status");
        require(!escrow.disputeRaised, "Cannot confirm during dispute");
        
        escrow.status = EscrowStatus.CONFIRMED;
        escrow.confirmationTime = block.timestamp;
        
        emit OrderConfirmed(paymentId, msg.sender, block.timestamp);
        
        // Start dispute period - funds will be released after DISPUTE_PERIOD if no dispute
    }
    
    /**
     * @dev Raise a dispute (called by user)
     * @param paymentId Payment ID
     * @param reason Dispute reason
     */
    function raiseDispute(bytes32 paymentId, string calldata reason) external {
        EscrowRecord storage escrow = escrows[paymentId];
        require(msg.sender == escrow.user, "Only user can raise dispute");
        require(escrow.status == EscrowStatus.DEPOSITED || escrow.status == EscrowStatus.CONFIRMED, "Invalid status");
        require(!escrow.disputeRaised, "Dispute already raised");
        require(bytes(reason).length > 0, "Dispute reason required");
        
        // Can only raise dispute within dispute period after confirmation
        if (escrow.status == EscrowStatus.CONFIRMED) {
            require(
                block.timestamp <= escrow.confirmationTime + DISPUTE_PERIOD,
                "Dispute period expired"
            );
        }
        
        escrow.disputeRaised = true;
        escrow.disputeReason = reason;
        escrow.status = EscrowStatus.DISPUTED;
        
        emit DisputeRaised(paymentId, msg.sender, reason);
    }
    
    /**
     * @dev Resolve dispute (called by authorized resolver)
     * @param paymentId Payment ID
     * @param inFavorOfUser True if resolving in favor of user (refund), false for merchant
     */
    function resolveDispute(bytes32 paymentId, bool inFavorOfUser) external onlyDisputeResolver {
        EscrowRecord storage escrow = escrows[paymentId];
        require(escrow.status == EscrowStatus.DISPUTED, "No active dispute");
        
        if (inFavorOfUser) {
            _refundToUser(paymentId);
        } else {
            _releaseToMerchant(paymentId);
        }
        
        emit DisputeResolved(paymentId, inFavorOfUser, msg.sender);
    }
    
    /**
     * @dev Release funds after dispute period expires (anyone can call)
     * @param paymentId Payment ID
     */
    function releaseFundsAfterDispute(bytes32 paymentId) external {
        EscrowRecord storage escrow = escrows[paymentId];
        require(escrow.status == EscrowStatus.CONFIRMED, "Not confirmed");
        require(!escrow.disputeRaised, "Dispute active");
        require(
            block.timestamp > escrow.confirmationTime + DISPUTE_PERIOD,
            "Dispute period not expired"
        );
        
        _releaseToMerchant(paymentId);
    }
    
    /**
     * @dev Auto-release funds if no confirmation after long period (anyone can call)
     * @param paymentId Payment ID
     */
    function autoReleaseFunds(bytes32 paymentId) external {
        EscrowRecord storage escrow = escrows[paymentId];
        require(escrow.status == EscrowStatus.DEPOSITED, "Not in deposited status");
        require(!escrow.disputeRaised, "Dispute active");
        require(
            block.timestamp > escrow.depositTime + AUTO_RELEASE_PERIOD,
            "Auto-release period not reached"
        );
        
        _releaseToMerchant(paymentId);
        
        emit AutoReleaseExecuted(paymentId, escrow.amount);
    }
    
    /**
     * @dev Internal function to release funds to merchant
     * @param paymentId Payment ID
     */
    function _releaseToMerchant(bytes32 paymentId) internal {
        EscrowRecord storage escrow = escrows[paymentId];
        
        escrow.status = EscrowStatus.RELEASED;
        
        // Transfer USDC to merchant
        IERC20(usdcToken).safeTransfer(escrow.merchantWallet, escrow.amount);
        
        // Notify payment contract
        ICrynkPaymentContract(paymentContract).releaseFundsFromEscrow(paymentId);
        
        emit FundsReleased(paymentId, escrow.merchantWallet, escrow.amount);
    }
    
    /**
     * @dev Internal function to refund funds to user
     * @param paymentId Payment ID
     */
    function _refundToUser(bytes32 paymentId) internal {
        EscrowRecord storage escrow = escrows[paymentId];
        
        escrow.status = EscrowStatus.REFUNDED;
        
        // Transfer USDC back to user
        IERC20(usdcToken).safeTransfer(escrow.user, escrow.amount);
        
        // Notify payment contract
        ICrynkPaymentContract(paymentContract).refundFunds(paymentId);
        
        emit FundsRefunded(paymentId, escrow.user, escrow.amount);
    }
    
    /**
     * @dev Admin function to add/remove authorized merchants
     * @param merchant Merchant address
     * @param authorized Authorization status
     */
    function setMerchantAuthorization(address merchant, bool authorized) external onlyOwner {
        authorizedMerchants[merchant] = authorized;
    }
    
    /**
     * @dev Admin function to add/remove dispute resolvers
     * @param resolver Resolver address
     * @param authorized Authorization status
     */
    function setDisputeResolver(address resolver, bool authorized) external onlyOwner {
        disputeResolvers[resolver] = authorized;
    }
    
    /**
     * @dev Update payment contract address (owner only)
     * @param newPaymentContract New payment contract address
     */
    function updatePaymentContract(address newPaymentContract) external onlyOwner {
        require(newPaymentContract != address(0), "Invalid address");
        paymentContract = newPaymentContract;
    }
    
    /**
     * @dev Get escrow details
     * @param paymentId Payment ID
     * @return Escrow record
     */
    function getEscrow(bytes32 paymentId) external view returns (EscrowRecord memory) {
        return escrows[paymentId];
    }
    
    /**
     * @dev Check if dispute period is active
     * @param paymentId Payment ID
     * @return True if dispute can be raised
     */
    function canRaiseDispute(bytes32 paymentId) external view returns (bool) {
        EscrowRecord memory escrow = escrows[paymentId];
        
        if (escrow.disputeRaised) return false;
        if (escrow.status == EscrowStatus.DEPOSITED) return true;
        if (escrow.status == EscrowStatus.CONFIRMED) {
            return block.timestamp <= escrow.confirmationTime + DISPUTE_PERIOD;
        }
        
        return false;
    }
    
    /**
     * @dev Emergency pause/unpause
     */
    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }
    
    /**
     * @dev Emergency fund recovery (owner only, only if contract is paused)
     * @param token Token address
     * @param amount Amount to recover
     */
    function emergencyRecovery(address token, uint256 amount) external onlyOwner whenPaused {
        IERC20(token).safeTransfer(owner(), amount);
    }
} 