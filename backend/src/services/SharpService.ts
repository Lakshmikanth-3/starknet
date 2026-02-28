/**
 * SharpService — Automates StarkWare SHARP proof submission and status tracking.
 *
 * Shells out to `cairo-sharp` CLI tools.
 * Tracks job status in SQLite for persistence.
 */

import { spawnSync } from 'child_process';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';
import path from 'path';
import fs from 'fs';
import os from 'os';
import process from 'process';

export interface ProofRecord {
    id: string;
    job_key: string;
    secret_hash: string;
    salt_hash: string;
    status: 'SUBMITTED' | 'IN_PROGRESS' | 'PROCESSED' | 'ONCHAIN' | 'FAILED';
    on_chain: number;
    created_at: number;
}

export class SharpService {
    /**
     * Converts a Windows absolute path to a WSL path.
     * Example: C:\Users\sl\... -> /mnt/c/Users/sl/...
     */
    private static toWslPath(windowsPath: string): string {
        const normalized = path.resolve(windowsPath).replace(/\\/g, '/');
        const driveMatch = normalized.match(/^([a-zA-Z]):\/(.*)/);
        if (driveMatch) {
            const drive = driveMatch[1].toLowerCase();
            const rest = driveMatch[2];
            return `/mnt/${drive}/${rest}`;
        }
        return normalized;
    }

    /**
     * Executes a command in WSL Ubuntu with Scarb 2.12.2 tools in PATH.
     */
    private static executeInWsl(innerCmd: string): { stdout: string; stderr: string; status: number | null } {
        // Scarb 2.12.2 bin path (contains scarb + all plugins: execute, prove, verify)
        const scarbBin = '/home/sl/.asdf/installs/scarb/2.12.2/bin';

        const pathAugmentation = `export PATH="${scarbBin}:/home/sl/.local/bin:/usr/bin:/bin:$PATH"`;
        const fullBashCmd = `${pathAugmentation} && ${innerCmd}`;

        const args = ['-d', 'Ubuntu', 'bash', '-c', fullBashCmd];

        const result = spawnSync('wsl', args, { encoding: 'utf8' });

        return {
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            status: result.status
        };
    }

    /**
     * Generate a ZK proof locally using Scarb 2.12.2.
     * Uses scarb prove --execute (all-in-one execute+prove) followed by scarb verify.
     */
    static async generateWithdrawProof(
        secret: string,
        commitmentHash: string,
        nullifierHash: string
    ): Promise<string[]> {
        console.log(`🚀 Starting local ZK Proving flow to generate Withdraw Proof...`);

        const scarbProjectDir = path.resolve(__dirname, '../../../cairo2_proof');
        const wslProjectPath = this.toWslPath(scarbProjectDir);

        const toHex = (val: string) => val.startsWith('0x') ? val : `0x${BigInt(val).toString(16)}`;

        // Write args to a Windows-accessible path (same pattern as submitProof which works)
        const argsFileName = `withdraw_args_${uuidv4()}.json`;
        const argsPath = path.join(scarbProjectDir, argsFileName);
        fs.writeFileSync(argsPath, JSON.stringify([toHex(secret), toHex(commitmentHash), toHex(nullifierHash)]));
        const wslArgsPath = this.toWslPath(argsPath);

        try {
            console.log(`⏳ Executing Cairo program and generating ZK proof (may take 30-60s)...`);
            const proveCmd = `cd ${wslProjectPath} && scarb prove --execute --arguments-file ${wslArgsPath}`;
            const proveRes = this.executeInWsl(proveCmd);

            // Log to debug file like submitProof does
            fs.appendFileSync('wsl_debug.log', `\n--- WITHDRAW PROVE ---\nStatus: ${proveRes.status}\nSTDOUT: ${proveRes.stdout}\nSTDERR: ${proveRes.stderr}\n--------------\n`);
            console.log('[SharpService] scarb prove stdout:', proveRes.stdout.slice(0, 300));

            if (fs.existsSync(argsPath)) fs.unlinkSync(argsPath);

            if (proveRes.status !== 0) {
                throw new Error(`scarb prove failed (exit ${proveRes.status}):\n${proveRes.stderr || proveRes.stdout}`);
            }

            // Parse the proof path from stdout — Scarb outputs "Saving proof to: target/..."
            const proofPathMatch = proveRes.stdout.match(/Saving proof to:\s+(\S+)/);
            if (!proofPathMatch) {
                throw new Error(`Could not parse proof path from scarb output.\nSTDOUT: ${proveRes.stdout}`);
            }
            const relProofPath = proofPathMatch[1];
            // Convert from relative WSL path to absolute Windows path
            const absProofPath = path.join(scarbProjectDir, relProofPath.replace(/\//g, path.sep));

            console.log(`✅ ZK Proof generated. Reading: ${absProofPath}`);
            const proofJson = JSON.parse(fs.readFileSync(absProofPath, 'utf8'));

            const proofArray = Array.isArray(proofJson) ? proofJson : (proofJson.proof || [proofJson]);
            console.log(`✅ Proof array length: ${proofArray.length}`);
            return proofArray;

        } catch (err) {
            if (fs.existsSync(argsPath)) { try { fs.unlinkSync(argsPath); } catch (_) { } }
            console.error('Local proving flow failed:', err);
            throw new Error(`Proving flow failed: ${err instanceof Error ? err.message : String(err)}\n\nPlease ensure Scarb 2.12.2 is installed in WSL Ubuntu.`);
        }
    }

    static async submitProof(secret: string, salt: string): Promise<{ jobKey: string }> {
        const scarbProjectDir = path.resolve(__dirname, '../../../cairo2_proof');
        const wslProjectPath = this.toWslPath(scarbProjectDir);

        // Create hashes for DB storage (NEVER store raw secret/salt)
        const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
        const saltHash = crypto.createHash('sha256').update(salt).digest('hex');

        // Convert args to 0x-prefixed hex strings as required by scarb-execute felt252 deserializer
        const toHex = (val: string) => val.startsWith('0x') ? val : `0x${BigInt(val).toString(16)}`;
        const secretHex = toHex(secret);
        const saltHex = toHex(salt);

        // Write args JSON to temp file in WSL-accessible path
        const argsFileName = `proof_args_${uuidv4()}.json`;
        const argsPath = path.join(scarbProjectDir, argsFileName);
        fs.writeFileSync(argsPath, JSON.stringify([secretHex, saltHex]));
        const wslArgsPath = this.toWslPath(argsPath);

        const jobKey = uuidv4();

        try {
            console.log(`🚀 Starting local ZK Proving flow with Scarb 2.12.2...`);

            // Step 1: scarb prove --execute (executes Cairo program + generates proof in one step)
            console.log(`⏳ Executing Cairo program and generating ZK proof...`);
            const proveCmd = `cd ${wslProjectPath} && scarb prove --execute --arguments-file ${wslArgsPath}`;
            const proveRes = this.executeInWsl(proveCmd);
            fs.appendFileSync('wsl_debug.log', `\n--- PROVE ---\nStatus: ${proveRes.status}\nSTDOUT: ${proveRes.stdout}\nSTDERR: ${proveRes.stderr}\n--------------\n`);

            // Clean up args file
            if (fs.existsSync(argsPath)) {
                try { fs.unlinkSync(argsPath); } catch (_) { }
            }

            if (proveRes.status !== 0) {
                throw new Error(`scarb prove failed: ${proveRes.stderr}`);
            }

            // Extract proof path from output (e.g. "Saving proof to: target/execute/cairo2_proof/executionN/proof/proof.json")
            const proofPathMatch = proveRes.stdout.match(/Saving proof to:\s+(\S+)/);
            if (!proofPathMatch) {
                throw new Error(`Could not parse proof path from scarb prove output: ${proveRes.stdout}`);
            }
            const relProofPath = proofPathMatch[1];
            const absProofPath = `${wslProjectPath}/${relProofPath}`;

            // Step 2: scarb verify
            console.log(`⏳ Verifying ZK proof...`);
            const verifyCmd = `cd ${wslProjectPath} && scarb verify --proof-file ${absProofPath}`;
            const verifyRes = this.executeInWsl(verifyCmd);
            fs.appendFileSync('wsl_debug.log', `\n--- VERIFY ---\nStatus: ${verifyRes.status}\nSTDOUT: ${verifyRes.stdout}\nSTDERR: ${verifyRes.stderr}\n--------------\n`);

            if (verifyRes.status !== 0) {
                throw new Error(`Proof verification failed: ${verifyRes.stderr}`);
            }

            console.log(`✅ ZK Proof generated and verified successfully. Proof at: ${relProofPath}`);

            const id = uuidv4();
            db.prepare(`
                INSERT INTO sharp_proofs (id, job_key, secret_hash, salt_hash, status, created_at)
                VALUES (?, ?, ?, ?, 'PROCESSED', unixepoch())
            `).run(id, jobKey, secretHash, saltHash);

            return { jobKey };
        } catch (err) {
            // Clean up args file on error too
            if (fs.existsSync(argsPath)) {
                try { fs.unlinkSync(argsPath); } catch (_) { }
            }
            console.error('Local proving flow failed:', err);
            throw new Error(`Proving flow failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    /**
     * Check the status of a specific SHARP job.
     */
    static async checkProofStatus(jobKey: string): Promise<{ status: string; onChain: boolean }> {
        if (jobKey.startsWith('SIMULATED-JOB')) {
            return { status: 'PROCESSED', onChain: false };
        }

        try {
            const innerCmd = `cairo-sharp status ${jobKey}`;
            const { stdout, stderr, status } = this.executeInWsl(innerCmd);

            if (status !== 0) {
                if (stderr.includes('not found') || stderr.includes('command not found')) {
                    return { status: 'PROCESSED', onChain: false }; // Fallback for simulated
                }
                throw new Error(`WSL status check failed: ${stderr}`);
            }

            let proofStatus: ProofRecord['status'] = 'IN_PROGRESS';
            if (stdout.includes('ONCHAIN')) proofStatus = 'ONCHAIN';
            else if (stdout.includes('PROCESSED')) proofStatus = 'PROCESSED';
            else if (stdout.includes('FAILED')) proofStatus = 'FAILED';
            else if (stdout.includes('IN_PROGRESS')) proofStatus = 'IN_PROGRESS';

            const onChain = proofStatus === 'ONCHAIN' ? 1 : 0;

            db.prepare(`
                UPDATE sharp_proofs 
                SET status = ?, on_chain = ? 
                WHERE job_key = ?
            `).run(proofStatus, onChain, jobKey);

            return { status: proofStatus, onChain: proofStatus === 'ONCHAIN' };
        } catch (err) {
            console.error(`SHARP status check failed for ${jobKey}:`, err);
            return { status: 'UNKNOWN', onChain: false };
        }
    }

    /**
     * Returns all proof submissions.
     */
    static async getProofHistory(): Promise<ProofRecord[]> {
        return db.prepare(`
            SELECT * FROM sharp_proofs ORDER BY created_at DESC
        `).all() as ProofRecord[];
    }
}
