const express = require('express');
const { registerUser, loginUser, authenticateUser } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/authenticate', authenticateUser);

module.exports = router;
