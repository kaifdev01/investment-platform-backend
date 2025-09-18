const express = require('express');
const Deposit = require('../models/Deposit');
const User = require('../models/User');
const Invitation = require('../models/Invitation');

const router = express.Router();

// Cron endpoint for external triggers
router.post('/process-deposits', async (req, res) => {
  try {
    const { getUSDCAmountFromTxId } = require('../getTransactionAmount');
    
    const pendingDeposits = await Deposit.find({
      status: 'pending',
      type: 'real'
    }).populate('userId');

    console.log(`🔄 Processing ${pendingDeposits.length} pending deposits...`);
    let processed = 0;

    for (const deposit of pendingDeposits) {
      if (!deposit.txHash) continue;

      // Get actual USDC amount from blockchain
      const result = await getUSDCAmountFromTxId(deposit.txHash);
      
      if (!result.success) {
        console.log(`❌ INVALID: ${deposit.txHash} - ${result.error}`);
        deposit.status = 'failed';
        deposit.processedAt = new Date();
        await deposit.save();
        continue;
      }
      
      const actualAmount = result.amount;
      
      // STRICT VALIDATION: Must match exactly
      if (Math.abs(actualAmount - deposit.amount) >= 0.01) {
        console.log(`❌ MISMATCH: User $${deposit.amount} ≠ Blockchain $${actualAmount}`);
        deposit.status = 'failed';
        deposit.processedAt = new Date();
        await deposit.save();
        continue;
      }

      // Confirm deposit
      deposit.status = 'confirmed';
      deposit.confirmations = 10;
      deposit.processedAt = new Date();
      await deposit.save();

      // Update user balance
      const user = await User.findById(deposit.userId._id);
      user.balance += actualAmount;
      await user.save();

      // Referral reward
      const invitation = await Invitation.findOne({
        code: user.invitationCode
      }).populate('createdBy');

      if (invitation && invitation.createdBy) {
        const referrer = invitation.createdBy;
        const rewardAmount = actualAmount * 0.05;
        referrer.referralRewards += rewardAmount;
        referrer.balance += rewardAmount;
        referrer.totalEarnings += rewardAmount;
        await referrer.save();
      }

      console.log(`✅ CONFIRMED: $${actualAmount} for ${user.email}`);
      processed++;
    }
    
    res.json({ 
      success: true, 
      message: `Processed ${processed} deposits`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;