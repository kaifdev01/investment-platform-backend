require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const updateDepositAddresses = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const masterWallet = process.env.MASTER_WALLET_ADDRESS || '0x857B7F4Cd911aB51e41D311cB437bBe33A229808';
    
    // Update all users to use master wallet address
    const result = await User.updateMany(
      {}, // Update all users
      { depositAddress: masterWallet }
    );
    
    console.log(`Updated ${result.modifiedCount} users with master wallet address: ${masterWallet}`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating deposit addresses:', error);
    process.exit(1);
  }
};

updateDepositAddresses();