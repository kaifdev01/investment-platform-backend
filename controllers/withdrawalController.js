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



    // Find the latest cycle that hasn't been requested for withdrawal
    const availableCycle = investment.cycleEarnings?.find(cycle => !cycle.withdrawalRequested);
    if (!availableCycle) {
      return res.status(400).json({ error: 'No available earnings to withdraw' });
    }
    
    const originalAmount = availableCycle.grossAmount;
    const feeAmount = originalAmount * 0.15; // 15% fee
    const netAmount = originalAmount - feeAmount;
    
    const withdrawal = new Withdrawal({
      userId: req.user._id,
      investmentId,
      amount: originalAmount,
      feeAmount: feeAmount,
      netAmount: netAmount,
      walletAddress,
      cycleNumber: availableCycle.cycleNumber
    });

    await withdrawal.save();

    // Mark this specific cycle as having a withdrawal request
    availableCycle.withdrawalRequested = true;
    investment.withdrawalRequestedAt = new Date();
    investment.withdrawalTimer = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h timer
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

    withdrawal.status = 'completed'; // Mark as completed so new withdrawals can be requested
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    withdrawal.txHash = txHash;
    withdrawal.notes = notes;
    
    await withdrawal.save();

    // Update user's balances when withdrawal is approved
    const user = await User.findById(withdrawal.userId._id || withdrawal.userId);
    if (!user.balanceWithdrawn) user.balanceWithdrawn = 0; // Initialize if missing
    
    user.balanceWithdrawn += withdrawal.netAmount; // Track approved withdrawals
    // Don't add to totalEarnings - it should only show current available earnings
    await user.save();
    
    console.log(`Updated user ${user.email}: balanceWithdrawn +${withdrawal.netAmount}, withdrawableBalance -${withdrawal.netAmount}`);

    // Don't reset investment state - just mark the specific cycle as processed
    const investment = await Investment.findById(withdrawal.investmentId);
    
    // Find and mark the specific cycle as processed
    if (investment.cycleEarnings && withdrawal.cycleNumber) {
      const processedCycle = investment.cycleEarnings.find(cycle => 
        cycle.cycleNumber === withdrawal.cycleNumber
      );
      if (processedCycle) {
        processedCycle.withdrawalProcessed = true;
        processedCycle.processedAt = new Date();
      }
    }
    
    investment.withdrawalApprovedAt = new Date();
    // Don't reset other fields - let cycles continue independently
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

    // Mark the specific cycle as available for withdrawal again
    const investment = await Investment.findById(withdrawal.investmentId);
    
    if (investment.cycleEarnings && withdrawal.cycleNumber) {
      const rejectedCycle = investment.cycleEarnings.find(cycle => 
        cycle.cycleNumber === withdrawal.cycleNumber
      );
      if (rejectedCycle) {
        rejectedCycle.withdrawalRequested = false; // Allow withdrawal request again
      }
    }
    
    await investment.save();

    res.json({ message: 'Withdrawal rejected' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = exports;