require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const invitationRoutes = require('./routes/invitations');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const cronRoutes = require('./routes/cron');
const withdrawalRoutes = require('./routes/withdrawal');
const testRoutes = require('./routes/test');

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
app.use('/api/cron', cronRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/test', testRoutes);

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Auto deposit processing available at /api/cron/process-deposits');
});
