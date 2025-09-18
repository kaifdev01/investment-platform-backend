const axios = require('axios');

async function getUSDCAmountFromTxId(txHash) {
  try {
    const apiUrl = 'https://api.etherscan.io/v2/api';
    const chainId = 137;
    const apiKey = 'R3FM3RWEWDUANFBCGSXQ6PS13YAQP6W1PI';
    const usdcContracts = [
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Old USDC
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'  // New USDC
    ];
    
    console.log(`🔍 Getting amount for: ${txHash}`);
    
    // Get transaction receipt (contains logs)
    const receiptUrl = `${apiUrl}?chainid=${chainId}&module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`;
    const response = await axios.get(receiptUrl);
    
    if (!response.data.result) {
      return { success: false, error: 'Transaction not found' };
    }
    
    const receipt = response.data.result;
    
    // Look for USDC Transfer events in logs
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    for (const log of receipt.logs) {
      // Check if this is a USDC contract
      const isUSDC = usdcContracts.some(contract => 
        log.address.toLowerCase() === contract.toLowerCase()
      );
      
      // Check if this is a Transfer event
      const isTransfer = log.topics[0] === transferTopic;
      
      if (isUSDC && isTransfer) {
        // Decode amount from log data
        const amountHex = log.data;
        const amountWei = parseInt(amountHex, 16);
        const usdcAmount = amountWei / 1000000; // USDC has 6 decimals
        
        // Get from/to addresses from topics
        const fromAddress = '0x' + log.topics[1].slice(26);
        const toAddress = '0x' + log.topics[2].slice(26);
        
        console.log(`💰 Found USDC transfer: $${usdcAmount}`);
        
        return { 
          success: true, 
          amount: usdcAmount,
          from: fromAddress,
          to: toAddress,
          contract: log.address,
          txHash: txHash
        };
      }
    }
    
    return { success: false, error: 'No USDC transfer found in transaction logs' };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { getUSDCAmountFromTxId };