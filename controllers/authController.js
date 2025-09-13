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

exports.sendCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const existing = await User.findOne({ email });
    if (existing && existing.isVerified) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const code = generateCode();

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email });
    }

    user.verificationCode = code;
    user.verificationCodeExpires = Date.now() + 3 * 60 * 1000; // 3 min
    user.isVerified = false;

    await user.save();

    await sendVerificationCode(email, code);

    res.json({ message: "Verification code sent to email", email });
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

    const user = await User.findOne({
      email,
      verificationCode,
      verificationCodeExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification code" });
    }

    const invitation = await Invitation.findOne({
      code: invitationCode,
      used: false,
    });
    if (!invitation) {
      return res.status(400).json({ error: "Invalid invitation code" });
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.phone = phone;
    user.password = password;
    user.withdrawalPassword = withdrawalPassword;
    user.invitationCode = invitationCode;
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    await user.save();

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
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
