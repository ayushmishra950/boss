const { gql } = require("apollo-server-express");

const typeDefs = gql`
  scalar Upload
  scalar Date

  ##########################
  ##### TYPE DEFINITIONS ###
  ##########################

  type User {
    id: ID!
    name: String
    username: String
    email: String
    phone: String
    password: String
    createTime: String
    token: String
    profileImage: String
    role: String
    bio: String
    isOnline: Boolean
    isPrivate: Boolean
    lastActive: String
    followers: [User]
    following: [User]
    posts: [Post]
    videos: [Video]
    bookmarks: [Post]
    saveReels: [Video]
    blockedUsers: [User]
    blockedBy: [User]
    hiddenFromStory: [User]
    is_blocked: Boolean

    # ✅ Pages Integration
    createdPages: [Page]
    likedPages: [Page]
  }

  type Page {
    id: ID!
    title: String!
    category: String!
    profileImage: String
    coverImage: String
    description: String
    createdBy: User!
    likedBy: [User]
    createdAt: String
  }

  #############################
  #### PageByUser Types #######
  #############################

  type PageLike {
    user: Page
    likedAt: String
  }

  type PageReply {
    id: ID!
    user: Page
    text: String!
    repliedAt: String
    likes: [PageLike]
  }

  type PageComment {
    id: ID!
    user: Page
    text: String!
    commentedAt: String
    likes: [PageLike]
    replies: [PageReply]
  }

  type PageByUser {
    id: ID!
    caption: String!
    imageUrl: String
    videoUrl: String
    thumbnailUrl: String
    createdBy: Page
    createdAt: String
    isArchived: Boolean
    likes: [PageLike]
    comments: [PageComment]
  }

  #############################
  ######## Other Types ########
  #############################

  type Story {
    id: ID!
    userId: ID!
    username: String!
    avatar: String!
    mediaType: String
    mediaUrl: String
    caption: String
    createdAt: String!
    isArchived: Boolean
    expiresAt: String!
    location: String
    viewers: [String]
    replies: [StoryReply]
  }

  type Video {
    id: ID!
    title: String!
    description: String
    videoUrl: String!
    thumbnailUrl: String
    duration: Float
    views: Int
    createdBy: User!
    isArchived: Boolean
    createdAt: String!
    updatedAt: String!
    likes: [VideoLike]
    comments: [VideoComment]
    tags: [String]
    category: String
    isPublic: Boolean
    fileSize: Float
    resolution: VideoResolution
  }

  type Notification {
    id: ID!
    recipient: User
    sender: User
    type: String
    message: String
    post: Post
    commentText: String
    commentId: ID
    followRequestId: ID
    isRead: Boolean
    createdAt: String
  }

  type OtpResponse {
    email: String!
    otp: Int!
    otpExpiryTime: String!
  }

  type Post {
    id: ID!
    caption: String
    imageUrl: String
    videoUrl: String
    locationName: String
    location: GeoPoint
    thumbnailUrl: String
    isVideo: Boolean
    createdBy: User
    createdAt: String
    isArchived: Boolean
    likes: [Like]
    comments: [Comment]
  }
    type GeoPoint {
  type: String        # e.g., "Point"
  coordinates: [Float] # [longitude, latitude]
}


  type Like {
    user: User
    likedAt: String
  }

  type Comment {
    id: ID!
    text: String
    user: User
    commentedAt: String
    likes: [Like]
    replies: [Reply]
  }

  type Reply {
    id: ID!
    text: String
    user: User
    repliedAt: String
    likes: [Like]
  }

  type UserBasic {
    id: ID!
    name: String
    username: String
    profileImage: String
  }

  type ActivityLog {
    id: ID!
    userId: ID!
    date: String!
    totalMinutes: Int!
    lastActivity: String
    sessions: [Session]
  }

  type Session {
    startTime: String
    endTime: String
    duration: Int
    device: String
  }

  type FollowRequestResponse {
    id: ID!
    message: String!
    success: Boolean!
  }

  type FollowRequest {
    id: ID!
    requester: ID!
    recipient: ID!
    status: String!
    createdAt: String
    updatedAt: String
  }

  type Location {
    city: String
    state: String
  }

  input LocationInput {
  type: String!
  coordinates: [Float!]!
}


  ##########################
  ######### QUERIES ########
  ##########################

  type Query {
    users(userId: ID): [User]
    getPagePosts(pageId: ID!): [PageByUser]
    getAllUsers(userId: ID): [User]
    getFollowRequestsByUser(userId: ID!): [FollowRequest!]!
    getLikedImagePostsByUser(userId: ID!): [Post!]!
    getCommentedImagePostsByUser(userId: ID!): [Post!]!
    getLikedVideoPostsByUser(userId: ID!): [Post!]!
    getLikedReelsByUser(userId: ID!): [Video!]!
    getCommentedReelsByUser(userId: ID!): [Video!]!
    getCommentedVideoPostsByUser(userId: ID!): [Post!]!
    getMe: User
    getUserBlockList(userId: ID): User
    
   ##getAllPosts(userId: ID): [Post]##
    getAllPosts(userId: ID!, userLocation: LocationInput): [Post]

    getUserOwnPosts(userId: ID!): [Post]
    getUserFollowing(userId: ID!): [UserBasic]
    getFollowers(userId: ID): [User!]!
    getHiddenFromStory(userId: ID): [User!]!
    mySelf(userId: ID): User
    searchUsers(username: String!, userId: ID!): [User]
    suggestedUsers(userId: ID!): [User]
    getUserNotifications(userId: ID!): [Notification]
    getUnreadNotificationsCount(userId: ID!): Int
    getCommentDetails(postId: ID!, commentId: ID!): Comment
    getUserInformation(id: ID!): User
    getSavedPosts(userId: ID!): [Post]
    getArchivedPosts(userId: ID!): [Post]
    allSavedReels(userId: ID!): [Video!]!
    getSavedStory(id: ID!): Story
    activityLogs(userId: ID!): [ActivityLog]

    # ✅ Pages Feature Queries
    getSuggestedPages: [Page!]!
    getLikedPages(userId: ID!): [Page!]!
    getUserPages(userId: ID!): [Page!]!
    getAllPages: [Page!]!

    # ✅ PageByUser Queries (optional)
    getPagePostsByUser(pageId: ID!): [PageByUser]
    getSinglePagePost(postId: ID!): PageByUser
  }

  ##########################
  ####### MUTATIONS ########
  ##########################

  type Mutation {
    requestOtp(
      name: String!
      username: String!
      email: String!
      password: String!
      phone: String!
    ): OtpResponse

    registerUser(email: String!, otp: Int!): User
    login(email: String!, password: String!): User
    logout: String

    changePassword(email: String!): OtpResponse
    newPassword(email: String!, newPassword: String!): String
    updateUserPrivacy(userId: ID!, isPrivate: Boolean!): String

createPost(
    id: ID,
    caption: String!,
    locationName: String,
    location: LocationInput,  # ✅ New input for coordinates
    image: Upload,
    video: Upload,
    thumbnail: Upload
  ): Post    DeletePost(id: ID!): String
    LikePost(userId: ID!, postId: ID!): String!
    CommentPost(userId: ID!, postId: ID!, text: String!): [Comment]!

    savePost(userId: ID!, postId: ID!): String
    unsavePost(userId: ID!, postId: ID!): String
    archivePost(postId: ID!, userId: ID!): String
    unarchivePost(postId: ID!, userId: ID!): String

    saveReel(reelId: ID!, userId: ID!): String
    unsaveReel(reelId: ID!, userId: ID!): String

    block(targetUserId: ID!, userId: ID!): String
    unblock(targetUserId: ID!, userId: ID!): String
    hideStoryFrom(userIds: [ID!]!, currentUserId: ID!): String

    editProfile(
      id: ID
      name: String
      username: String
      caption: String
      image: Upload
    ): User

    followAndUnfollow(id: ID!): User
    markNotificationsAsRead(userId: ID!): String
    sendFollowRequest(privateUserId: ID!, requesterId: ID!, requesterName: String!): FollowRequestResponse
    acceptFollowRequest(requestId: ID!, userId: ID!): String
    rejectFollowRequest(requestId: ID!, userId: ID!): String

    # Comments & Replies
    LikeComment(userId: ID!, postId: ID!, commentId: ID!): String
    ReplyToComment(userId: ID!, postId: ID!, commentId: ID!, text: String!): Reply
    DeleteComment(userId: ID!, postId: ID!, commentId: ID!): String
    DeleteReply(userId: ID!, postId: ID!, commentId: ID!, replyId: ID!): Comment
    LikeReply(userId: ID!, postId: ID!, commentId: ID!, replyId: ID!): String

    # ✅ Pages Feature Mutations
    createPage(title: String!, profileImage: Upload, coverImage: Upload, category: String!, description: String, userId: ID!): Page
    likePage(userId: ID!, pageId: ID!): String
    deletePage(userId: ID!, pageId: ID!): String


    # ✅ PageByUser Mutations
    createPagePost(caption: String!, image: Upload, video: Upload, thumbnail: Upload, pageId: ID!): PageByUser
   
  }
`;

module.exports = typeDefs;
