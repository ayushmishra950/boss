const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },

  username: { type: String, unique: true, sparse: true },

  email: { type: String, unique: true },

  password: { type: String },

  phone: { type: String },

  otp: { type: Number },
  
  role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },

  createTime: {
    type: Date,
    default: Date.now,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  otpExpiryTime: {
    type: Date,
    required: true,
  },

  profileImage: {
    type: String,
    default: "",
  },

  bio: {
    type: String,
    default: "",
  },

  isOnline: {
    type: Boolean,
    default: false,
  },

  isPrivate: {
    type: Boolean,
    default: false,
  },

  lastActive: {
    type: Date,
    default: Date.now,
  },

  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  posts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  ],

  videos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
    },
  ],

  bookmarks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  ],

  saveReels: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
    },
  ],

  blockedUsers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  ],

  blockedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  ],

  hiddenFromStory: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  unreadNotifications: {
    type: Number,
    default: 0,
  },

  is_blocked: {
    type: Boolean,
    default: false,
  },

  // ✅ Added for Pages feature:
  createdPages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Page",
    },
  ],

  likedPages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Page",
    },
  ],

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
