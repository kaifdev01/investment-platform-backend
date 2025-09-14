const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createTestAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const testUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      phone: '1234567890',
      password: 'password123',
      withdrawalPassword: 'withdraw123',
      invitationCode: 'TEST123',
      isVerified: true,
      isAdmin: true
    });
    
    await testUser.save();
    console.log('Test admin user created successfully!');
    console.log('Email: admin@test.com');
    console.log('Password: password123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestAdmin();