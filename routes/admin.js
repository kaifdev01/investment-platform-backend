const express = require('express');
const { createInvitation } = require('../controllers/invitationController');
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.post('/create-invitation', createInvitation);
router.get('/dashboard', auth, adminAuth, adminController.getAdminDashboard);
router.get('/users', auth, adminAuth, adminController.getAllUsers);
router.get('/deposits', auth, adminAuth, adminController.getAllDeposits);
router.post('/process-deposit', auth, adminAuth, adminController.processDeposit);
router.get('/pending-deposits', auth, adminAuth, adminController.getPendingDeposits);
router.post('/add-user-balance', auth, adminAuth, adminController.addUserBalance);

module.exports = router;