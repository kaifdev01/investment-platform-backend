const User = require('../models/User');

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, currentPassword, newPassword, currentWithdrawalPassword, newWithdrawalPassword } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {
      firstName,
      lastName
    };

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }

      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      updateData.password = newPassword;
    }

    // Update withdrawal password if provided
    if (newWithdrawalPassword) {
      if (!currentWithdrawalPassword) {
        return res.status(400).json({ error: 'Current withdrawal password is required to change withdrawal password' });
      }

      const isCurrentWithdrawalPasswordValid = await user.compareWithdrawalPassword(currentWithdrawalPassword);
      if (!isCurrentWithdrawalPasswordValid) {
        return res.status(400).json({ error: 'Current withdrawal password is incorrect' });
      }

      if (newWithdrawalPassword.length < 6) {
        return res.status(400).json({ error: 'New withdrawal password must be at least 6 characters' });
      }

      updateData.withdrawalPassword = newWithdrawalPassword;
    }

    // Update user and trigger pre-save middleware for password hashing
    Object.assign(user, updateData);
    const updatedUser = await user.save();

    res.json({ 
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};