const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const { sendVerificationCode, welcomeCode, sendPasswordResetEmail } = require("../config/email");

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "se@#Gg5a4s6B*&cr*(szYet");
};

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store verification codes temporarily
const verificationCodes = new Map();

exports.sendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const code = generateCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 3 minutes

    // Store code temporarily
    verificationCodes.set(email, { code, expiresAt });
    console.log('Generated verification code:', { email, code, expiresAt });

    const emailSent = await sendVerificationCode(email, code);

    res.json({
      message: emailSent ? "Verification code sent to email" : "Check server console for verification code",
      email,
      devCode: process.env.NODE_ENV === 'development' ? code : undefined
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,
      withdrawalPassword,
      invitationCode,
      verificationCode,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !password ||
      !confirmPassword ||
      !withdrawalPassword ||
      !invitationCode ||
      !verificationCode
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    // Check verification code from temporary storage
    const storedCode = verificationCodes.get(email);
    console.log('Verification check:', { email, verificationCode, storedCode });

    if (!storedCode) {
      return res.status(400).json({ error: "Verification code not found. Please request a new code." });
    }

    if (storedCode.code !== verificationCode) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    if (Date.now() > storedCode.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({ error: "Verification code expired. Please request a new code." });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Find referrer by their permanent referral code
    const referrer = await User.findOne({ myReferralCode: invitationCode });
    if (!referrer) {
      return res.status(400).json({ error: "Invalid invitation code" });
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      password,
      withdrawalPassword,
      invitationCode,
      referredBy: referrer._id,
      isVerified: true
    });

    await user.save();
    
    // Generate permanent referral code after user is saved (so we have _id)
    const userId = user._id.toString();
    const createdTime = user.createdAt.getTime().toString(36);
    user.myReferralCode = userId.substring(userId.length - 6) + createdTime.substring(createdTime.length - 4);
    await user.save();
    console.log(`Generated permanent code for new user ${user.email}: ${user.myReferralCode}`);

    // Build referral tree
    if (referrer) {
      // Add to Level 1 of referrer
      referrer.referralLevel1.push(user._id);
      
      // Award 3 points to referrer for successful referral registration
      referrer.score = (referrer.score || 0) + 3;
      console.log(`Referral registration bonus: 3 points awarded to ${referrer.email} for ${user.email}'s registration`);

      // Find Level 2 referrer (referrer's referrer)
      if (referrer.referredBy) {
        const level2Referrer = await User.findById(referrer.referredBy);
        if (level2Referrer) {
          level2Referrer.referralLevel2.push(user._id);

          // Find Level 3 referrer
          if (level2Referrer.referredBy) {
            const level3Referrer = await User.findById(level2Referrer.referredBy);
            if (level3Referrer) {
              level3Referrer.referralLevel3.push(user._id);
              await level3Referrer.save();
            }
          }
          await level2Referrer.save();
        }
      }
      await referrer.save();
    }

    // Remove verification code from temporary storage
    verificationCodes.delete(email);

    const token = generateToken(user._id);

    await welcomeCode(user.email, user.firstName);

    res.json({
      message: "Registration successful & email verified",
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isAdmin: user.isAdmin || false,
        depositAddress: user.depositAddress,
        coinbaseDepositAddress: user.coinbaseDepositAddress,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user._id);
    // Update coinbaseDepositAddress if not set
    if (!user.coinbaseDepositAddress) {
      user.coinbaseDepositAddress = process.env.COINBASE_WALLET_ADDRESS || process.env.MASTER_WALLET_ADDRESS;
      await user.save();
    }
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isAdmin: user.isAdmin || false,
        depositAddress: user.depositAddress,
        coinbaseDepositAddress: user.coinbaseDepositAddress,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    // Generate reset token
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetPasswordOTP = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const emailSent = await sendPasswordResetEmail(email, resetToken);

    res.json({
      message: emailSent ? "Password reset code sent to your email" : "Check server console for reset code",
      devCode: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, resetCode, newPassword, confirmPassword } = req.body;

    if (!email || !resetCode || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ 
      email,
      resetPasswordOTP: resetCode,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now login with your new password." });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.forgotWithdrawalPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Withdrawal password reset request for:', email);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found with this email" });
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

    user.resetWithdrawalPasswordOTP = resetToken;
    user.resetWithdrawalPasswordExpires = resetExpires;
    await user.save();
    console.log('Reset token saved for user:', email, 'Token:', resetToken);

    const emailSent = await sendPasswordResetEmail(email, resetToken, 'withdrawal');
    console.log('Email sent status:', emailSent);

    res.json({
      message: emailSent ? "Withdrawal password reset code sent to your email" : "Reset code generated. Check server console for code.",
      devCode: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    console.error('Forgot withdrawal password error:', error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

exports.resetWithdrawalPassword = async (req, res) => {
  try {
    const { email, resetCode, newWithdrawalPassword, confirmWithdrawalPassword } = req.body;

    if (!email || !resetCode || !newWithdrawalPassword || !confirmWithdrawalPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (newWithdrawalPassword !== confirmWithdrawalPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (newWithdrawalPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ 
      email,
      resetWithdrawalPasswordOTP: resetCode,
      resetWithdrawalPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }

    user.withdrawalPassword = newWithdrawalPassword;
    user.resetWithdrawalPasswordOTP = undefined;
    user.resetWithdrawalPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Withdrawal password reset successful." });
  } catch (error) {
    console.error('Reset withdrawal password error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};
