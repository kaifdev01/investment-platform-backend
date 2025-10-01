require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Investment = require('../models/Investment');
const Withdrawal = require('../models/Withdrawal');

const deleteUserInvestments = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const userEmail = 'adeelimran467@gmail.com';

    // Find user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log(`Found user: ${user.firstName} ${user.lastName} (${user.email})`);

    // Delete all investments for this user
    const deletedInvestments = await Investment.deleteMany({ userId: user._id });
    console.log(`Deleted ${deletedInvestments.deletedCount} investments`);

    // Delete all withdrawals for this user
    const deletedWithdrawals = await Withdrawal.deleteMany({ userId: user._id });
    console.log(`Deleted ${deletedWithdrawals.deletedCount} withdrawals`);

    // Reset user balances
    user.totalEarnings = 0;
    user.withdrawableBalance = 0;
    user.balanceWithdrawn = 0;
    await user.save();

    console.log('User balances reset to 0');
    console.log('Cleanup completed successfully');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

deleteUserInvestments();