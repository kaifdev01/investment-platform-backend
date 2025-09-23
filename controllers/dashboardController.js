const User = require('../models/User');
const Investment = require('../models/Investment');
const Invitation = require('../models/Invitation');

exports.getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Update user's coinbaseDepositAddress if not set
    if (!user.coinbaseDepositAddress) {
      user.coinbaseDepositAddress = process.env.COINBASE_WALLET_ADDRESS || process.env.MASTER_WALLET_ADDRESS;
      await user.save();
    }
    
    const investments = await Investment.find({ userId: req.user._id, status: 'Active' });
    
    // Calculate totals from investments (net amounts after 15% fee)
    const grossEarnings = investments.reduce((sum, inv) => sum + (inv.totalEarned || 0), 0);
    const netEarnings = grossEarnings * 0.85; // 15% fee deducted
    const withdrawableBalance = netEarnings - (user.balanceWithdrawn || 0);
    
    res.json({
      accountSummary: {
        balance: user.balance,
        totalInvestment: user.totalInvestment,
        totalEarnings: netEarnings, // Net earnings after fee
        withdrawableBalance: Math.max(0, withdrawableBalance), // Net earnings minus withdrawn amount
        balanceWithdrawn: user.balanceWithdrawn || 0, // Amount admin has approved
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