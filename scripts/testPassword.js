const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

require('dotenv').config();

const testPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = await User.findOne({ email: 'kaifm9096@gmail.com' });
    if (!user) {
      console.log('User not found');
      return;
    }

    const testPasswords = ['123456', 'qwerty1122', '12312312'];
    
    console.log('Testing passwords against stored hash:', user.withdrawalPassword);
    
    for (const pwd of testPasswords) {
      const isValid = await user.compareWithdrawalPassword(pwd);
      console.log(`Password "${pwd}": ${isValid ? 'VALID' : 'INVALID'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

testPassword();