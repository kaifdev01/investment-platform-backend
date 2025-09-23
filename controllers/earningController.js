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
  try {
    const { investmentId } = req.body;

    const investment = await Investment.findOne({
      _id: investmentId,
      userId: req.user._id
    });

    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }

    // Check if this is a new cycle after withdrawal approval
    if (investment.withdrawalApprovedAt && investment.nextCycleAvailableAt) {
      if (new Date() < investment.nextCycleAvailableAt) {
        return res.status(400).json({ error: 'Next cycle not available yet. Please wait 48 hours after withdrawal approval.' });
      }
      // Reset for new cycle
      investment.earningStarted = false;
      investment.earningCompleted = false;
      investment.canWithdraw = false;
      investment.withdrawalRequestedAt = null;
      investment.withdrawalApprovedAt = null;
      investment.nextCycleAvailableAt = null;
      investment.totalEarned = 0;
      investment.withdrawalPending = false;
    }

    if (investment.earningStarted && !investment.earningCompleted) {
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

    const endTime = new Date(now.getTime() + 1 * 60 * 1000); // 1 minute for testing

    investment.earningStarted = true;
    investment.earningCompleted = false;
    investment.cycleStartTime = now;
    investment.cycleEndTime = endTime;
    investment.withdrawalPending = false;
    await investment.save();

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