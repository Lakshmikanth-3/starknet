/// Bitcoin block header store.
/// A trusted relayer (backend) posts Bitcoin Signet block headers here.
/// The vault uses this to get the Merkle root for SPV proof verification.

#[starknet::interface]
trait IHeaderStore<TContractState> {
    /// Store a block header's merkle root, indexed by block height.
    /// Only the relayer account can call this.
    fn store_header(ref self: TContractState, height: u64, merkle_root: [u32; 8]);

    /// Get the stored merkle root for a given block height.
    /// Panics if the header has not been stored.
    fn get_merkle_root(self: @TContractState, height: u64) -> [u32; 8];

    /// Returns true if a header at this height has been stored.
    fn is_header_stored(self: @TContractState, height: u64) -> bool;

    /// Returns the address of the authorized relayer.
    fn get_relayer(self: @TContractState) -> starknet::ContractAddress;
}

#[starknet::contract]
mod HeaderStore {
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::{ContractAddress, get_caller_address};

    /// We store each merkle root as 8 separate u32 slots because Cairo storage
    /// doesn't support fixed-size arrays as map values directly yet.
    /// Key: (height, word_index) → u32
    #[storage]
    struct Storage {
        relayer: ContractAddress,
        // merkle root words: height → word_0..word_7
        merkle_w0: Map<u64, u32>,
        merkle_w1: Map<u64, u32>,
        merkle_w2: Map<u64, u32>,
        merkle_w3: Map<u64, u32>,
        merkle_w4: Map<u64, u32>,
        merkle_w5: Map<u64, u32>,
        merkle_w6: Map<u64, u32>,
        merkle_w7: Map<u64, u32>,
        stored: Map<u64, bool>,
        latest_height: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        HeaderStored: HeaderStored,
    }

    #[derive(Drop, starknet::Event)]
    struct HeaderStored {
        #[key]
        height: u64,
        merkle_root_w0: u32,
        merkle_root_w7: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState, relayer: ContractAddress) {
        self.relayer.write(relayer);
        self.latest_height.write(0);
    }

    #[abi(embed_v0)]
    impl HeaderStoreImpl of super::IHeaderStore<ContractState> {
        fn store_header(ref self: ContractState, height: u64, merkle_root: [u32; 8]) {
            // Only authorized relayer
            let caller = get_caller_address();
            assert(caller == self.relayer.read(), 'Only relayer can store headers');

            let s = merkle_root.span();
            self.merkle_w0.write(height, *s[0]);
            self.merkle_w1.write(height, *s[1]);
            self.merkle_w2.write(height, *s[2]);
            self.merkle_w3.write(height, *s[3]);
            self.merkle_w4.write(height, *s[4]);
            self.merkle_w5.write(height, *s[5]);
            self.merkle_w6.write(height, *s[6]);
            self.merkle_w7.write(height, *s[7]);
            self.stored.write(height, true);

            if height > self.latest_height.read() {
                self.latest_height.write(height);
            }

            self.emit(HeaderStored { height, merkle_root_w0: *s[0], merkle_root_w7: *s[7] });
        }

        fn get_merkle_root(self: @ContractState, height: u64) -> [u32; 8] {
            assert(self.stored.read(height), 'Header not stored for height');
            [
                self.merkle_w0.read(height),
                self.merkle_w1.read(height),
                self.merkle_w2.read(height),
                self.merkle_w3.read(height),
                self.merkle_w4.read(height),
                self.merkle_w5.read(height),
                self.merkle_w6.read(height),
                self.merkle_w7.read(height),
            ]
        }

        fn is_header_stored(self: @ContractState, height: u64) -> bool {
            self.stored.read(height)
        }

        fn get_relayer(self: @ContractState) -> ContractAddress {
            self.relayer.read()
        }
    }
}
