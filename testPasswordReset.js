const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testPasswordReset() {
  try {
    console.log('Testing password reset functionality...');
    
    // Test forgot password
    console.log('\n1. Testing forgot password...');
    const forgotResponse = await axios.post(`${API_URL}/forgot-password`, {
      email: 'test@example.com' // Replace with actual test email
    });
    console.log('Forgot password response:', forgotResponse.data);
    
    // Test reset password (you'll need to get the reset code from email/console)
    console.log('\n2. Testing reset password...');
    const resetResponse = await axios.post(`${API_URL}/reset-password`, {
      email: 'test@example.com',
      resetCode: '123456', // Replace with actual reset code
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123'
    });
    console.log('Reset password response:', resetResponse.data);
    
  } catch (error) {
    console.error('Test error:', error.response?.data || error.message);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testPasswordReset();
}

module.exports = testPasswordReset;