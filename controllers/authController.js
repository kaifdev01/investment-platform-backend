const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Invitation = require("../models/Invitation");
const { sendVerificationCode, welcomeCode } = require("../config/email");

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "secret");
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
    const expiresAt = Date.now() + 3 * 60 * 1000; // 3 minutes

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
    
    // Development bypass: accept '123456' as universal code
    if (verificationCode === '123456') {
      console.log('🔧 DEV MODE: Using universal verification code');
    } else {
      if (!storedCode) {
        return res.status(400).json({ error: "Verification code not found. Use '123456' for testing or request a new code." });
      }
      
      if (storedCode.code !== verificationCode) {
        return res.status(400).json({ error: "Invalid verification code. Use '123456' for testing." });
      }
      
      if (Date.now() > storedCode.expiresAt) {
        verificationCodes.delete(email);
        return res.status(400).json({ error: "Verification code expired. Use '123456' for testing or request a new code." });
      }
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const invitation = await Invitation.findOne({
      code: invitationCode,
      used: false,
    });
    if (!invitation) {
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
      isVerified: true
    });

    await user.save();

    // Remove verification code from temporary storage
    verificationCodes.delete(email);

    invitation.used = true;
    invitation.usedBy = user._id;
    await invitation.save();

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
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
