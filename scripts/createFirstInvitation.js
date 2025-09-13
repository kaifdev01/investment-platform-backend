require('dotenv').config();
const mongoose = require('mongoose');
const Invitation = require('../models/Invitation');

const createFirstInvitation = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const invitation = new Invitation({
      code: 'ADMIN2025',
      used: false
    });

    await invitation.save();
    console.log('First invitation code created: ADMIN2025');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createFirstInvitation();