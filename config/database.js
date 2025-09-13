const mongoose = require('mongoose');

// Global cached connection
let cachedConnection = null;

const connectDB = async () => {
  // Return cached connection if exists
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached MongoDB connection');
    return cachedConnection;
  }

  try {
    // Check for required environment variable
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    console.log('Establishing new MongoDB connection...');

    // Connection options optimized for Vercel serverless
    const options = {
      serverSelectionTimeoutMS: 8000, // 8 seconds
      socketTimeoutMS: 45000,
      connectTimeoutMS: 8000,
      bufferMaxEntries: 0, // Disable buffering in serverless
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    // Connect to MongoDB
    const connection = await mongoose.connect(process.env.MONGODB_URI, options);
    
    console.log(`MongoDB connected: ${connection.connection.host}`);
    
    // Cache the connection
    cachedConnection = connection;
    return connection;

  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    // Handle specific connection errors
    if (error.message.includes('Could not connect to any servers')) {
      console.error('IP WHITELIST ERROR: Make sure to whitelist your IP in MongoDB Atlas');
      console.error('Go to: Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)');
    }
    
    // Throw error instead of process.exit() for serverless
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

// Handle connection events (optional but useful for debugging)
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

module.exports = connectDB;
