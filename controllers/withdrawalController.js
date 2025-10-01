const Withdrawal = require('../models/Withdrawal');
const Investment = require('../models/Investment');
const User = require('../models/User');

// Request withdrawal for all available earnings
exports.requestWithdrawAll = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Save wallet address to user profile for future use
    const user = await User.findById(req.user._id);
    if (user.withdrawalWallet !== walletAddress) {
      user.withdrawalWallet = walletAddress;
      await user.save();
    }

    // Find all investments with available earnings
    const investments = await Investment.find({ 
      userId: req.user._id,
      canWithdraw: true
    });

    // Include USDC balance and referral rewards
    const userBalance = user.balance || 0;
    const referralRewards = user.referralRewards || 0;
    const additionalAmount = userBalance + referralRewards;

    if (investments.length === 0 && additionalAmount === 0) {
      return res.status(400).json({ error: 'No available funds to withdraw' });
    }

    let totalGrossAmount = additionalAmount; // Start with balance + referrals
    let withdrawalCount = 0;

    // Process each investment with available cycles
    for (const investment of investments) {
      const availableCycles = investment.cycleEarnings?.filter(cycle => !cycle.withdrawalRequested) || [];
      
      for (const cycle of availableCycles) {
        const originalAmount = cycle.grossAmount;
        const feeAmount = originalAmount * 0.15; // 15% fee
        const netAmount = originalAmount - feeAmount;
        
        const withdrawal = new Withdrawal({
          userId: req.user._id,
          investmentId: investment._id,
          amount: originalAmount,
          feeAmount: feeAmount,
          netAmount: netAmount,
          walletAddress,
          cycleNumber: cycle.cycleNumber
        });

        await withdrawal.save();
        
        // Mark cycle as requested
        cycle.withdrawalRequested = true;
        totalGrossAmount += originalAmount;
        withdrawalCount++;
      }
      
      // Update investment
      investment.withdrawalRequestedAt = new Date();
      investment.withdrawalTimer = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await investment.save();
    }

    const totalFee = (totalGrossAmount - additionalAmount) * 0.15; // Only fee on earnings
    const totalNet = totalGrossAmount - totalFee;

    res.json({ 
      message: `Withdrawal request submitted for all available funds (${withdrawalCount} cycles${additionalAmount > 0 ? ' + balance/rewards' : ''}). Admin approval required.`,
      totalGross: totalGrossAmount,
      totalFee: totalFee,
      totalNet: totalNet,
      withdrawalCount: withdrawalCount,
      balanceAmount: additionalAmount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

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

    // Save wallet address to user profile for future use
    const user = await User.findById(req.user._id);
    if (user.withdrawalWallet !== walletAddress) {
      user.withdrawalWallet = walletAddress;
      await user.save();
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