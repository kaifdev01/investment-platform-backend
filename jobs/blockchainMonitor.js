const cron = require('node-cron');
const blockchainService = require('../services/blockchainService');

// Monitor blockchain every 30 seconds
const startBlockchainMonitoring = () => {
  console.log('Starting blockchain monitoring...');
  
  // Run every 30 seconds
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await blockchainService.scanForDeposits();
    } catch (error) {
      console.error('Blockchain monitoring error:', error);
    }
  });
  
  console.log('Blockchain monitoring started - scanning every 30 seconds');
};

module.exports = { startBlockchainMonitoring };