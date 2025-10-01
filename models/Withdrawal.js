const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  investmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    required: false
  },
  amount: {
    type: Number,
    required: true
  },
  feeAmount: {
    type: Number,
    required: true,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true,
    default: 0
  },
  walletAddress: {
    type: String,
    required: true
  },
  cycleNumber: {
    type: Number,
    required: false
  },
  type: {
    type: String,
    enum: ['earnings', 'balance_and_rewards'],
    default: 'earnings'
  },
  originalBalance: {
    type: Number,
    default: 0
  },
  originalReferralRewards: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  txHash: {
    type: String
  },
  notes: {
    type: String
  }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);