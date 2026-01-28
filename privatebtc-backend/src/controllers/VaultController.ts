import { Request, Response } from 'express';
import { VaultService } from '../services/VaultService';
import { CryptoService } from '../services/CryptoService';

export class VaultController {
    private vaultService: VaultService;

    constructor(vaultService: VaultService) {
        this.vaultService = vaultService;
    }

    /**
     * POST /api/vaults
     * Create a new vault
     */
    createVault = async (req: Request, res: Response) => {
        try {
            console.log('🔵 Creating vault with data:', req.body);

            const { userAddress, amount, lockPeriod } = req.body;

            // Validate required fields
            if (!userAddress) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: userAddress'
                });
            }

            if (!amount || isNaN(parseFloat(amount))) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing or invalid field: amount (must be a number)'
                });
            }

            if (!lockPeriod || isNaN(parseInt(lockPeriod))) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing or invalid field: lockPeriod (must be 30, 60, 90, 180, or 365)'
                });
            }

            const result = await this.vaultService.createVault({
                userAddress,
                amount: parseFloat(amount),
                lockPeriod: parseInt(lockPeriod)
            });

            console.log('✅ Vault created successfully:', result.vaultId);

            res.status(201).json({
                success: true,
                data: result
            });
        } catch (error: any) {
            console.error('❌ Error creating vault:', error.message);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * GET /api/vaults/:userAddress
     * Get all vaults for a user
     */
    getUserVaults = async (req: Request, res: Response) => {
        try {
            const { userAddress } = req.params;
            console.log('🔵 Fetching vaults for user:', userAddress);

            if (!userAddress) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required parameter: userAddress'
                });
            }

            const vaults = this.vaultService.getUserVaults(userAddress);

            console.log(`✅ Found ${vaults.length} vaults for user ${userAddress}`);

            res.json({
                success: true,
                count: vaults.length,
                data: vaults
            });
        } catch (error: any) {
            console.error('❌ Error fetching vaults:', error.message);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * POST /api/vaults/:vaultId/withdraw
     * Withdraw from vault
     */
    withdrawFromVault = async (req: Request, res: Response) => {
        try {
            const { vaultId } = req.params;
            const { proof, userAddress } = req.body;

            console.log('🔵 Withdrawal request for vault:', vaultId);

            if (!proof) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: proof'
                });
            }

            if (!userAddress) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required field: userAddress'
                });
            }

            const result = await this.vaultService.withdrawFromVault({
                vaultId,
                proof,
                userAddress
            });

            console.log('✅ Withdrawal successful:', vaultId);

            res.json({
                success: true,
                data: result
            });
        } catch (error: any) {
            console.error('❌ Error withdrawing:', error.message);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * POST /api/vaults/generate-proof
     * Generate ZK proof for withdrawal
     */
    generateProof = async (req: Request, res: Response) => {
        try {
            const { vaultId, amount, randomness } = req.body;

            console.log('🔵 Generating proof for vault:', vaultId);

            if (!vaultId || !amount || !randomness) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: vaultId, amount, randomness'
                });
            }

            const result = await CryptoService.generateProof(
                vaultId,
                parseFloat(amount),
                randomness
            );

            console.log('✅ Proof generated successfully');

            res.json({
                success: true,
                data: result
            });
        } catch (error: any) {
            console.error('❌ Error generating proof:', error.message);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    };

    /**
     * GET /api/stats
     * Get platform statistics
     */
    getStats = async (req: Request, res: Response) => {
        try {
            console.log('🔵 Fetching platform statistics');

            const stats = this.vaultService.getStats();

            console.log('✅ Stats retrieved:', stats);

            res.json({
                success: true,
                data: stats
            });
        } catch (error: any) {
            console.error('❌ Error fetching stats:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    };
}
