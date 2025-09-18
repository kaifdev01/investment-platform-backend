const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Investment = require('../models/Investment');
const Withdrawal = require('../models/Withdrawal');

exports.getAdminDashboard = async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get total deposits (confirmed only)
    const totalDepositsResult = await Deposit.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalDeposits = totalDepositsResult[0]?.total || 0;
    
    // Get total investments
    const totalInvestmentsResult = await Investment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalInvestments = totalInvestmentsResult[0]?.total || 0;
    
    // Get total withdrawals (approved only)
    const totalWithdrawalsResult = await Withdrawal.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawals = totalWithdrawalsResult[0]?.total || 0;
    
    // Get pending counts
    const pendingDeposits = await Deposit.countDocuments({ status: 'pending' });
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    
    // Calculate revenue (5% of confirmed deposits as referral rewards)
    const totalRevenue = totalDeposits * 0.05;
    
    // Recent activity
    const recentDeposits = await Deposit.find({ status: 'confirmed' })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    const recentWithdrawals = await Withdrawal.find({ status: { $in: ['pending', 'approved'] } })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      metrics: {
        totalUsers,
        totalDeposits,
        totalInvestments,
        totalWithdrawals,
        totalRevenue,
        pendingDeposits,
        pendingWithdrawals
      },
      recentActivity: {
        deposits: recentDeposits,
        withdrawals: recentWithdrawals
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};