const Investment = require('../models/Investment');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const { distributeReferralRewards } = require('../services/referralService');

const investmentTiers = [
  { amount: 250, tier: 'Micro', dailyRate: 4.00 },
  { amount: 500, tier: 'Mini', dailyRate: 4.94 },
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
    // Get user's existing investments to determine which tiers to disable
    const existingInvestments = await Investment.find({ userId: req.user._id, status: 'Active' });
    const highestExistingAmount = existingInvestments.length > 0
      ? Math.max(...existingInvestments.map(inv => inv.amount))
      : 0;

    // Mark tiers as disabled if they are <= highest existing investment
    const tiersWithStatus = investmentTiers.map(tier => ({
      ...tier,
      disabled: tier.amount <= highestExistingAmount
    }));

    res.json({ tiers: tiersWithStatus });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.createInvestment = async (req, res) => {
  try {
    const { amount } = req.body;

    // Block investments on weekends
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({
        error: 'Investments are only available Monday through Friday. Please try again on a weekday.'
      });
    }

    const tier = investmentTiers.find(t => t.amount === amount);

    if (!tier) {
      return res.status(400).json({ error: 'Invalid investment amount' });
    }

    // Production: Only allow higher tier investments
    const existingInvestments = await Investment.find({ userId: req.user._id, status: 'Active' });
    let upgradeAmount = tier.amount;

    if (existingInvestments.length > 0) {
      const highestExistingAmount = Math.max(...existingInvestments.map(inv => inv.amount));
      if (amount <= highestExistingAmount) {
        return res.status(400).json({
          error: 'You can only invest in higher tier packages. Please upgrade to a higher amount.'
        });
      }
      // Calculate upgrade amount (only pay the difference)
      upgradeAmount = tier.amount - highestExistingAmount;
    }

    const user = await User.findById(req.user._id);
    if (user.balance < upgradeAmount) {
      return res.status(400).json({ error: `Insufficient balance. You need $${upgradeAmount} to upgrade.` });
    }

    const investment = new Investment({
      userId: req.user._id,
      amount: tier.amount,
      tier: tier.tier,
      dailyRate: tier.dailyRate
    });

    await investment.save();

    // Update user's balance and total investment
    const isFirstInvestment = user.totalInvestment === 0;
    user.balance -= upgradeAmount;
    user.totalInvestment += upgradeAmount;
    await user.save();

    // Referral points only awarded at registration, not investment

    console.log(`Investment upgrade: Tier ${tier.tier}, Full amount: $${tier.amount}, Paid: $${upgradeAmount}`);

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

    // Block completing cycles on weekends
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({
        error: 'Earnings cannot be completed on weekends. Please wait until Monday.'
      });
    }

    // Get user's current score to calculate earnings multiplier
    const user = await User.findById(req.user._id);
    const userScore = user.score || 0;

    // Calculate earnings multiplier based on points
    let earningsMultiplier = 1.0; // Default 100%
    if (userScore < 50) {
      if (userScore >= 40) earningsMultiplier = 0.9;      // 90%
      else if (userScore >= 30) earningsMultiplier = 0.8; // 80%
      else if (userScore >= 20) earningsMultiplier = 0.7; // 70%
      else if (userScore >= 10) earningsMultiplier = 0.6; // 60%
      else earningsMultiplier = 0.5;                      // 50%
    }

    // Special handling for $500 Mini tier - always exactly $21
    let grossEarning, netEarning, feeAmount, baseEarning;
    
    if (investment.amount === 500 && investment.tier === 'Mini') {
      baseEarning = 21;
      grossEarning = 21; // Fixed $21, no score multiplier applied
      feeAmount = 0; // No fee for Mini tier
      netEarning = 21; // Always $21
    } else {
      // Calculate earnings with multiplier applied for other tiers
      baseEarning = (investment.amount * investment.dailyRate) / 100;
      grossEarning = baseEarning * earningsMultiplier;
      feeAmount = grossEarning * 0.15; // 15% fee
      netEarning = grossEarning - feeAmount; // Net amount after fee
    }

    console.log(`Earnings calculation: Score=${userScore}, Multiplier=${earningsMultiplier}, Base=${baseEarning.toFixed(2)}, Final=${grossEarning.toFixed(2)}`);

    investment.cyclesCompleted += 1;

    // Add this cycle's earnings to the array
    if (!investment.cycleEarnings) investment.cycleEarnings = [];
    investment.cycleEarnings.push({
      cycleNumber: investment.cyclesCompleted,
      grossAmount: netEarning, // Store net amount for Mini tier to show $21
      completedAt: new Date(),
      withdrawalRequested: false
    });

    // For Mini tier, always show $21 total regardless of previous earnings
    if (investment.amount === 500 && investment.tier === 'Mini') {
      investment.totalEarned = 21; // Always show $21 for Mini tier
    } else {
      investment.totalEarned = (investment.totalEarned || 0) + netEarning; // Accumulate for other tiers
    }
    investment.canWithdraw = true; // Show withdrawal request option
    investment.earningCompleted = true; // Mark as completed
    investment.earningStarted = false; // Reset to allow new cycle
    investment.cycleStartTime = null;
    investment.cycleEndTime = null;
    // Don't clear withdrawalRequestedAt - let previous withdrawals remain

    await investment.save();

    // Don't update user balances here - only when admin approves withdrawal
    console.log(`Cycle completed: grossEarning=${grossEarning}, netEarning=${netEarning}`);
    console.log(`Investment after completion: canWithdraw=${investment.canWithdraw}, earningCompleted=${investment.earningCompleted}, totalEarned=${investment.totalEarned}`);

    // Note: Referral rewards will be distributed when admin approves withdrawal

    res.json({
      message: 'Earning cycle completed! You can now request withdrawal.',
      earning: netEarning,
      totalEarned: investment.totalEarned
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};