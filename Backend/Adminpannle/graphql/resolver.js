
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../model/model");
const User = require('../../Models/user');
const Post = require('../../Models/Post');
const Block = require('../model/block');
const mongoose = require("mongoose");
const Story = require('../../Models/Story');
const Video = require('../../Models/Video');
const Category = require("../model/Category");
const CategoryPage = require("../model/CategoryPage");

const checkRole = require('../../middleware/roleCheck'); // ✅ role check

const adminResolvers = {
  Query: {

    getAllUsersByAdmin:checkRole(['ADMIN']) (async (_,{}) => {
      try {
        const users = await User.find({})
          .populate('posts')
          .populate('followers')
          .populate("is_blocked")
          .populate('following');
        return users;
      } catch (error) {
        console.error("Error fetching users:", error);
        throw new Error("Failed to fetch users");
      }
    }),    
    getStoriesbyUser:checkRole(['ADMIN'])(async (_, { userId }) => {
          try {
            return await Story.find({ userId, isArchived: true }).sort({ createdAt: -1 });
          } catch (err) {
            console.error("Error fetching stories:", err);
            throw new Error("Failed to fetch stories");
          }
        }),
    getMyStories: async (_, { userId }) => {
      try {
        // Get all stories for the user (both active and archived)
        const stories = await Story.find({ userId }).sort({ createdAt: -1 });
        return stories;
      } catch (err) {
        console.error("Error fetching user stories:", err);
        throw new Error("Failed to fetch user stories");
      }
    },
    getAllCategories: checkRole(['ADMIN'])(async () => {
      const categories = await Category.find().sort({ createdAt: -1 });
      return categories;
    }),


    getAllCategoriesPages: async () => {
      const categories = await CategoryPage.find().sort({ createdAt: -1 });
      return categories;
    },


    allUsers: checkRole(['ADMIN'])(async () => {
      return await User.countDocuments();  
    }),

    admin: checkRole(['ADMIN'])(async (_, { id }) => {
      return await Admin.findById(id);
    }),

    totalPosts: checkRole(['ADMIN'])(async () => {
      return await Post.countDocuments();
    }),

    // BlockCount: checkRole(['ADMIN'])(async () => {
    //   return await Block.countDocuments();
    // }),

    BlockCount:async () => {
  const blockedUsers = await Block.find().select('userId');

  const userIds = blockedUsers.map(b => b.userId);

  const users = await User.find({ _id: { $in: userIds } });

  return users;
},

    getUserLikedPosts: checkRole(['ADMIN'])(async (_, { userId }) => {
      const posts = await Post.find({
        "likes.user": new mongoose.Types.ObjectId(userId),
        imageUrl: { $ne: null }
      }).populate("likes", "_id username");
      return posts;
    }),

    getUserCommentedPosts: checkRole(['ADMIN'])(async (_, { userId }) => {
      const posts = await Post.find({
        "comments.user": userId,
        imageUrl: { $ne: null }
      }).populate("createdBy", "username profilePic");
      return posts;
    }),

    getUserLikedVideos: checkRole(['ADMIN'])(async (_, { userId }) => {
      const videos = await Post.find({
        "likes.user": userId,
        videoUrl: { $ne: null }
      }).populate("createdBy", "username");
      return videos;
    }),

    getUserLikedReels: checkRole(['ADMIN'])(async (_, { userId }) => {
      const videos = await Video.find({
        "likes.user": userId,
        videoUrl: { $ne: null }
      }).populate("createdBy", "username");
      return videos;
    }),

    getUserCommentedVideos: checkRole(['ADMIN'])(async (_, { userId }) => {
      const videos = await Post.find({
        "comments.user": userId,
        videoUrl: { $ne: null }
      });
      return videos;
    }),

    getUserCommentedReels: checkRole(['ADMIN'])(async (_, { userId }) => {
      const videos = await Video.find({
        "comments.user": userId,
        videoUrl: { $ne: null }
      });
      return videos;
    }),
  },

  Mutation: {
    registerAdmin: async (_, { input }) => {
      const { firstname, lastname, email, password, phoneNumber } = input;
      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) throw new Error("Admin already exists");

      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = new Admin({
        firstname,
        lastname,
        email,
        phoneNumber,
        password: hashedPassword,
      });

      await newAdmin.save();

      const token = jwt.sign(
        { id: newAdmin._id, email: newAdmin.email, role: "ADMIN" }, // ✅ include role
        "SECRET_KEY",
        { expiresIn: "1d" }
      );

      return { token, admin: newAdmin };
    },

    loginAdmin: async (_, { input }) => {
      const { email, password } = input;

      const admin = await Admin.findOne({ email });
      if (!admin) throw new Error("Invalid email or password");

      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) throw new Error("Invalid email or password");

      const token = jwt.sign(
        { id: admin._id, email: admin.email, role: "ADMIN" }, // ✅ include role
        "SECRET_KEY",
        { expiresIn: "1d" }
      );

      return { token, admin };
    },

    blockUser: checkRole(['ADMIN'])(async (_, { userId }) => {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      user.is_blocked = true;
      await Block.create({ userId: user._id });
      await user.save();
      return user;
    }),

    unblockUser: checkRole(['ADMIN'])(async (_, { userId }) => {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      user.is_blocked = false;
      await Block.deleteOne({ userId: user._id });
      await user.save();
      return user;
    }),

       DeletePostByAdmin: checkRole(['ADMIN'])(async (_, { id, type }) => {
      if (!id || !type) {
        throw new Error("Both id and type are required");
      }
    
      // 📝 Handle deleting a post
      if (type === "posts") {
        const deletePost = await Post.findByIdAndDelete(id);
        if (deletePost) {
          const user = await User.findById(deletePost.createdBy);
          if (user) {
            user.posts = user.posts.filter(
              postId => postId.toString() !== deletePost._id.toString()
            );
            await user.save();
          }
          return "Post deleted successfully.";
        } else {
          throw new Error("Post not found");
        }
      }
    
      // 🎥 Handle deleting a reel
      if (type === "reels") {
        const deleteReel = await Video.findByIdAndDelete(id);
        if (deleteReel) {
          return "Reel deleted successfully.";
        } else {
          throw new Error("Reel not found");
        }
      }
    
      // 📖 Handle deleting a story
      if (type === "stories") {
        const deleteStory = await Story.findByIdAndDelete(id);
        if (deleteStory) {
          return "Story deleted successfully.";
        } else {
          throw new Error("Story not found");
        }
      }
    
      // ❌ If type doesn't match any of the above
      throw new Error("Invalid type. Must be 'posts', 'reels', or 'stories'.");
    }),
    

    createCategory: checkRole(['ADMIN'])(async (_, { name, userId }) => {
      const existing = await Category.findOne({ name });
      if (existing) {
        throw new Error("Category already exists");
      }

      const newCategory = await Category.create({
        name,
        createdBy: userId
      });

      return newCategory;
    }),

    deleteCategory: checkRole(['ADMIN'])(async (_, { id, userId }) => {
      const category = await Category.findById(id);
      if (!category) {
        throw new Error("Category not found");
      }

      if (category.createdBy.toString() !== userId) {
        throw new Error("You do not have permission to delete this category");
      }

      await Category.findByIdAndDelete(id);
      return true;
    }),

     addCategoryPage: checkRole(['ADMIN'])(async (_, { name, userId }) => {
      const existing = await CategoryPage.findOne({ name });
      if (existing) {
        throw new Error("Category already exists");
      }

      const newCategory = await CategoryPage.create({
        name,
        createdBy: userId
      });

      return newCategory;
    }),

     deleteCategoryPage: checkRole(['ADMIN'])(async (_, { id, userId }) => {
      const category = await CategoryPage.findById(id);
      if (!category) {
        throw new Error("Category not found");
      }

      if (category.createdBy.toString() !== userId.toString()) {
        throw new Error("You do not have permission to delete this category");
      }

      await CategoryPage.findByIdAndDelete(id);
      return true;
    }),
  },
};

module.exports = adminResolvers;

