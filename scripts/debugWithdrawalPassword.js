require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function debugWithdrawalPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a user (replace with actual email)
    const userEmail = 'kaifm9096@gmail.com';
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('User found:', user.email);
    console.log('Current withdrawal password hash:', user.withdrawalPassword);
    
    // Test password comparison
    const testPassword = 'kaifkaif';
    const isValid = await user.compareWithdrawalPassword(testPassword);
    console.log(`Password "${testPassword}" is valid:`, isValid);
    
    // Test direct bcrypt comparison
    const directCompare = await bcrypt.compare(testPassword, user.withdrawalPassword);
    console.log('Direct bcrypt comparison:', directCompare);
    
    // Check if password is actually hashed
    const isHashed = user.withdrawalPassword.startsWith('$2');
    console.log('Password appears to be hashed:', isHashed);
    
    if (!isValid) {
      console.log('❌ PASSWORD COMPARISON FAILED! Fixing...');
      
      // Direct hash and update
      const hashedPassword = await bcrypt.hash(testPassword, 12);
      await User.findByIdAndUpdate(user._id, { withdrawalPassword: hashedPassword });
      
      // Reload user to test
      const updatedUser = await User.findById(user._id);
      const newTest = await updatedUser.compareWithdrawalPassword(testPassword);
      
      console.log('✅ Password has been re-hashed');
      console.log('New hash:', updatedUser.withdrawalPassword);
      console.log('New password test:', newTest);
    } else {
      console.log('✅ Password is working correctly');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugWithdrawalPassword();