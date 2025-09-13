const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 
      'mongodb+srv://admin:admin@cluster0.aewgwmo.mongodb.net/test?retryWrites=true&w=majority',
      { serverSelectionTimeoutMS: 5000 }
    );
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
