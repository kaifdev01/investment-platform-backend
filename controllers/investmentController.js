const Investment = require('../models/Investment');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const { distributeReferralRewards } = require('../services/referralService');

const investmentTiers = [
  { amount: 1000, tier: 'Starter', dailyRate: 3.30 },
  { amount: 2000, tier: 'Basic', dailyRate: 3.45 },
  { amount: 3000, tier: 'Bronze I', dailyRate: 3.48 },
  { amount: 4000, tier: 'Bronze II', dailyRate: 3.50 },
  { amount: 5000, tier: 'Bronze III', dailyRate: 3.53 },
  { amount: 6000, tier: 'Silver I', dailyRate: 3.55 },
  { amount: 7000, tier: 'Silver II', dailyRate: 3.56 },
  { amount: 8000, tier: 'Silver III', dailyRate: 3.58 },
  { amount: 9000, tier: 'Gold I', dailyRate: 3.59 },
  { amount: 10000, tier: 'Gold II', dailyRate: 3.60 },
  { amount: 12000, tier: 'Gold III', dailyRate: 3.63 },
  { amount: 14000, tier: 'Platinum I', dailyRate: 3.66 },
  { amount: 16000, tier: 'Platinum II', dailyRate: 3.68 },
  { amount: 18000, tier: 'Platinum III', dailyRate: 3.70 },
  { amount: 20000, tier: 'Diamond I', dailyRate: 3.72 },
  { amount: 24000, tier: 'Diamond II', dailyRate: 3.74 },
  { amount: 28000, tier: 'Diamond III', dailyRate: 3.75 },
  { amount: 32000, tier: 'Elite I', dailyRate: 3.77 },
  { amount: 36000, tier: 'Elite II', dailyRate: 3.80 },
  { amount: 40000, tier: 'Elite III', dailyRate: 3.83 },
  { amount: 45000, tier: 'Master I', dailyRate: 3.87 },
  { amount: 50000, tier: 'Master II', dailyRate: 3.90 },
  { amount: 55000, tier: 'Master III', dailyRate: 3.91 },
  { amount: 60000, tier: 'Champion I', dailyRate: 3.92 },
  { amount: 65000, tier: 'Champion II', dailyRate: 3.93 },
  { amount: 70000, tier: 'Champion III', dailyRate: 3.94 },
  { amount: 75000, tier: 'Legend I', dailyRate: 3.945 },
  { amount: 80000, tier: 'Legend II', dailyRate: 3.95 },
  { amount: 85000, tier: 'Legend III', dailyRate: 3.97 },
  { amount: 90000, tier: 'Supreme I', dailyRate: 3.98 },
  { amount: 95000, tier: 'Supreme II', dailyRate: 3.99 },
  { amount: 100000, tier: 'Supreme III', dailyRate: 4.00 }
];

exports.getInvestmentTiers = async (req, res) => {
  try {
    res.json({ tiers: investmentTiers });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.createInvestment = async (req, res) => {
  try {
    const { amount } = req.body;
    const tier = investmentTiers.find(t => t.amount === amount);
    
    if (!tier) {
      return res.status(400).json({ error: 'Invalid investment amount' });
    }

    const user = await User.findById(req.user._id);
    if (user.balance < tier.amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const investment = new Investment({
      userId: req.user._id,
      amount: tier.amount,
      tier: tier.tier,
      dailyRate: tier.dailyRate
    });

    await investment.save();

    // Update user's balance and total investment
    user.balance -= tier.amount;
    user.totalInvestment += tier.amount;
    await user.save();

    res.json({ message: 'Investment created successfully', investment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Complete cycle and enable withdrawal
exports.completeCycle = async (req, res) => {
  try {
    const { investmentId } = req.body;
    const investment = await Investment.findById(investmentId);
    
    if (!investment || investment.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    if (new Date() < investment.cycleEndTime) {
      return res.status(400).json({ error: 'Cycle not completed yet' });
    }

    // Calculate earnings (daily rate for 8 hours = dailyRate/3)
    const earningAmount = (investment.amount * investment.dailyRate) / 300; // 8 hours = 1/3 day
    
    investment.totalEarned += earningAmount;
    investment.cyclesCompleted += 1;
    investment.canWithdraw = true;
    investment.earningCompleted = true;
    investment.cycleStartTime = null;
    investment.cycleEndTime = null;
    
    await investment.save();

    // Note: Referral rewards will be distributed when admin approves withdrawal

    res.json({ 
      message: 'Earning cycle completed! You can now request withdrawal.',
      earning: earningAmount,
      totalEarned: investment.totalEarned
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};