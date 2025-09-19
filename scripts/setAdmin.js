require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const setAdminStatus = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Replace with your admin email
    const adminEmail = 'kaifm9096@gmail.com'; // CHANGE THIS TO YOUR EMAIL

    const user = await User.findOne({ email: adminEmail });

    if (!user) {
      console.log(`User with email ${adminEmail} not found`);
      process.exit(1);
    }

    console.log('Current user status:', {
      email: user.email,
      isAdmin: user.isAdmin,
      name: `${user.firstName} ${user.lastName}`
    });

    // Set admin status
    user.isAdmin = true;
    await user.save();

    console.log(`✅ Admin status set for ${user.email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

setAdminStatus();