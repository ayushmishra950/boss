import React, { useState } from 'react';
import { FaHeart, FaComment, FaShare, FaBookmark, FaEllipsisV, FaPlayCircle } from 'react-icons/fa';

const PostCard = ({ post, onLike, onComment, onShare }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.(post.id, !isLiked);
  };

  const handleComment = (e) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment?.(post.id, commentText);
      setCommentText('');
      setShowCommentInput(false);
    }
  };

  const handleShare = () => {
    alert('Post shared!');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-5 relative">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2.5">
          <img 
            src={post.userAvatar} 
            alt={post.username} 
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <span className="font-semibold text-sm">{post.username}</span>
            <span className="text-xs text-gray-500">{post.timeAgo}</span>
          </div>
        </div>
        <button className="p-2 rounded-full hover:bg-gray-100">
          <FaEllipsisV className="text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="w-full">
        {post.caption && (
          <p className="px-4 py-3 text-sm text-gray-800">
            {post.caption}
          </p>
        )}
        
        <div className="relative group">
          {post.type === 'image' ? (
            <img 
              src={post.media} 
              alt="Post content" 
              className="w-full max-h-[700px] object-cover bg-black block transition-transform duration-300 group-hover:opacity-95" 
            />
          ) : (
            <div className="relative">
              <video 
                controls 
                className="w-full max-h-[700px] object-contain bg-black block"
              >
                <source src={post.media} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black bg-opacity-50 rounded-full p-3">
                  <FaPlayCircle className="text-white text-2xl" />
                </div>
              </div>
            </div>
          )}
          
          {/* Action Buttons Overlay */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
              onClick={handleLike}
              className={`flex flex-col items-center text-white bg-black bg-opacity-60 rounded-full p-3 hover:bg-opacity-80 transition-all`}
            >
              <FaHeart className={`text-xl ${isLiked ? 'text-red-500 fill-current' : 'text-white'}`} />
              <span className="text-xs mt-1">{(post.likes || 0) + (isLiked ? 1 : 0)}</span>
            </button>
            
            <button 
              onClick={handleShare}
              className="flex flex-col items-center text-white bg-black bg-opacity-60 rounded-full p-3 hover:bg-opacity-80 transition-all"
            >
              <FaShare className="text-xl" />
              <span className="text-xs mt-1">Share</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="relative">
        {/* Action Buttons */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200 bg-white">
          <div className="flex space-x-4">
            <button 
              className={`p-2 rounded-full ${isLiked ? 'text-red-500' : 'text-gray-600'} hover:bg-gray-100`}
              onClick={handleLike}
            >
              <FaHeart className={isLiked ? 'fill-current' : ''} />
              <span className="text-xs font-medium ml-1">{(post.likes || 0) + (isLiked ? 1 : 0)}</span>
            </button>
            
            <button 
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
              onClick={() => setShowCommentInput(!showCommentInput)}
            >
              <FaComment />
              <span className="text-xs font-medium ml-1">{post.comments?.length || 0}</span>
            </button>
            
            <button 
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
              onClick={handleShare}
            >
              <FaShare />
            </button>
          </div>
          
          <button 
            className={`p-2 rounded-full ${isSaved ? 'text-purple-700' : 'text-gray-600'} hover:bg-gray-100`}
            onClick={() => setIsSaved(!isSaved)}
          >
            <FaBookmark />
          </button>
        </div>

        {/* Comments Section */}
        <div className="border-t border-gray-200">
          {/* Comment Input */}
          {showCommentInput && (
            <div className="px-4 py-3 bg-white">
              <div className="flex items-center">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleComment(e)}
                />
                <button 
                  onClick={handleComment}
                  className="ml-2 bg-purple-600 text-white px-4 py-2 rounded-full hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Post
                </button>
              </div>
            </div>
          )}

          {/* Comments List */}
          {post.comments && post.comments.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 max-h-48 overflow-y-auto">
              {post.comments.map((comment, index) => (
                <div key={index} className="mb-3 last:mb-0">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <img 
                        src={comment.userAvatar || '/default-avatar.png'} 
                        alt={comment.username} 
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      />
                    </div>
                    <div className="ml-2 flex-1">
                      <div className="flex items-center">
                        <span className="font-semibold text-sm text-gray-900">{comment.username}</span>
                        {comment.userId === post.userId && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                            Author
                          </span>
                        )}
                        <span className="mx-1.5 text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{comment.timeAgo}</span>
                      </div>
                      <div className="mt-1 bg-gray-100 rounded-2xl px-3 py-2">
                        <p className="text-sm text-gray-800">{comment.text}</p>
                      </div>
                      <div className="mt-1 flex space-x-4 text-xs text-gray-500">
                        <button className="hover:text-gray-700">Like</button>
                        <button className="hover:text-gray-700">Reply</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCard;
