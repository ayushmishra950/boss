const ActivityLog = require('../Models/ActivityLog');
const jwt = require('jsonwebtoken');

// Store active sessions in memory
const activeSessions = new Map();

// Activity tracking middleware
const trackActivity = async (req, res, next) => {
  try {
    // Get token from cookie or authorization header
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.id;

    if (!userId) {
      return next();
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Check if user has an active session
    const sessionKey = `${userId}_${today}`;
    const existingSession = activeSessions.get(sessionKey);

    if (existingSession) {
      // Update last activity time
      existingSession.lastActivity = now;
    } else {
      // Create new session
      // Detect device type from user agent
      const userAgent = req.headers['user-agent'] || '';
      let device = 'Desktop';
      
      if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
        device = 'Mobile';
      } else if (/tablet|ipad/i.test(userAgent)) {
        device = 'Tablet';
      }
      
      activeSessions.set(sessionKey, {
        userId,
        date: today,
        startTime: now,
        lastActivity: now,
        device
      });
    }

    // Set up session cleanup on response end
    const originalEnd = res.end;
    res.end = function(...args) {
      // Update activity log when response ends
      updateActivityLog(userId, today);
      originalEnd.apply(this, args);
    };

    next();
  } catch (error) {
    // If token is invalid, just continue without tracking
    next();
  }
};

// Update activity log in database
const updateActivityLog = async (userId, date) => {
  try {
    const sessionKey = `${userId}_${date}`;
    const session = activeSessions.get(sessionKey);
    
    if (!session) return;

    // Calculate session duration (minimum 1 minute)
    const duration = Math.max(1, Math.ceil((session.lastActivity - session.startTime) / (1000 * 60)));
    
    // Get or create activity log for today
    const log = await ActivityLog.getOrCreateForDate(userId, date);
    
    // Add session with device information
    await log.addSession(session.startTime, session.lastActivity, session.device);
    
  } catch (error) {
    console.error('Error updating activity log:', error);
  }
};

// Cleanup old sessions every 30 minutes
setInterval(() => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
  
  for (const [key, session] of activeSessions.entries()) {
    if (session.lastActivity < cutoff) {
      // Update final activity before removing
      updateActivityLog(session.userId, session.date);
      activeSessions.delete(key);
    }
  }
}, 30 * 60 * 1000); // Run every 30 minutes

// Periodic activity update (every 5 minutes for active sessions)
setInterval(() => {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
  
  for (const [key, session] of activeSessions.entries()) {
    if (session.lastActivity > recentCutoff) {
      // Add 5 minutes of activity for active sessions
      ActivityLog.updateActivity(session.userId, 5).catch(console.error);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

module.exports = { trackActivity };
