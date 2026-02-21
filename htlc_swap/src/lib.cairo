use starknet::ContractAddress;

#[starknet::interface]
pub trait IHTLC<TContractState> {
    fn fund(
        ref self: TContractState,
        receiver: ContractAddress,
        hashlock: felt252,
        timelock: u64,
        token: ContractAddress,
        amount: u256
    );
    fn withdraw(ref self: TContractState, preimage: felt252);
    fn refund(ref self: TContractState);
    
    // Getters
    fn get_sender(self: @TContractState) -> ContractAddress;
    fn get_receiver(self: @TContractState) -> ContractAddress;
    fn get_amount(self: @TContractState) -> u256;
    fn get_hashlock(self: @TContractState) -> felt252;
    fn get_timelock(self: @TContractState) -> u64;
    fn is_withdrawn(self: @TContractState) -> bool;
    fn is_refunded(self: @TContractState) -> bool;
}

#[starknet::contract]
mod HTLC {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use core::poseidon::poseidon_hash_span;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {
        sender: ContractAddress,
        receiver: ContractAddress,
        amount: u256,
        hashlock: felt252,
        timelock: u64,
        token: ContractAddress,
        withdrawn: bool,
        refunded: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Funded: Funded,
        Withdrawn: Withdrawn,
        Refunded: Refunded,
    }

    #[derive(Drop, starknet::Event)]
    struct Funded { 
        sender: ContractAddress, 
        receiver: ContractAddress, 
        amount: u256, 
        hashlock: felt252, 
        timelock: u64 
    }
    #[derive(Drop, starknet::Event)]
    struct Withdrawn { receiver: ContractAddress, preimage: felt252 }
    #[derive(Drop, starknet::Event)]
    struct Refunded { sender: ContractAddress }

    #[abi(embed_v0)]
    impl HTLCImpl of super::IHTLC<ContractState> {
        fn fund(
            ref self: ContractState,
            receiver: ContractAddress,
            hashlock: felt252,
            timelock: u64,
            token: ContractAddress,
            amount: u256
        ) {
            assert(amount > 0, 'Amount must be > 0');
            assert(timelock > get_block_timestamp(), 'Timelock must be in future');
            
            let caller = get_caller_address();
            
            // Transfer funds from sender to this contract
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(caller, get_contract_address(), amount);

            self.sender.write(caller);
            self.receiver.write(receiver);
            self.amount.write(amount);
            self.hashlock.write(hashlock);
            self.timelock.write(timelock);
            self.token.write(token);
            self.withdrawn.write(false);
            self.refunded.write(false);

            self.emit(Funded { sender: caller, receiver, amount, hashlock, timelock });
        }

        fn withdraw(ref self: ContractState, preimage: felt252) {
            assert(!self.withdrawn.read(), 'Already withdrawn');
            assert(!self.refunded.read(), 'Already refunded');
            
            // Verify hashlock
            let hash = poseidon_hash_span(array![preimage].span());
            assert(hash == self.hashlock.read(), 'Invalid preimage');
            
            self.withdrawn.write(true);
            
            // Transfer funds to receiver
            let receiver = self.receiver.read();
            let amount = self.amount.read();
            let token = self.token.read();
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(receiver, amount);

            self.emit(Withdrawn { receiver, preimage });
        }

        fn refund(ref self: ContractState) {
            assert(!self.withdrawn.read(), 'Already withdrawn');
            assert(!self.refunded.read(), 'Already refunded');
            assert(get_block_timestamp() >= self.timelock.read(), 'Timelock not expired');
            
            let sender = self.sender.read();
            assert(get_caller_address() == sender, 'Not sender');
            
            self.refunded.write(true);
            
            // Transfer funds back to sender
            let amount = self.amount.read();
            let token = self.token.read();
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(sender, amount);

            self.emit(Refunded { sender });
        }

        fn get_sender(self: @ContractState) -> ContractAddress { self.sender.read() }
        fn get_receiver(self: @ContractState) -> ContractAddress { self.receiver.read() }
        fn get_amount(self: @ContractState) -> u256 { self.amount.read() }
        fn get_hashlock(self: @ContractState) -> felt252 { self.hashlock.read() }
        fn get_timelock(self: @ContractState) -> u64 { self.timelock.read() }
        fn is_withdrawn(self: @ContractState) -> bool { self.withdrawn.read() }
        fn is_refunded(self: @ContractState) -> bool { self.refunded.read() }
    }
}
