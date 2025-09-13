const Invitation = require('../models/Invitation');

exports.generateInvitation = async (req, res) => {
  try {
    const code = Math.random().toString(36).substring(2, 15);
    const invitation = new Invitation({ code, createdBy: req.user._id });
    await invitation.save();
    res.json({ code });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};