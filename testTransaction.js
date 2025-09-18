const { getUSDCAmountFromTxId } = require('./getTransactionAmount');
const axios = require('axios');

async function debugTransaction(txHash) {
  try {
    const apiUrl = 'https://api.etherscan.io/v2/api';
    const chainId = 137;
    const apiKey = 'R3FM3RWEWDUANFBCGSXQ6PS13YAQP6W1PI';
    const usdcContracts = {
      'old': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Old USDC
      'new': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'  // New USDC (USDC.e)
    };

    const txUrl = `${apiUrl}?chainid=${chainId}&module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    const response = await axios.get(txUrl);
    const tx = response.data.result;

    console.log('🔍 Transaction Details:');
    console.log(`From: ${tx.from}`);
    console.log(`To: ${tx.to}`);
    console.log(`Value: ${tx.value}`);
    console.log(`Input: ${tx.input?.substring(0, 20)}...`);
    console.log(`Old USDC Contract: ${usdcContracts.old}`);
    console.log(`New USDC Contract: ${usdcContracts.new}`);
    console.log(`Is Old USDC?: ${tx.to?.toLowerCase() === usdcContracts.old.toLowerCase()}`);
    console.log(`Is New USDC?: ${tx.to?.toLowerCase() === usdcContracts.new.toLowerCase()}`);
    
    // Try to decode amount regardless of contract
    if (tx.input && tx.input.startsWith('0xa9059cbb')) {
      const amountHex = tx.input.slice(-64);
      const amountWei = parseInt(amountHex, 16);
      const amount = amountWei / 1000000;
      console.log(`💰 Decoded Amount: $${amount} USDC`);
    }

  } catch (error) {
    console.error('Debug error:', error.message);
  }
}

async function testTransaction() {
  const txHash = '0x30e6f4dc1d9e7a8334a8541795f2cd0fbe486d5e751bb4a43c49ddc34b067bf1';

  console.log('Testing transaction amount detection...');
  console.log(`Transaction ID: ${txHash}`);

  // Debug the transaction first
  await debugTransaction(txHash);

  console.log('\n--- Testing USDC Detection ---');
  const result = await getUSDCAmountFromTxId(txHash);

  if (result.success) {
    console.log('✅ SUCCESS!');
    console.log(`💰 Amount sent: $${result.amount} USDC`);
    console.log(`📤 From: ${result.from}`);
    console.log(`📥 To: ${result.to}`);
  } else {
    console.log('❌ FAILED!');
    console.log(`Error: ${result.error}`);
    console.log('\n💡 This transaction is not a USDC transfer.');
    console.log('To test with a real USDC transaction:');
    console.log('1. Send USDC using MetaMask on Polygon network');
    console.log('2. Copy the transaction hash');
    console.log('3. Replace the txHash in this file');
  }
}

// Run the test
testTransaction().catch(console.error);