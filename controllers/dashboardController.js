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
    
    // Calculate current available earnings (not yet requested for withdrawal)
    const currentCycleEarnings = investments
      .filter(inv => inv.canWithdraw && !inv.withdrawalRequestedAt)
      .reduce((sum, inv) => sum + (inv.totalEarned || 0), 0);
    const currentNetEarnings = currentCycleEarnings * 0.85;
    
    // Calculate total earnings that have been requested for withdrawal
    const Withdrawal = require('../models/Withdrawal');
    const withdrawalRequests = await Withdrawal.find({ userId: req.user._id });
    const totalRequestedEarnings = withdrawalRequests.reduce((sum, w) => sum + (w.netAmount || w.amount * 0.85), 0);
    
    // Total earnings = requested withdrawals + current available earnings
    const totalNetEarnings = totalRequestedEarnings + currentNetEarnings;
    const withdrawableBalance = currentNetEarnings; // Only current cycle is withdrawable
    
    res.json({
      accountSummary: {
        balance: user.balance,
        totalInvestment: user.totalInvestment,
        totalEarnings: totalNetEarnings, // Cumulative net earnings
        withdrawableBalance: Math.max(0, withdrawableBalance), // Current cycle net earnings
        balanceWithdrawn: user.balanceWithdrawn || 0, // Amount admin has approved
        referralRewards: user.referralRewards,
        withdrawalWallet: user.withdrawalWallet,
        score: user.score || 0
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