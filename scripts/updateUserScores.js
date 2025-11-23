const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const updateUserScores = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/investment-platform');
    console.log('Connected to MongoDB');

    // Update all users without a score to have the default score of 50
    const result = await User.updateMany(
      { $or: [{ score: { $exists: false } }, { score: null }] },
      { $set: { score: 50 } }
    );

    console.log(`Updated ${result.modifiedCount} users with default score of 50`);

    // Show current user scores
    const users = await User.find({}, 'firstName lastName email score').sort({ score: -1 });
    console.log('\nCurrent user scores:');
    users.forEach(user => {
      console.log(`${user.firstName} ${user.lastName} (${user.email}): ${user.score} points`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error updating user scores:', error);
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  updateUserScores();
}

module.exports = updateUserScores;