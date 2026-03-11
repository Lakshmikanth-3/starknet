/**
 * force_withdrawal.ts
 * One-shot script: directly execute the covenant Bitcoin payout for a
 * pending authorization, bypassing Starknet RPC verification.
 *
 * Usage:  npx tsx scripts/force_withdrawal.ts <auth_id>
 *   e.g.: npx tsx scripts/force_withdrawal.ts e86bb8c0-4bec-4053-965e-c66647459fc0
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../backend/.env' });

// Ensure dotenv loads before service imports
process.chdir('../backend');
dotenv.config({ path: '.env' });

import { BitcoinCovenantService } from '../backend/src/services/BitcoinCovenantService';
import { WithdrawalAuthorizationService } from '../backend/src/services/WithdrawalAuthorizationService';

async function main() {
    const authId = process.argv[2];
    if (!authId) {
        console.error('Usage: npx tsx force_withdrawal.ts <auth_id>');
        process.exit(1);
    }

    const auth = WithdrawalAuthorizationService.getAuthorizationById(authId);
    if (!auth) {
        console.error(`Authorization ${authId} not found`);
        process.exit(1);
    }

    console.log('');
    console.log('=====================================================');
    console.log(' Force Withdrawal — Bypasses Starknet RPC timeout');
    console.log('=====================================================');
    console.log(`Authorization ID: ${auth.id}`);
    console.log(`Vault ID:         ${auth.vault_id}`);
    console.log(`Bitcoin address:  ${auth.bitcoin_address}`);
    console.log(`Amount:           ${auth.amount_sats} sats`);
    console.log(`Starknet TX:      ${auth.starknet_tx_hash}`);
    console.log(`Status:           ${auth.status}`);
    console.log('');

    if (auth.status === 'completed') {
        console.log('⚠️  Authorization already completed. Bitcoin TXID:', auth.bitcoin_txid);
        process.exit(0);
    }

    console.log('➡  Marking as processing...');
    WithdrawalAuthorizationService.updateStatus(authId, 'processing');

    try {
        console.log('➡  Calling BitcoinCovenantService.executeCovenantWithdrawal...');
        const txid = await BitcoinCovenantService.executeCovenantWithdrawal(authId);
        WithdrawalAuthorizationService.updateStatus(authId, 'completed', txid);
        console.log('');
        console.log('✅ SUCCESS!');
        console.log(`   Bitcoin TXID: ${txid}`);
        console.log(`   Explorer: https://mempool.space/signet/tx/${txid}`);
    } catch (err: any) {
        console.error('❌ Failed:', err.message);
        WithdrawalAuthorizationService.updateStatus(authId, 'pending');
        process.exit(1);
    }
}

main();
