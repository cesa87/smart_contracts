// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract CrynkPaymentContract is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant PLATFORM_FEE_RATE = 100; // 1% (basis points)
    uint256 public constant BASIS_POINTS = 10000;
    address public constant USDC_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // Mainnet USDC
    
    // State variables
    address public feeWallet;
    address public escrowContract;
    uint256 public totalPaymentsProcessed;
    
    // Mappings
    mapping(address => mapping(address => uint256)) public delegatedAllowances; // user => delegate => amount
    mapping(bytes32 => Payment) public payments;
    mapping(uint256 => bool) public validMerchants;
    mapping(address => bool) public authorizedDelegates;
    
    // Structs
    struct Payment {
        bytes32 id;
        address user;
        uint256 merchantId;
        uint256 totalAmount;
        uint256 platformFee;
        PaymentStatus status;
        uint256 timestamp;
        TokenPayment[] tokenPayments;
    }
    
    struct TokenPayment {
        address token;
        uint256 amount;
        bool processed;
    }
    
    struct SwapParams {
        address fromToken;
        uint256 fromAmount;
        address toToken;
        bytes swapData;
        uint256 minAmountOut;
    }
    
    enum PaymentStatus {
        INITIATED,
        FUNDS_PULLED,
        SWAPPED,
        ESCROWED,
        COMPLETED,
        REFUNDED,
        FAILED
    }
    
    // Events
    event AllowanceDelegated(address indexed user, address indexed delegate, uint256 amount);
    event AllowanceRevoked(address indexed user, address indexed delegate);
    event PaymentInitiated(bytes32 indexed paymentId, address indexed user, uint256 merchantId, uint256 totalAmount);
    event FundsPulled(bytes32 indexed paymentId, address indexed user, uint256 totalAmount);
    event TokensSwapped(bytes32 indexed paymentId, address fromToken, address toToken, uint256 amountIn, uint256 amountOut);
    event FundsEscrowed(bytes32 indexed paymentId, uint256 amount);
    event PaymentCompleted(bytes32 indexed paymentId, address indexed merchant, uint256 amount);
    event PaymentRefunded(bytes32 indexed paymentId, address indexed user, uint256 amount);
    event MerchantStatusUpdated(uint256 indexed merchantId, bool status);
    
    // Modifiers
    modifier onlyAuthorizedDelegate() {
        require(authorizedDelegates[msg.sender] || msg.sender == owner(), "Not authorized delegate");
        _;
    }
    
    modifier validMerchant(uint256 merchantId) {
        require(validMerchants[merchantId], "Invalid merchant");
        _;
    }
    
    constructor(address _feeWallet, address _escrowContract) {
        require(_feeWallet != address(0), "Invalid fee wallet");
        require(_escrowContract != address(0), "Invalid escrow contract");
        
        feeWallet = _feeWallet;
        escrowContract = _escrowContract;
        
        // Authorize contract itself as delegate
        authorizedDelegates[address(this)] = true;
    }
    
    /**
     * @dev Delegate allowance to a contract or address
     * @param delegateContract Address to delegate allowance to
     * @param allowanceAmount Maximum amount that can be pulled
     */
    function delegateAllowance(address delegateContract, uint256 allowanceAmount) external {
        require(delegateContract != address(0), "Invalid delegate");
        require(allowanceAmount > 0, "Invalid allowance amount");
        
        delegatedAllowances[msg.sender][delegateContract] = allowanceAmount;
        
        emit AllowanceDelegated(msg.sender, delegateContract, allowanceAmount);
    }
    
    /**
     * @dev Revoke previously granted allowance
     */
    function revokeAllowance(address delegateContract) external {
        require(delegatedAllowances[msg.sender][delegateContract] > 0, "No allowance to revoke");
        
        delegatedAllowances[msg.sender][delegateContract] = 0;
        
        emit AllowanceRevoked(msg.sender, delegateContract);
    }
    
    /**
     * @dev Initiate a payment with multiple tokens
     * @param merchantId Target merchant ID
     * @param totalOrderAmount Total order amount in USD (18 decimals)
     * @param tokenAddresses Array of token addresses to pay with
     * @param tokenAmounts Array of amounts for each token
     */
    function initiatePayment(
        uint256 merchantId,
        uint256 totalOrderAmount,
        address[] calldata tokenAddresses,
        uint256[] calldata tokenAmounts
    ) external nonReentrant whenNotPaused validMerchant(merchantId) {
        require(totalOrderAmount > 0, "Invalid order amount");
        require(tokenAddresses.length == tokenAmounts.length, "Array length mismatch");
        require(tokenAddresses.length > 0, "No tokens specified");
        
        bytes32 paymentId = keccak256(abi.encodePacked(msg.sender, merchantId, totalOrderAmount, block.timestamp));
        
        // Verify delegated allowances cover the total amount
        uint256 totalRequired = calculateTotalWithFees(totalOrderAmount);
        require(delegatedAllowances[msg.sender][address(this)] >= totalRequired, "Insufficient delegated allowance");
        
        // Create payment record
        Payment storage payment = payments[paymentId];
        payment.id = paymentId;
        payment.user = msg.sender;
        payment.merchantId = merchantId;
        payment.totalAmount = totalOrderAmount;
        payment.platformFee = (totalOrderAmount * PLATFORM_FEE_RATE) / BASIS_POINTS;
        payment.status = PaymentStatus.INITIATED;
        payment.timestamp = block.timestamp;
        
        // Store token payment details
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            require(tokenAmounts[i] > 0, "Invalid token amount");
            payment.tokenPayments.push(TokenPayment({
                token: tokenAddresses[i],
                amount: tokenAmounts[i],
                processed: false
            }));
        }
        
        totalPaymentsProcessed++;
        
        emit PaymentInitiated(paymentId, msg.sender, merchantId, totalOrderAmount);
    }
    
    /**
     * @dev Calculate platform fee for given amount
     * @param orderAmount Order amount to calculate fee for
     * @return Platform fee amount
     */
    function calculateFees(uint256 orderAmount) external pure returns (uint256) {
        return (orderAmount * PLATFORM_FEE_RATE) / BASIS_POINTS;
    }
    
    /**
     * @dev Pull funds from user's wallet using delegation
     * @param paymentId Payment ID to pull funds for
     */
    function pullFunds(bytes32 paymentId) external onlyAuthorizedDelegate nonReentrant {
        Payment storage payment = payments[paymentId];
        require(payment.status == PaymentStatus.INITIATED, "Invalid payment status");
        
        // Verify allowance is still sufficient
        uint256 totalRequired = calculateTotalWithFees(payment.totalAmount);
        require(delegatedAllowances[payment.user][address(this)] >= totalRequired, "Insufficient allowance");
        
        // Pull platform fee to fee wallet
        if (payment.platformFee > 0) {
            // Assuming first token payment covers platform fee for simplicity
            // In production, this should be more sophisticated
            address feeToken = payment.tokenPayments[0].token;
            
            // Convert platform fee from 18 decimals (USD) to token decimals
            // For USDC (6 decimals): divide by 10^12
            uint256 feeInTokenDecimals;
            if (feeToken == USDC_ADDRESS) {
                feeInTokenDecimals = payment.platformFee / 1e12; // Convert 18 decimals to 6 decimals
            } else {
                // For other tokens, assume they use 18 decimals like ETH
                feeInTokenDecimals = payment.platformFee;
            }
            
            IERC20(feeToken).safeTransferFrom(payment.user, feeWallet, feeInTokenDecimals);
        }
        
        // Pull token amounts to contract
        for (uint256 i = 0; i < payment.tokenPayments.length; i++) {
            TokenPayment storage tokenPayment = payment.tokenPayments[i];
            IERC20(tokenPayment.token).safeTransferFrom(
                payment.user,
                address(this),
                tokenPayment.amount
            );
            tokenPayment.processed = true;
        }
        
        // Reduce delegated allowance
        delegatedAllowances[payment.user][address(this)] -= totalRequired;
        
        payment.status = PaymentStatus.FUNDS_PULLED;
        
        emit FundsPulled(paymentId, payment.user, totalRequired);
    }
    
    /**
     * @dev Swap tokens to stablecoin using external DEX (Squid integration)
     * @param paymentId Payment ID
     * @param swapParams Array of swap parameters for each token
     */
    function swapToStablecoin(
        bytes32 paymentId,
        SwapParams[] calldata swapParams
    ) external onlyAuthorizedDelegate nonReentrant {
        Payment storage payment = payments[paymentId];
        require(payment.status == PaymentStatus.FUNDS_PULLED, "Invalid payment status");
        
        uint256 totalUSDCReceived = 0;
        
        for (uint256 i = 0; i < swapParams.length; i++) {
            SwapParams memory params = swapParams[i];
            
            // Verify we have the tokens to swap
            uint256 balance = IERC20(params.fromToken).balanceOf(address(this));
            require(balance >= params.fromAmount, "Insufficient token balance");
            
            // If already USDC, skip swap
            if (params.fromToken == USDC_ADDRESS) {
                totalUSDCReceived += params.fromAmount;
                continue;
            }
            
            // Approve spending for swap
            IERC20(params.fromToken).safeApprove(address(this), params.fromAmount);
            
            // Execute swap through external DEX (placeholder for Squid integration)
            uint256 usdcReceived = _executeSwap(params);
            require(usdcReceived >= params.minAmountOut, "Slippage too high");
            
            totalUSDCReceived += usdcReceived;
            
            emit TokensSwapped(paymentId, params.fromToken, USDC_ADDRESS, params.fromAmount, usdcReceived);
        }
        
        payment.status = PaymentStatus.SWAPPED;
    }
    
    /**
     * @dev Deposit swapped USDC to escrow contract
     * @param paymentId Payment ID
     */
    function depositToEscrow(bytes32 paymentId) external onlyAuthorizedDelegate nonReentrant {
        Payment storage payment = payments[paymentId];
        require(payment.status == PaymentStatus.SWAPPED, "Invalid payment status");
        
        uint256 usdcBalance = IERC20(USDC_ADDRESS).balanceOf(address(this));
        require(usdcBalance >= payment.totalAmount, "Insufficient USDC balance");
        
        // Transfer to escrow contract
        IERC20(USDC_ADDRESS).safeTransfer(escrowContract, payment.totalAmount);
        
        payment.status = PaymentStatus.ESCROWED;
        
        emit FundsEscrowed(paymentId, payment.totalAmount);
    }
    
    /**
     * @dev Release funds from escrow to merchant (called by escrow contract)
     * @param paymentId Payment ID
     */
    function releaseFundsFromEscrow(bytes32 paymentId) external {
        require(msg.sender == escrowContract, "Only escrow contract");
        
        Payment storage payment = payments[paymentId];
        require(payment.status == PaymentStatus.ESCROWED, "Invalid payment status");
        
        payment.status = PaymentStatus.COMPLETED;
        
        emit PaymentCompleted(paymentId, address(uint160(payment.merchantId)), payment.totalAmount);
    }
    
    /**
     * @dev Refund payment to user (called by escrow contract)
     * @param paymentId Payment ID
     */
    function refundFunds(bytes32 paymentId) external {
        require(msg.sender == escrowContract, "Only escrow contract");
        
        Payment storage payment = payments[paymentId];
        require(payment.status == PaymentStatus.ESCROWED, "Invalid payment status");
        
        payment.status = PaymentStatus.REFUNDED;
        
        emit PaymentRefunded(paymentId, payment.user, payment.totalAmount);
    }
    
    /**
     * @dev Add or remove merchant from valid merchants list
     * @param merchantId Merchant ID
     * @param status Valid status
     */
    function updateMerchantStatus(uint256 merchantId, bool status) external onlyOwner {
        validMerchants[merchantId] = status;
        emit MerchantStatusUpdated(merchantId, status);
    }
    
    /**
     * @dev Set authorized delegate status
     * @param delegate Address to authorize/unauthorize
     * @param status Authorization status
     */
    function setAuthorizedDelegate(address delegate, bool status) external onlyOwner {
        authorizedDelegates[delegate] = status;
    }
    
    /**
     * @dev Update fee wallet address
     * @param newFeeWallet New fee wallet address
     */
    function updateFeeWallet(address newFeeWallet) external onlyOwner {
        require(newFeeWallet != address(0), "Invalid fee wallet");
        feeWallet = newFeeWallet;
    }
    
    /**
     * @dev Update escrow contract address
     * @param newEscrowContract New escrow contract address
     */
    function updateEscrowContract(address newEscrowContract) external onlyOwner {
        require(newEscrowContract != address(0), "Invalid escrow contract");
        escrowContract = newEscrowContract;
    }
    
    /**
     * @dev Emergency pause/unpause contract
     */
    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }
    
    /**
     * @dev Get payment details
     * @param paymentId Payment ID
     * @return Payment struct
     */
    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }
    
    /**
     * @dev Get delegated allowance
     * @param user User address
     * @param delegate Delegate address
     * @return Allowance amount
     */
    function getDelegatedAllowance(address user, address delegate) external view returns (uint256) {
        return delegatedAllowances[user][delegate];
    }
    
    /**
     * @dev Calculate total amount with fees
     * @param orderAmount Base order amount
     * @return Total amount including fees
     */
    function calculateTotalWithFees(uint256 orderAmount) public pure returns (uint256) {
        uint256 platformFee = (orderAmount * PLATFORM_FEE_RATE) / BASIS_POINTS;
        return orderAmount + platformFee;
    }
    
    /**
     * @dev Internal function to execute token swap (placeholder for Squid integration)
     * @param params Swap parameters
     * @return Amount of USDC received
     */
    function _executeSwap(SwapParams memory params) internal returns (uint256) {
        // This is a placeholder - in production, this would integrate with Squid Router
        // For now, return a mock amount
        return params.fromAmount; // 1:1 mock swap
    }
    
    /**
     * @dev Emergency token withdrawal (owner only)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
} 