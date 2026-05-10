const User = require('../config/User');
const jwt = require('jsonwebtoken');

// Helper: generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const publicUser = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  trend: user.trend,
  streak: user.streak,
  last_score: user.last_score,
  preference: user.preference,
  emailReminder: user.emailReminder,
  checkpoints: user.checkpoints,
  hasCompletedCheckIn: user.hasCompletedCheckIn,
});

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);

const addCheckInCheckpoint = (user) => {
  const today = new Date();
  const todayKey = toDateKey(today);
  const hasTodayCheckpoint = user.checkpoints.some((checkpoint) => toDateKey(checkpoint) === todayKey);

  if (!hasTodayCheckpoint) {
    user.checkpoints.push(today);
  }

  user.checkpoints = user.checkpoints.slice(-3);
};

const calculateWellBeingScore = (responses) => {
  const numericEntries = Object.entries(responses || {})
    .map(([key, value]) => ({ key, value: Number(value) }))
    .filter((entry) => Number.isFinite(entry.value));

  if (!numericEntries.length) {
    return 0;
  }

  const normalizedTotal = numericEntries.reduce((total, entry) => {
    // Heuristic: Sheet 4's "mental well-being" is a 1-10 scale.
    // Others are 1-5. We check the key for "mental" or if value > 5.
    const isTenScale = entry.key.toLowerCase().includes("mental") || entry.value > 5;
    const maxValue = isTenScale ? 10 : 5;
    return total + (entry.value / maxValue) * 100;
  }, 0);

  return Math.round(normalizedTotal / numericEntries.length);
};

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ error: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "Not authorized, user not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Not authorized, token failed" });
  }
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
      name: user.name,
      hasCompletedCheckIn: user.hasCompletedCheckIn,
      preference: user.preference,
      emailReminder: user.emailReminder,
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
        name: user.name,
        hasCompletedCheckIn: user.hasCompletedCheckIn,
        preference: user.preference,
        emailReminder: user.emailReminder,
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
      name: user.name,
      isNewUser,
      hasCompletedCheckIn: user.hasCompletedCheckIn,
      preference: user.preference,
      emailReminder: user.emailReminder,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Authentication error:", err.message);
    res.status(500).json({ error: "Server error during authentication" });
  }
};

const getCurrentUser = async (req, res) => {
  res.json(publicUser(req.user));
};

const submitCheckIn = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const checkInResponses = req.body.responses || req.body.details;

    if (!checkInResponses || typeof checkInResponses !== "object" || Array.isArray(checkInResponses)) {
      return res.status(400).json({ error: "Check-in responses are required" });
    }

    if (!name && !req.user.name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const score = calculateWellBeingScore(checkInResponses);

    if (name) {
      req.user.name = name;
    }

    req.user.hasCompletedCheckIn = true;
    req.user.last_score = score;
    req.user.trend.push(score);
    req.user.streak = (req.user.streak || 0) + 1;
    addCheckInCheckpoint(req.user);

    await req.user.save();

    res.status(201).json(publicUser(req.user));
  } catch (err) {
    console.error("Check-in submit error:", err.message);
    res.status(500).json({ error: "Server error during check-in submission" });
  }
};

const updatePreferences = async (req, res) => {
  try {
    const { preference, emailReminder } = req.body;
    const allowedPreferences = ["Weekly", "Twice a week", "Monthly"];

    if (preference && !allowedPreferences.includes(preference)) {
      return res.status(400).json({ error: "Invalid check-in frequency" });
    }

    if (preference) {
      req.user.preference = preference;
    }

    if (typeof emailReminder === "boolean") {
      req.user.emailReminder = emailReminder;
    }

    await req.user.save();

    res.json(publicUser(req.user));
  } catch (err) {
    console.error("Preference update error:", err.message);
    res.status(500).json({ error: "Server error during preference update" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  authenticateUser,
  getCurrentUser,
  submitCheckIn,
  updatePreferences,
  protect,
};
