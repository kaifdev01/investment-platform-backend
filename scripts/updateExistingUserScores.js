require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Deposit = require('../models/Deposit');

const updateExistingUserScores = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log(`Found ${users.length} users to update`);

    let updatedCount = 0;

    for (const user of users) {
      // Check if user has any confirmed deposits
      const confirmedDeposits = await Deposit.find({
        userId: user._id,
        status: 'confirmed'
      });

      // Force all users to 0 points first
      let newScore = 0;

      // Only give 50 points if user has confirmed deposits
      if (confirmedDeposits.length > 0) {
        newScore = 50;
      }

      // Always update score to ensure consistency
      user.score = newScore;
      await user.save();
      updatedCount++;
      console.log(`Set ${user.email}: ${newScore} points (${confirmedDeposits.length} deposits)`);
    }

    console.log(`\n✅ Migration completed!`);
    console.log(`📊 Total users processed: ${users.length}`);
    console.log(`🔄 Users updated: ${updatedCount}`);
    console.log(`📈 Users with 50 points: ${users.filter(u => u.score === 50).length}`);
    console.log(`📉 Users with 0 points: ${users.filter(u => u.score === 0).length}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the migration
updateExistingUserScores();