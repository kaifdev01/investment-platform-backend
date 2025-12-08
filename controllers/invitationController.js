const Invitation = require('../models/Invitation');

const User = require('../models/User');

exports.createInvitation = async (req, res) => {
  try {
    let user = await User.findById(req.user._id);
    
    console.log(`Invitation request for ${user.email}, current code: ${user.myReferralCode}`);
    
    if (!user.myReferralCode || user.myReferralCode === '') {
      const userId = user._id.toString();
      const createdTime = user.createdAt ? user.createdAt.getTime().toString(36) : Date.now().toString(36);
      user.myReferralCode = userId.substring(userId.length - 6) + createdTime.substring(createdTime.length - 4);
      await user.save();
      console.log(`Generated NEW permanent code for ${user.email}: ${user.myReferralCode}`);
    } else {
      console.log(`Returning EXISTING code for ${user.email}: ${user.myReferralCode}`);
    }
    
    res.json({ code: user.myReferralCode });
  } catch (error) {
    console.error('Error in createInvitation:', error);
    res.status(400).json({ error: error.message });
  }
}; 