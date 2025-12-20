const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const fixWithdrawalPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = await User.findOne({ email: 'kaifm9096@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }

    const resetPassword = '123456';
    
    // Directly hash and update without triggering pre-save middleware
    const hashedPassword = await bcrypt.hash(resetPassword, 12);
    
    await User.updateOne(
      { email: 'kaifm9096@gmail.com' },
      { $set: { withdrawalPassword: hashedPassword } }
    );
    
    // Verify the update worked
    const updatedUser = await User.findOne({ email: 'kaifm9096@gmail.com' });
    const isValid = await bcrypt.compare(resetPassword, updatedUser.withdrawalPassword);
    
    console.log('Password reset to:', resetPassword);
    console.log('New hash:', hashedPassword);
    console.log('Verification successful:', isValid);
    
    if (isValid) {
      console.log('SUCCESS: You can now use "123456" as withdrawal password');
    } else {
      console.log('FAILED: Password verification failed');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

fixWithdrawalPassword();