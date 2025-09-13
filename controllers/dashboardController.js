const User = require('../models/User');
const Investment = require('../models/Investment');
const Invitation = require('../models/Invitation');

exports.getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const investments = await Investment.find({ userId: req.user._id, status: 'Active' });
    
    res.json({
      accountSummary: {
        balance: user.balance,
        totalInvestment: user.totalInvestment,
        totalEarnings: user.totalEarnings,
        withdrawableBalance: user.withdrawableBalance,
        referralRewards: user.referralRewards
      },
      activeInvestments: investments
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getReferrals = async (req, res) => {
  try {
    const invitations = await Invitation.find({ 
      createdBy: req.user._id, 
      used: true 
    }).populate('usedBy', 'firstName lastName email createdAt');
    
    res.json({ referrals: invitations.map(inv => inv.usedBy) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};