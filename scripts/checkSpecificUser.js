require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email: 'Preceamisi@gmail.com' });
    if (user) {
      console.log('🔍 Current user data:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Score: ${user.score}`);
      console.log(`   Balance: ${user.balance}`);
      console.log(`   Total Investment: ${user.totalInvestment}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Updated: ${user.updatedAt}`);
      
      // Force update to 0
      user.score = 0;
      await user.save();
      console.log('✅ Forced score to 0 and saved');
      
      // Verify the update
      const updatedUser = await User.findOne({ email: 'Preceamisi@gmail.com' });
      console.log(`🔄 Verified score after update: ${updatedUser.score}`);
    } else {
      console.log('❌ User not found');
    }

  } catch (error) {
    console.error('Check failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

checkUser();