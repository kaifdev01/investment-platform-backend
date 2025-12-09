// const express = require('express');
// const { register, login } = require('../controllers/authController');

// const router = express.Router();

// router.post('/register', register);
// router.post('/login', login);

// module.exports = router;
const express = require("express");
const { register, login, sendCode, forgotPassword, resetPassword, forgotWithdrawalPassword, resetWithdrawalPassword, adminRegister } = require("../controllers/authController");
const { authenticate, isAdmin } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/send-code", sendCode);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/forgot-withdrawal-password", forgotWithdrawalPassword);
router.post("/reset-withdrawal-password", resetWithdrawalPassword);
router.post("/admin-register", authenticate, isAdmin, adminRegister);

module.exports = router;
