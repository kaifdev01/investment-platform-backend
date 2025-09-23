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
    
    // Calculate current cycle earnings from investments
    const currentCycleEarnings = investments.reduce((sum, inv) => sum + (inv.totalEarned || 0), 0);
    const currentNetEarnings = currentCycleEarnings * 0.85;
    
    // Total earnings = user's stored total + current cycle earnings
    const totalGrossEarnings = (user.totalEarnings || 0) + currentCycleEarnings;
    const totalNetEarnings = totalGrossEarnings * 0.85;
    const withdrawableBalance = currentNetEarnings; // Only current cycle is withdrawable
    
    res.json({
      accountSummary: {
        balance: user.balance,
        totalInvestment: user.totalInvestment,
        totalEarnings: totalNetEarnings, // Cumulative net earnings
        withdrawableBalance: Math.max(0, withdrawableBalance), // Current cycle net earnings
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