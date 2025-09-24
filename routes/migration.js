const express = require('express');
const router = express.Router();
const Investment = require('../models/Investment');

// Migration endpoint to update existing cycle earnings
router.post('/update-cycle-earnings', async (req, res) => {
  try {
    const investments = await Investment.find({
      cycleEarnings: { $exists: true, $ne: [] }
    });
    
    let updatedCount = 0;
    
    for (const investment of investments) {
      let updated = false;
      
      for (const cycle of investment.cycleEarnings) {
        // Calculate what the gross amount should be with new formula
        const correctGrossAmount = (investment.amount * investment.dailyRate) / 100;
        
        // Only update if the current amount is different (old calculation)
        if (Math.abs(cycle.grossAmount - correctGrossAmount) > 0.01) {
          cycle.grossAmount = correctGrossAmount;
          updated = true;
        }
      }
      
      if (updated) {
        // Also update totalEarned to match the latest cycle
        const latestCycle = investment.cycleEarnings[investment.cycleEarnings.length - 1];
        investment.totalEarned = latestCycle.grossAmount;
        
        await investment.save();
        updatedCount++;
      }
    }
    
    res.json({ 
      message: `Migration completed. Updated ${updatedCount} investments.`,
      updatedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;