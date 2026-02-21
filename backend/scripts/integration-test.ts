/**
 * Integration tests for PrivateBTC Vault Backend.
 * Run: npx tsx scripts/integration-test.ts
 *
 * Test sequence from RESOLVE.md Step 6:
 * 1. GET /health                       — RPC live, block number returned
 * 2. POST /api/commitment/create       — Returns commitment + nullifier_hash
 * 3. POST /api/htlc/create             — Returns htlcId + preimage
 * 4. POST /api/htlc/claim (correct)    — status: claimed
 * 5. POST /api/htlc/claim (same id)    — 409 Already claimed
 * 6. POST /api/htlc/claim (bad preimage)— 401 Invalid preimage
 * 7. POST /api/htlc/refund (before exp) — 403 Timelock not expired
 */

const BASE = 'http://localhost:3001';
import process from 'node:process';
import fetch, { RequestInit } from 'node-fetch';

// Polyfill global fetch for any libraries that expect it
if (!globalThis.fetch) {
    (globalThis as any).fetch = fetch;
}

let passed = 0;
let failed = 0;

interface TestCase {
    name: string;
    run: () => Promise<void>;
}

function pass(msg: string) {
    console.log(`  ✅ PASS — ${msg}`);
    passed++;
}

function fail(msg: string, detail?: unknown) {
    console.error(`  ❌ FAIL — ${msg}`, detail ?? '');
    failed++;
}

async function request(method: string, path: string, body?: unknown) {
    const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${BASE}${path}`, opts);
    const json = await r.json() as Record<string, unknown>;
    return { status: r.status, json };
}

// ── Test state (shared between tests) ──────────────────────────────────────
let htlcId = '';
let preimage = '';
let commitment = '';
let nullifier_hash = '';

const TESTS: TestCase[] = [
    {
        name: '1. GET /health — RPC live, block number returned',
        async run() {
            const { status, json } = await request('GET', '/health');
            if (status !== 200) return fail('status not 200', { status, json });
            const s = json as { status: string; starknet?: { blockNumber?: number } };
            if (s.status !== 'ok') return fail('status !== ok', json);
            const bn = s.starknet?.blockNumber;
            if (!bn || bn < 1) return fail('no live blockNumber', json);
            pass(`blockNumber = ${bn}`);
        },
    },
    {
        name: '2. POST /api/commitment/create — returns commitment + nullifier_hash',
        async run() {
            const { status, json } = await request('POST', '/api/commitment/create', {
                secret: '0x616263',   // hex for "abc"
                salt: '0x313233',     // hex for "123"
            });
            if (status !== 201) return fail('status not 201', { status, json });
            const d = (json as { data?: { commitment?: string; nullifier_hash?: string } }).data;
            if (!d?.commitment || !d?.nullifier_hash) return fail('missing fields', json);
            commitment = d.commitment;
            nullifier_hash = d.nullifier_hash;
            pass(`commitment = ${commitment.slice(0, 20)}…  nullifier = ${nullifier_hash.slice(0, 20)}…`);
        },
    },
    {
        name: '3. POST /api/htlc/create using commitment — returns htlcId + preimage',
        async run() {
            const future = Math.floor(Date.now() / 1000) + 3600;
            const { status, json } = await request('POST', '/api/htlc/create', {
                sender: '0x1111111111111111111111111111111111111111111111111111111111111111',
                receiver: '0x2222222222222222222222222222222222222222222222222222222222222222',
                amount: commitment || '0x123',
                timelockSeconds: future
            });
            if (status !== 201) return fail('status not 201', { status, json });
            const d = (json as any).data;
            if (!d?.htlcId || !d?.preimage) return fail('missing fields', json);
            htlcId = d.htlcId;
            preimage = d.preimage;
            pass(`htlcId = ${htlcId.slice(0, 18)}…`);
        },
    },
    {
        name: '4. POST /api/htlc/claim (correct preimage) — status: claimed',
        async run() {
            if (!htlcId || !preimage) return fail('htlcId/preimage not set (test 3 failed?)');
            const { status, json } = await request('POST', '/api/htlc/claim', { htlcId, preimage });
            if (status !== 200) return fail('status not 200', { status, json });
            const d = (json as { data?: { status?: string } }).data;
            if (d?.status !== 'claimed') return fail('status !== claimed', json);
            pass('HTLC claimed successfully');
        },
    },
    {
        name: '5. POST /api/htlc/claim again (same htlcId) — must return 409',
        async run() {
            if (!htlcId || !preimage) return fail('htlcId/preimage not set');
            const { status, json } = await request('POST', '/api/htlc/claim', { htlcId, preimage });
            if (status !== 409) return fail(`expected 409 got ${status}`, json);
            pass('409 Already claimed — double-spend prevented');
        },
    },
    {
        name: '6. POST /api/htlc/claim (wrong preimage on fresh HTLC) — must return 401',
        async run() {
            const future = Math.floor(Date.now() / 1000) + 3600;
            const createRes = await request('POST', '/api/htlc/create', {
                sender: '0x' + '1'.repeat(64),
                receiver: '0x' + '2'.repeat(64),
                amount: '500',
                timelockSeconds: future
            });
            if (!createRes.json?.data?.htlcId) return fail('could not create fresh HTLC for test 6', createRes);
            const { status, json } = await request('POST', '/api/htlc/claim', {
                htlcId: (createRes.json.data as any).htlcId,
                preimage: 'wrong-preimage'
            });
            if (status !== 401) return fail('expected 401 for wrong preimage', { status, json });
            pass('correctly rejected wrong preimage with 401');
        }
    },
    {
        name: '7. POST /api/htlc/refund (before timelock) — must return 403',
        async run() {
            const future = Math.floor(Date.now() / 1000) + 3600;
            const createRes = await request('POST', '/api/htlc/create', {
                sender: '0x' + '3'.repeat(64),
                receiver: '0x' + '4'.repeat(64),
                amount: '700',
                timelockSeconds: future
            });
            if (!createRes.json?.data?.htlcId) return fail('could not create HTLC for test 7', createRes);
            const { status } = await request('POST', '/api/htlc/refund', {
                htlcId: (createRes.json.data as any).htlcId,
                senderAddress: '0x' + '3'.repeat(64)
            });
            if (status !== 403) return fail('expected 403 refund forbidden', { status });
            pass('correctly rejected early refund with 403');
        }
    },
    {
        name: '8. GET /api/bridge/btc-status — check real Bitcoin Signet connection',
        async run() {
            const { status, json } = await request('GET', '/api/bridge/btc-status');
            if (status !== 200) return fail('status not 200', { status, json });
            const d = (json as { data?: { currentBlock?: { height: number } } }).data;
            if (!d?.currentBlock?.height || d.currentBlock.height < 100000) return fail('invalid block height', json);
            pass(`Signet height = ${d.currentBlock.height}`);
        },
    },
    {
        name: '9. POST /api/bridge/detect-lock (simulated) — returns lock event',
        async run() {
            const { status, json } = await request('POST', '/api/bridge/detect-lock', {
                address: 'tb1q99999999999999999999999999999999999999',
                amountSats: 1000,
                simulate: true
            });
            const d = (json as { data?: { simulated: boolean; fakeTxid: string } }).data;
            if (status !== 200) return fail('status not 200', { status, json });
            if (!d?.simulated || !d?.fakeTxid) return fail('missing simulation fields', json);
            pass(`Simulated lock detected: ${d.fakeTxid}`);
        },
    },
    {
        name: '10. POST /api/sharp/submit — returns jobKey for ZK-proof',
        async run() {
            const { status, json } = await request('POST', '/api/sharp/submit', {
                secret: '123123',
                salt: '456456'
            });
            // Note: Since this shells out to cairo-sharp, success depends on CLI availability
            if (status === 200) {
                const d = (json as { data?: { jobKey?: string } }).data;
                if (!d?.jobKey) return fail('missing jobKey', json);
                pass(`Proof submitted. Job key = ${d.jobKey}`);
            } else {
                // If CLI is missing in this env, we might get 500 but still verify the route logic
                fail(`Verification failed: ${json.error || 'Unknown error'}`);
            }
        },
    },
    {
        name: '11. GET /api/sharp/history — verify database persistence',
        async run() {
            const { status, json } = await request('GET', '/api/sharp/history');
            if (status !== 200) return fail('status not 200', { status, json });
            const p = (json as { data?: { proofs: any[] } }).data?.proofs;
            if (!p || p.length === 0) return fail('history is empty', json);
            pass(`Found ${p.length} previous proof submissions in DB`);
        },
    },
    // ── HARDENING TESTS (12-21) ─────────────────────────────────────────────
    {
        name: '12. Malformed JSON Body — must return 400',
        async run() {
            const r = await fetch(`${BASE}/api/htlc/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"invalid": json...}'
            });
            const json = await r.json() as any;
            if (r.status !== 400 || !json.error?.includes('JSON')) return fail('expected 400 Invalid JSON', { status: r.status, json });
            pass('Global Error Handler caught malformed JSON');
        }
    },
    {
        name: '13. Validation Middleware: Missing Field — must return 400',
        async run() {
            const { status, json } = await request('POST', '/api/htlc/create', { sender: '0x1' }); // missing receiver/amount
            if (status !== 400 || !(json as any).error?.includes('required')) return fail('expected 400 validation error', { status, json });
            pass('validateBody middleware enforced required fields');
        }
    },
    {
        name: '14. Payload Size Limit (>50kb) — must return 413',
        async run() {
            const largeData = 'x'.repeat(60 * 1024); // 60KB
            const r = await fetch(`${BASE}/api/htlc/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: largeData })
            });
            if (r.status !== 413) return fail(`expected 413 but got ${r.status}`);
            pass('Payload limit (50kb) enforced');
        }
    },
    {
        name: '15. Invalid Starknet Address format — must return 400',
        async run() {
            const { status, json } = await request('GET', '/api/vault/balance/0xABC');
            if (status !== 400 || !(json as any).error?.includes('format')) return fail('expected 400 format error', { status, json });
            pass('isValidStarknetAddress validator enforced');
        }
    },
    {
        name: '16. Invalid Bitcoin Address format — must return 400',
        async run() {
            const { status, json } = await request('POST', '/api/bridge/watch-address', { address: '1notabtcaddress' });
            if (status !== 400 || !(json as any).error?.includes('Must start with tb1')) return fail('expected 400 btc format error', { status, json });
            pass('isValidBitcoinSignetAddress validator enforced');
        }
    },
    {
        name: '17. Route Not Found (404) — custom JSON response',
        async run() {
            const { status, json } = await request('GET', '/api/non/existent/route');
            if (status !== 404 || json.success !== false) return fail('expected 404 JSON', { status, json });
            pass('notFound middleware working');
        }
    },
    {
        name: '18. Method Not Allowed (405) — custom JSON response',
        async run() {
            const { status, json } = await request('DELETE', '/api/htlc/create');
            if (status !== 405 || (json as any).error !== 'Method not allowed') return fail('expected 405 Method Not Allowed', { status, json });
            pass('methodNotAllowed middleware working');
        }
    },
    {
        name: '19. Concurrency Lock: Double Claim — must return 409 locked',
        async run() {
            const future = Math.floor(Date.now() / 1000) + 3600;
            // Create a fresh HTLC to test concurrent race
            const create = await request('POST', '/api/htlc/create', {
                sender: '0x123' + '0'.repeat(61),
                receiver: '0x456' + '0'.repeat(61),
                amount: '1',
                timelockSeconds: future
            });
            if (!create.json?.data) return fail('could not create HTLC for test 19', create);
            const { htlcId: id, preimage: p } = (create.json as any).data;

            // Fire two claims simultaneously
            const [r1, r2] = await Promise.all([
                request('POST', '/api/htlc/claim', { htlcId: id, preimage: p }),
                request('POST', '/api/htlc/claim', { htlcId: id, preimage: p })
            ]);

            const oneIsLocked = r1.status === 409 || r2.status === 409;
            const oneIsSuccess = r1.status === 200 || r2.status === 200;

            if (!oneIsLocked || !oneIsSuccess) return fail('Concurrency lock did not catch race', { r1, r2 });
            pass('LockManager prevented concurrent claim race condition');
        }
    },
    {
        name: '20. RPC Resilience: Health Circuit State — verified',
        async run() {
            const { status, json } = await request('GET', '/health');
            const circuit = (json as any).starknet?.circuit;
            if (!circuit || !circuit.status) return fail('Circuit state missing from health', json);
            pass(`Circuit status: ${circuit.status} (failures: ${circuit.failures})`);
        }
    },
    {
        name: '21. API Rate Limiting (Strict) — must return 429',
        async run() {
            console.log('  ⏳ Hammering /api/commitment/create (strict) with 300 reqs to trigger 429...');
            const requests = [];
            for (let i = 0; i < 300; i++) {
                requests.push(request('POST', '/api/commitment/create', { secret: 'a', salt: 'b' }));
            }
            const results = await Promise.all(requests);
            const has429 = results.some(r => r.status === 429);
            const msg429 = (results.find(r => r.status === 429)?.json as any)?.error;
            if (!has429) return fail('Rate limit did not trigger after 300 requests');
            pass(`Rate limiter successfully blocked with: ${msg429}`);
        }
    },
];

async function main() {
    console.log('');
    console.log('══════════════════════════════════════════════════════════');
    console.log('  PrivateBTC Vault — Integration Tests');
    console.log('══════════════════════════════════════════════════════════');
    console.log('');

    for (const test of TESTS) {
        console.log(`▶ ${test.name}`);
        try {
            await test.run();
        } catch (err) {
            fail(`Unexpected exception: ${err instanceof Error ? err.message : String(err)}`);
        }
        console.log('');
    }

    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Results: ${passed}/${TESTS.length} passed   ${failed} failed`);
    console.log('══════════════════════════════════════════════════════════');
    console.log('');

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
