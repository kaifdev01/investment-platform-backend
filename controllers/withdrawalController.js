const Withdrawal = require('../models/Withdrawal');
const Investment = require('../models/Investment');
const User = require('../models/User');

// Request withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const { investmentId, walletAddress } = req.body;
    
    const investment = await Investment.findById(investmentId);
    if (!investment || investment.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    if (!investment.canWithdraw) {
      return res.status(400).json({ error: 'Withdrawal not available yet' });
    }

    // Check if withdrawal already requested for current cycle
    const existingWithdrawal = await Withdrawal.findOne({
      investmentId,
      status: 'pending' // Only check for pending withdrawals
    });

    if (existingWithdrawal) {
      return res.status(400).json({ error: 'Withdrawal already requested for this cycle' });
    }

    const originalAmount = investment.totalEarned;
    const feeAmount = originalAmount * 0.15; // 15% fee
    const netAmount = originalAmount - feeAmount;
    
    const withdrawal = new Withdrawal({
      userId: req.user._id,
      investmentId,
      amount: originalAmount,
      feeAmount: feeAmount,
      netAmount: netAmount,
      walletAddress
    });

    await withdrawal.save();

    // Mark investment as withdrawal requested
    investment.withdrawalRequestedAt = new Date();
    investment.canWithdraw = false;
    await investment.save();

    res.json({ message: 'Withdrawal requested successfully. Admin approval required.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get user withdrawals
exports.getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id })
      .populate('investmentId')
      .sort({ requestedAt: -1 });
    
    res.json({ withdrawals });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Admin: Get all pending withdrawals
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .populate('userId', 'firstName lastName email')
      .populate('investmentId')
      .sort({ requestedAt: -1 });
    
    res.json({ withdrawals });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Admin: Get all withdrawals (history)
exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({})
      .populate('userId', 'firstName lastName email')
      .populate('investmentId')
      .populate('processedBy', 'firstName lastName email')
      .sort({ requestedAt: -1 });
    
    res.json({ withdrawals });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Admin: Approve withdrawal
exports.approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId, txHash, notes } = req.body;
    
    const withdrawal = await Withdrawal.findById(withdrawalId).populate('userId');
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    withdrawal.status = 'approved';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    withdrawal.txHash = txHash;
    withdrawal.notes = notes;
    
    await withdrawal.save();

    // Update user's balances when withdrawal is approved
    const user = await User.findById(withdrawal.userId._id || withdrawal.userId);
    if (!user.balanceWithdrawn) user.balanceWithdrawn = 0; // Initialize if missing
    user.balanceWithdrawn += withdrawal.netAmount; // Track approved withdrawals
    user.withdrawableBalance -= withdrawal.netAmount; // Remove net amount from withdrawable
    await user.save();
    
    console.log(`Updated user ${user.email}: balanceWithdrawn +${withdrawal.netAmount}, withdrawableBalance -${withdrawal.netAmount}`);

    // Set 48-hour waiting period for next cycle
    const investment = await Investment.findById(withdrawal.investmentId);
    const now = new Date();
    investment.withdrawalApprovedAt = now;
    investment.nextCycleAvailableAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
    await investment.save();

    // Distribute referral rewards when admin approves withdrawal (based on net amount)
    const { distributeReferralRewards } = require('../services/referralService');
    await distributeReferralRewards(withdrawal.userId._id, withdrawal.netAmount);

    res.json({ message: 'Withdrawal approved successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Admin: Reject withdrawal
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId, notes } = req.body;
    
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    withdrawal.status = 'rejected';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    withdrawal.notes = notes;
    
    await withdrawal.save();

    // Allow user to request withdrawal again
    const investment = await Investment.findById(withdrawal.investmentId);
    investment.canWithdraw = true;
    investment.withdrawalRequestedAt = null;
    await investment.save();

    res.json({ message: 'Withdrawal rejected' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = exports;