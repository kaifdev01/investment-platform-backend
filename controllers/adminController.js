const Deposit = require('../models/Deposit');
const User = require('../models/User');
const Invitation = require('../models/Invitation');
const blockchainService = require('../services/blockchainService');

// Manual deposit processing for testing
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
    
    // For testing: manually confirm the deposit
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
      message: 'Deposit processed successfully',
      deposit: deposit,
      newBalance: user.balance
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