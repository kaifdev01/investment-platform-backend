require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const changeWithdrawalPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const userEmail = 'adeelimran467@gmail.com'; // Change this to the user's email
    const newWithdrawalPassword = 'adeel1122'; // Change this to the new password

    // Find user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log('User not found');
      return;
    }

    console.log(`Found user: ${user.firstName} ${user.lastName} (${user.email})`);

    // Update withdrawal password
    user.withdrawalPassword = newWithdrawalPassword;
    await user.save();

    console.log('Withdrawal password updated successfully');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

changeWithdrawalPassword();