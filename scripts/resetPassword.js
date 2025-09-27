require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const resetPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const email = 'kaifm9096@gmail.com';
    const newPassword = 'qwerty1122@'; // Change this to your desired password

    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found`);
      process.exit(1);
    }

    console.log('Found user:', {
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      isAdmin: user.isAdmin
    });

    // Manually hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log('🔐 Hashing password...');

    // Update password directly in database
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });

    console.log('🔍 Password hash preview:', hashedPassword.substring(0, 20) + '...');

    console.log(`✅ Password reset successfully for ${email}`);
    console.log(`🔑 New password: ${newPassword}`);
    console.log('You can now login with this password');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

resetPassword();