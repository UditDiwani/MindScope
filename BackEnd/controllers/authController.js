const User = require('../config/User');
const jwt = require('jsonwebtoken');

// Helper: generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register
const registerUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: "User already exists" });

    user = await User.create({ email, password });
    res.status(201).json({
      _id: user._id,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Server error during registration" });
  }
};

// Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error during login" });
  }
};

// Login if the user exists; otherwise create the account and login
const authenticateUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
    } else {
      user = await User.create({ email, password });
      isNewUser = true;
    }

    res.status(isNewUser ? 201 : 200).json({
      _id: user._id,
      email: user.email,
      isNewUser,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Authentication error:", err.message);
    res.status(500).json({ error: "Server error during authentication" });
  }
};

module.exports = { registerUser, loginUser, authenticateUser };
