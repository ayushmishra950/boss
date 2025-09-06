
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  caption: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
  },
  videoUrl: {
    type: String,
  },
  thumbnailUrl: {
    type: String,
  },
  locationName: {
    type: String,  // e.g., "Goa, India"
    default: null,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],  // [longitude, latitude]
      default: undefined,
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },

  // ✅ Likes with timestamp
  likes: [
    {
      _id: false,
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      likedAt: { type: Date, default: Date.now },
    }
  ],

  // ✅ Comments with timestamp, likes, and replies
  comments: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: { type: String, required: true },
      commentedAt: { type: Date, default: Date.now },

      // Likes for comments
      likes: [
        {
          _id: false,
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          likedAt: { type: Date, default: Date.now },
        }
      ],

      // Replies to comments
      replies: [
        {
          _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          text: { type: String, required: true },
          repliedAt: { type: Date, default: Date.now },

          // Likes for replies
          likes: [
            {
              _id: false,
              user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
              likedAt: { type: Date, default: Date.now },
            }
          ],
        }
      ],
    }
  ],
});

// ✅ Export safely (for hot-reloading environments)
module.exports = mongoose.models.Post || mongoose.model("Post", postSchema);
