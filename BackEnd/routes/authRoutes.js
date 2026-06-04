const express = require('express');
const {
  registerUser,
  loginUser,
  authenticateUser,
  getCurrentUser,
  submitCheckIn,
  saveLatestCheckIn,
  getLatestCheckIn,
  updatePreferences,
  protect,
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/authenticate', authenticateUser);
router.get('/me', protect, getCurrentUser);
router.post('/check-in', protect, submitCheckIn);
router.post('/latest-check-in', protect, saveLatestCheckIn);
router.get('/latest-check-in', protect, getLatestCheckIn);
router.put('/preferences', protect, updatePreferences);

module.exports = router;
