const mongoose = require('mongoose');
const Investment = require('../models/Investment');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://admin:admin@cluster0.aewgwmo.mongodb.net/test?retryWrites=true&w=majority', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const updateCycleEarnings = async () => {
  try {
    await connectDB();
    
    const investments = await Investment.find({
      cycleEarnings: { $exists: true, $ne: [] }
    });
    
    console.log(`Found ${investments.length} investments with cycle earnings`);
    
    for (const investment of investments) {
      let updated = false;
      
      for (const cycle of investment.cycleEarnings) {
        // Calculate what the gross amount should be with new formula
        const correctGrossAmount = (investment.amount * investment.dailyRate) / 100;
        
        // Only update if the current amount is different (old calculation)
        if (Math.abs(cycle.grossAmount - correctGrossAmount) > 0.01) {
          console.log(`Updating cycle ${cycle.cycleNumber} for investment ${investment._id}`);
          console.log(`Old gross: ${cycle.grossAmount}, New gross: ${correctGrossAmount}`);
          
          cycle.grossAmount = correctGrossAmount;
          updated = true;
        }
      }
      
      if (updated) {
        // Also update totalEarned to match the latest cycle
        const latestCycle = investment.cycleEarnings[investment.cycleEarnings.length - 1];
        investment.totalEarned = latestCycle.grossAmount;
        
        await investment.save();
        console.log(`Updated investment ${investment._id}`);
      }
    }
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

updateCycleEarnings();