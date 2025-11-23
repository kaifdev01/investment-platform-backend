const User = require('../models/User');
const Deposit = require('../models/Deposit');
const { updateScore } = require('../services/scoreService');

exports.simulateDeposit = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 5) {
      return res.status(400).json({ error: 'Minimum deposit is $5 USDC' });
    }

    if (amount > 10000) {
      return res.status(400).json({ error: 'Maximum demo deposit is $10,000 USDC' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.depositAddress) {
      return res.status(400).json({ error: 'Deposit address not found. Please contact support.' });
    }

    // Create deposit record
    const deposit = new Deposit({
      userId: user._id,
      amount: parseFloat(amount),
      toAddress: user.depositAddress,
      status: 'confirmed',
      type: 'demo',
      confirmations: 1,
      processedAt: new Date()
    });

    await deposit.save();

    // Update user balance
    user.balance += parseFloat(amount);
    await user.save();
    
    // Update score for deposit
    await updateScore(user._id, 'DEPOSIT', parseFloat(amount));

    res.json({
      message: 'Demo deposit successful!',
      newBalance: user.balance,
      depositAmount: amount,
      depositId: deposit._id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDepositHistory = async (req, res) => {
  try {
    const deposits = await Deposit.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ deposits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.processDeposit = async (req, res) => {
  try {
    const { txHash, amount, fromAddress } = req.body;

    if (!txHash || !amount || !fromAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.depositAddress) {
      return res.status(400).json({ error: 'Deposit address not found. Please contact support.' });
    }

    // Check if deposit already exists
    const existingDeposit = await Deposit.findOne({ txHash });
    if (existingDeposit) {
      return res.status(400).json({ error: 'Deposit already processed' });
    }

    // Create pending deposit
    const deposit = new Deposit({
      userId: user._id,
      amount: parseFloat(amount),
      txHash,
      fromAddress,
      toAddress: user.depositAddress,
      status: 'pending',
      type: 'real'
    });

    await deposit.save();

    res.json({
      message: 'Deposit submitted for processing',
      depositId: deposit._id,
      status: 'pending'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};