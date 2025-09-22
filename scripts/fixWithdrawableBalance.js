require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const fixWithdrawableBalance = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Update all users to have withdrawableBalance field if missing
    const result = await User.updateMany(
      { withdrawableBalance: { $exists: false } },
      { $set: { withdrawableBalance: 0 } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} users with withdrawableBalance field`);
    
    // Also ensure all users have the field even if it exists but is null/undefined
    const result2 = await User.updateMany(
      { $or: [{ withdrawableBalance: null }, { withdrawableBalance: undefined }] },
      { $set: { withdrawableBalance: 0 } }
    );
    
    console.log(`✅ Fixed ${result2.modifiedCount} users with null/undefined withdrawableBalance`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

fixWithdrawableBalance();