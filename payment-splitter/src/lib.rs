#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token, Address, Env, String,
    log
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub id: String,
    pub user: Address,
    pub merchant: Address,
    pub total_amount: i128,
    pub platform_fee: i128,
    pub merchant_amount: i128,
    pub timestamp: u64,
    pub completed: bool,
    pub payment_type: String,
}

#[contracttype]
pub enum DataKey {
    FeeWallet,
    PlatformFeeRate,
    TokenAddress,
    Payment(String),
    PaymentCount,
    Admin,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidMerchant = 1,
    InvalidAmount = 2,
    PaymentAlreadyCompleted = 3,
    InsufficientBalance = 4,
    Unauthorized = 5,
    InvalidFeeRate = 6,
    TransferFailed = 7,
}

#[contract]
pub struct CrynkPaymentSplitter;

#[contractimpl]
impl CrynkPaymentSplitter {
    /// Initialize the contract with fee wallet, token address, and platform fee rate
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_wallet: Address,
        token_address: Address,
        platform_fee_rate: u32, // Basis points (100 = 1%)
    ) -> Result<(), Error> {
        // Require admin to authenticate
        admin.require_auth();

        if platform_fee_rate > 10000 {
            return Err(Error::InvalidFeeRate);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeWallet, &fee_wallet);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
        env.storage().instance().set(&DataKey::PlatformFeeRate, &platform_fee_rate);
        env.storage().instance().set(&DataKey::PaymentCount, &0u64);

        log!(&env, "CrynkPaymentSplitter initialized with fee rate: {}", platform_fee_rate);
        Ok(())
    }

    /// Split payment between platform and merchant with percentage-based fee
    pub fn split_payment(
        env: Env,
        user: Address,
        payment_id: String,
        merchant: Address,
        total_amount: i128,
    ) -> Result<(), Error> {
        // Require user to authenticate for this payment
        user.require_auth();

        // Validate inputs
        if total_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Check if payment already exists
        if env.storage().temporary().has(&DataKey::Payment(payment_id.clone())) {
            return Err(Error::PaymentAlreadyCompleted);
        }

        let fee_wallet: Address = env.storage().instance().get(&DataKey::FeeWallet).unwrap();
        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let platform_fee_rate: u32 = env.storage().instance().get(&DataKey::PlatformFeeRate).unwrap();

        // Calculate amounts
        let platform_fee = (total_amount * platform_fee_rate as i128) / 10000;
        let merchant_amount = total_amount - platform_fee;

        // Get token client
        let token_client = token::Client::new(&env, &token_address);

        // Check user balance
        let user_balance = token_client.balance(&user);
        if user_balance < total_amount {
            return Err(Error::InsufficientBalance);
        }

        // Transfer platform fee to fee wallet
        if platform_fee > 0 {
            token_client.transfer(&user, &fee_wallet, &platform_fee);
        }

        // Transfer merchant amount to merchant
        if merchant_amount > 0 {
            token_client.transfer(&user, &merchant, &merchant_amount);
        }

        // Store payment record
        let payment = Payment {
            id: payment_id.clone(),
            user: user.clone(),
            merchant: merchant.clone(),
            total_amount,
            platform_fee,
            merchant_amount,
            timestamp: env.ledger().timestamp(),
            completed: true,
            payment_type: String::from_str(&env, "TOKEN"),
        };

        env.storage().temporary().set(&DataKey::Payment(payment_id.clone()), &payment);

        // Increment payment count
        let mut count: u64 = env.storage().instance().get(&DataKey::PaymentCount).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::PaymentCount, &count);

        // Emit event (log for now)
        log!(
            &env,
            "PaymentSplit: ID={}, User={}, Merchant={}, Total={}, Fee={}, MerchantAmount={}",
            payment_id,
            user,
            merchant,
            total_amount,
            platform_fee,
            merchant_amount
        );

        Ok(())
    }

    /// Split payment with fixed fee amounts (no percentage calculation)
    pub fn split_payment_fixed(
        env: Env,
        user: Address,
        payment_id: String,
        merchant: Address,
        merchant_amount: i128,
        platform_fee_amount: i128,
    ) -> Result<(), Error> {
        // Require user to authenticate for this payment
        user.require_auth();

        // Validate inputs
        if merchant_amount <= 0 || platform_fee_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Check if payment already exists
        if env.storage().temporary().has(&DataKey::Payment(payment_id.clone())) {
            return Err(Error::PaymentAlreadyCompleted);
        }

        let fee_wallet: Address = env.storage().instance().get(&DataKey::FeeWallet).unwrap();
        let token_address: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();
        let total_amount = merchant_amount + platform_fee_amount;

        // Get token client
        let token_client = token::Client::new(&env, &token_address);

        // Check user balance
        let user_balance = token_client.balance(&user);
        if user_balance < total_amount {
            return Err(Error::InsufficientBalance);
        }

        // Transfer platform fee to fee wallet
        token_client.transfer(&user, &fee_wallet, &platform_fee_amount);

        // Transfer merchant amount to merchant
        token_client.transfer(&user, &merchant, &merchant_amount);

        // Store payment record
        let payment = Payment {
            id: payment_id.clone(),
            user: user.clone(),
            merchant: merchant.clone(),
            total_amount,
            platform_fee: platform_fee_amount,
            merchant_amount,
            timestamp: env.ledger().timestamp(),
            completed: true,
            payment_type: String::from_str(&env, "TOKEN"),
        };

        env.storage().temporary().set(&DataKey::Payment(payment_id.clone()), &payment);

        // Increment payment count
        let mut count: u64 = env.storage().instance().get(&DataKey::PaymentCount).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::PaymentCount, &count);

        // Emit event (log for now)
        log!(
            &env,
            "PaymentSplitFixed: ID={}, User={}, Merchant={}, Total={}, Fee={}, MerchantAmount={}",
            payment_id,
            user,
            merchant,
            total_amount,
            platform_fee_amount,
            merchant_amount
        );

        Ok(())
    }

    /// Get payment details by ID
    pub fn get_payment(env: Env, payment_id: String) -> Option<Payment> {
        env.storage().temporary().get(&DataKey::Payment(payment_id))
    }

    /// Get total number of payments processed
    pub fn get_payment_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::PaymentCount).unwrap_or(0)
    }

    /// Update fee wallet (admin only)
    pub fn update_fee_wallet(env: Env, new_fee_wallet: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage().instance().set(&DataKey::FeeWallet, &new_fee_wallet);
        log!(&env, "Fee wallet updated to: {}", new_fee_wallet);
        Ok(())
    }

    /// Update platform fee rate (admin only)
    pub fn update_platform_fee_rate(env: Env, new_rate: u32) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        if new_rate > 10000 {
            return Err(Error::InvalidFeeRate);
        }

        env.storage().instance().set(&DataKey::PlatformFeeRate, &new_rate);
        log!(&env, "Platform fee rate updated to: {}", new_rate);
        Ok(())
    }

    /// Get current fee wallet
    pub fn get_fee_wallet(env: Env) -> Address {
        env.storage().instance().get(&DataKey::FeeWallet).unwrap()
    }

    /// Get current platform fee rate
    pub fn get_platform_fee_rate(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::PlatformFeeRate).unwrap()
    }

    /// Get current token address
    pub fn get_token_address(env: Env) -> Address {
        env.storage().instance().get(&DataKey::TokenAddress).unwrap()
    }
}

// Tests
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CrynkPaymentSplitter, ());
        let client = CrynkPaymentSplitterClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let fee_wallet = Address::generate(&env);
        let token_address = Address::generate(&env);

        client.initialize(&admin, &fee_wallet, &token_address, &100);

        assert_eq!(client.get_fee_wallet(), fee_wallet);
        assert_eq!(client.get_platform_fee_rate(), 100);
        assert_eq!(client.get_token_address(), token_address);
    }

    #[test]
    fn test_get_payment_count() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(CrynkPaymentSplitter, ());
        let client = CrynkPaymentSplitterClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let fee_wallet = Address::generate(&env);
        let token_address = Address::generate(&env);

        client.initialize(&admin, &fee_wallet, &token_address, &100);
        
        // Initial count should be 0
        assert_eq!(client.get_payment_count(), 0);
    }
} 