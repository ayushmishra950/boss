const bcrypt = require('bcryptjs');
const User = require('../Models/user');
const { sendOtpMail } = require('../Utils/otp');
const { user_token } = require('../Utils/token');
require('dotenv').config();

const { GraphQLUpload } = require('graphql-upload');
const Post = require('../Models/Post');
const Video = require('../Models/Video');
const Page = require('../Models/Page');
const PageByUser = require('../Models/PageByUser');
const Notification = require('../Models/Notification');
const ActivityLog = require('../Models/ActivityLog');
const FollowRequest = require('../Models/FollowRequest');
const { uploadToCloudinary } = require('../Utils/cloudinary');
const { geocodeLocation } = require('../Location/location');

const otpStore = {};

// Auto-clean expired OTPs
setInterval(() => {
  const now = new Date();
  Object.keys(otpStore).forEach(email => {
    if (otpStore[email].expiry < now) delete otpStore[email];
  });
}, 5 * 60 * 1000);

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

const resolvers = {
  Upload: GraphQLUpload,

  Query: {
//     getLocation: async (_, { latitude, longitude }) => {
//       const result = await getCityState(latitude, longitude);
//       return result; // { city, state }
//     },

getPagePostsByUser: async (_, { pageId }) => {
  if (!pageId) throw new Error("Page ID is required");

  try {
    const posts = await PageByUser.find({ createdBy: pageId })
      .sort({ createdAt: -1 })
      .populate("createdBy"); // 👈 populate karo createdBy ko

    // ObjectId ko string me convert karo
    const fixedPosts = posts.map(post => {
      const postObj = post.toObject();

      if (postObj.createdBy && postObj.createdBy._id) {
        postObj.createdBy.id = postObj.createdBy._id.toString(); // 👈 ye line zaroori hai
      }

      return postObj;
    });

    return fixedPosts;

  } catch (error) {
    console.error("Error fetching posts:", error);
    throw new Error("Failed to fetch page posts");
  }
},
    getSuggestedPages: async () => {
      try {
        return await Page.find().populate("createdBy likedBy");
      } catch (error) {
        throw new Error("Failed to fetch suggested pages");
      }
    },
    getAllPages: async () => {
      try {
        return await Page.find().populate("createdBy likedBy");
      } catch (error) {
        throw new Error("Failed to fetch all pages");
      }
    },

    getLikedPages: async (_, { userId }) => {
      try {
        const user = await User.findById(userId).populate("likedPages");
        if (!user) throw new Error("User not found");
        return user.likedPages;
      } catch (error) {
        throw new Error(error.message || "Error fetching liked pages");
      }
    },

    getUserPages: async (_, { userId }) => {
      try {
        const user = await User.findById(userId).populate("createdPages");
        if (!user) throw new Error("User not found");
        return user.createdPages;
      } catch (error) {
        throw new Error(error.message || "Error fetching user pages");
      }
    },

    getAllUsers: async () => {
      try {
        const users = await User.find({}).populate('posts').populate('followers').populate('following').populate("is_blocked");
        return users;
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to fetch users");
      }
    },

    getLikedImagePostsByUser: async (_, { userId }) => {
      const posts = await Post.find({
        "likes.user": userId,
        imageUrl: { $ne: null }
      }).populate("likes", "_id username");
      return posts;
    },
    
    getCommentedImagePostsByUser: async (_, { userId }) => {
      const posts = await Post.find({
        "comments.user": userId,
        imageUrl: { $ne: null }
      }).populate("createdBy", "username profilePic");
      return posts;
    },
    
    getLikedVideoPostsByUser: async (_, { userId }) => {
      const videos = await Post.find({
        "likes.user": userId,
        videoUrl: { $ne: null }
      }).populate("createdBy", "username");
      return videos;
    },
    
    getLikedReelsByUser: async (_, { userId }) => {
      const reels = await Video.find({
        "likes.user": userId,
        videoUrl: { $ne: null }
      }).populate("createdBy", "username");
      return reels;
    },
    
    getCommentedVideoPostsByUser: async (_, { userId }) => {
      const videos = await Post.find({
        "comments.user": userId,
        videoUrl: { $ne: null }
      });
      return videos;
    },
    
    getCommentedReelsByUser: async (_, { userId }) => {
      const reels = await Video.find({
        "comments.user": userId,
        videoUrl: { $ne: null }
      });
      return reels;
    },    
getFollowRequestsByUser: async (_, { userId }) => {
      try {
        // Find all follow requests where the user is either requester or recipient
        const requests = await FollowRequest.find({
          $or: [{ requester: userId }, { recipient: userId }]
        });

        return requests;
      } catch (error) {
        console.error('Error fetching follow requests:', error);
        throw new Error('Failed to fetch follow requests');
      }
    },


     users: async (_, { userId }) => {
  try {
    // Step 1: Get current user with following, blockedUsers, and blockedBy
    const user = await User.findById(userId)
      .populate('following', 'id name username profileImage isOnline is_blocked')
      .select('following blockedUsers blockedBy');

    if (!user) {
      throw new Error('User not found');
    }

    // Step 2: Get all blocked IDs (both blockedUsers and blockedBy)
    const blockedUserIds = user.blockedUsers?.map(id => id.toString()) || [];
    const blockedByUserIds = user.blockedBy?.map(id => id.toString()) || [];
    const allBlockedIds = [...new Set([...blockedUserIds, ...blockedByUserIds])];

    // Step 3: Filter out blocked users from following list
    const filteredFollowing = user.following.filter(followedUser => 
      !allBlockedIds.includes(followedUser._id.toString())
    );

    // Step 4: Map and return cleaned list
    const followingList = filteredFollowing.map(followedUser => ({
      id: followedUser._id.toString(),
      name: followedUser.name,
      username: followedUser.username,
      profileImage: followedUser.profileImage || null,
    }));

    return followingList;

  } catch (error) {
    console.error('getUserFollowing error:', error);
    throw new Error('Failed to fetch following list');
  }
},
    getFollowers: async (_, { userId }, { }) => {
      if (!userId) throw new AuthenticationError("Not logged in");
      const user = await User.findById(userId).populate("following");
      return user.following;
    },
    getHiddenFromStory: async (_, { userId }, { }) => {
      if (!userId) throw new AuthenticationError("Not logged in");
      const user = await User.findById(userId).populate("hiddenFromStory");
      return user.hiddenFromStory;
    },
mySelf: async (_, { userId }, { dataSources }) => {
      // Example using a data source or DB service
      // You can also replace this with Prisma, Mongoose, etc.
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        isPrivate : user.isPrivate,
      };
    },

    allSavedReels: async (_, {userId}, context) => {
    
    if (!userId) throw new Error("Authentication required");

    const userDoc = await User.findById(userId).populate('saveReels');
    return userDoc.saveReels;
  },
    getArchivedPosts: async (_, { userId }) => {
      return await Post.find({ createdBy: userId, isArchived: true });
    },
    getSavedPosts: async (_, { userId }) => {
      const user = await User.findById(userId).populate("bookmarks");
      return user.bookmarks;
    },

    // users: async () =>
    //   await User.find().select('id name username email phone profileImage is_blocked bio createTime isOnline lastActive').populate('posts', 'id').populate('blockedUsers', 'id name username profileImage'),

      getMe: async (_, args, { user }) => {
        try {
          if (!user) {
            throw new Error('Authentication required');
          }

          const currentUser = await User.findOne({ _id: user.id })
            .populate('posts')
            .populate('followers')
            .populate('following');
          
     
          return currentUser;
        } catch(error) {
          console.log('Error in getMe:', error);
          throw error;
        }
      
      },

      getUserBlockList: async (_, { userId },) => {
        try {
          if (!userId) {
            throw new Error('Authentication required');
          }

          const currentUser = await User.findOne({ _id: userId })
            .populate('posts')
            .populate('blockedUsers')
            .populate('followers')
            .populate('following');
          
          console.log(`🔍 getMe for user ${currentUser.name}:`);
          console.log(`👥 Following count: ${currentUser.following?.length || 0}`);
          console.log(`👥 Following users:`, currentUser.following?.map(f => ({ id: f._id, name: f.name })) || []);
          
          return currentUser;
        } catch(error) {
          console.log('Error in getMe:', error);
          throw error;
        }
      
      },


getAllPosts: async (_, { userId, userLocation }) => {
  console.log('getAllPosts called with userId:', userId, 'and userLocation:', userLocation);
  try {
    const [lon, lat] = userLocation?.coordinates;

    const currentUser = await User.findById(userId).populate('following');
    if (!currentUser) throw new Error("User not found");

    const followingIds = currentUser.following.map(user => user._id);
    const userIdsToFetch = [userId, ...followingIds];

    const maxDistance = 10000; // 10 km

    // 🔹 Fetch posts from following users
    const followingPosts = await Post.find({
      createdBy: { $in: userIdsToFetch }
    })
    .sort({ createdAt: -1 })
    .populate("createdBy", "id name username profileImage")
    .populate("likes.user", "id name username profileImage")
    .populate("comments.user", "id name username profileImage")
    .populate("comments.likes.user", "id name username profileImage")
    .populate("comments.replies.user", "id name username profileImage")
    .populate("comments.replies.likes.user", "id name username profileImage");

    // 🔹 Fetch nearby posts
    const nearbyPosts = await Post.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lon, lat],
          },
          $maxDistance: maxDistance,
        }
      }
    })
    .sort({ createdAt: -1 })
    .populate("createdBy", "id name username profileImage")
    .populate("likes.user", "id name username profileImage")
    .populate("comments.user", "id name username profileImage")
    .populate("comments.likes.user", "id name username profileImage")
    .populate("comments.replies.user", "id name username profileImage")
    .populate("comments.replies.likes.user", "id name username profileImage");

    // 🔹 Combine and remove duplicates
    const combined = [...followingPosts, ...nearbyPosts];
    const uniquePostsMap = new Map();
    combined.forEach(post => {
      uniquePostsMap.set(post._id.toString(), post);
    });

    const posts = Array.from(uniquePostsMap.values());

    const postsWithFlag = posts.map(post => ({
      ...post._doc,
      id: post._id,
      isVideo: !!post.videoUrl
    }));

    return postsWithFlag;
  } catch (error) {
    console.error('getAllPosts error:', error);
    throw new Error('Failed to fetch posts');
  }
},

// New resolver for profile page - only user's own posts
getUserOwnPosts: async (_, { userId }) => {
  try {
    // Fetch only posts created by the specific user
    const posts = await Post.find({ createdBy: userId, isArchived: { $ne: true } })
      .sort({ createdAt: -1 })
      .populate("createdBy", "id name username profileImage")
      .populate("likes.user", "id name username profileImage")
      .populate("comments.user", "id name username profileImage")
      .populate("comments.likes.user", "id name username profileImage")
      .populate("comments.replies.user", "id name username profileImage")
      .populate("comments.replies.likes.user", "id name username profileImage");

    // ✅ Add isVideo flag to posts based on whether they have videoUrl
    const postsWithFlag = posts.map(post => ({
      ...post._doc,
      id: post._id,
      isVideo: !!post.videoUrl // true if post has video, false otherwise
    }));

    return postsWithFlag;
  } catch (error) {
    console.error('getUserOwnPosts error:', error);
    throw new Error('Failed to fetch user posts');
  }
},

// user notifications code 


getUserNotifications: async (_, { userId }) => {
  try {
    console.log('Fetching notifications for user:', userId);
    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'id name username profileImage')
      .populate('post', 'id caption imageUrl videoUrl')
      .sort({ createdAt: -1 })
      .limit(50);
    
    console.log('Found notifications:', notifications.length);
    notifications.forEach(notif => {
      if (notif.type === 'follow_request') {
        console.log('Follow request notification:', {
          id: notif._id,
          followRequestId: notif.followRequestId,
          type: notif.type,
          message: notif.message
        });
      }
    });

    return notifications.map(notification => {
      const notificationObj = {
        ...notification._doc,
        id: notification._id.toString(),
        recipient: {
          ...notification.recipient,
          id: notification.recipient._id.toString()
        }
      };

      // Convert sender IDs
      if (notification.sender) {
        notificationObj.sender = {
          ...notification.sender._doc,
          id: notification.sender._id.toString()
        };
      }

      // Convert post IDs
      if (notification.post) {
        notificationObj.post = {
          ...notification.post._doc,
          id: notification.post._id.toString()
        };
      }

      // Convert commentId if it exists
      if (notification.commentId) {
        notificationObj.commentId = notification.commentId.toString();
      }

      // Convert followRequestId if it exists
      if (notification.followRequestId) {
        notificationObj.followRequestId = notification.followRequestId.toString();
      }

      return notificationObj;
    });
  } catch (error) {
    console.error('getUserNotifications error:', error);
    throw new Error('Failed to fetch notifications');
  }
},

// Get unread notifications count
getUnreadNotificationsCount: async (_, { userId }) => {
  try {
    const user = await User.findById(userId);
    return user ? user.unreadNotifications : 0;
  } catch (error) {
    console.error('getUnreadNotificationsCount error:', error);
    throw new Error('Failed to get unread count');
  }
},

// Get comment details with likes and replies
getCommentDetails: async (_, { postId, commentId }) => {
  try {
    const post = await Post.findById(postId)
      .populate("comments.user", "id name username profileImage")
      .populate("comments.likes.user", "id name username profileImage")
      .populate("comments.replies.user", "id name username profileImage")
      .populate("comments.replies.likes.user", "id name username profileImage");

    if (!post) throw new Error("Post not found");

    const comment = post.comments.id(commentId);
    if (!comment) throw new Error("Comment not found");

    // Convert all IDs to strings
    const commentObj = {
      ...comment._doc,
      id: comment._id.toString(),
      user: {
        ...comment.user._doc,
        id: comment.user._id.toString()
      },
      likes: comment.likes.map(like => ({
        ...like._doc,
        id: like._id.toString(),
        user: {
          ...like.user._doc,
          id: like.user._id.toString()
        }
      })),
      replies: comment.replies.map(reply => ({
        ...reply._doc,
        id: reply._id.toString(),
        user: {
          ...reply.user._doc,
          id: reply.user._id.toString()
        },
        likes: reply.likes.map(replyLike => ({
          ...replyLike._doc,
          id: replyLike._id.toString(),
          user: {
            ...replyLike.user._doc,
            id: replyLike.user._id.toString()
          }
        }))
      }))
    };

    return commentObj;
  } catch (error) {
    console.error('getCommentDetails error:', error);
    throw new Error('Failed to get comment details');
  }
}, // end code here


searchUsers: async (_, { username, userId }) => {
  try {
    // Search all users except the current user
    const users = await User.find({
      $and: [
        {
          $or: [
            { name: { $regex: username, $options: 'i' } },
            { username: { $regex: username, $options: 'i' } }
          ]
        },
        { _id: { $ne: userId } }  // Exclude current user
      ]
    })
      .select('id name username email phone isPrivate is_blocked profileImage bio createTime followers following posts')
      .populate('followers', 'id name')
      .populate('following', 'id name')
      .populate('blockedUsers', 'id username')
      .populate({
        path: 'posts',
        select: 'id caption imageUrl createdAt likes comments',
        populate: [
          {
            path: 'likes.user',
            select: 'id name username profileImage'
          },
          {
            path: 'comments.user',
            select: 'id name username profileImage'
          }
        ]
      })
      .limit(10);

    return users;
  } catch (error) {
    console.error('Search users error:', error);
    throw new Error('Failed to search users');
  }
},

    suggestedUsers: async (_, { userId }) => {
  try {
    const currentUser = await User.findById(userId)
      .select('blockedUsers blockedBy')
      .populate('following');

    if (!currentUser) throw new Error("User not found");

    const userFollowings = currentUser.following.map(u => u._id.toString());

    // 🔒 Block logic
    const blockedUserIds = currentUser?.blockedUsers?.map(id => id.toString()) || [];
    const blockedByUserIds = currentUser?.blockedBy?.map(id => id.toString()) || [];
    const allBlockedIds = [...new Set([...blockedUserIds, ...blockedByUserIds])];

    const potentialSuggestionsMap = {};

    for (let followedUserId of userFollowings) {
      const followedUser = await User.findById(followedUserId).populate("following");
      if (!followedUser) continue;

      followedUser.following.forEach(targetUser => {
        const id = targetUser._id.toString();
        if (
          id !== userId &&
          !userFollowings.includes(id) &&
          id !== currentUser._id.toString() &&
          !allBlockedIds.includes(id) // ❌ Exclude blocked users
        ) {
          potentialSuggestionsMap[id] = (potentialSuggestionsMap[id] || 0) + 1;
        }
      });
    }

    const suggestedUserIdsWithScore = Object.entries(potentialSuggestionsMap)
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ id, score }));

    if (suggestedUserIdsWithScore.length > 0) {
      const users = await User.find({
        _id: {
          $in: suggestedUserIdsWithScore.map(u => u.id),
          $nin: allBlockedIds // ❌ Exclude blocked users again (just in case)
        }
      })
        .populate('followers', 'id name')
        .populate('following', 'id name')
        .populate('blockedUsers', 'id username')
        .populate({
          path: 'posts',
          select: 'id caption imageUrl createdAt likes comments',
          populate: [
            { path: 'likes.user', select: 'id name username profileImage' },
            { path: 'comments.user', select: 'id name username profileImage' }
          ]
        });

      const usersWithScore = users.map(user => {
        const scoreObj = suggestedUserIdsWithScore.find(u => u.id === user._id.toString());
        return {
          ...user._doc,
          id: user._id.toString(),
          suggestionScore: scoreObj ? scoreObj.score : 0
        };
      });

      return usersWithScore.sort((a, b) => b.suggestionScore - a.suggestionScore);
    }

    // 🔄 Fallback users if no suggestions — also exclude blocked
    const fallbackUsers = await User.find({
      _id: {
        $nin: [...userFollowings, currentUser._id.toString(), ...allBlockedIds]
      }
    })
      .populate('followers', 'id name')
      .populate('following', 'id name')
      .populate('blockedUsers', 'id username')
      .populate({
        path: 'posts',
        select: 'id caption imageUrl createdAt likes comments',
        populate: [
          { path: 'likes.user', select: 'id name username profileImage' },
          { path: 'comments.user', select: 'id name username profileImage' }
        ]
      })
      .limit(5);

    return fallbackUsers.map(u => ({
      ...u._doc,
      id: u._id.toString(),
      suggestionScore: 0
    }));

  } catch (err) {
    console.error('suggestedUsers resolver error:', err);
    throw err;
  }
},

  //   getUserInformation: async (_, { id }) => {
  //     const user = await User.findById(id);
  //     if (!user) throw new Error("User not found");
  //     return user;
  //   },
  // },

  getUserInformation: async (_, { id }) => {
  try {
    console.log('🔍 Fetching user information for ID:', id);
    
    const user = await User.findById(id)
      .populate('followers', 'id name username profileImage')
      .populate('following', 'id name username profileImage')
      .populate('posts', 'id');
    
    if (!user) {
      throw new Error("User not found");
    }

    if (user.is_blocked) {
      throw new Error("User is blocked by Admin");
    }

    console.log('📊 User stats:', {
      followers: user.followers?.length || 0,
      following: user.following?.length || 0,
      posts: user.posts?.length || 0
    });

    return user;
  } catch (error) {
    console.error('❌ Error in getUserInformation:', error);
    throw new Error(error.message || "Something went wrong");
  }
},

    // Activity logs resolver
    activityLogs: async (_, { userId }) => {
      try {
        if (!userId) {
          throw new Error('User ID is required');
        }

        // Get activity logs for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateString = thirtyDaysAgo.toISOString().split('T')[0];

        const logs = await ActivityLog.find({
          userId,
          date: { $gte: dateString }
        }).sort({ date: -1 });

        // If no logs exist, create some sample data for the last 7 days
        if (logs.length === 0) {
          const sampleLogs = [];
          const devices = ['Mobile', 'Desktop', 'Tablet'];
          
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Create realistic activity data (20-180 minutes per day)
            const totalMinutes = Math.floor(Math.random() * 160) + 20;
            
            // Generate 1-5 sessions for this day
            const sessionCount = Math.floor(Math.random() * 5) + 1;
            const sessions = [];
            let remainingMinutes = totalMinutes;
            
            for (let j = 0; j < sessionCount; j++) {
              // Determine session duration (at least 5 minutes, but not more than remaining minutes)
              const sessionMinutes = Math.min(
                Math.max(Math.floor(remainingMinutes / (sessionCount - j)), 5),
                remainingMinutes
              );
              remainingMinutes -= sessionMinutes;
              
              // Create random start time for this day
              const sessionDate = new Date(date);
              const randomHour = Math.floor(Math.random() * 24);
              const randomMinute = Math.floor(Math.random() * 60);
              sessionDate.setHours(randomHour, randomMinute, 0, 0);
              
              // Calculate end time
              const endDate = new Date(sessionDate);
              endDate.setMinutes(endDate.getMinutes() + sessionMinutes);
              
              // Randomly select device
              const devices = ['Mobile', 'Desktop', 'Tablet'];
              const deviceIndex = Math.floor(Math.random() * devices.length);
              
              sessions.push({
                startTime: sessionDate,
                endTime: endDate,
                duration: sessionMinutes,
                device: devices[deviceIndex]
              });
            }
            
            // We've already generated sessions above, so we don't need to generate more
            
            const log = new ActivityLog({
              userId,
              date: dateStr,
              totalMinutes,
              lastActivity: new Date(),
              sessions
            });
            
            await log.save();
            sampleLogs.push(log);
          }
          return sampleLogs;
        }

        return logs;
      } catch (error) {
        console.error('activityLogs resolver error:', error);
        throw new Error('Failed to fetch activity logs');
      }
    },
  },

  Mutation: {
    requestOtp: async (_, { name, username, email, password, phone }) => {
      if (await User.findOne({ email })) throw new Error('User with this email already exists');
      if (await User.findOne({ username })) throw new Error('Username already taken');

      const otp = Math.floor(100000 + Math.random() * 900000);
      await sendOtpMail(email, otp);

      otpStore[email] = {
        otp,
        name,
        username,
        email,
        password,
        phone,
        expiry: new Date(Date.now() + 2 * 60 * 1000),
      };

      return { email, otp, otpExpiryTime: otpStore[email].expiry };
    },

    registerUser: async (_, { email, otp }, { res }) => {
      const entry = otpStore[email];
      if (!entry) throw new Error('No OTP requested');
      if (new Date() > entry.expiry) throw new Error('OTP expired');
      if (parseInt(otp) !== entry.otp) throw new Error('OTP not matched');
      if (await User.findOne({ email: entry.email })) throw new Error('User already exists');

      const user = new User({
        name: entry.name,
        username: entry.username,
        email: entry.email,
        password: await bcrypt.hash(entry.password, 10),
        phone: entry.phone,
        otp: entry.otp,
        createTime: new Date(),
        otpExpiryTime: entry.expiry,
      });

      await user.save();
      delete otpStore[email];

      const token = user_token(user);
      res.cookie("token", token);

      return user;
    },

   login: async (_, { email, password }, { res }) => {
  const user = await User.findOne({ email });
  
  if (!user) {
    throw new Error('User not found');
  }

  // ✅ Block check pehle hi lagao
  if (user.is_blocked) {
    throw new Error('User is blocked by admin');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = user_token(user);
  res.cookie("token", token);
  return user;
},


    logout: async (_, __, { res }) => {
      res.clearCookie("token");
      return "User logged out successfully";
    },

    changePassword: async (_, { email }) => {
      const user = await User.findOne({ email });
      if (!user) throw new Error('User not found');
         const otp = Math.floor(100000 + Math.random() * 900000);
      await sendOtpMail(email, otp);

      return { email, otp,expiry: new Date(Date.now() + 2 * 60 * 1000) };
    },

        newPassword: async (_, { email,newPassword }) => {
      const user = await User.findOne({ email });
      if (!user) throw new Error('User not found');
      user.password = await bcrypt.hash(newPassword, 6);
      await user.save();
      return 'Password updated successfully';
    },


updateUserPrivacy: async (_, { userId, isPrivate }) => {
  try {
    // Find user
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Update the field directly
    user.isPrivate = isPrivate;
    await user.save();

    return "Private account status updated successfully";
  } catch (error) {
    throw new Error(`Failed to update privacy: ${error.message}`);
  }
},

hideStoryFrom: async (_, { userIds,currentUserId}, { currentUser }) => {
      if (!currentUserId) throw new AuthenticationError("Not logged in");

      const user = await User.findById(currentUserId);

      // Filter only valid followers
      const validUserIds = userIds.filter(id => user.followers.includes(id));

      user.hiddenFromStory = validUserIds;
      await user.save();

      return "Story hidden from selected users.";
    },

    createPage: async (_, { title, category, profileImage, coverImage, description, userId }) => {
      try {
          if(!title || !category || !description || !userId || !profileImage || !coverImage) throw new Error("Missing required fields");
        let imageUrl = null;
        let coverUrl = null;

        if (profileImage) {
          imageUrl = await uploadToCloudinary(profileImage, 'image');
        }

        if (coverImage) {
          coverUrl = await uploadToCloudinary(coverImage, 'image');
        }

        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        const page = new Page({
          title,
          category,
          description,
          profileImage: imageUrl,
          coverImage: coverUrl,
          createdBy: userId,
        });

        await page.save();

        await User.findByIdAndUpdate(userId, {
          $push: { createdPages: page._id },
        });

        return page;
      } catch (error) {
        throw new Error(error.message || "Failed to create page");
      }
    },

    deletePage: async (_, { pageId, userId }) => {
  if (!pageId) throw new Error("Page ID is required");
  if (!userId) throw new Error("User ID is required");

  // Step 1: Delete the page
  const deletedPage = await Page.findByIdAndDelete(pageId);
  if (!deletedPage) throw new Error("Page not found");

  // Step 2: Find the user who created it
  const user = await User.findById(deletedPage.createdBy);
  if (!user) throw new Error("Creator user not found");

  if( user._id.toString() !== userId) {
    throw new Error("You are not authorized to delete this page");
  }

  // Step 3: Remove this page's ID from user's createdPages array
  user.createdPages = user.createdPages.filter(
    pageId => pageId.toString() !== deletedPage._id.toString()
  );

  // Step 4: Save the updated user document
  await user.save();

  return "Page deleted successfully";
},

    // ✅ likePage with try-catch
    likePage: async (_, { userId, pageId }) => {
      try {
        const page = await Page.findById(pageId);
        const user = await User.findById(userId);

        if (!page || !user) throw new Error("User or Page not found");

        if (page.likedBy.includes(userId)) {
          return "Page already liked";
        }

        page.likedBy.push(userId);
        await page.save();

        await User.findByIdAndUpdate(userId, {
          $addToSet: { likedPages: pageId },
        });

        return "Page liked successfully";
      } catch (error) {
        throw new Error(error.message || "Failed to like page");
      }
    },

block: async (_, { targetUserId, userId }) => {
  if (!userId || !targetUserId) throw new Error("Missing userId or targetUserId");

  if (userId === targetUserId) {
    throw new Error("You can't block yourself");
  }

  const currentUser = await User.findById(userId);
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) throw new Error("User not found");

  // Already blocked?
  if (currentUser.blockedUsers.includes(targetUserId)) {
    throw new Error("User already blocked");
  }

  // ✅ Add block
  currentUser.blockedUsers.push(targetUserId);

  // ✅ Only add to blockedBy if not already there
  if (!targetUser.blockedBy.includes(userId)) {
    targetUser.blockedBy.push(userId);
  }

  await currentUser.save();
  await targetUser.save();

  return "User blocked successfully";
},

unblock: async (_, { targetUserId, userId }) => {
  if (!userId || !targetUserId) throw new Error("Missing userId or targetUserId");

  const currentUser = await User.findById(userId);
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) throw new Error("User not found");

  // ✅ Remove from blockedUsers of currentUser
  currentUser.blockedUsers = currentUser.blockedUsers.filter(
    id => id.toString() !== targetUserId
  );

  // ✅ Remove from blockedBy of targetUser
  targetUser.blockedBy = targetUser.blockedBy.filter(
    id => id.toString() !== userId
  );

  await currentUser.save();
  await targetUser.save();

  return "User unblocked successfully";
},

createPagePost: async (_, { caption, image, video, pageId }) => {
  if(!pageId) throw new Error("Page ID is required");
      try {
        // ✅ Upload image if exists
        let imageUrl = null;
        if (image) {
          imageUrl = await uploadToCloudinary(image, 'image');
        }

        // ✅ Upload video if exists
        let videoUrl = null;
        if (video) {
          videoUrl = await uploadToCloudinary(video, 'video');
        }

        // ✅ Upload thumbnail if exists
        let thumbnailUrl = null;
        if (thumbnail) {
          thumbnailUrl = await uploadToCloudinary(thumbnail, 'image');
        }

        // ✅ Create post document
        const newPost = new PageByUser({
          caption,
          imageUrl,
          videoUrl,
          thumbnailUrl,
          createdBy: pageId,
        });

       const savedPost = await newPost.save();
       
       await savedPost.populate("createdBy");

        return savedPost;
      } catch (error) {
        console.error("Error creating page post:", error);
        throw new Error("Failed to create page post");
      }
    },

//     createPost: async (_, { id, caption, image, video, thumbnail, locationName }) => {
//   let imageUrl = null;
//   let videoUrl = null;
//   let thumbnailUrl = null;
//   let location = undefined;

//   // ✅ Geocode locationName to coordinates
//   if (locationName) {
//     try {
//       const coords = await geocodeLocation(locationName); // await is necessary
//       location = {
//         type: 'Point',
//         coordinates: [coords.lon, coords.lat], // [longitude, latitude]
//       };
//     } catch (error) {
//       console.warn("Location not found or geocoding failed:", error.message);
//     }
//   }

//   // ✅ Upload image
//   if (image) {
//     imageUrl = await uploadToCloudinary(image, 'image');
//   }

//   // ✅ Upload video
//   if (video) {
//     if (video.size > 300 * 1024 * 1024) {
//       throw new Error("Video should be under 300MB");
//     }
//     const videoResponse = await uploadToCloudinary(video, 'video');
//     videoUrl = videoResponse.url;
//   }

//   // ✅ Upload thumbnail
//   if (thumbnail) {
//     thumbnailUrl = await uploadToCloudinary(thumbnail, 'image');
//   }

//   // ✅ At least one media required
//   // if (!imageUrl && !videoUrl) {
//   //   throw new Error('Either image or video must be provided');
//   // }

//   // ✅ Create the post
//   const post = await Post.create({
//     caption,
//     imageUrl,
//     videoUrl,
//     thumbnailUrl,
//     locationName: locationName || null,
//     location: location || undefined,
//     createdBy: id,
//   });

//   // ✅ Add post to user's post list
//   await User.findByIdAndUpdate(id, { $push: { posts: post._id } });

//   return post;
// },


createPost: async (_, {
  id,
  caption,
  image,
  video,
  thumbnail,
  locationName,
  location // ✅ Accept directly from frontend
}) => {
  let imageUrl = null;
  let videoUrl = null;
  let thumbnailUrl = null;

  // ✅ Upload image
  if (image) {
    imageUrl = await uploadToCloudinary(image, 'image');
  }

  // ✅ Upload video
  if (video) {
    if (video.size > 300 * 1024 * 1024) {
      throw new Error("Video should be under 300MB");
    }
    const videoResponse = await uploadToCloudinary(video, 'video');
    videoUrl = videoResponse.url;
  }

  // ✅ Upload thumbnail
  if (thumbnail) {
    thumbnailUrl = await uploadToCloudinary(thumbnail, 'image');
  }

  // ✅ Create the post
  const post = await Post.create({
    caption,
    imageUrl,
    videoUrl,
    thumbnailUrl,
    locationName: locationName || null,
    location: location || undefined, // 🆕 coordinates from frontend
    createdBy: id,
  });

  // ✅ Add post to user's post list
  await User.findByIdAndUpdate(id, {
    $push: { posts: post._id }
  });

  return post;
},
   // 📌 Save Post Resolver
savePost: async (_, { userId, postId }) => {
  try {
    if (!userId || !postId) {
      throw new Error("Missing userId or postId");
    }

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (!Array.isArray(user.bookmarks)) {
      user.bookmarks = [];
    }

    const alreadyBookmarked = user.bookmarks.some(
      (id) => id.toString() === postId.toString()
    );

    if (!alreadyBookmarked) {
      user.bookmarks.push(postId);
      await user.save();
    }

    return "Post saved successfully.";
  } catch (error) {
    console.error("Error in savePost:", error);
    throw new Error("Failed to save post.");
  }
}
,

// ❌ Unsave Post Resolver
unsavePost: async (_, { userId, postId }) => {
  try {
    if (!userId || !postId) {
      throw new Error("Missing userId or postId");
    }

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (!Array.isArray(user.bookmarks)) {
      user.bookmarks = [];
    }

    const beforeCount = user.bookmarks.length;

    // Filter out the postId
    user.bookmarks = user.bookmarks.filter(
      (savedId) => savedId.toString() !== postId.toString()
    );

    const afterCount = user.bookmarks.length;

    // Save only if something was actually removed
    if (beforeCount !== afterCount) {
      await user.save();
      return "Post removed from bookmarks.";
    } else {
      return "Post was not bookmarked.";
    }

  } catch (error) {
    console.error("Error in unsavePost:", error);
    throw new Error("Failed to unsave post.");
  }
},
saveReel: async (_, { reelId,userId }, context) => {
      try {
        if (!userId) {
          return "Authentication required" 
        }

        // Check if reel exists
        const reel = await Video.findById(reelId);
        if (!reel) {
          return  "Reel not found"
        }

        // Check if already saved
        const userDoc = await User.findById(userId);
        const alreadySaved = userDoc.saveReels.includes(reelId);

        if (alreadySaved) {
          return " Reel already saved" 
        }

        userDoc.saveReels.push(reelId);
        await userDoc.save();

        return "Reel saved successfully"
      } catch (err) {
        console.error(err);
        return "Something went wrong"
      }
    },

    unsaveReel: async (_, { reelId,userId }, context) => {
      try {
        if (!userId) {
          return  "Authentication required" 
        }

        await User.findByIdAndUpdate(userId, {
          $pull: { saveReels: reelId },
        });

        return  "Reel unsaved successfully"
      } catch (err) {
        console.error(err);
        return "Something went wrong" 
      }
    },

archivePost: async (_, { postId,userId }, { user }) => {
      try {
        const post = await Post.findOne({ _id: postId, createdBy: userId });
        if (!post) {
          throw new Error("Post not found");
        }

        post.isArchived = true;
        await post.save();
        return "Post Archived successfully";
      } catch (error) {
        console.error("Error archiving post:", error);
        throw new Error("Failed to archive post");
      }
    },

    unarchivePost: async (_, { postId,userId }, { user }) => {
      try {
        const post = await Post.findOne({ _id: postId, createdBy: userId });
        if (!post) {
          throw new Error("Post not found");
        }

        post.isArchived = false;
        await post.save();
        return "Post unArchived successfully";
      } catch (error) {
        console.error("Error unarchiving post:", error);
        throw new Error("Failed to unarchive post");
      }
    },

    
    DeletePost: async (_, { id}) => {      
if (!id) throw new Error("Post ID is required");
      const deletePost = await Post.findByIdAndDelete(id);

if (deletePost) {
  const user = await User.findById(deletePost.createdBy);
  

  if (user) {
    user.posts = user.posts.filter(
      postId => postId.toString() !== deletePost._id.toString()
    );

    await user.save(); // 🔥 Ye important hai
  }
}
      return "DeletePost Successfully..."
    },

     CommentPost : async (_, { userId, postId, text }, context) => {
  if (!userId || !postId || !text.trim()) {
    throw new Error("Missing fields");
  }

  // 1. Create new comment
  const newComment = {
    user: userId,
    text,
    commentedAt: new Date(),
  };

  // 2. Find post and push comment
  const post = await Post.findById(postId).populate('createdBy', 'id name username');
  if (!post) throw new Error("Post not found");

  post.comments.push(newComment);
  await post.save();

  // Get the created comment ID
  const createdComment = post.comments[post.comments.length - 1];

  // 🔔 Create notification for post owner (if not commenting on own post)
  if (post.createdBy._id.toString() !== userId) {
    try {
      const notification = new Notification({
        recipient: post.createdBy._id,
        sender: userId,
        type: 'comment',
        message: 'commented on your post',
        post: postId,
        commentId: createdComment._id,
        commentText: text
      });
      await notification.save();
      
      // Get populated notification data
      const populatedNotification = await Notification.findById(notification._id)
        .populate('sender', 'id name username profileImage')
        .populate('post', 'id caption imageUrl videoUrl');

      console.log('🔔 Comment notification created:', populatedNotification);

      // 🚀 EMIT REAL-TIME NOTIFICATION
      const io = context.req?.app?.get('io');
      if (io) {
        const recipientId = post.createdBy._id.toString();
        console.log('🚀 Emitting comment notification to user:', recipientId);
        
        io.to(recipientId).emit('newNotification', {
          id: populatedNotification._id.toString(),
          type: 'comment',
          sender: {
            id: populatedNotification.sender._id.toString(),
            name: populatedNotification.sender.name,
            username: populatedNotification.sender.username,
            profileImage: populatedNotification.sender.profileImage
          },
          post: {
            id: populatedNotification.post._id.toString(),
            caption: populatedNotification.post.caption
          },
          commentId: createdComment._id.toString(),
          commentText: text.trim(),
          createdAt: populatedNotification.createdAt.toISOString(),
          isRead: false
        });
        
        console.log('✅ Comment notification emitted successfully');
      } else {
        console.log('❌ Socket.io not available for comment notification');
      }
      
      // Increment unread count for recipient
      await User.findByIdAndUpdate(post.createdBy._id, {
        $inc: { unreadNotifications: 1 }
      });
    } catch (notificationError) {
      console.error('Error creating comment notification:', notificationError);
    }
  }

  // await post.populate("comments.user");

  return post.comments;
},

    // Send follow request to private user
    // sendFollowRequest: async (_, { privateUserId, requesterId, requesterName }) => {
    //   try {
    //     // Check if request already exists
    //     const existingRequest = await FollowRequest.findOne({
    //       requester: requesterId,
    //       target: privateUserId,
    //       status: 'pending'
    //     });

    //     if (existingRequest) {
    //       throw new Error('Follow request already sent');
    //     }

    //     // Create follow request
    //     const followRequest = new FollowRequest({
    //       requester: requesterId,
    //       target: privateUserId,
    //       status: 'pending'
    //     });

    //     await followRequest.save();

    //     // Create notification for private user
    //     const notification = new Notification({
    //       recipient: privateUserId,
    //       sender: requesterId,
    //       type: 'follow_request',
    //       message: `${requesterName} wants to follow you`,
    //       followRequestId: followRequest._id
    //     });

    //     await notification.save();

    //     // Increment unread notifications count
    //     await User.findByIdAndUpdate(privateUserId, {
    //       $inc: { unreadNotifications: 1 }
    //     });

    //     return {
    //       id: followRequest._id.toString(),
    //       message: 'Follow request sent successfully',
    //       success: true
    //     };
    //   } catch (error) {
    //     console.error('Error sending follow request:', error);
    //     throw new Error(error.message || 'Failed to send follow request');
    //   }
    // },


    sendFollowRequest: async (_, { privateUserId, requesterId, requesterName }) => {
  try {
    // Check if request already exists
    const existingRequest = await FollowRequest.findOne({
      requester: requesterId,
      recipient: privateUserId, // ✅ field name corrected
      status: 'pending'
    });

    if (existingRequest) {
      throw new Error('Follow request already sent');
    }

    // Create follow request
    const followRequest = new FollowRequest({
      requester: requesterId,
      recipient: privateUserId, // ✅ field name corrected
      status: 'pending'
    });

    await followRequest.save();

    // Create notification for private user
    const notification = new Notification({
      recipient: privateUserId,
      sender: requesterId,
      type: 'follow_request',
      message: `${requesterName} wants to follow you`,
      followRequestId: followRequest._id
    });

    await notification.save();
    console.log('Created follow request notification:', {
      notificationId: notification._id,
      followRequestId: followRequest._id,
      recipient: privateUserId,
      sender: requesterId
    });

    // Increment unread notifications count
    await User.findByIdAndUpdate(privateUserId, {
      $inc: { unreadNotifications: 1 }
    });

    return {
      id: followRequest._id.toString(),
      message: 'Follow request sent successfully',
      success: true
    };
  } catch (error) {
    console.error('Error sending follow request:', error);
    throw new Error(error.message || 'Failed to send follow request');
  }
},

    // Accept follow request
    acceptFollowRequest: async (_, { requestId, userId }) => {
      try {
        const followRequest = await FollowRequest.findById(requestId)
          .populate('requester', 'id name username')
          .populate('recipient', 'id name username');

        if (!followRequest) {
          throw new Error('Follow request not found');
        }

        if (followRequest.recipient._id.toString() !== userId) {
          throw new Error('Unauthorized to accept this request');
        }

        if (followRequest.status !== 'pending') {
          throw new Error('Follow request is no longer pending');
        }

        // Update follow request status
        followRequest.status = 'accepted';
        await followRequest.save();

        // Add follower relationship
        const recipientUser = await User.findById(followRequest.recipient._id);
        const requesterUser = await User.findById(followRequest.requester._id);

        // Add requester to recipient's followers
        if (!recipientUser.followers.includes(followRequest.requester._id)) {
          recipientUser.followers.push(followRequest.requester._id);
          await recipientUser.save();
        }

        // Add recipient to requester's following
        if (!requesterUser.following.includes(followRequest.recipient._id)) {
          requesterUser.following.push(followRequest.recipient._id);
          await requesterUser.save();
        }

        // Create acceptance notification for requester
        const acceptNotification = new Notification({
          recipient: followRequest.requester._id,
          sender: followRequest.recipient._id,
          type: 'follow_accept',
          message: `${followRequest.recipient.name} accepted your follow request`
        });

        await acceptNotification.save();

        // Increment unread notifications count for requester
        await User.findByIdAndUpdate(followRequest.requester._id, {
          $inc: { unreadNotifications: 1 }
        });

        // Delete the follow request notification
        await Notification.deleteOne({
          followRequestId: followRequest._id,
          type: 'follow_request'
        });

        return 'Follow request accepted successfully';
      } catch (error) {
        console.error('Error accepting follow request:', error);
        throw new Error(error.message || 'Failed to accept follow request');
      }
    },

    // Reject follow request
    rejectFollowRequest: async (_, { requestId, userId }) => {
      try {
        const followRequest = await FollowRequest.findById(requestId);

        if (!followRequest) {
          throw new Error('Follow request not found');
        }

        if (followRequest.recipient.toString() !== userId) {
          throw new Error('Unauthorized to reject this request');
        }

        if (followRequest.status !== 'pending') {
          throw new Error('Follow request is no longer pending');
        }

        // Update follow request status
        followRequest.status = 'rejected';
        await followRequest.save();

        // Delete the follow request notification
        await Notification.deleteOne({
          followRequestId: followRequest._id,
          type: 'follow_request'
        });

        return 'Follow request rejected successfully';
      } catch (error) {
        console.error('Error rejecting follow request:', error);
        throw new Error(error.message || 'Failed to reject follow request');
      }
    },

    LikePost: async (_, { userId, postId }, context) => {
   
  if (!userId || !postId) {
    throw new Error("userId and postId are required");
  }

  try {
    const post = await Post.findById(postId).populate('createdBy', 'id name username');

    if (!post) {
      throw new Error("Post not found");
    }

    const alreadyLiked = post.likes.some(like => like.user.toString() === userId);

    if (alreadyLiked) {
    // user unlike kar rha hai
      post.likes = post.likes.filter(like => like.user.toString() !== userId);
    } else {
      post.likes.push({ user: userId, likedAt: new Date() });
      
      // 🔔 Create notification for post owner (if not liking own post)
      if (post.createdBy._id.toString() !== userId) {
        try {
          const notification = new Notification({
            recipient: post.createdBy._id,
            sender: userId,
            type: 'like',
            message: 'liked your post',
            post: postId
          });
          await notification.save();
          
          // Get populated notification data
          const populatedNotification = await Notification.findById(notification._id)
            .populate('sender', 'id name username profileImage')
            .populate('post', 'id caption imageUrl videoUrl');

          console.log('🔔 Like notification created:', populatedNotification);

          // 🚀 EMIT REAL-TIME NOTIFICATION
          const io = context.req?.app?.get('io');
          if (io) {
            const recipientId = post.createdBy._id.toString();
            console.log('🚀 Emitting like notification to user:', recipientId);
            
            io.to(recipientId).emit('newNotification', {
              id: populatedNotification._id.toString(),
              type: 'like',
              sender: {
                id: populatedNotification.sender._id.toString(),
                name: populatedNotification.sender.name,
                username: populatedNotification.sender.username,
                profileImage: populatedNotification.sender.profileImage
              },
              post: {
                id: populatedNotification.post._id.toString(),
                caption: populatedNotification.post.caption
              },
              createdAt: populatedNotification.createdAt.toISOString(),
              isRead: false
            });
            
            console.log('✅ Like notification emitted successfully');
          } else {
            console.log('❌ Socket.io not available for like notification');
          }
          
          // Increment unread count for recipient
          await User.findByIdAndUpdate(post.createdBy._id, {
            $inc: { unreadNotifications: 1 }
          });
        } catch (notificationError) {
          console.error('Error creating like notification:', notificationError);
        }
      }
    }

    await post.save();
    
    return alreadyLiked ? "Unliked" : "Liked";
  } catch (error) {
    console.error("Like error:", error);
    throw new Error("Something went wrong while liking the post");
  }
},

    editProfile: async (_, { id, username, name, caption, image }) => {
      const user = await User.findById(id);
      if (!user) throw new Error("User not found");
      if (name) user.name = name;
      if (username && username !== user.username) {
        // Only check username uniqueness if it's being changed
        const existingUser = await User.findOne({ username });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          throw new Error("Username already taken");
        }
        user.username = username;
      }
      if (caption) user.bio = caption;
      if (image) user.profileImage = await uploadToCloudinary(image);
      await user.save();
      return user;
    },

    followAndUnfollow: async (_, { id }, context) => {
      if (!context?.user?.id) throw new Error("Unauthorized");
      const reqUserId = context.user.id;
      if (reqUserId === id) throw new Error("You cannot follow yourself");

      const [currentUser, targetUser] = await Promise.all([
        User.findById(reqUserId),
        User.findById(id),
      ]);

      if (!currentUser || !targetUser) throw new Error("User not found");

      const isFollowing = currentUser.following.includes(id);

      if (isFollowing) {
        await Promise.all([
          User.updateOne({ _id: reqUserId }, { $pull: { following: id } }),
          User.updateOne({ _id: id }, { $pull: { followers: reqUserId } }),
        ]);
      } else {
        await Promise.all([
          User.updateOne({ _id: reqUserId }, { $push: { following: id } }),
          User.updateOne({ _id: id }, { $push: { followers: reqUserId } }),
        ]);
        
        // 🔔 Create follow notification
        try {
          const notification = new Notification({
            recipient: id,
            sender: reqUserId,
            type: 'follow',
            message: 'started following you'
          });
          await notification.save();
          
          // Get populated notification data
          const populatedNotification = await Notification.findById(notification._id)
            .populate('sender', 'id name username profileImage');

          console.log('🔔 Follow notification created:', populatedNotification);

          // 🚀 EMIT REAL-TIME NOTIFICATION
          const io = context.req?.app?.get('io');
          if (io) {
            const recipientId = id.toString();
            console.log('🚀 Emitting follow notification to user:', recipientId);
            
            io.to(recipientId).emit('newNotification', {
              id: populatedNotification._id.toString(),
              type: 'follow',
              sender: {
                id: populatedNotification.sender._id.toString(),
                name: populatedNotification.sender.name,
                username: populatedNotification.sender.username,
                profileImage: populatedNotification.sender.profileImage
              },
              createdAt: populatedNotification.createdAt.toISOString(),
              isRead: false
            });
            
            console.log('✅ Follow notification emitted successfully');
          } else {
            console.log('❌ Socket.io not available for follow notification');
          }
          
          // Increment unread count for recipient
          await User.findByIdAndUpdate(id, {
            $inc: { unreadNotifications: 1 }
          });
        } catch (notificationError) {
          console.error('Error creating follow notification:', notificationError);
        }
      }

      return targetUser;
    },

    

    markNotificationsAsRead: async (_, { userId }) => {
      try {
        // Mark all notifications as read for this user
        await Notification.updateMany(
          { recipient: userId, isRead: false },
          { isRead: true }
        );
        
        // Reset unread count to 0
        await User.findByIdAndUpdate(userId, {
          unreadNotifications: 0
        });
        
        return "Notifications marked as read";
      } catch (error) {
        console.error('Error marking notifications as read:', error);
        throw new Error('Failed to mark notifications as read');
      }
    },

    // Like a comment
    LikeComment: async (_, { userId, postId, commentId }, context) => {
      try {
        const post = await Post.findById(postId).populate('createdBy', 'id name username');
        if (!post) throw new Error("Post not found");

        const comment = post.comments.id(commentId);
        if (!comment) throw new Error("Comment not found");

        const alreadyLiked = comment.likes.some(like => like.user.toString() === userId);

        if (alreadyLiked) {
          // Unlike the comment
          comment.likes = comment.likes.filter(like => like.user.toString() !== userId);
        } else {
          // Like the comment
          comment.likes.push({ user: userId, likedAt: new Date() });
          
          // Create notification for comment owner (if not liking own comment)
          if (comment.user.toString() !== userId) {
            try {
              const notification = new Notification({
                recipient: comment.user,
                sender: userId,
                type: 'comment_like',
                message: 'liked your comment',
                post: postId,
                commentId: commentId
              });
              await notification.save();
              
              // Get populated notification data
              const populatedNotification = await Notification.findById(notification._id)
                .populate('sender', 'id name username profileImage')
                .populate('post', 'id caption imageUrl videoUrl');

              // Emit real-time notification
              const io = context.req?.app?.get('io');
              if (io) {
                const recipientId = comment.user.toString();
                io.to(recipientId).emit('newNotification', {
                  id: populatedNotification._id.toString(),
                  type: 'comment_like',
                  sender: {
                    id: populatedNotification.sender._id.toString(),
                    name: populatedNotification.sender.name,
                    username: populatedNotification.sender.username,
                    profileImage: populatedNotification.sender.profileImage
                  },
                  post: {
                    id: populatedNotification.post._id.toString(),
                    caption: populatedNotification.post.caption
                  },
                  createdAt: populatedNotification.createdAt.toISOString(),
                  isRead: false
                });
              }
              
              // Increment unread count for recipient
              await User.findByIdAndUpdate(comment.user, {
                $inc: { unreadNotifications: 1 }
              });
            } catch (notificationError) {
              console.error('Error creating comment like notification:', notificationError);
            }
          }
        }

        await post.save();
        return alreadyLiked ? "Comment unliked" : "Comment liked";
      } catch (error) {
        console.error('LikeComment error:', error);
        throw new Error('Failed to like comment');
      }
    },

    // Reply to a comment
    ReplyToComment: async (_, { userId, postId, commentId, text }, context) => {
      try {
        if (!text.trim()) throw new Error("Reply text cannot be empty");

        const post = await Post.findById(postId).populate('createdBy', 'id name username');
        if (!post) throw new Error("Post not found");

        const comment = post.comments.id(commentId);
        if (!comment) throw new Error("Comment not found");

        const newReply = {
          user: userId,
          text: text.trim(),
          repliedAt: new Date(),
          likes: []
        };

        comment.replies.push(newReply);
        await post.save();

        // Get the created reply with populated user data
        const updatedPost = await Post.findById(postId)
          .populate('comments.replies.user', 'id name username profileImage');
        
        const updatedComment = updatedPost.comments.id(commentId);
        const createdReply = updatedComment.replies[updatedComment.replies.length - 1];

        // Create notification for comment owner (if not replying to own comment)
        if (comment.user.toString() !== userId) {
          try {
            const notification = new Notification({
              recipient: comment.user,
              sender: userId,
              type: 'reply',
              message: 'replied to your comment',
              post: postId,
              commentId: commentId,
              commentText: text.trim()
            });
            await notification.save();
            
            // Get populated notification data
            const populatedNotification = await Notification.findById(notification._id)
              .populate('sender', 'id name username profileImage')
              .populate('post', 'id caption imageUrl videoUrl');

            // Emit real-time notification
            const io = context.req?.app?.get('io');
            if (io) {
              const recipientId = comment.user.toString();
              io.to(recipientId).emit('newNotification', {
                id: populatedNotification._id.toString(),
                type: 'reply',
                sender: {
                  id: populatedNotification.sender._id.toString(),
                  name: populatedNotification.sender.name,
                  username: populatedNotification.sender.username,
                  profileImage: populatedNotification.sender.profileImage
                },
                post: {
                  id: populatedNotification.post._id.toString(),
                  caption: populatedNotification.post.caption
                },
                commentId: commentId,
                commentText: text.trim(),
                createdAt: populatedNotification.createdAt.toISOString(),
                isRead: false
              });
            }
            
            // Increment unread count for recipient
            await User.findByIdAndUpdate(comment.user, {
              $inc: { unreadNotifications: 1 }
            });
          } catch (notificationError) {
            console.error('Error creating reply notification:', notificationError);
          }
        }

        return {
          ...createdReply._doc,
          id: createdReply._id.toString(),
          user: createdReply.user
        };
      } catch (error) {
        console.error('ReplyToComment error:', error);
        throw new Error('Failed to reply to comment');
      }
    },

    // Delete a reply
    DeleteReply: async (_, { userId, postId, commentId, replyId }) => {
      try {
        const post = await Post.findById(postId);
        if (!post) throw new Error("Post not found");

        const comment = post.comments.id(commentId);
        if (!comment) throw new Error("Comment not found");

        const reply = comment.replies.id(replyId);
        if (!reply) throw new Error("Reply not found");

        // Check if user owns the reply
        if (reply.user.toString() !== userId) {
          throw new Error("You can only delete your own replies");
        }

        comment.replies.pull(replyId);
        await post.save();

        // Return updated comment with populated data
        const updatedPost = await Post.findById(postId)
          .populate('comments.user', 'id name username profileImage')
          .populate('comments.likes.user', 'id name username profileImage')
          .populate('comments.replies.user', 'id name username profileImage')
          .populate('comments.replies.likes.user', 'id name username profileImage');

        const updatedComment = updatedPost.comments.id(commentId);
        
        return {
          ...updatedComment._doc,
          id: updatedComment._id.toString(),
          user: updatedComment.user,
          likes: updatedComment.likes.map(like => ({
            ...like._doc,
            user: like.user
          })),
          replies: updatedComment.replies.map(reply => ({
            ...reply._doc,
            id: reply._id.toString(),
            user: reply.user,
            likes: reply.likes.map(replyLike => ({
              ...replyLike._doc,
              user: replyLike.user
            }))
          }))
        };
      } catch (error) {
        console.error('DeleteReply error:', error);
        throw new Error('Failed to delete reply');
      }
    },

    // Delete a comment
    DeleteComment: async (_, { userId, postId, commentId }) => {
      try {
        const post = await Post.findById(postId);
        if (!post) throw new Error("Post not found");

        const comment = post.comments.id(commentId);
        if (!comment) throw new Error("Comment not found");

        // Check if user owns the comment or owns the post
        if (comment.user.toString() !== userId && post.createdBy.toString() !== userId) {
          throw new Error("You can only delete your own comments or comments on your posts");
        }

        post.comments.pull(commentId);
        await post.save();

        return "Comment deleted successfully";
      } catch (error) {
        console.error('DeleteComment error:', error);
        throw new Error('Failed to delete comment');
      }
    },

    // Like a reply
    LikeReply: async (_, { userId, postId, commentId, replyId }, context) => {
      try {
        const post = await Post.findById(postId);
        if (!post) throw new Error("Post not found");

        const comment = post.comments.id(commentId);
        if (!comment) throw new Error("Comment not found");

        const reply = comment.replies.id(replyId);
        if (!reply) throw new Error("Reply not found");

        const alreadyLiked = reply.likes.some(like => like.user.toString() === userId);

        if (alreadyLiked) {
          // Unlike the reply
          reply.likes = reply.likes.filter(like => like.user.toString() !== userId);
        } else {
          // Like the reply
          reply.likes.push({ user: userId, likedAt: new Date() });
          
          // Create notification for reply owner (if not liking own reply)
          if (reply.user.toString() !== userId) {
            try {
              const notification = new Notification({
                recipient: reply.user,
                sender: userId,
                type: 'reply_like',
                message: 'liked your reply',
                post: postId,
                commentId: commentId
              });
              await notification.save();
              
              // Get populated notification data
              const populatedNotification = await Notification.findById(notification._id)
                .populate('sender', 'id name username profileImage')
                .populate('post', 'id caption imageUrl videoUrl');

              // Emit real-time notification
              const io = context.req?.app?.get('io');
              if (io) {
                const recipientId = reply.user.toString();
                io.to(recipientId).emit('newNotification', {
                  id: populatedNotification._id.toString(),
                  type: 'reply_like',
                  sender: {
                    id: populatedNotification.sender._id.toString(),
                    name: populatedNotification.sender.name,
                    username: populatedNotification.sender.username,
                    profileImage: populatedNotification.sender.profileImage
                  },
                  post: {
                    id: populatedNotification.post._id.toString(),
                    caption: populatedNotification.post.caption
                  },
                  createdAt: populatedNotification.createdAt.toISOString(),
                  isRead: false
                });
              }
              
              // Increment unread count for recipient
              await User.findByIdAndUpdate(reply.user, {
                $inc: { unreadNotifications: 1 }
              });
            } catch (notificationError) {
              console.error('Error creating reply like notification:', notificationError);
            }
          }
        }

        await post.save();
        return alreadyLiked ? "Reply unliked" : "Reply liked";
      } catch (error) {
        console.error('LikeReply error:', error);
        throw new Error('Failed to like reply');
      }
    },
  },

  // ✅ NEWLY ADDED: Follower/Following Resolvers
  User: {
    id: (parent) => parent._id || parent.id,
    name: (parent) => parent.name || parent.username || "Unknown User",
    username: (parent) => parent.username || "unknown",
    email: (parent) => parent.email || "",
    followers: async (parent) => {
      const user = await User.findById(parent._id || parent.id).populate("followers");
      return user ? user.followers : [];
    },
    following: async (parent) => {
      const user = await User.findById(parent._id || parent.id).populate("following");
      return user ? user.following : [];
    },
  },

  // ✅ NEWLY ADDED: Post Resolvers for likes and comments
  Post: {
    likes: async (parent) => {
      if (parent.likes) {
        return parent.likes;
      }
      return [];
    },
    comments: async (parent) => {
      if (parent.comments) {
        return parent.comments;
      }
      return [];
    },
  },

  Like: {
    user: async (parent) => {
      if (parent.user && typeof parent.user === 'object') {
        return parent.user;
      }
      return null;
    },
    likedAt: (parent) => parent.likedAt,
  },

  Comment: {
    id: (parent) => parent._id || parent.id,
    user: async (parent) => {
      if (parent.user && typeof parent.user === 'object') {
        return parent.user;
      }
      return null;
    },
    commentedAt: (parent) => parent.commentedAt,
    likes: (parent) => parent.likes || [],
    replies: (parent) => parent.replies || [],
  },

  Reply: {
    id: (parent) => parent._id || parent.id,
    user: async (parent) => {
      if (parent.user && typeof parent.user === 'object') {
        return parent.user;
      }
      return null;
    },
    repliedAt: (parent) => parent.repliedAt,
    likes: (parent) => parent.likes || [],
  }
}

module.exports = resolvers;
