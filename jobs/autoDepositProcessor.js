const cron = require('node-cron');
const Deposit = require('../models/Deposit');
const User = require('../models/User');
const Invitation = require('../models/Invitation');

class AutoDepositProcessor {
  constructor() {
    // Not needed anymore - using external function
  }

  async processAllPendingDeposits() {
    try {
      const pendingDeposits = await Deposit.find({
        status: 'pending',
        type: 'real'
      }).populate('userId');

      console.log(`🔄 Processing ${pendingDeposits.length} pending deposits...`);

      for (const deposit of pendingDeposits) {
        await this.processSingleDeposit(deposit);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error('Error processing pending deposits:', error);
    }
  }

  async processSingleDeposit(deposit) {
    try {
      if (!deposit.txHash) return;

      // Get actual USDC amount from blockchain
      const { getUSDCAmountFromTxId } = require('../getTransactionAmount');
      const result = await getUSDCAmountFromTxId(deposit.txHash);
      
      if (!result.success) {
        console.log(`❌ INVALID TRANSACTION: ${result.error}`);
        deposit.status = 'failed';
        deposit.processedAt = new Date();
        await deposit.save();
        return;
      }
      
      const actualAmount = result.amount;
      
      // STRICT VALIDATION: Amounts must match exactly
      if (Math.abs(actualAmount - deposit.amount) >= 0.01) {
        console.log(`❌ AMOUNT MISMATCH: User entered $${deposit.amount}, Blockchain shows $${actualAmount}`);
        deposit.status = 'failed';
        deposit.processedAt = new Date();
        await deposit.save();
        return;
      }

      console.log(`✅ AMOUNTS MATCH: User $${deposit.amount} = Blockchain $${actualAmount}`);

      // Confirm deposit
      deposit.status = 'confirmed';
      deposit.confirmations = 10;
      deposit.blockNumber = 12345;
      deposit.processedAt = new Date();
      await deposit.save();

      // Update user balance
      const user = await User.findById(deposit.userId._id);
      user.balance += actualAmount;
      await user.save();

      // Process referral reward (5%)
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

        console.log(`💰 Referral reward: $${rewardAmount} given to ${referrer.email}`);
      }

      console.log(`✅ SUCCESS: $${actualAmount} confirmed for ${user.email}`);

    } catch (error) {
      console.error(`Error processing deposit ${deposit._id}:`, error);
    }
  }
}

const processor = new AutoDepositProcessor();

const startAutoDepositProcessing = () => {
  console.log('Starting automatic deposit processing...');
  cron.schedule('*/2 * * * *', async () => {
    try {
      await processor.processAllPendingDeposits();
    } catch (error) {
      console.error('Auto deposit processing error:', error);
    }
  });
  console.log('✅ Automatic deposit processing started - checking every 2 minutes');
};

module.exports = { startAutoDepositProcessing };