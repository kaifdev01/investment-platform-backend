const User = require('../models/User');

const distributeReferralRewards = async (userId, earningAmount) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.referredBy) return;

    // Level 1: 10%
    const level1Referrer = await User.findById(user.referredBy);
    if (level1Referrer) {
      if (!level1Referrer.referralRewards) level1Referrer.referralRewards = 0;
      const level1Reward = earningAmount * 0.10;
      level1Referrer.referralRewards += level1Reward;
      await level1Referrer.save();
      console.log(`Level 1 referral reward: $${level1Reward} to ${level1Referrer.email}`);

      // Level 2: 3%
      if (level1Referrer.referredBy) {
        const level2Referrer = await User.findById(level1Referrer.referredBy);
        if (level2Referrer) {
          if (!level2Referrer.referralRewards) level2Referrer.referralRewards = 0;
          const level2Reward = earningAmount * 0.03;
          level2Referrer.referralRewards += level2Reward;
          await level2Referrer.save();
          console.log(`Level 2 referral reward: $${level2Reward} to ${level2Referrer.email}`);

          // Level 3: 1%
          if (level2Referrer.referredBy) {
            const level3Referrer = await User.findById(level2Referrer.referredBy);
            if (level3Referrer) {
              if (!level3Referrer.referralRewards) level3Referrer.referralRewards = 0;
              const level3Reward = earningAmount * 0.01;
              level3Referrer.referralRewards += level3Reward;
              await level3Referrer.save();
              console.log(`Level 3 referral reward: $${level3Reward} to ${level3Referrer.email}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error distributing referral rewards:', error);
  }
};

module.exports = { distributeReferralRewards };