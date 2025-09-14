const express = require('express');
const router = express.Router();
const { sendVerificationCode } = require('../config/email');

// Test email endpoint
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const testCode = '123456';
    const emailSent = await sendVerificationCode(email, testCode);
    
    res.json({ 
      message: emailSent ? 'Test email sent successfully' : 'Email failed - check console',
      emailSent,
      testCode: process.env.NODE_ENV === 'development' ? testCode : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;