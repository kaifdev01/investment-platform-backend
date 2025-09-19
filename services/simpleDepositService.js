const axios = require('axios');
const Deposit = require('../models/Deposit');
const User = require('../models/User');

class SimpleDepositService {
  constructor() {
    // ✅ Use Etherscan Multichain API base URL (works for Polygon too)
    this.apiBaseUrl = 'https://api.etherscan.io/v2/api';
    this.chainId = 137; // Polygon Mainnet
    this.apiKey = "R3FM3RWEWDUANFBCGSXQ6PS13YAQP6W1PI";

    // ✅ USDC contract on Polygon
    this.usdcContract = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    // Master wallet
    this.masterWallet = process.env.MASTER_WALLET_ADDRESS || '0x857B7F4Cd911aB51e41D311cB437bBe33A229808';
  }

  async checkTransaction(txHash) {
    try {
      console.log(`🔍 Checking transaction: ${txHash}`);

      // ✅ Get transaction receipt (via Multichain API)
      const receiptUrl = `${this.apiBaseUrl}?chainid=${this.chainId}&module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${this.apiKey}`;
      const receiptResponse = await axios.get(receiptUrl);
      console.log("url", receiptUrl)

      console.log('API Response:', receiptResponse.data);

      const receipt = receiptResponse.data.result;
      if (!receipt) {
        console.log('❌ Transaction not found');
        return { valid: false, error: 'Transaction hash not found on Polygon network' };
      }

      if (receipt.status !== '0x1') {
        console.log('❌ Transaction failed on blockchain');
        return { valid: false, error: 'Transaction failed on blockchain' };
      }

      // ✅ Get transaction details
      const txUrl = `${this.apiBaseUrl}?chainid=${this.chainId}&module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${this.apiKey}`;
      const txResponse = await axios.get(txUrl);

      const tx = txResponse.data.result;
      if (!tx) {
        console.log('❌ Transaction details not found');
        return { valid: false, error: 'Transaction details not found' };
      }

      console.log(`Transaction: ${tx.from} -> ${tx.to}`);
      console.log(`Value: ${tx.value}`);
      console.log(`Master wallet: ${this.masterWallet}`);

      if (tx.to.toLowerCase() !== this.usdcContract.toLowerCase()) {
        console.log('❌ Not a USDC transaction');
        return { valid: false, error: 'Not a USDC transaction' };
      }

      // ✅ Verify transfer to master wallet
      const transferToMaster = receipt.logs.some(log => {
        if (log.topics && log.topics.length >= 3) {
          const transferSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          const toAddress = '0x' + log.topics[2].slice(26);
          return log.topics[0] === transferSig &&
            toAddress.toLowerCase() === this.masterWallet.toLowerCase();
        }
        return false;
      });

      if (!transferToMaster) {
        console.log('❌ USDC not transferred to master wallet');
        return { valid: false, error: 'USDC not sent to platform wallet' };
      }

      console.log('✅ Valid USDC transfer to master wallet');

      return {
        valid: true,
        from: tx.from,
        to: tx.to,
        blockNumber: parseInt(receipt.blockNumber, 16),
        status: 'confirmed'
      };

    } catch (error) {
      console.error('❌ Transaction check error:', error.response?.data || error.message);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new SimpleDepositService();
