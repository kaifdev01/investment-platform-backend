require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const invitationRoutes = require('./routes/invitations');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const { startBlockchainMonitoring } = require('./jobs/blockchainMonitor');
const { startAutoDepositProcessing } = require('./jobs/autoDepositProcessor');

const app = express();
app.use(cors({
  origin: "*",  // For testing (you can restrict later)
  credentials: true
}));
app.use(express.json());

connectDB();

app.use('/api', authRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start blockchain monitoring
  startBlockchainMonitoring();
  // Start automatic deposit processing
  startAutoDepositProcessing();
});