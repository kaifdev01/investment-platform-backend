require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const fixReferralRewards = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Update all users to have referralRewards field if missing
    const result = await User.updateMany(
      { referralRewards: { $exists: false } },
      { $set: { referralRewards: 0 } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} users with referralRewards field`);
    
    // Also ensure all users have the field even if it exists but is null/undefined
    const result2 = await User.updateMany(
      { $or: [{ referralRewards: null }, { referralRewards: undefined }] },
      { $set: { referralRewards: 0 } }
    );
    
    console.log(`✅ Fixed ${result2.modifiedCount} users with null/undefined referralRewards`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixReferralRewards();