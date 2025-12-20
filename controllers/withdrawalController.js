const Withdrawal = require('../models/Withdrawal');
const Investment = require('../models/Investment');
const User = require('../models/User');

// Request withdrawal for all available earnings
exports.requestWithdrawAll = async (req, res) => {
  try {
    const { walletAddress, withdrawalPassword, amount } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    if (!withdrawalPassword) {
      return res.status(400).json({ error: 'Withdrawal password is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid withdrawal amount is required' });
    }

    // Save wallet address to user profile for future use
    const user = await User.findById(req.user._id);
    if (user.withdrawalWallet !== walletAddress) {
      user.withdrawalWallet = walletAddress;
      await user.save();
    }

    // Verify withdrawal password
    console.log('=== WITHDRAWAL PASSWORD VERIFICATION ===');
    console.log('User ID:', req.user._id);
    console.log('User email:', user.email);
    console.log('Password provided:', withdrawalPassword);
    console.log('Stored hash:', user.withdrawalPassword);
    
    // Refresh user data to ensure we have the latest withdrawal password
    const freshUser = await User.findById(req.user._id);
    console.log('Fresh user hash:', freshUser.withdrawalPassword);
    console.log('Hashes match:', user.withdrawalPassword === freshUser.withdrawalPassword);
    
    const isPasswordValid = await freshUser.compareWithdrawalPassword(withdrawalPassword);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid withdrawal password' });
    }
    console.log('=== PASSWORD VERIFICATION PASSED ===');

    // Find all investments with available earnings
    const investments = await Investment.find({ 
      userId: req.user._id,
      canWithdraw: true
    });

    // Include USDC balance and referral rewards
    const userBalance = user.balance || 0;
    const referralRewards = user.referralRewards || 0;
    const additionalAmount = userBalance + referralRewards;

    // Calculate total available earnings
    const availableEarnings = investments.reduce((total, investment) => {
      const availableCycles = investment.cycleEarnings?.filter(cycle => !cycle.withdrawalRequested) || [];
      return total + availableCycles.reduce((sum, cycle) => sum + (cycle.grossAmount * 0.85), 0); // Net after 15% fee
    }, 0);

    const totalAvailable = additionalAmount + availableEarnings;

    if (totalAvailable === 0) {
      return res.status(400).json({ error: 'No available funds to withdraw' });
    }

    if (amount > totalAvailable) {
      return res.status(400).json({ 
        error: `Insufficient funds. Available: $${totalAvailable.toFixed(2)}, Requested: $${amount.toFixed(2)}` 
      });
    }

    let remainingAmount = amount;
    let withdrawalCount = 0;
    let totalProcessed = 0;

    // First, use balance and referral rewards if available and needed
    if (additionalAmount > 0 && remainingAmount > 0) {
      const balanceToUse = Math.min(additionalAmount, remainingAmount);
      
      const balanceWithdrawal = new Withdrawal({
        userId: req.user._id,
        investmentId: null,
        amount: balanceToUse,
        feeAmount: 0,
        netAmount: balanceToUse,
        walletAddress,
        cycleNumber: null,
        type: 'balance_and_rewards',
        originalBalance: Math.min(userBalance, balanceToUse),
        originalReferralRewards: Math.min(referralRewards, balanceToUse - Math.min(userBalance, balanceToUse))
      });

      await balanceWithdrawal.save();
      withdrawalCount++;
      totalProcessed += balanceToUse;
      remainingAmount -= balanceToUse;
      
      // Deduct from user balance and referral rewards proportionally
      const balanceUsed = Math.min(userBalance, balanceToUse);
      const rewardsUsed = balanceToUse - balanceUsed;
      user.balance -= balanceUsed;
      user.referralRewards -= rewardsUsed;
      await user.save();
    }

    // Then process earnings if more amount is needed
    if (remainingAmount > 0) {
      for (const investment of investments) {
        if (remainingAmount <= 0) break;
        
        const availableCycles = investment.cycleEarnings?.filter(cycle => !cycle.withdrawalRequested) || [];
        
        for (const cycle of availableCycles) {
          if (remainingAmount <= 0) break;
          
          const cycleNetAmount = cycle.grossAmount * 0.85; // Net after 15% fee
          const amountToWithdraw = Math.min(cycleNetAmount, remainingAmount);
          
          // Calculate gross amount needed to get the desired net amount
          const grossNeeded = amountToWithdraw / 0.85;
          const feeAmount = grossNeeded * 0.15;
          
          const withdrawal = new Withdrawal({
            userId: req.user._id,
            investmentId: investment._id,
            amount: grossNeeded,
            feeAmount: feeAmount,
            netAmount: amountToWithdraw,
            walletAddress,
            cycleNumber: cycle.cycleNumber,
            type: 'earnings'
          });

          await withdrawal.save();
          cycle.withdrawalRequested = true;
          withdrawalCount++;
          totalProcessed += amountToWithdraw;
          remainingAmount -= amountToWithdraw;
        }
        
        // Update investment if any cycles were processed
        const processedCycles = investment.cycleEarnings?.filter(cycle => cycle.withdrawalRequested) || [];
        if (processedCycles.length > 0) {
          investment.withdrawalRequestedAt = new Date();
          investment.withdrawalTimer = new Date(Date.now() + 48 * 60 * 60 * 1000);
          await investment.save();
        }
      }
    }

    // Withdrawal request submitted (score managed by admin)
    
    res.json({ 
      message: `Withdrawal request submitted for $${totalProcessed.toFixed(2)} (${withdrawalCount} withdrawal records). Admin approval required.`,
      totalProcessed: totalProcessed,
      withdrawalCount: withdrawalCount,
      requestedAmount: amount
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
      cycleNumber: availableCycle.cycleNumber,
      type: 'earnings'
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

// Admin: Get all pending withdrawals (grouped by user)
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .populate('userId', 'firstName lastName email')
      .populate('investmentId')
      .sort({ requestedAt: -1 });
    
    // Group withdrawals by user
    const groupedWithdrawals = {};
    
    withdrawals.forEach(withdrawal => {
      const userId = withdrawal.userId._id.toString();
      
      if (!groupedWithdrawals[userId]) {
        groupedWithdrawals[userId] = {
          user: withdrawal.userId,
          withdrawals: [],
          totalGrossAmount: 0,
          totalNetAmount: 0,
          totalFeeAmount: 0,
          count: 0,
          earliestRequest: withdrawal.requestedAt
        };
      }
      
      // Add withdrawal details
      const withdrawalObj = withdrawal.toObject();
      if (withdrawal.type === 'balance_and_rewards') {
        withdrawalObj.description = `Balance Withdrawal Request - USDC Balance: $${withdrawal.originalBalance || 0} + Referral Rewards: $${withdrawal.originalReferralRewards || 0}`;
        withdrawalObj.displayType = 'Balance Withdrawal Request';
      } else {
        withdrawalObj.description = `Cycle ${withdrawal.cycleNumber} earnings (15% fee applied)`;
        withdrawalObj.displayType = `Investment Cycle ${withdrawal.cycleNumber}`;
      }
      
      groupedWithdrawals[userId].withdrawals.push(withdrawalObj);
      groupedWithdrawals[userId].totalGrossAmount += withdrawal.amount;
      groupedWithdrawals[userId].totalNetAmount += withdrawal.netAmount;
      groupedWithdrawals[userId].totalFeeAmount += (withdrawal.feeAmount || 0);
      groupedWithdrawals[userId].count += 1;
      
      // Track earliest request
      if (withdrawal.requestedAt < groupedWithdrawals[userId].earliestRequest) {
        groupedWithdrawals[userId].earliestRequest = withdrawal.requestedAt;
      }
    });
    
    // Convert to array and sort by earliest request
    const groupedArray = Object.values(groupedWithdrawals)
      .sort((a, b) => new Date(a.earliestRequest) - new Date(b.earliestRequest));
    
    res.json({ 
      groupedWithdrawals: groupedArray,
      totalUsers: groupedArray.length,
      totalWithdrawals: withdrawals.length
    });
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

    withdrawal.status = 'completed';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    withdrawal.txHash = txHash;
    withdrawal.notes = notes;
    
    await withdrawal.save();

    const user = await User.findById(withdrawal.userId._id || withdrawal.userId);
    if (!user.balanceWithdrawn) user.balanceWithdrawn = 0;
    
    user.balanceWithdrawn += withdrawal.netAmount;
    await user.save();
    
    console.log(`Updated user ${user.email}: balanceWithdrawn +${withdrawal.netAmount}`);

    if (withdrawal.type === 'earnings' && withdrawal.investmentId) {
      const investment = await Investment.findById(withdrawal.investmentId);
      
      if (investment && investment.cycleEarnings && withdrawal.cycleNumber) {
        const processedCycle = investment.cycleEarnings.find(cycle => 
          cycle.cycleNumber === withdrawal.cycleNumber
        );
        if (processedCycle) {
          processedCycle.withdrawalProcessed = true;
          processedCycle.processedAt = new Date();
        }
      }
      
      if (investment) {
        investment.withdrawalApprovedAt = new Date();
        await investment.save();
      }
    }

    const { distributeReferralRewards } = require('../services/referralService');
    await distributeReferralRewards(withdrawal.userId._id, withdrawal.netAmount);

    res.json({ message: 'Withdrawal approved successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Admin: Approve all user withdrawals
exports.approveUserWithdrawals = async (req, res) => {
  try {
    const { userId, txHash, notes } = req.body;
    
    const withdrawals = await Withdrawal.find({ 
      userId, 
      status: 'pending' 
    }).populate('userId');
    
    if (withdrawals.length === 0) {
      return res.status(404).json({ error: 'No pending withdrawals found for this user' });
    }

    let totalNetAmount = 0;
    
    // Process all withdrawals
    for (const withdrawal of withdrawals) {
      withdrawal.status = 'completed';
      withdrawal.processedAt = new Date();
      withdrawal.processedBy = req.user._id;
      withdrawal.txHash = txHash;
      withdrawal.notes = notes;
      
      await withdrawal.save();
      totalNetAmount += withdrawal.netAmount;
      
      // Handle investment updates for earnings withdrawals
      if (withdrawal.type === 'earnings' && withdrawal.investmentId) {
        const investment = await Investment.findById(withdrawal.investmentId);
        
        if (investment && investment.cycleEarnings && withdrawal.cycleNumber) {
          const processedCycle = investment.cycleEarnings.find(cycle => 
            cycle.cycleNumber === withdrawal.cycleNumber
          );
          if (processedCycle) {
            processedCycle.withdrawalProcessed = true;
            processedCycle.processedAt = new Date();
          }
        }
        
        if (investment) {
          investment.withdrawalApprovedAt = new Date();
          await investment.save();
        }
      }
    }

    // Update user balance
    const user = await User.findById(userId);
    if (!user.balanceWithdrawn) user.balanceWithdrawn = 0;
    user.balanceWithdrawn += totalNetAmount;
    await user.save();
    
    console.log(`Bulk approved ${withdrawals.length} withdrawals for ${user.email}: total $${totalNetAmount}`);

    // Distribute referral rewards
    const { distributeReferralRewards } = require('../services/referralService');
    await distributeReferralRewards(userId, totalNetAmount);

    res.json({ 
      message: `Successfully approved ${withdrawals.length} withdrawals for ${user.firstName} ${user.lastName} (Total: $${totalNetAmount.toFixed(2)})`,
      processedCount: withdrawals.length,
      totalAmount: totalNetAmount
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Admin: Reject all user withdrawals
exports.rejectUserWithdrawals = async (req, res) => {
  try {
    const { userId, notes } = req.body;
    
    const withdrawals = await Withdrawal.find({ 
      userId, 
      status: 'pending' 
    }).populate('userId');
    
    if (withdrawals.length === 0) {
      return res.status(404).json({ error: 'No pending withdrawals found for this user' });
    }

    // Process all withdrawals
    for (const withdrawal of withdrawals) {
      withdrawal.status = 'rejected';
      withdrawal.processedAt = new Date();
      withdrawal.processedBy = req.user._id;
      withdrawal.notes = notes;
      
      await withdrawal.save();
      
      // Restore balance for balance_and_rewards withdrawals
      if (withdrawal.type === 'balance_and_rewards') {
        const user = await User.findById(withdrawal.userId._id || withdrawal.userId);
        user.balance = (user.balance || 0) + (withdrawal.originalBalance || 0);
        user.referralRewards = (user.referralRewards || 0) + (withdrawal.originalReferralRewards || 0);
        await user.save();
      }

      // Handle investment updates for earnings withdrawals
      if (withdrawal.type === 'earnings' && withdrawal.investmentId) {
        const investment = await Investment.findById(withdrawal.investmentId);
        
        if (investment && investment.cycleEarnings && withdrawal.cycleNumber) {
          const rejectedCycle = investment.cycleEarnings.find(cycle => 
            cycle.cycleNumber === withdrawal.cycleNumber
          );
          if (rejectedCycle) {
            rejectedCycle.withdrawalRequested = false;
          }
        }
        
        if (investment) {
          await investment.save();
        }
      }
    }

    const user = withdrawals[0].userId;
    console.log(`Bulk rejected ${withdrawals.length} withdrawals for ${user.email}`);

    res.json({ 
      message: `Successfully rejected ${withdrawals.length} withdrawals for ${user.firstName} ${user.lastName}`,
      processedCount: withdrawals.length
    });
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
    
    // If balance_and_rewards withdrawal is rejected, restore the balance
    if (withdrawal.type === 'balance_and_rewards') {
      const user = await User.findById(withdrawal.userId);
      user.balance = (user.balance || 0) + (withdrawal.originalBalance || 0);
      user.referralRewards = (user.referralRewards || 0) + (withdrawal.originalReferralRewards || 0);
      await user.save();
    }

    // Only process investment updates for earnings withdrawals
    if (withdrawal.type === 'earnings' && withdrawal.investmentId) {
      const investment = await Investment.findById(withdrawal.investmentId);
      
      if (investment && investment.cycleEarnings && withdrawal.cycleNumber) {
        const rejectedCycle = investment.cycleEarnings.find(cycle => 
          cycle.cycleNumber === withdrawal.cycleNumber
        );
        if (rejectedCycle) {
          rejectedCycle.withdrawalRequested = false; // Allow withdrawal request again
        }
      }
      
      if (investment) {
        await investment.save();
      }
    }

    res.json({ message: 'Withdrawal rejected' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = exports;