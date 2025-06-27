// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CrynkPaymentSplitter
 * @dev Smart contract for splitting payments in a single transaction
 * Users send total payment amount, contract automatically splits between platform fee and merchant
 * Supports both USDC and ETH payments
 */
contract CrynkPaymentSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // USDC contract address (for current network)
    address public usdcAddress;
    
    // Platform fee wallet (receives platform fees)
    address public feeWallet;
    
    // Platform fee rate (100 = 1%, 10000 = 100%)
    uint256 public platformFeeRate = 100; // 1%
    
    // Events
    event PaymentSplit(
        bytes32 indexed paymentId,
        address indexed user,
        address indexed merchant,
        uint256 totalAmount,
        uint256 platformFee,
        uint256 merchantAmount,
        string paymentType // "USDC" or "ETH"
    );
    
    event ETHPaymentReceived(
        bytes32 indexed paymentId,
        address indexed user,
        address indexed merchant,
        uint256 ethAmount,
        uint256 platformFeeETH,
        uint256 merchantAmountETH
    );
    
    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event PlatformFeeRateUpdated(uint256 oldRate, uint256 newRate);
    event USDCAddressUpdated(address indexed oldAddress, address indexed newAddress);

    struct Payment {
        bytes32 id;
        address user;
        address merchant;
        uint256 totalAmount;
        uint256 platformFee;
        uint256 merchantAmount;
        uint256 timestamp;
        bool completed;
        string paymentType;
    }

    // Mapping of payment ID to payment details
    mapping(bytes32 => Payment) public payments;

    constructor(address _feeWallet, address _usdcAddress) {
        require(_feeWallet != address(0), "Fee wallet cannot be zero address");
        require(_usdcAddress != address(0), "USDC address cannot be zero address");
        feeWallet = _feeWallet;
        usdcAddress = _usdcAddress;
    }

    /**
     * @dev Split USDC payment in a single transaction
     * @param paymentId Unique identifier for the payment
     * @param merchant Address to receive the merchant portion
     * @param totalAmount Total amount to be split (in USDC units)
     */
    function splitPayment(
        bytes32 paymentId,
        address merchant,
        uint256 totalAmount
    ) external nonReentrant {
        require(merchant != address(0), "Merchant address cannot be zero");
        require(totalAmount > 0, "Amount must be greater than zero");
        require(!payments[paymentId].completed, "Payment already completed");

        IERC20 usdc = IERC20(usdcAddress);
        
        // Check user has sufficient balance
        require(
            usdc.balanceOf(msg.sender) >= totalAmount,
            "Insufficient USDC balance"
        );

        // Calculate platform fee and merchant amount
        uint256 platformFee = (totalAmount * platformFeeRate) / 10000;
        uint256 merchantAmount = totalAmount - platformFee;

        // Store payment details
        payments[paymentId] = Payment({
            id: paymentId,
            user: msg.sender,
            merchant: merchant,
            totalAmount: totalAmount,
            platformFee: platformFee,
            merchantAmount: merchantAmount,
            timestamp: block.timestamp,
            completed: true,
            paymentType: "USDC"
        });

        // Transfer platform fee to fee wallet
        if (platformFee > 0) {
            usdc.safeTransferFrom(msg.sender, feeWallet, platformFee);
        }

        // Transfer merchant amount to merchant
        if (merchantAmount > 0) {
            usdc.safeTransferFrom(msg.sender, merchant, merchantAmount);
        }

        emit PaymentSplit(
            paymentId,
            msg.sender,
            merchant,
            totalAmount,
            platformFee,
            merchantAmount,
            "USDC"
        );
    }

    /**
     * @dev Split USDC payment with fixed fee amounts (no percentage calculation)
     * @param paymentId Unique identifier for the payment
     * @param merchant Address to receive the merchant portion
     * @param merchantAmount Exact amount to send to merchant (in USDC units)
     * @param platformFeeAmount Exact amount to send as platform fee (in USDC units)
     */
    function splitPaymentFixed(
        bytes32 paymentId,
        address merchant,
        uint256 merchantAmount,
        uint256 platformFeeAmount
    ) external nonReentrant {
        require(merchant != address(0), "Merchant address cannot be zero");
        require(merchantAmount > 0, "Merchant amount must be greater than zero");
        require(platformFeeAmount > 0, "Platform fee must be greater than zero");
        require(!payments[paymentId].completed, "Payment already completed");

        uint256 totalAmount = merchantAmount + platformFeeAmount;
        IERC20 usdc = IERC20(usdcAddress);
        
        // Check user has sufficient balance
        require(
            usdc.balanceOf(msg.sender) >= totalAmount,
            "Insufficient USDC balance"
        );

        // Store payment details
        payments[paymentId] = Payment({
            id: paymentId,
            user: msg.sender,
            merchant: merchant,
            totalAmount: totalAmount,
            platformFee: platformFeeAmount,
            merchantAmount: merchantAmount,
            timestamp: block.timestamp,
            completed: true,
            paymentType: "USDC"
        });

        // Transfer platform fee to fee wallet
        usdc.safeTransferFrom(msg.sender, feeWallet, platformFeeAmount);

        // Transfer merchant amount to merchant
        usdc.safeTransferFrom(msg.sender, merchant, merchantAmount);

        emit PaymentSplit(
            paymentId,
            msg.sender,
            merchant,
            totalAmount,
            platformFeeAmount,
            merchantAmount,
            "USDC"
        );
    }

    /**
     * @dev Split ETH payment - accepts ETH and splits it directly
     * @param paymentId Unique identifier for the payment
     * @param merchant Address to receive the merchant portion
     */
    function splitETHPayment(
        bytes32 paymentId,
        address payable merchant
    ) external payable nonReentrant {
        require(merchant != address(0), "Merchant address cannot be zero");
        require(msg.value > 0, "ETH amount must be greater than zero");
        require(!payments[paymentId].completed, "Payment already completed");

        uint256 totalAmount = msg.value;
        
        // Calculate platform fee and merchant amount
        uint256 platformFee = (totalAmount * platformFeeRate) / 10000;
        uint256 merchantAmount = totalAmount - platformFee;

        // Store payment details
        payments[paymentId] = Payment({
            id: paymentId,
            user: msg.sender,
            merchant: merchant,
            totalAmount: totalAmount,
            platformFee: platformFee,
            merchantAmount: merchantAmount,
            timestamp: block.timestamp,
            completed: true,
            paymentType: "ETH"
        });

        // Transfer platform fee to fee wallet
        if (platformFee > 0) {
            (bool feeSuccess, ) = payable(feeWallet).call{value: platformFee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        // Transfer merchant amount to merchant
        if (merchantAmount > 0) {
            (bool merchantSuccess, ) = merchant.call{value: merchantAmount}("");
            require(merchantSuccess, "Merchant transfer failed");
        }

        emit PaymentSplit(
            paymentId,
            msg.sender,
            merchant,
            totalAmount,
            platformFee,
            merchantAmount,
            "ETH"
        );

        emit ETHPaymentReceived(
            paymentId,
            msg.sender,
            merchant,
            totalAmount,
            platformFee,
            merchantAmount
        );
    }

    /**
     * @dev Fallback function to handle ETH payments with default merchant
     * This allows simple ETH sends to the contract
     */
    receive() external payable {
        // For demo purposes, if someone just sends ETH without calling splitETHPayment,
        // we'll treat it as a payment with the fee wallet as the merchant
        bytes32 defaultPaymentId = keccak256(abi.encodePacked(block.timestamp, msg.sender, msg.value));
        
        uint256 totalAmount = msg.value;
        uint256 platformFee = (totalAmount * platformFeeRate) / 10000;
        uint256 merchantAmount = totalAmount - platformFee;

        // Store payment details with fee wallet as merchant
        payments[defaultPaymentId] = Payment({
            id: defaultPaymentId,
            user: msg.sender,
            merchant: feeWallet,
            totalAmount: totalAmount,
            platformFee: platformFee,
            merchantAmount: merchantAmount,
            timestamp: block.timestamp,
            completed: true,
            paymentType: "ETH"
        });

        // All funds go to fee wallet in this case
        (bool success, ) = payable(feeWallet).call{value: totalAmount}("");
        require(success, "Transfer failed");

        emit PaymentSplit(
            defaultPaymentId,
            msg.sender,
            feeWallet,
            totalAmount,
            platformFee,
            merchantAmount,
            "ETH"
        );
    }

    /**
     * @dev Handle incoming USDC transfers from Squid Router
     * This function will be called when USDC is sent to this contract
     * We need to monitor for USDC transfers and auto-split them
     */
    function handleSquidUSDCTransfer(
        bytes32 paymentId,
        address merchant,
        uint256 usdcAmount
    ) external {
        require(usdcAmount > 0, "USDC amount must be greater than zero");
        require(merchant != address(0), "Merchant address cannot be zero");

        IERC20 usdc = IERC20(usdcAddress);
        
        // Verify this contract received the USDC
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient USDC received");

        // Calculate platform fee and merchant amount
        uint256 platformFee = (usdcAmount * platformFeeRate) / 10000;
        uint256 merchantAmount = usdcAmount - platformFee;

        // Store payment details
        payments[paymentId] = Payment({
            id: paymentId,
            user: msg.sender,
            merchant: merchant,
            totalAmount: usdcAmount,
            platformFee: platformFee,
            merchantAmount: merchantAmount,
            timestamp: block.timestamp,
            completed: true,
            paymentType: "USDC"
        });

        // Transfer platform fee to fee wallet
        if (platformFee > 0) {
            usdc.transfer(feeWallet, platformFee);
        }

        // Transfer merchant amount to merchant
        if (merchantAmount > 0) {
            usdc.transfer(merchant, merchantAmount);
        }

        emit PaymentSplit(
            paymentId,
            msg.sender,
            merchant,
            usdcAmount,
            platformFee,
            merchantAmount,
            "USDC"
        );
    }

    /**
     * @dev Get payment details
     * @param paymentId Payment ID to query
     */
    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    /**
     * @dev Update fee wallet (only owner)
     * @param _newFeeWallet New fee wallet address
     */
    function updateFeeWallet(address _newFeeWallet) external onlyOwner {
        require(_newFeeWallet != address(0), "Fee wallet cannot be zero address");
        address oldWallet = feeWallet;
        feeWallet = _newFeeWallet;
        emit FeeWalletUpdated(oldWallet, _newFeeWallet);
    }

    /**
     * @dev Update USDC address (only owner)
     * @param _newUSDCAddress New USDC contract address
     */
    function updateUSDCAddress(address _newUSDCAddress) external onlyOwner {
        require(_newUSDCAddress != address(0), "USDC address cannot be zero address");
        address oldAddress = usdcAddress;
        usdcAddress = _newUSDCAddress;
        emit USDCAddressUpdated(oldAddress, _newUSDCAddress);
    }

    /**
     * @dev Update platform fee rate (only owner)
     * @param _newRate New fee rate (100 = 1%, 10000 = 100%)
     */
    function updatePlatformFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 1000, "Fee rate cannot exceed 10%"); // Max 10%
        uint256 oldRate = platformFeeRate;
        platformFeeRate = _newRate;
        emit PlatformFeeRateUpdated(oldRate, _newRate);
    }

    /**
     * @dev Calculate fee breakdown for a given amount
     * @param totalAmount Total payment amount
     */
    function calculateFees(uint256 totalAmount) external view returns (uint256 platformFee, uint256 merchantAmount) {
        platformFee = (totalAmount * platformFeeRate) / 10000;
        merchantAmount = totalAmount - platformFee;
    }
} 