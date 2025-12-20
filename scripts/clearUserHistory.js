const mongoose = require('mongoose');
const User = require('../models/User');
const Investment = require('../models/Investment');
const Withdrawal = require('../models/Withdrawal');

require('dotenv').config();

const clearUserHistory = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = await User.findOne({ email: 'kaifm9096@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }

    // Delete all investments
    const deletedInvestments = await Investment.deleteMany({ userId: user._id });
    console.log(`Deleted ${deletedInvestments.deletedCount} investments`);

    // Delete all withdrawals
    const deletedWithdrawals = await Withdrawal.deleteMany({ userId: user._id });
    console.log(`Deleted ${deletedWithdrawals.deletedCount} withdrawals`);

    // Reset user investment totals
    user.totalInvestment = 0;
    user.referralRewards = 0;
    user.balanceWithdrawn = 0;
    await user.save();
    console.log('Reset user totalInvestment, referralRewards, and balanceWithdrawn to 0');

    console.log('User history cleared successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

clearUserHistory();