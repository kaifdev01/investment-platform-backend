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
  coinbaseDepositAddress: { type: String },
  balance: { type: Number, default: 0 },
  totalInvestment: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  withdrawableBalance: { type: Number, default: 0 },
  balanceWithdrawn: { type: Number, default: 0 },
  referralRewards: { type: Number, default: 0 },
  withdrawalWallet: { type: String },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralLevel1: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  referralLevel2: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  referralLevel3: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
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

  // Set wallet addresses for all users
  if (this.isNew && !this.depositAddress) {
    this.depositAddress = process.env.MASTER_WALLET_ADDRESS || '0x857B7F4Cd911aB51e41D311cB437bBe33A229808';
    this.coinbaseDepositAddress = process.env.COINBASE_WALLET_ADDRESS || process.env.MASTER_WALLET_ADDRESS;
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