require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const fixBalanceWithdrawn = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Update all users to have balanceWithdrawn field if missing
    const result = await User.updateMany(
      { balanceWithdrawn: { $exists: false } },
      { $set: { balanceWithdrawn: 0 } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} users with balanceWithdrawn field`);
    
    // Also ensure all users have the field even if it exists but is null/undefined
    const result2 = await User.updateMany(
      { $or: [{ balanceWithdrawn: null }, { balanceWithdrawn: undefined }] },
      { $set: { balanceWithdrawn: 0 } }
    );
    
    console.log(`✅ Fixed ${result2.modifiedCount} users with null/undefined balanceWithdrawn`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

fixBalanceWithdrawn();