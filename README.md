# Investment Platform Backend

Backend API for USDC investment platform with automatic deposit processing.

## Features
- JWT Authentication
- MongoDB Database
- Automatic Deposit Processing
- Investment Management
- Referral System

## Environment Variables
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=your-jwt-secret
MASTER_WALLET_ADDRESS=0xYourWalletAddress
MASTER_WALLET_PRIVATE_KEY=your-private-key
ACTIVE_NETWORK=polygon
MIN_CONFIRMATIONS=3
PORT=5000
```

## Deploy to Vercel
1. Push this backend folder to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

## API Endpoints
- POST /api/register - User registration
- POST /api/login - User login
- GET /api/user/dashboard - Dashboard data
- POST /api/user/process-deposit - Submit deposit
- POST /api/user/invest - Create investment