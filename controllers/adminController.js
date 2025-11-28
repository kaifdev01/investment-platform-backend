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
    const isFirstDeposit = user.balance === 0 && user.totalInvestment === 0;
    user.balance += deposit.amount;
    
    // Give 50 points for first deposit
    if (isFirstDeposit && user.score === 0) {
      user.score = 50;
      console.log(`First deposit bonus: 50 points awarded to ${user.email}`);
    }
    
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

// Admin update user balance (set exact amount)
exports.updateUserBalance = async (req, res) => {
  try {
    const { userId, newBalance, note } = req.body;
    
    if (!userId || newBalance < 0) {
      return res.status(400).json({ error: 'Valid user ID and non-negative balance required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const oldBalance = user.balance;
    const difference = parseFloat(newBalance) - oldBalance;
    
    // Create admin record for the balance change
    const deposit = new Deposit({
      userId: user._id,
      amount: Math.abs(difference),
      toAddress: 'admin_update',
      status: 'confirmed',
      type: 'admin_credit',
      confirmations: 1,
      processedAt: new Date(),
      note: note || `Admin balance ${difference >= 0 ? 'increase' : 'decrease'}: ${oldBalance.toFixed(2)} → ${parseFloat(newBalance).toFixed(2)}`
    });
    
    await deposit.save();
    
    // Update user balance to exact amount
    user.balance = parseFloat(newBalance);
    await user.save();
    
    res.json({ 
      message: `Successfully updated ${user.firstName} ${user.lastName}'s balance from $${oldBalance.toFixed(2)} to $${newBalance}`,
      oldBalance: oldBalance,
      newBalance: user.balance,
      difference: difference,
      deposit: deposit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin reset user password
exports.resetUserPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'User ID and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();
    
    res.json({ 
      message: `Password successfully reset for ${user.firstName} ${user.lastName} (${user.email})`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin update user score
exports.updateUserScore = async (req, res) => {
  try {
    const { userId, scoreChange, note } = req.body;
    
    if (!userId || scoreChange === undefined) {
      return res.status(400).json({ error: 'User ID and score change are required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const oldScore = user.score || 50;
    const newScore = Math.max(0, oldScore + parseInt(scoreChange));
    
    user.score = newScore;
    await user.save();
    
    console.log(`Admin score update: ${user.email} - ${oldScore} → ${newScore} (${scoreChange >= 0 ? '+' : ''}${scoreChange}) - ${note || 'No note'}`);
    
    res.json({ 
      message: `Score updated for ${user.firstName} ${user.lastName}: ${oldScore} → ${newScore} (${scoreChange >= 0 ? '+' : ''}${scoreChange})`,
      oldScore,
      newScore,
      scoreChange: parseInt(scoreChange)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin reset user withdrawal password
exports.resetUserWithdrawalPassword = async (req, res) => {
  try {
    const { userId, newWithdrawalPassword } = req.body;
    
    if (!userId || !newWithdrawalPassword) {
      return res.status(400).json({ error: 'User ID and new withdrawal password are required' });
    }
    
    if (newWithdrawalPassword.length < 6) {
      return res.status(400).json({ error: 'Withdrawal password must be at least 6 characters' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user withdrawal password (will be hashed by pre-save middleware)
    user.withdrawalPassword = newWithdrawalPassword;
    await user.save();
    
    res.json({ 
      message: `Withdrawal password successfully reset for ${user.firstName} ${user.lastName} (${user.email})`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};