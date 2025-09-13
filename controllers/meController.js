exports.getMe = async (req, res) => {
  try {
    const user = req.user;
    res.json({ 
      user: { 
        id: user._id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        phone: user.phone,
        depositAddress: user.depositAddress
      } 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};