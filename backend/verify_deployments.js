const { RpcProvider, Contract, json } = require('starknet');
const fs = require('fs');
require('dotenv').config();

async function verifyDeployments() {
  console.log('🔍 Verifying New Deployments\n');
  console.log('='.repeat(70));
  
  const provider = new RpcProvider({ 
    nodeUrl: process.env.STARKNET_RPC_URL 
  });
  
  const mockBtcAddr = '0x0201c23ba72660516c987e8d11b8f6238b386f13099880cd1a8f5b065667343';
  const vaultAddr = '0x072d121d6a86c73b649519cb51546dfba728ff0f1f3c041662ea7088ef01775';
  
  try {
    // Check MockBTC
    console.log('\nMockBTC:');
    console.log(`  Address: ${mockBtcAddr}`);
    
    const mockBtcClass = await provider.getClassAt(mockBtcAddr);
    const mockBtcAbi = typeof mockBtcClass.abi === 'string' 
      ? json.parse(mockBtcClass.abi)
      : mockBtcClass.abi;
    
    const mockBtcInterface = mockBtcAbi.find(item => item.type === 'interface');
    const mockBtcFuncs = mockBtcInterface ? mockBtcInterface.items : [];
    
    console.log(`  Functions: ${mockBtcFuncs.length}`);
    console.log(`  Has mint(): ${mockBtcFuncs.some(f => f.name === 'mint') ? '✓ YES' : '✗ NO'}`);
    console.log(`  Has approve(): ${mockBtcFuncs.some(f => f.name === 'approve') ? '✓ YES' : '✗ NO'}`);
    console.log(`  Has transfer(): ${mockBtcFuncs.some(f => f.name === 'transfer') ? '✓ YES' : '✗ NO'}`);
    
    // Check Vault
    console.log('\nVault:');
    console.log(`  Address: ${vaultAddr}`);
    
    const vaultClass = await provider.getClassAt(vaultAddr);
    const vaultAbi = typeof vaultClass.abi === 'string' 
      ? json.parse(vaultClass.abi)
      : vaultClass.abi;
    
    const vaultInterface = vaultAbi.find(item => item.type === 'interface');
    const vaultFuncs = vaultInterface ? vaultInterface.items : [];
    
    console.log(`  Functions: ${vaultFuncs.length}`);
    console.log(`  Has deposit(): ${vaultFuncs.some(f => f.name === 'deposit') ? '✓ YES' : '✗ NO'}`);
    console.log(`  Has withdraw(): ${vaultFuncs.some(f => f.name === 'withdraw') ? '✓ YES' : '✗ NO'}`);
    
    console.log('\n' + '='.repeat(70));
    
    if (mockBtcFuncs.length > 0 && vaultFuncs.length > 0) {
      console.log('✅ All contracts deployed successfully with proper ABIs!');
      console.log('\n🧪 Ready to test! Run: node test_deposit_fixed.js');
    } else {
      console.log('❌ Warning: Some contracts have empty ABIs');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyDeployments();
