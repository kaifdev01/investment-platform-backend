const express = require('express');
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
router.get('/investment-tiers', auth, getInvestmentTiers);
router.post('/invest', auth, createInvestment);
router.post('/complete-cycle', auth, completeCycle);
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

module.exports = router;