const { getLeaderboard } = require('../services/scoreService');
const User = require('../models/User');

// Get user's current score
exports.getUserScore = async (req, res) => {
  try {
    const user = await User.findById(req.user._id, 'score firstName lastName');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      score: user.score,
      name: `${user.firstName} ${user.lastName}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(limit);
    
    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;