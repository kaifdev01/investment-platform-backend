const Investment = require('../models/Investment');
const User = require('../models/User');

const investmentTiers = [
  { amount: 0.5, tier: 'Test Tier', dailyRate: 1.0 },
  { amount: 1, tier: 'Bronze I', dailyRate: 1.5 },
  { amount: 5, tier: 'Bronze II', dailyRate: 2.0 },
  { amount: 10, tier: 'Silver I', dailyRate: 2.5 },
  { amount: 25, tier: 'Silver II', dailyRate: 3.0 },
  { amount: 50, tier: 'Gold I', dailyRate: 3.5 },
  { amount: 100, tier: 'Gold II', dailyRate: 4.0 },
  { amount: 250, tier: 'Platinum I', dailyRate: 4.5 },
  { amount: 500, tier: 'Platinum II', dailyRate: 5.0 }
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