const mongoose = require('mongoose');
const User = require('../models/User');
const Investment = require('../models/Investment');
require('dotenv').config();

const deleteUserInvestments = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'kaifm9096@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    const result = await Investment.deleteMany({ userId: user._id });
    console.log(`Deleted ${result.deletedCount} investments for ${user.email}`);

    // Reset user investment totals
    user.totalInvestment = 0;
    await user.save();
    console.log('Reset user totalInvestment to 0');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

deleteUserInvestments();