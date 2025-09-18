const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  tier: { type: String, required: true },
  dailyRate: { type: Number, required: true },
  startDate: { type: Date, default: Date.now },
  status: { type: String, default: 'Active', enum: ['Active', 'Completed', 'Cancelled'] },
  currentCycle: { type: mongoose.Schema.Types.ObjectId, ref: 'EarningCycle' },
  totalEarned: { type: Number, default: 0 },
  cyclesCompleted: { type: Number, default: 0 },
  cycleStartTime: { type: Date },
  cycleEndTime: { type: Date },
  canWithdraw: { type: Boolean, default: false },
  withdrawalRequestedAt: { type: Date },
  earningStarted: { type: Boolean, default: false },
  earningCompleted: { type: Boolean, default: false },
  withdrawalApprovedAt: { type: Date },
  nextCycleAvailableAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);