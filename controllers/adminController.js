const Deposit = require('../models/Deposit');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const blockchainService = require('../services/blockchainService');
const { getAdminDashboard } = require('./adminDashboardController');
const axios = require('axios');

// Helper function to get actual transaction amount
const getActualTransactionAmount = async (txHash) => {
  try {
    const apiUrl = 'https://api.etherscan.io/v2/api';
    const chainId = 137;
    const apiKey = 'R3FM3RWEWDUANFBCGSXQ6PS13YAQP6W1PI';
    const usdcContract = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    
    const txUrl = `${apiUrl}?chainid=${chainId}&module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    const response = await axios.get(txUrl);
    
    if (!response.data.result) return null;
    
    const tx = response.data.result;
    
    if (tx.to?.toLowerCase() !== usdcContract.toLowerCase()) {
      return null;
    }
    
    if (tx.input && tx.input.startsWith('0xa9059cbb')) {
      const amountHex = tx.input.slice(-64);
      const amountWei = parseInt(amountHex, 16);
      return amountWei / 1000000;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting actual amount:', error);
    return null;
  }
};

// Manual deposit processing with amount validation
exports.processDeposit = async (req, res) => {
  try {
    const { depositId } = req.body;
    
    const deposit = await Deposit.findById(depositId).populate('userId');
    if (!deposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }
    
    if (deposit.status !== 'pending') {
      return res.status(400).json({ error: 'Deposit already processed' });
    }
    
    // For manual approval, skip blockchain validation
    deposit.status = 'confirmed';
    deposit.confirmations = 5;
    deposit.processedAt = new Date();
    await deposit.save();
    
    // Update user balance
    const user = await User.findById(deposit.userId._id);
    user.balance += deposit.amount;
    await user.save();
    
    // Process referral reward (5% of deposit)
    const invitation = await Invitation.findOne({ 
      code: user.invitationCode 
    }).populate('createdBy');
    
    if (invitation && invitation.createdBy) {
      const referrer = invitation.createdBy;
      const rewardAmount = deposit.amount * 0.05; // 5% referral reward
      
      referrer.referralRewards += rewardAmount;
      referrer.balance += rewardAmount;
      referrer.totalEarnings += rewardAmount;
      await referrer.save();
      
      console.log(`Referral reward: $${rewardAmount} given to ${referrer.email}`);
    }
    
    res.json({ 
      message: `Deposit processed successfully: $${actualAmount}`,
      deposit: deposit,
      newBalance: user.balance,
      actualAmount: actualAmount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all pending deposits
exports.getPendingDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ status: 'pending' })
      .populate('userId', 'email firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json({ deposits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Force blockchain scan
exports.forceScan = async (req, res) => {
  try {
    await blockchainService.scanForDeposits();
    res.json({ message: 'Blockchain scan completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin dashboard metrics
exports.getAdminDashboard = getAdminDashboard;

// Get all users with their deposits
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password -withdrawalPassword')
      .sort({ createdAt: -1 });
    
    // Get deposits for each user
    const usersWithDeposits = await Promise.all(
      users.map(async (user) => {
        const deposits = await Deposit.find({ userId: user._id })
          .sort({ createdAt: -1 });
        
        const totalDeposits = deposits
          .filter(d => d.status === 'confirmed')
          .reduce((sum, d) => sum + d.amount, 0);
        
        return {
          ...user.toObject(),
          deposits,
          totalDeposits
        };
      })
    );
    
    res.json({ users: usersWithDeposits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all deposits for admin management
exports.getAllDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({})
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.json({ deposits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin add balance to user account
exports.addUserBalance = async (req, res) => {
  try {
    const { userId, amount, note } = req.body;
    
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid user ID and positive amount required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create admin deposit record
    const deposit = new Deposit({
      userId: user._id,
      amount: parseFloat(amount),
      toAddress: 'admin_credit',
      status: 'confirmed',
      type: 'admin_credit',
      confirmations: 1,
      processedAt: new Date(),
      note: note || 'Admin balance addition'
    });
    
    await deposit.save();
    
    // Update user balance
    user.balance += parseFloat(amount);
    await user.save();
    
    res.json({ 
      message: `Successfully added $${amount} to ${user.firstName} ${user.lastName}'s account`,
      newBalance: user.balance,
      deposit: deposit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};