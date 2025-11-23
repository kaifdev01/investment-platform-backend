const User = require('../models/User');

// Manual score update by admin only
const updateScore = async (userId, scoreChange) => {
  try {
    const user = await User.findById(userId);
    if (!user) return false;

    user.score = Math.max(0, user.score + scoreChange); // Ensure score doesn't go below 0
    await user.save();

    console.log(`Score manually updated for ${user.email}: ${scoreChange > 0 ? '+' : ''}${scoreChange} (Total: ${user.score})`);
    return { scoreChange, newScore: user.score };
  } catch (error) {
    console.error('Score update error:', error);
    return false;
  }
};

// Get user leaderboard
const getLeaderboard = async (limit = 10) => {
  try {
    const users = await User.find({}, 'firstName lastName email score')
      .sort({ score: -1 })
      .limit(limit);
    return users;
  } catch (error) {
    console.error('Leaderboard error:', error);
    return [];
  }
};

module.exports = {
  updateScore,
  getLeaderboard
};