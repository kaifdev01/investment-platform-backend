require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const email = 'infohprfarm@gmail.com';
    console.log(`🔍 Looking for user: ${email}`);
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      
      // Let's check all users to see what emails exist
      const allUsers = await User.find({}, 'email firstName lastName isAdmin');
      console.log('\n📋 All users in database:');
      allUsers.forEach((u, index) => {
        console.log(`${index + 1}. ${u.email} - ${u.firstName} ${u.lastName} ${u.isAdmin ? '(ADMIN)' : ''}`);
      });
    } else {
      console.log('✅ User found:', {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        isAdmin: user.isAdmin,
        id: user._id
      });
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

checkUser();