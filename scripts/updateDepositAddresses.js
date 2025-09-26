require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const updateDepositAddresses = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const masterWallet = process.env.MASTER_WALLET_ADDRESS || '0x517A5645c16F59744E724fA4432c8f2bC85cAb1d';
    
    // Update all users to use master wallet address
    const result = await User.updateMany(
      {}, // Update all users
      { depositAddress: masterWallet }
    );
    
    console.log(`Updated ${result.modifiedCount} users with master wallet address: ${masterWallet}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error updating deposit addresses:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

updateDepositAddresses();