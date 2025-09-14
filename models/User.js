const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  withdrawalPassword: { type: String, required: true },
  invitationCode: { type: String, required: true },
  depositAddress: { type: String, unique: true },
  balance: { type: Number, default: 0 },
  totalInvestment: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  withdrawableBalance: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  verificationCode: String,
  verificationCodeExpires: Date,
  resetPasswordOTP: String,
  resetPasswordExpires: Date,
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') && !this.isModified('withdrawalPassword')) return next();

  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isModified('withdrawalPassword')) {
    this.withdrawalPassword = await bcrypt.hash(this.withdrawalPassword, 12);
  }

  // Set master wallet address for all users
  if (this.isNew && !this.depositAddress) {
    this.depositAddress = process.env.MASTER_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b8D0C9e3e0C0C0C0C0';
  }

  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.compareWithdrawalPassword = async function (password) {
  return bcrypt.compare(password, this.withdrawalPassword);
};

module.exports = mongoose.model('User', userSchema);