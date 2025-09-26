require('dotenv').config();

module.exports = {
  // Ethereum Mainnet
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL,

  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL ,

  // Master wallet (platform's main wallet)
  MASTER_WALLET_ADDRESS: process.env.MASTER_WALLET_ADDRESS || '0x517A5645c16F59744E724fA4432c8f2bC85cAb1d',

  // USDC Contract Addresses
  USDC_CONTRACT_ETHEREUM: '0xA0b86a33E6441b8e5c7F8b8b8b8b8b8b8b8b8b8b',
  USDC_CONTRACT_POLYGON: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',

  ACTIVE_NETWORK: process.env.ACTIVE_NETWORK || 'polygon',

  MIN_CONFIRMATIONS: parseInt(process.env.MIN_CONFIRMATIONS) || 3,

  // Monitoring settings
  BLOCK_SCAN_INTERVAL: 15000, // 15 seconds
  BLOCKS_TO_SCAN: 100 // Scan last 100 blocks
};
