const User = require('../config/User');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const path = require('path');

const pythonCommand = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const predictionScriptPath = path.join(__dirname, "..", "ML", "predict.py");
const sentimentScriptPath = path.join(__dirname, "..", "ML", "sentiment.py");
const ML_FEATURE_KEYS = [
  "degree_level",
  "study_mode",
  "funding_status",
  "program_year",
  "weekly_hours",
  "supervisor_freq",
  "caregiving",
  "productivity_index",
  "coping_index",
  "stressor_index",
];

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
  last_sentiment_score: user.last_sentiment_score,
  last_state_of_mind: user.last_state_of_mind,
  preference: user.preference,
  emailReminder: user.emailReminder,
  checkpoints: user.checkpoints,
  hasCompletedCheckIn: user.hasCompletedCheckIn,
  latestCheckIn: user.latestCheckIn,
});

const toDateKey = (value) => new Date(value).toISOString().slice(0, 10);

const addCheckInCheckpoint = (user) => {
  const today = new Date();
  const todayKey = toDateKey(today);
  const hasTodayCheckpoint = user.checkpoints.some((checkpoint) => toDateKey(checkpoint) === todayKey);

  if (!hasTodayCheckpoint) {
    user.checkpoints.push(today);
  }

  user.checkpoints = user.checkpoints.slice(-5);
};

const clampScore = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const getSentimentText = (responses) => {
  const noteText = `${responses.primary_stressor_note || ""} ${responses.coping_support_note || ""}`.trim();

  if (noteText) {
    return noteText;
  }

  return [
    `weekly hours ${responses.weekly_hours || 0}`,
    `stressor ${responses.stressor_index || 0}`,
    `productivity ${responses.productivity_index || 0}`,
    `coping ${responses.coping_index || 0}`,
  ].join(" ");
};

const getStateOfMindLabel = (score) => {
  if (score >= 0.35) {
    return "Positive";
  }

  if (score <= -0.35) {
    return "Strained";
  }

  return "Neutral";
};

const getLocalSentiment = (text) => {
  const lowerText = text.toLowerCase();
  const positiveWords = ["support", "supported", "cope", "coping", "focused", "calm", "progress", "help", "manageable", "confident", "better"];
  const negativeWords = ["stress", "deadline", "overwhelmed", "anxious", "tired", "hopeless", "pressure", "conflict", "stuck", "difficult"];
  const positive = positiveWords.reduce((total, word) => total + (lowerText.includes(word) ? 1 : 0), 0);
  const negative = negativeWords.reduce((total, word) => total + (lowerText.includes(word) ? 1 : 0), 0);

  if (!lowerText.trim()) {
    return 0;
  }

  return Number(((positive - negative) / Math.max(positive + negative, 1)).toFixed(3));
};

const analyzeSentiment = (responses) => {
  const text = getSentimentText(responses);

  return new Promise((resolve) => {
    const py = spawn(pythonCommand, [sentimentScriptPath, text]);
    let result = "";
    let settled = false;
    const finish = (score) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(score);
    };

    py.stdout.on("data", (data) => {
      result += data.toString();
    });

    py.on("error", () => {
      finish(getLocalSentiment(text));
    });

    py.on("close", () => {
      try {
        const sentiment = result ? JSON.parse(result) : {};
        const score = Number(sentiment.compound);
        finish(Number.isFinite(score) ? Number(score.toFixed(3)) : getLocalSentiment(text));
      } catch (err) {
        finish(getLocalSentiment(text));
      }
    });
  });
};

const getMlFeaturePayload = (responses) => {
  const payload = {};
  const missingFields = [];

  ML_FEATURE_KEYS.forEach((key) => {
    const value = Number(responses[key]);

    if (!Number.isFinite(value)) {
      missingFields.push(key);
      return;
    }

    payload[key] = value;
  });

  return { payload, missingFields };
};

const predictWellbeing = (responses) => {
  const { payload, missingFields } = getMlFeaturePayload(responses);

  if (missingFields.length) {
    return Promise.reject(new Error(`Missing required check-in fields: ${missingFields.join(", ")}`));
  }

  return new Promise((resolve, reject) => {
    const py = spawn(pythonCommand, [predictionScriptPath, JSON.stringify({ responses: payload })]);
    let result = "";
    let error = "";

    py.stdout.on("data", (data) => {
      result += data.toString();
    });

    py.stderr.on("data", (data) => {
      error += data.toString();
    });

    py.on("error", (err) => {
      reject(new Error(`Unable to start Python process: ${err.message}`));
    });

    py.on("close", (code) => {
      try {
        const prediction = result ? JSON.parse(result) : {};

        if (code !== 0 || prediction.error) {
          reject(new Error(prediction.error || error || "Prediction failed"));
          return;
        }

        const score = Number(prediction.overall_wellbeing);

        if (!Number.isFinite(score)) {
          reject(new Error("Prediction did not return overall_wellbeing"));
          return;
        }

        resolve(Math.round(clampScore(score)));
      } catch (err) {
        reject(new Error(error || "Prediction returned invalid JSON"));
      }
    });
  });
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
      last_score: user.last_score,
      last_sentiment_score: user.last_sentiment_score,
      last_state_of_mind: user.last_state_of_mind,
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
        last_score: user.last_score,
        last_sentiment_score: user.last_sentiment_score,
        last_state_of_mind: user.last_state_of_mind,
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
      last_score: user.last_score,
      last_sentiment_score: user.last_sentiment_score,
      last_state_of_mind: user.last_state_of_mind,
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

    const [score, sentimentScore] = await Promise.all([
      predictWellbeing(checkInResponses),
      analyzeSentiment(checkInResponses),
    ]);
    const stateOfMind = getStateOfMindLabel(sentimentScore);

    if (name) {
      req.user.name = name;
    }

    req.user.hasCompletedCheckIn = true;
    req.user.last_score = score;
    req.user.last_sentiment_score = sentimentScore;
    req.user.last_state_of_mind = stateOfMind;
    req.user.trend.push(score);
    req.user.streak = (req.user.streak || 0) + 1;
    req.user.latestCheckIn = {
      name: name || req.user.name,
      responses: checkInResponses,
      wellbeingScore: score,
      sentimentScore,
      stateOfMind,
      savedAt: new Date(),
    };
    addCheckInCheckpoint(req.user);

    await req.user.save();

    res.status(201).json(publicUser(req.user));
  } catch (err) {
    console.error("Check-in submit error:", err.message);
    res.status(500).json({ error: "Server error during check-in submission" });
  }
};

const saveLatestCheckIn = async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const responses = req.body.responses;

    if (!responses || typeof responses !== "object" || Array.isArray(responses)) {
      return res.status(400).json({ error: "Check-in responses are required" });
    }

    req.user.latestCheckIn = {
      name: name || req.user.name,
      responses,
      savedAt: new Date(),
    };

    await req.user.save();

    res.status(200).json({ latestCheckIn: req.user.latestCheckIn });
  } catch (err) {
    console.error("Latest check-in save error:", err.message);
    res.status(500).json({ error: "Server error saving latest check-in" });
  }
};

const getLatestCheckIn = async (req, res) => {
  res.json({ latestCheckIn: req.user.latestCheckIn || null });
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
  saveLatestCheckIn,
  getLatestCheckIn,
  updatePreferences,
  protect,
};
