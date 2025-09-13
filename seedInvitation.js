require('dotenv').config();
const mongoose = require('mongoose');
const Invitation = require('./models/Invitation');

const seedInvitation = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/user-onboarding');
    
    const code = Math.random().toString(36).substring(2, 15);
    const invitation = new Invitation({ code });
    await invitation.save();
    
    console.log(`Invitation code created: ${code}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

seedInvitation();