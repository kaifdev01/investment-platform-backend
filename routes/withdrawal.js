const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const withdrawalController = require('../controllers/withdrawalController');

// User routes
router.post('/request', auth, withdrawalController.requestWithdrawal);
router.get('/my-withdrawals', auth, withdrawalController.getUserWithdrawals);

// Admin routes
router.get('/admin/pending', auth, adminAuth, withdrawalController.getPendingWithdrawals);
router.get('/admin/all', auth, adminAuth, withdrawalController.getAllWithdrawals);
router.post('/admin/approve', auth, adminAuth, withdrawalController.approveWithdrawal);
router.post('/admin/reject', auth, adminAuth, withdrawalController.rejectWithdrawal);

module.exports = router;