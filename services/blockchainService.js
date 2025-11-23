const { ethers } = require('ethers');
const config = require('../config/blockchain');
const User = require('../models/User');
const Deposit = require('../models/Deposit');

class BlockchainService {
  constructor() {
    this.provider = null;
    this.usdcContract = null;
    this.lastScannedBlock = 0;
    this.init();
  }

  async init() {
    try {
      // Initialize provider based on active network
      const rpcUrl = config.ACTIVE_NETWORK === 'ethereum' 
        ? config.ETHEREUM_RPC_URL 
        : config.POLYGON_RPC_URL;
      
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // USDC Contract ABI (minimal for transfer events)
      const usdcAbi = [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ];
      
      const usdcAddress = config.ACTIVE_NETWORK === 'ethereum'
        ? config.USDC_CONTRACT_ETHEREUM
        : config.USDC_CONTRACT_POLYGON;
      
      this.usdcContract = new ethers.Contract(usdcAddress, usdcAbi, this.provider);
      
      // Get current block number
      this.lastScannedBlock = await this.provider.getBlockNumber() - config.BLOCKS_TO_SCAN;
      
      console.log(`Blockchain service initialized on ${config.ACTIVE_NETWORK}`);
      console.log(`Master wallet: ${config.MASTER_WALLET_ADDRESS}`);
      console.log(`Starting from block: ${this.lastScannedBlock}`);
      
    } catch (error) {
      console.error('Failed to initialize blockchain service:', error);
    }
  }

  async scanForDeposits() {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = this.lastScannedBlock + 1;
      const toBlock = Math.min(fromBlock + 50, currentBlock);
      
      if (fromBlock > currentBlock) return;
      
      console.log(`Scanning blocks ${fromBlock} to ${toBlock}`);
      
      // Get USDC transfer events to master wallet
      const filter = this.usdcContract.filters.Transfer(null, config.MASTER_WALLET_ADDRESS);
      const events = await this.usdcContract.queryFilter(filter, fromBlock, toBlock);
      
      for (const event of events) {
        await this.processDepositEvent(event);
      }
      
      this.lastScannedBlock = toBlock;
      
    } catch (error) {
      console.error('Error scanning for deposits:', error);
    }
  }

  async processDepositEvent(event) {
    try {
      const txHash = event.transactionHash;
      const fromAddress = event.args.from;
      const toAddress = event.args.to;
      const rawAmount = event.args.value;
      
      // Convert from wei to USDC (6 decimals)
      const amount = parseFloat(ethers.formatUnits(rawAmount, 6));
      
      // Check if we already processed this transaction
      const existingDeposit = await Deposit.findOne({ txHash });
      if (existingDeposit) return;
      
      // Find user by pending deposit
      const user = await this.findUserByMemo(txHash, fromAddress);
      if (!user) return;
      
      // Get transaction details
      const receipt = await this.provider.getTransactionReceipt(txHash);
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;
      
      if (confirmations < config.MIN_CONFIRMATIONS) return;
      
      // Create deposit record
      const deposit = new Deposit({
        userId: user._id,
        amount: amount,
        txHash: txHash,
        fromAddress: fromAddress,
        toAddress: toAddress,
        status: 'confirmed',
        type: 'real',
        confirmations: confirmations,
        blockNumber: receipt.blockNumber,
        processedAt: new Date()
      });
      
      await deposit.save();
      
      // Update user balance
      const isFirstDeposit = user.balance === 0 && user.totalInvestment === 0;
      user.balance += amount;
      
      // Give 50 points for first deposit
      if (isFirstDeposit && user.score === 0) {
        user.score = 50;
        console.log(`First deposit bonus: 50 points awarded to ${user.email}`);
      }
      
      await user.save();
      
      console.log(`✅ Processed deposit: $${amount} USDC for user ${user.email}`);
      
    } catch (error) {
      console.error('Error processing deposit event:', error);
    }
  }

  async findUserByMemo(txHash, fromAddress) {
    const pendingDeposit = await Deposit.findOne({
      fromAddress: fromAddress,
      status: 'pending',
      type: 'real'
    }).populate('userId');
    
    return pendingDeposit ? pendingDeposit.userId : null;
  }
}

module.exports = new BlockchainService();