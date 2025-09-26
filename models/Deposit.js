const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  txHash: { type: String },
  fromAddress: { type: String },
  toAddress: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' },
  type: { type: String, enum: ['demo', 'real', 'admin_credit'], default: 'real' },
  confirmations: { type: Number, default: 0 },
  blockNumber: { type: Number },
  processedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Deposit', depositSchema);