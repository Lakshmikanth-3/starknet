#[starknet::interface]
trait IPrivateBTCVault<TContractState> {
    fn deposit(ref self: TContractState, amount: u256, commitment: felt252);
    fn withdraw(ref self: TContractState, nullifier: felt252, proof: Span<felt252>, recipient: starknet::ContractAddress, amount: u256);
    fn get_total_staked(self: @TContractState) -> u256;
}

#[starknet::contract]
mod PrivateBTCVault {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::get_caller_address;
    use starknet::get_contract_address;

    // IERC20 Interface for interaction
    #[starknet::interface]
    trait IERC20<TState> {
        fn transfer(ref self: TState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    }

    #[storage]
    struct Storage {
        btc_token: ContractAddress,
        commitments: Map<felt252, bool>,
        nullifiers: Map<felt252, bool>,
        total_assets: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Deposit: Deposit,
        Withdrawal: Withdrawal,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        commitment: felt252,
        amount: u256
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawal {
        #[key]
        nullifier: felt252,
        recipient: ContractAddress,
        amount: u256
    }

    #[constructor]
    fn constructor(ref self: ContractState, btc_token: ContractAddress) {
        self.btc_token.write(btc_token);
    }

    #[abi(embed_v0)]
    impl PrivateBTCVaultImpl of super::IPrivateBTCVault<ContractState> {
        fn deposit(ref self: ContractState, amount: u256, commitment: felt252) {
            let caller = get_caller_address();
            let this_contract = get_contract_address();
            let token_address = self.btc_token.read();

            // 1. Transfer BTC from user to Vault
            // Requires user to have called `approve` on the token contract first!
            let success = IERC20Dispatcher { contract_address: token_address }.transfer_from(caller, this_contract, amount);
            assert(success, 'Transfer failed');
            
            // 2. Check if commitment already exists
            assert(!self.commitments.read(commitment), 'Commitment already exists');

            // 3. Store commitment
            self.commitments.write(commitment, true);
            
            // 4. Update total assets
            let current_total = self.total_assets.read();
            self.total_assets.write(current_total + amount);

            self.emit(Deposit { commitment, amount });
        }

        fn withdraw(ref self: ContractState, nullifier: felt252, proof: Span<felt252>, recipient: ContractAddress, amount: u256) {
            // 1. Verify Nullifier has not been used
            assert(!self.nullifiers.read(nullifier), 'Nullifier already used');

            // 2. Verify ZK Proof (Simulated for Hackathon MVP)
            // 
            // PRIVACY TRACK IMPLEMENTATION NOTE:
            // In the production version, this function will call the Starknet OS Verifier 
            // or a custom ZK-STARK verifier contract to validate the proof against public inputs.
            // 
            // Future Logic:
            // let public_inputs = array![commitment, nullifier, amount, recipient];
            // IVerifierDispatcher { contract_address: ... }.verify_proof(proof, public_inputs);
            //
            assert(proof.len() > 0, 'Invalid proof length');

            // 3. Mark nullifier as used
            self.nullifiers.write(nullifier, true);

            // 4. Update assets and check balance
            let current_total = self.total_assets.read();
            assert(current_total >= amount, 'Insufficient vault funds');
            self.total_assets.write(current_total - amount);

            // 5. Transfer BTC to recipient
            let token_address = self.btc_token.read();
            let success = IERC20Dispatcher { contract_address: token_address }.transfer(recipient, amount);
            assert(success, 'Transfer failed');

            self.emit(Withdrawal { nullifier, recipient, amount });
        }

        fn get_total_staked(self: @ContractState) -> u256 {
            self.total_assets.read()
        }
    }
}
