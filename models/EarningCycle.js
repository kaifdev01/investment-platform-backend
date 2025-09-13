const mongoose = require('mongoose');

const earningCycleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  investmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Investment', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  amount: { type: Number, required: true },
  dailyRate: { type: Number, required: true },
  cycleEarning: { type: Number, default: 0 },
  isWeekday: { type: Boolean, required: true }
}, { timestamps: true });

module.exports = mongoose.model('EarningCycle', earningCycleSchema);