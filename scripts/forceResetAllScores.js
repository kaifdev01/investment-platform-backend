require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Deposit = require('../models/Deposit');

const forceResetAllScores = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // First, reset ALL users to 0 points
    const resetResult = await User.updateMany({}, { score: 0 });
    console.log(`🔄 Reset ${resetResult.modifiedCount} users to 0 points`);

    // Get all users with their deposits
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to check`);

    let usersWithDeposits = 0;
    let usersWithoutDeposits = 0;

    for (const user of users) {
      const confirmedDeposits = await Deposit.find({
        userId: user._id,
        status: 'confirmed'
      });

      if (confirmedDeposits.length > 0) {
        // User has deposits - give 50 points
        user.score = 50;
        await user.save();
        usersWithDeposits++;
        console.log(`✅ ${user.email}: 50 points (${confirmedDeposits.length} deposits)`);
      } else {
        // User has no deposits - ensure 0 points
        user.score = 0;
        await user.save();
        usersWithoutDeposits++;
        console.log(`❌ ${user.email}: 0 points (no deposits)`);
      }
    }

    console.log(`\n🎯 Final Results:`);
    console.log(`📈 Users with 50 points: ${usersWithDeposits}`);
    console.log(`📉 Users with 0 points: ${usersWithoutDeposits}`);
    console.log(`📊 Total users: ${users.length}`);

    // Double-check specific user
    const preceUser = await User.findOne({ email: 'Preceamisi@gmail.com' });
    if (preceUser) {
      const preceDeposits = await Deposit.find({
        userId: preceUser._id,
        status: 'confirmed'
      });
      console.log(`\n🔍 Prece Amisi check:`);
      console.log(`   Email: ${preceUser.email}`);
      console.log(`   Score: ${preceUser.score}`);
      console.log(`   Deposits: ${preceDeposits.length}`);
      console.log(`   Balance: ${preceUser.balance}`);
    }

  } catch (error) {
    console.error('Reset failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

forceResetAllScores();