// const express = require('express');
// const { register, login } = require('../controllers/authController');

// const router = express.Router();

// router.post('/register', register);
// router.post('/login', login);

// module.exports = router;
const express = require("express");
const { register, login, sendCode, forgotPassword, resetPassword } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/send-code", sendCode);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
