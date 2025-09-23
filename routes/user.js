const express = require('express');
const User = require('../models/User');
const { generateInvitation } = require('../controllers/userController');
const { getDashboard, getReferrals } = require('../controllers/dashboardController');
const { getInvestmentTiers, createInvestment, completeCycle } = require('../controllers/investmentController');
const { getMe } = require('../controllers/meController');
const { updateProfile } = require('../controllers/profileController');
const { simulateDeposit, getDepositHistory, processDeposit } = require('../controllers/depositController');
const { startCycle, claimReward, getActiveCycles } = require('../controllers/earningController');
const simpleDepositService = require('../services/simpleDepositService');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/generate-invitation', auth, generateInvitation);
router.get('/dashboard', auth, getDashboard);
router.get('/referrals', auth, getReferrals);
router.get('/referral-tree', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('referralLevel1', 'firstName lastName email createdAt')
      .populate('referralLevel2', 'firstName lastName email createdAt')
      .populate('referralLevel3', 'firstName lastName email createdAt');
    
    const level1 = user.referralLevel1 || [];
    const level2 = user.referralLevel2 || [];
    const level3 = user.referralLevel3 || [];
    
    res.json({
      level1,
      level2,
      level3,
      totalReferrals: level1.length + level2.length + level3.length,
      hasReferrals: level1.length > 0 || level2.length > 0 || level3.length > 0
    });
  } catch (error) {
    console.error('Referral tree error:', error);
    res.status(500).json({ error: error.message });
  }
});
router.get('/investment-tiers', auth, getInvestmentTiers);
router.post('/invest', auth, createInvestment);
router.post('/complete-cycle', auth, claimReward);
router.post('/start-earning', auth, startCycle);
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);
router.post('/simulate-deposit', auth, simulateDeposit);
router.get('/deposit-history', auth, getDepositHistory);
router.post('/process-deposit', auth, processDeposit);
router.post('/start-cycle', auth, startCycle);
router.post('/claim-reward', auth, claimReward);
router.get('/active-cycles', auth, getActiveCycles);

// Manual deposit processing
router.post('/admin/manual-process/:depositId', auth, async (req, res) => {
  try {
    const result = await simpleDepositService.manualProcessDeposit(req.params.depositId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending deposits
router.get('/admin/pending-deposits', auth, async (req, res) => {
  try {
    const Deposit = require('../models/Deposit');
    const deposits = await Deposit.find({ status: 'pending' })
      .populate('userId', 'email firstName lastName')
      .sort({ createdAt: -1 });
    res.json({ deposits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block/Unblock user
router.post('/admin/toggle-block/:userId', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug referral data
router.get('/debug/referrals/:userId?', auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const user = await User.findById(userId)
      .populate('referredBy', 'firstName lastName email')
      .populate('referralLevel1', 'firstName lastName email')
      .populate('referralLevel2', 'firstName lastName email')
      .populate('referralLevel3', 'firstName lastName email');
    
    res.json({
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      },
      referredBy: user.referredBy,
      referralLevel1: user.referralLevel1,
      referralLevel2: user.referralLevel2,
      referralLevel3: user.referralLevel3,
      counts: {
        level1: user.referralLevel1?.length || 0,
        level2: user.referralLevel2?.length || 0,
        level3: user.referralLevel3?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update Email
router.put('/admin/update-email', auth, async (req, res) => {
  try {
    const { newEmail } = req.body;
    
    console.log('Admin check:', { userId: req.user._id, isAdmin: req.user.isAdmin, email: req.user.email });
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required. Current user is not admin.' });
    }
    
    if (!newEmail) {
      return res.status(400).json({ error: 'New email is required' });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    // Update admin's email
    await User.findByIdAndUpdate(req.user._id, { email: newEmail });
    
    res.json({ message: 'Email updated successfully' });
  } catch (error) {
    console.error('Email update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// System Analytics
router.get('/admin/analytics', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const Investment = require('../models/Investment');
    const Deposit = require('../models/Deposit');
    
    const { period = '30' } = req.query;
    const daysBack = parseInt(period);
    const dateAgo = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const dateFormat = "%Y-%m-%d";
    
    // User growth
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: dateAgo } } },
      { $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    // Investment trends
    const investmentTrends = await Investment.aggregate([
      { $match: { createdAt: { $gte: dateAgo } } },
      { $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    // Deposit trends
    const depositTrends = await Deposit.aggregate([
      { $match: { createdAt: { $gte: dateAgo }, status: 'confirmed' } },
      { $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    // Summary stats
    const totalUsers = await User.countDocuments();
    const totalInvestments = await Investment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]);
    const totalDeposits = await Deposit.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
    
    res.json({
      userGrowth,
      investmentTrends,
      depositTrends,
      summary: {
        totalUsers,
        totalInvestments: totalInvestments[0]?.total || 0,
        totalDeposits: totalDeposits[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;