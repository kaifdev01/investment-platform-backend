const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const withdrawalController = require('../controllers/withdrawalController');

// Update failed deposit details
const updateFailedDeposit = async (req, res) => {
  try {
    const { depositId, txHash, amount } = req.body;
    const Deposit = require('../models/Deposit');
    
    const deposit = await Deposit.findOne({
      _id: depositId,
      userId: req.user._id,
      status: 'failed'
    });
    
    if (!deposit) {
      return res.status(404).json({ error: 'Failed deposit not found' });
    }
    
    // Update deposit details
    deposit.txHash = txHash;
    deposit.amount = amount;
    deposit.status = 'pending';
    deposit.processedAt = null;
    await deposit.save();
    
    res.json({ message: 'Deposit updated successfully. Will be reprocessed.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get user's failed deposits
const getFailedDeposits = async (req, res) => {
  try {
    const Deposit = require('../models/Deposit');
    
    const failedDeposits = await Deposit.find({
      userId: req.user._id,
      status: 'failed'
    }).sort({ createdAt: -1 });
    
    res.json({ deposits: failedDeposits });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// User routes
router.post('/request', auth, withdrawalController.requestWithdrawal);
router.post('/request-all', auth, withdrawalController.requestWithdrawAll);
router.get('/my-withdrawals', auth, withdrawalController.getUserWithdrawals);
router.post('/update-failed-deposit', auth, updateFailedDeposit);
router.get('/failed-deposits', auth, getFailedDeposits);

// Admin routes
router.get('/admin/pending', auth, adminAuth, withdrawalController.getPendingWithdrawals);
router.get('/admin/all', auth, adminAuth, withdrawalController.getAllWithdrawals);
router.post('/admin/approve', auth, adminAuth, withdrawalController.approveWithdrawal);
router.post('/admin/reject', auth, adminAuth, withdrawalController.rejectWithdrawal);

module.exports = router;