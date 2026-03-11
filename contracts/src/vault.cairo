/// PrivateBTCVault — SPV-gated minting with P2TR covenant deposit address.
///
/// deposit() requires a real Bitcoin SPV proof:
///   1. Looks up block's Merkle root from HeaderStore
///   2. Verifies the Bitcoin tx is included (Merkle proof)
///   3. Parses the tx output to confirm amount & destination matches
///      the covenant P2TR address (OP_1 OP_PUSH32 <tweaked_pubkey>)
///   4. Only then mints mBTC and records the ZK commitment
///
/// Using P2TR means deposits are locked in the OP_CAT covenant script —
/// the operator's hot-wallet key CANNOT spend deposited funds directly.
/// Withdrawals require the covenant tapscript to be satisfied on Bitcoin.

#[starknet::interface]
trait IPrivateBTCVault<TContractState> {
    fn deposit(
        ref self: TContractState,
        commitment: felt252,
        block_height: u64,
        tx_pos: u64,
        raw_tx: Span<u8>,
        vout_index: u32,
        merkle_proof: Span<[u32; 8]>,
    );

    fn withdraw(
        ref self: TContractState,
        nullifier: felt252,
        proof: Span<felt252>,
        recipient: starknet::ContractAddress,
        amount: u256
    );

    fn get_total_staked(self: @TContractState) -> u256;
    fn is_commitment_registered(self: @TContractState, commitment: felt252) -> bool;
}

#[starknet::contract]
mod PrivateBTCVault {
    use starknet::ContractAddress;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::get_contract_address;
    use private_btc_core::bitcoin_spv;

    // ── External contract interfaces ─────────────────────────────────────────

    #[starknet::interface]
    trait IMockBTCToken<TState> {
        fn transfer(ref self: TState, recipient: ContractAddress, amount: u256) -> bool;
        fn balance_of(self: @TState, account: ContractAddress) -> u256;
        fn mint(ref self: TState, recipient: ContractAddress, amount: u256);
    }

    #[starknet::interface]
    trait IHeaderStore<TState> {
        fn get_merkle_root(self: @TState, height: u64) -> [u32; 8];
        fn is_header_stored(self: @TState, height: u64) -> bool;
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    #[storage]
    struct Storage {
        btc_token: ContractAddress,
        header_store: ContractAddress,
        nullifiers: Map<felt252, bool>,
        commitments: Map<felt252, bool>,
        // Covenant Bitcoin P2TR tweaked x-only pubkey (32 bytes → 8 × u32 big-endian)
        // From: tb1p72dtm26yw6ez0dzddqxt50960r7nyrw2dh0622u2zkp33qskqyaqrj90m7
        // Derived by bech32m-decoding the covenant address witness program.
        vault_tapkey_w0: u32,
        vault_tapkey_w1: u32,
        vault_tapkey_w2: u32,
        vault_tapkey_w3: u32,
        vault_tapkey_w4: u32,
        vault_tapkey_w5: u32,
        vault_tapkey_w6: u32,
        vault_tapkey_w7: u32,
        // Prevent double-mint: txid stored as (hi_u128, lo_u128)
        spent_txids: Map<(u128, u128), bool>,
    }

    // ── Events ───────────────────────────────────────────────────────────────

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
        amount_sats: u64,
        block_height: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawal {
        #[key]
        nullifier: felt252,
        recipient: ContractAddress,
        amount: u256
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    #[constructor]
    fn constructor(
        ref self: ContractState,
        btc_token: ContractAddress,
        header_store: ContractAddress,
        // 32-byte covenant tweaked x-only pubkey split into 8 × u32 big-endian words
        vault_tapkey_w0: u32,
        vault_tapkey_w1: u32,
        vault_tapkey_w2: u32,
        vault_tapkey_w3: u32,
        vault_tapkey_w4: u32,
        vault_tapkey_w5: u32,
        vault_tapkey_w6: u32,
        vault_tapkey_w7: u32,
    ) {
        self.btc_token.write(btc_token);
        self.header_store.write(header_store);
        self.vault_tapkey_w0.write(vault_tapkey_w0);
        self.vault_tapkey_w1.write(vault_tapkey_w1);
        self.vault_tapkey_w2.write(vault_tapkey_w2);
        self.vault_tapkey_w3.write(vault_tapkey_w3);
        self.vault_tapkey_w4.write(vault_tapkey_w4);
        self.vault_tapkey_w5.write(vault_tapkey_w5);
        self.vault_tapkey_w6.write(vault_tapkey_w6);
        self.vault_tapkey_w7.write(vault_tapkey_w7);
    }

    // ── External ABI ─────────────────────────────────────────────────────────

    #[abi(embed_v0)]
    impl PrivateBTCVaultImpl of super::IPrivateBTCVault<ContractState> {
        fn deposit(
            ref self: ContractState,
            commitment: felt252,
            block_height: u64,
            tx_pos: u64,
            raw_tx: Span<u8>,
            vout_index: u32,
            merkle_proof: Span<[u32; 8]>,
        ) {
            // ── 1. Commitment not already registered ──────────────────────────
            assert(!self.commitments.read(commitment), 'Commitment already used');

            // ── 2. Get Merkle root from HeaderStore ───────────────────────────
            let hs = IHeaderStoreDispatcher { contract_address: self.header_store.read() };
            assert(hs.is_header_stored(block_height), 'Block header not relayed yet');
            let merkle_root = hs.get_merkle_root(block_height);

            // ── 3. Compute txid = double_sha256(raw_tx) ───────────────────────
            let txid = bitcoin_spv::double_sha256(raw_tx);

            // ── 4. Prevent double-mint: check txid not spent ──────────────────
            let txid_span = txid.span();
            let txid_hi: u128 = InternalImpl::pack_u128(*txid_span[0], *txid_span[1], *txid_span[2], *txid_span[3]);
            let txid_lo: u128 = InternalImpl::pack_u128(*txid_span[4], *txid_span[5], *txid_span[6], *txid_span[7]);
            assert(!self.spent_txids.read((txid_hi, txid_lo)), 'Bitcoin txid already minted');

            // ── 5. Verify Merkle inclusion proof ──────────────────────────────
            assert(
                bitcoin_spv::verify_merkle_proof(txid, merkle_proof, tx_pos, merkle_root),
                'Invalid Bitcoin Merkle proof'
            );

            // ── 6. Parse tx output: get amount + scriptPubKey ─────────────────
            let (amount_sats, script) = bitcoin_spv::parse_output(raw_tx, vout_index);
            assert(amount_sats > 0, 'Zero amount in tx output');

            // ── 7. Verify output pays the COVENANT P2TR address ───────────────
            // scriptPubKey must be: OP_1 (0x51) + PUSH_32 (0x20) + 32-byte tweaked pubkey
            // This ensures BTC is locked in the OP_CAT covenant, NOT the hot wallet.
            let tapkey = InternalImpl::vault_tapkey(@self);
            assert(
                bitcoin_spv::script_matches_p2tr(script, tapkey.span()),
                'Output not paying covenant P2TR'
            );

            // ── 8. Mark commitment + txid as spent ───────────────────────────
            self.commitments.write(commitment, true);
            self.spent_txids.write((txid_hi, txid_lo), true);

            // ── 9. Mint mBTC to vault ─────────────────────────────────────────
            // 1 sat = 10^-8 BTC; mBTC has 18 decimals → multiply sats by 10^10
            let amount_wei: u256 = u256 {
                low: amount_sats.into() * 10_000_000_000_u128,
                high: 0
            };
            let vault_addr = get_contract_address();
            IMockBTCTokenDispatcher { contract_address: self.btc_token.read() }
                .mint(vault_addr, amount_wei);

            // ── 10. Emit ──────────────────────────────────────────────────────
            self.emit(Deposit { commitment, amount_sats, block_height });
        }

        fn withdraw(
            ref self: ContractState,
            nullifier: felt252,
            proof: Span<felt252>,
            recipient: ContractAddress,
            amount: u256
        ) {
            assert(!self.nullifiers.read(nullifier), 'Nullifier already used');
            assert(proof.len() > 0, 'Invalid proof length');

            let this_contract = get_contract_address();
            let token = IMockBTCTokenDispatcher { contract_address: self.btc_token.read() };
            let vault_balance = token.balance_of(this_contract);
            assert(vault_balance >= amount, 'Insufficient vault balance');

            self.nullifiers.write(nullifier, true);
            let success = token.transfer(recipient, amount);
            assert(success, 'Transfer failed');

            self.emit(Withdrawal { nullifier, recipient, amount });
        }

        fn get_total_staked(self: @ContractState) -> u256 {
            let this_contract = get_contract_address();
            IMockBTCTokenDispatcher { contract_address: self.btc_token.read() }
                .balance_of(this_contract)
        }

        fn is_commitment_registered(self: @ContractState, commitment: felt252) -> bool {
            self.commitments.read(commitment)
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Build the 32-byte covenant tweaked x-only pubkey from storage as Array<u8>.
        fn vault_tapkey(self: @ContractState) -> Array<u8> {
            let mut arr: Array<u8> = ArrayTrait::new();
            Self::push_u32_be(ref arr, self.vault_tapkey_w0.read());
            Self::push_u32_be(ref arr, self.vault_tapkey_w1.read());
            Self::push_u32_be(ref arr, self.vault_tapkey_w2.read());
            Self::push_u32_be(ref arr, self.vault_tapkey_w3.read());
            Self::push_u32_be(ref arr, self.vault_tapkey_w4.read());
            Self::push_u32_be(ref arr, self.vault_tapkey_w5.read());
            Self::push_u32_be(ref arr, self.vault_tapkey_w6.read());
            Self::push_u32_be(ref arr, self.vault_tapkey_w7.read());
            arr
        }

        /// Append a u32 as 4 big-endian bytes.
        fn push_u32_be(ref arr: Array<u8>, word: u32) {
            arr.append(((word / 0x1000000) & 0xff).try_into().unwrap());
            arr.append(((word / 0x10000) & 0xff).try_into().unwrap());
            arr.append(((word / 0x100) & 0xff).try_into().unwrap());
            arr.append((word & 0xff).try_into().unwrap());
        }

        /// Pack 4 × u32 into a u128 (big-endian).
        fn pack_u128(w0: u32, w1: u32, w2: u32, w3: u32) -> u128 {
            w0.into() * 0x1_0000_0000_0000_0000_0000_u128
                + w1.into() * 0x1_0000_0000_0000_u128
                + w2.into() * 0x1_0000_0000_u128
                + w3.into()
        }
    }
}
