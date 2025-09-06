const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
  },
  totalMinutes: {
    type: Number,
    default: 0,
    min: 0
  },
  sessions: [{
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number, // in minutes
      default: 0
    },
    device: {
      type: String,
      enum: ['Mobile', 'Desktop', 'Tablet'],
      default: 'Desktop'
    }
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
activityLogSchema.index({ userId: 1, date: 1 }, { unique: true });

// Method to add activity session
activityLogSchema.methods.addSession = function(startTime, endTime, device = 'Desktop') {
  const duration = Math.round((endTime - startTime) / (1000 * 60)); // Convert to minutes
  
  this.sessions.push({
    startTime,
    endTime,
    duration,
    device
  });
  
  this.totalMinutes += duration;
  this.lastActivity = new Date();
  
  return this.save();
};

// Static method to get or create activity log for a date
activityLogSchema.statics.getOrCreateForDate = async function(userId, date) {
  let log = await this.findOne({ userId, date });
  
  if (!log) {
    log = new this({
      userId,
      date,
      totalMinutes: 0,
      sessions: []
    });
    await log.save();
  }
  
  return log;
};

// Static method to update daily activity
activityLogSchema.statics.updateActivity = async function(userId, minutes = 1) {
  const today = new Date().toISOString().split('T')[0];
  
  let log = await this.findOne({ userId, date: today });
  
  if (!log) {
    log = new this({
      userId,
      date: today,
      totalMinutes: minutes,
      lastActivity: new Date()
    });
  } else {
    log.totalMinutes += minutes;
    log.lastActivity = new Date();
  }
  
  return log.save();
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
