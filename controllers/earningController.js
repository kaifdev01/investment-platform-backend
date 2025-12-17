const Investment = require('../models/Investment');
const EarningCycle = require('../models/EarningCycle');
const User = require('../models/User');

const isWeekday = (date) => {
  const day = date.getDay();
  const isActualWeekday = day >= 1 && day <= 5; // Monday = 1, Friday = 5

  // For testing: Allow weekend earnings after 20 minutes
  if (!isActualWeekday) {
    const now = new Date();
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
    return date >= twentyMinutesAgo;
  }

  return isActualWeekday;
};

exports.startCycle = async (req, res) => {
  console.log('=== START CYCLE ENDPOINT CALLED ===');
  console.log('Investment ID:', req.body.investmentId);
  try {
    const { investmentId } = req.body;

    const investment = await Investment.findOne({
      _id: investmentId,
      userId: req.user._id
    });

    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    // Reset investment state for new cycle
    if (investment.withdrawalApprovedAt || (investment.earningCompleted && !investment.earningStarted)) {
      investment.earningStarted = false;
      investment.earningCompleted = false;
      // Don't reset canWithdraw - let it remain true if there are earnings
      investment.withdrawalRequestedAt = null;
      investment.withdrawalApprovedAt = null;
      investment.nextCycleAvailableAt = null;
      investment.cycleStartTime = null;
      investment.cycleEndTime = null;
      // Don't reset totalEarned - keep existing earnings
    }

    // Only block if currently in an active earning cycle that hasn't ended and hasn't been withdrawn
    if (investment.earningStarted && investment.cycleEndTime && new Date() < investment.cycleEndTime && !investment.earningCompleted && !investment.withdrawalApprovedAt) {
      return res.status(400).json({ error: 'Earning cycle already started' });
    }

    const now = new Date();
    const dayOfWeek = now.getDay();

    // Block earning cycles on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({ 
        error: 'Earning cycles are not available on weekends. Please try again on Monday.' 
      });
    }

    // Production: Only allow earning from highest tier
    const userInvestments = await Investment.find({
      userId: req.user._id,
      status: 'Active'
    });
    
    const highestTierInvestment = userInvestments.reduce((highest, current) => {
      return current.amount > highest.amount ? current : highest;
    }, userInvestments[0]);
    
    // Only allow earning from the highest tier
    if (investment.amount < highestTierInvestment.amount) {
      return res.status(400).json({ 
        error: `You can only earn from your highest tier (${highestTierInvestment.tier}). Lower tier earnings are disabled.` 
      });
    }
    
    // Check if user already started any cycle for this tier today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCycle = await Investment.findOne({
      userId: req.user._id,
      tier: investment.tier,
      lastCycleDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (todayCycle) {
      return res.status(400).json({ 
        error: `You can only start one earning cycle per day for ${investment.tier} tier. Please try again tomorrow.` 
      });
    }

    const endTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours for production

    investment.earningStarted = true;
    investment.earningCompleted = false;
    investment.cycleStartTime = now;
    investment.cycleEndTime = endTime;
    investment.withdrawalPending = false;
    investment.lastCycleDate = now; // Track when last cycle was started
    // Don't modify canWithdraw when starting new cycle - let it remain as set by completeCycle
    await investment.save();
    
    console.log('Cycle started successfully. Investment updated:', {
      id: investment._id,
      tier: investment.tier,
      lastCycleDate: investment.lastCycleDate,
      cycleStartTime: investment.cycleStartTime
    });

    res.json({ message: 'Earning cycle started!', investment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.claimReward = async (req, res) => {
  try {
    const { investmentId } = req.body;

    const investment = await Investment.findOne({
      _id: investmentId,
      userId: req.user._id,
      earningStarted: true,
      earningCompleted: false
    });

    if (!investment) {
      return res.status(404).json({ error: 'Active earning cycle not found' });
    }

    const now = new Date();
    if (now < investment.cycleEndTime) {
      return res.status(400).json({ error: 'Cycle not completed yet' });
    }

    // Block completing cycles on weekends
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({ error: 'Earnings cannot be completed on weekends. Please wait until Monday.' });
    }

    // Calculate earning (daily rate / 3 for 8-hour cycle)
    const cycleEarning = (investment.amount * investment.dailyRate / 100) / 3;

    // Update investment
    investment.totalEarned += cycleEarning;
    investment.earningCompleted = true;
    investment.canWithdraw = true;
    await investment.save();

    // Update user balance
    const user = await User.findById(req.user._id);
    user.totalEarnings = (user.totalEarnings || 0) + cycleEarning;
    user.withdrawableBalance = (user.withdrawableBalance || 0) + cycleEarning;
    await user.save();

    res.json({
      message: 'Earning cycle completed successfully!',
      earning: cycleEarning,
      newBalance: user.withdrawableBalance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getActiveCycles = async (req, res) => {
  try {
    const investments = await Investment.find({
      userId: req.user._id,
      earningStarted: true,
      earningCompleted: false
    });

    res.json({ cycles: investments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};