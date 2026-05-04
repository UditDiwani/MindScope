const mongoose = require('mongoose'); // DB management 
const bcrypt = require('bcryptjs'); // for password hashing
const { Timestamp } = require('mongodb');

const user_schema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    trend: {
        type: [Number],
        default: []
    },
    streak: {
        type: Number,
        default: 0
    },
    last_score: {
        type: Number,
        default: 0
    },
    preference: {
        type: String,
        default: 'Weekly'
    },
    checkpoints: {
        type: [Date],
        default: []
    },
}, { timestamps : true});


// Hash password before saving
user_schema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare entered password with stored hash
user_schema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', user_schema);