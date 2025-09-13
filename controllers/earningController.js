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
      userId: req.user._id, 
      status: 'Active' 
    });
    
    if (!investment) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    
    // Check if there's already an active cycle
    if (investment.currentCycle) {
      const activeCycle = await EarningCycle.findById(investment.currentCycle);
      if (activeCycle && activeCycle.status === 'active') {
        return res.status(400).json({ error: 'Cycle already active for this investment' });
      }
    }
    
    const now = new Date();
    const endTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes later
    const weekday = isWeekday(now);
    
    // Calculate cycle earning (daily rate / 3 for 8-hour cycle)
    const cycleEarning = weekday ? (investment.amount * investment.dailyRate / 100) / 3 : 0;
    
    const cycle = new EarningCycle({
      userId: req.user._id,
      investmentId: investment._id,
      startTime: now,
      endTime: endTime,
      amount: investment.amount,
      dailyRate: investment.dailyRate,
      cycleEarning: cycleEarning,
      isWeekday: weekday
    });
    
    await cycle.save();
    
    investment.currentCycle = cycle._id;
    await investment.save();
    
    res.json({
      message: 'Earning cycle started successfully',
      cycle: {
        id: cycle._id,
        startTime: cycle.startTime,
        endTime: cycle.endTime,
        earning: cycle.cycleEarning,
        isWeekday: weekday
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.claimReward = async (req, res) => {
  try {
    const { cycleId } = req.body;
    
    const cycle = await EarningCycle.findOne({
      _id: cycleId,
      userId: req.user._id,
      status: 'active'
    });
    
    if (!cycle) {
      return res.status(404).json({ error: 'Active cycle not found' });
    }
    
    const now = new Date();
    if (now < cycle.endTime) {
      return res.status(400).json({ error: 'Cycle not completed yet' });
    }
    
    // Update cycle status
    cycle.status = 'completed';
    await cycle.save();
    
    // Update investment
    const investment = await Investment.findById(cycle.investmentId);
    investment.totalEarned += cycle.cycleEarning;
    investment.cyclesCompleted += 1;
    investment.currentCycle = null;
    await investment.save();
    
    // Update user balance
    const user = await User.findById(req.user._id);
    user.totalEarnings += cycle.cycleEarning;
    user.withdrawableBalance += cycle.cycleEarning;
    await user.save();
    
    res.json({
      message: 'Reward claimed successfully',
      earning: cycle.cycleEarning,
      newBalance: user.withdrawableBalance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getActiveCycles = async (req, res) => {
  try {
    const cycles = await EarningCycle.find({
      userId: req.user._id,
      status: 'active'
    }).populate('investmentId', 'tier amount');
    
    res.json({ cycles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};