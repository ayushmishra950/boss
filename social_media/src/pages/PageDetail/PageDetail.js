import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaThumbsUp, FaShare, FaArrowLeft, FaGlobe, FaCalendarAlt, FaMapMarkerAlt, FaEllipsisV, FaCheck, FaTimes, FaImage, FaVideo, FaSpinner } from 'react-icons/fa';
import { BsGrid3X3 } from 'react-icons/bs';
import PostCard from '../../components/postCard/PostCard';
import { useQuery,useMutation } from '@apollo/client';
import { GET_PAGE_BY_ID, CREATE_PAGE_POST, GET_PAGE_POSTS, GET_ME } from '../../graphql/mutations';
import { toast } from 'react-toastify';
import './PageDetail.css';

const PageDetail = () => {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
  const [postCaption, setPostCaption] = useState('');
    const [image, setImage] = useState(null);
    const [video, setVideo] = useState(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  // GraphQL query to fetch page by ID
  const { data: pageData, loading: pageLoading, error: pageError } = useQuery(GET_PAGE_BY_ID, {
    variables: { pageId },
    skip: !pageId,
    fetchPolicy: 'cache-first'
  });
  const { data: pagePostsData, loading: pagePostsLoading, error: pagePostsError } = useQuery(GET_PAGE_POSTS, {
    variables: { pageId },
    skip: !pageId,
    fetchPolicy: 'cache-first'
  });
  const [posts, setPosts] = useState([]);
  const [createPagePost,{error}] = useMutation(CREATE_PAGE_POST)
  
  // Get current user data for profile photo
  const { data: currentUserData, loading: userLoading } = useQuery(GET_ME, {
    fetchPolicy: 'cache-first'
  });
  
  const currentUser = currentUserData?.getMe;


    const handleFileChange = (event) => {
      // Safely get the file from the event
      const file = event?.target?.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      
      reader.onload = (loadEvent) => {
        if (!loadEvent?.target?.result) {
          console.error('Error reading file');
          return;
        }
        
        if (file.type.startsWith('image/')) {
          setImage(file);
          setVideo(null);
          setSelectedMedia(loadEvent.target.result);
          setMediaType('image');
          setIsPostModalOpen(true);
        } else if (file.type.startsWith('video/')) {
          setVideo(file);
          setImage(null);
          setSelectedMedia(loadEvent.target.result);
          setMediaType('video');
          setIsPostModalOpen(true);
        } else {
          alert('Only image or video files are allowed');
          return;
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
      };
      
      reader.readAsDataURL(file);
    };



    const handleCreatePost = async () => {
      console.log('Debug values:', { pageId, image, video, postCaption });
      if (!pageId || !postCaption.trim() || (!image && !video)) return;
      
      setIsCreatingPost(true);
      try {
        const response = await createPagePost({
          variables: {  
            pageId: pageId.toString(),
            caption: postCaption,
            image: image,
            video: video,
          },
        });
        console.log('Post created:', response);
        const newPost = response.data.createPagePost;
        
        // Transform the GraphQL response to match PostCard expected format
        const transformedPost = {
          id: newPost.id,
          userAvatar: currentUser?.profileImage || newPost.actualUser?.profileImage || 'https://via.placeholder.com/40',
          username: currentUser?.name || currentUser?.username || newPost.actualUser?.name || newPost.actualUser?.username || 'User',
          timeAgo: 'Just now',
          caption: newPost.caption,
          media: newPost.imageUrl || newPost.videoUrl,
          type: newPost.imageUrl ? 'image' : 'video',
          likes: 0,
          comments: []
        };
        
        setPosts([transformedPost, ...posts]);
        setIsPostModalOpen(false);
        setSelectedMedia(null);
        setMediaType(null);
        setPostCaption('');
        setImage(null);
        setVideo(null);
        
        // Trigger event to refresh posts in main feed
        window.dispatchEvent(new Event("postUploaded"));
        
        toast.success('Post uploaded successfully! 🎉', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } catch (err) {
        console.error('Error creating post:', err);
        console.error('GraphQL errors:', err.graphQLErrors);
        console.error('Network error:', err.networkError);
        console.error('Error message:', err.message);
        if (err.graphQLErrors) {
          err.graphQLErrors.forEach(({ message, locations, path }) =>
            console.error(`GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`)
          );
        }
        
        toast.error('Failed to create post. Please try again.', {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setIsCreatingPost(false);
      }
    };
 

  

  useEffect(() => {
    // First try to fetch from localStorage
    const savedPages = JSON.parse(localStorage.getItem('userPages') || '[]');
    const foundPage = savedPages.find(p => p.id.toString() === pageId);
    
    if (foundPage) {
      setPage(foundPage);
      // Check if the page is already liked by the current user
      const likedPages = JSON.parse(localStorage.getItem('likedPages') || '{}');
      setIsLiked(!!likedPages[pageId]);
      setIsLoading(false);
    } else if (pageData?.getPageById) {
      // If not found in localStorage, use GraphQL data
      const graphqlPage = pageData.getPageById;
      const formattedPage = {
        id: graphqlPage.id,
        name: graphqlPage.title,
        category: graphqlPage.category,
        description: graphqlPage.description,
        likes: '0',
        coverPhoto: graphqlPage.coverImage || 'https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        profilePhoto: graphqlPage.profileImage || 'https://randomuser.me/api/portraits/tech/1.jpg',
        isLiked: false,
        isYours: false,
        createdAt: graphqlPage.createdAt || new Date().toISOString(),
        createdBy: graphqlPage.createdBy
      };
      
      setPage(formattedPage);
      
      // Save to localStorage for future use
      const updatedPages = [...savedPages, formattedPage];
      localStorage.setItem('userPages', JSON.stringify(updatedPages));
      
      setIsLoading(false);
    } else if (!pageLoading && !foundPage && !pageData?.getPageById) {
      // If page not found in both localStorage and GraphQL, redirect
      navigate('/pages');
    }
  }, [pageId, navigate, pageData, pageLoading]);

  useEffect(() => {
    if (pagePostsData?.getPagePosts) {
      const graphqlPosts = pagePostsData.getPagePosts;
      const formattedPosts = graphqlPosts.map(post => ({
        id: post.id,
        userAvatar: post.actualUser?.profileImage || currentUser?.profileImage || 'https://via.placeholder.com/40',
        username: post.actualUser?.name || post.actualUser?.username || currentUser?.name || currentUser?.username || 'User',
        timeAgo: 'Just now',
        caption: post.caption,
        media: post.videoUrl || post.imageUrl,
        type: post.videoUrl ? 'video' : 'image',
        likes: post.likes?.length || 0,
        comments: post.comments || []
      }));
      
      setPosts(formattedPosts);
    }
  }, [pagePostsData, page]);

  const handleLike = () => {
    const savedPages = JSON.parse(localStorage.getItem('userPages') || '[]');
    const updatedPages = savedPages.map(p => {
      if (p.id.toString() === pageId) {
        const newLikes = isLiked ? (parseInt(p.likes) - 1).toString() : (parseInt(p.likes) + 1).toString();
        return { ...p, likes: newLikes };
      }
      return p;
    });
    
    // Update liked status in localStorage
    const likedPages = JSON.parse(localStorage.getItem('likedPages') || '{}');
    if (isLiked) {
      delete likedPages[pageId];
    } else {
      likedPages[pageId] = true;
    }
    
    localStorage.setItem('userPages', JSON.stringify(updatedPages));
    localStorage.setItem('likedPages', JSON.stringify(likedPages));
    
    
    setPage(updatedPages.find(p => p.id.toString() === pageId));
    setIsLiked(!isLiked);
  };

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  // This function is no longer needed as we've moved the logic directly to the buttons
  const handleMediaButtonClick = (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'image' ? 'image/*' : 'video/*';
    input.onchange = handleFileChange;
    input.click();
  };

  const handlePostSubmit = (e) => {
    e.preventDefault();
    if (!selectedMedia || !postCaption.trim()) return;
    
    const newPost = {
      id: Date.now(),
      userAvatar: currentUser?.profileImage || 'https://randomuser.me/api/portraits/men/3.jpg',
      username: currentUser?.name || currentUser?.username || 'Current User',
      timeAgo: 'Just now',
      media: selectedMedia,
      type: mediaType,
      caption: postCaption,
      likes: 0,
      comments: []
    };
    
    // Update posts state
    setPosts([newPost, ...posts]);
    
    // Save to localStorage
    const savedPages = JSON.parse(localStorage.getItem('userPages') || '[]');
    const updatedPages = savedPages.map(p => {
      if (p.id.toString() === pageId) {
        return {
          ...p,
          posts: [newPost, ...(p.posts || [])]
        };
      }
      return p;
    });
    
    localStorage.setItem('userPages', JSON.stringify(updatedPages));
    
    // Reset form
    setIsPostModalOpen(false);
    setSelectedMedia(null);
    setMediaType(null);
    setPostCaption('');
  };

  if (isLoading || pageLoading || pagePostsLoading || userLoading) {
    return <div className="page-detail-loading">Loading...</div>;
  }

  if (!page) {
    return <div className="page-not-found">Page not found</div>;
  }

  // Format the creation date
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-header-top">
          <button onClick={handleBack} className="back-button">
            <FaArrowLeft />
          </button>
          <div className="profile-header-info">
            <h2>{page.name}</h2>
            <p>{page.likes} likes</p>
          </div>
        </div>
      </div>

      {/* Cover Photo */}
      <div className="cover-photo">
        <img src={page.coverPhoto} alt={`${page.name} cover`} />
      </div>

      {/* Profile Info */}
      <div className="profile-info">
        <div className="profile-main">
          <div className="profile-avatar">
            <img src={page.profilePhoto} alt={page.name} />
          </div>
          <div className="profile-actions">
            <button 
              className={`action-button ${isLiked ? 'liked' : ''}`} 
              onClick={handleLike}
            >
              {isLiked ? (
                <><FaCheck /> Liked</>
              ) : (
                <><FaThumbsUp /> Like</>
              )}
            </button>
            <button className="action-button">
              <FaShare /> Share
            </button>
            <button className="action-button more-options">
              <FaEllipsisV />
            </button>
          </div>
        </div>

        <div className="profile-details">
          <h1>{page.name}</h1>
          <p className="category">{page.category}</p>
          
          <div className="profile-meta">
            <span><FaGlobe /> Public</span>
            <span><FaCalendarAlt /> Created on {formatDate(page.createdAt)}</span>
            {page.location && (
              <span><FaMapMarkerAlt /> {page.location}</span>
            )}
          </div>

          {page.description && (
            <div className="profile-bio">
              <p>{page.description}</p>
            </div>
          )}
          
          {/* Post Buttons - Only show for page owner */}
          {currentUser && page?.createdBy && currentUser.id === page.createdBy.id && (
            <div className="post-buttons">
              <button 
                className="post-button photo-post" 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = handleFileChange;
                  input.click();
                }}
              >
                <FaImage className="button-icon" />
                <span>Photo</span>
              </button>
              <button 
                className="post-button video-post" 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'video/*';
                  input.onchange = handleFileChange;
                  input.click();
                }}
              >
                <FaVideo className="button-icon" />
                <span>Video</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button className="tab active">
          <BsGrid3X3 /> POSTS
        </button>
      </div>

      {/* Posts Feed */}
      <div className="profile-content">
        {posts.length > 0 ? (
          <div className="posts-feed">
            {posts.map(post => (
              <PostCard 
                key={post.id}
                post={post}
                onLike={(postId, liked) => {
                  setPosts(posts.map(p => 
                    p.id === postId 
                      ? { ...p, likes: liked ? p.likes + 1 : p.likes - 1 } 
                      : p
                  ));
                }}
                onComment={(postId, comment) => {
                  setPosts(posts.map(p => 
                    p.id === postId 
                      ? { 
                          ...p, 
                          comments: [
                            ...p.comments, 
                            { id: Date.now(), user: 'Current User', text: comment }
                          ] 
                        } 
                      : p
                  ));
                }}
                onShare={(post) => {
                  // Implement share functionality
                  console.log('Sharing post:', post.id);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="no-posts">
            <div className="no-posts-icon">📷</div>
            <h3>No Posts Yet</h3>
            <p>When {page.name} shares photos and reels, you'll see them here.</p>
          </div>
        )}
      </div>

      {/* Post Creation Modal */}
      {isPostModalOpen && (
        <div className="post-creation-modal">
          <div className="post-creation-content">
            <div className="post-creation-header">
              <h3>Create Post</h3>
              <button className="close-button" onClick={() => setIsPostModalOpen(false)}>
                <FaTimes />
              </button>
            </div>
            
            <div className="post-preview">
              {mediaType === 'image' ? (
                <img src={selectedMedia} alt="Post preview" className="post-media-preview" />
              ) : (
                <video controls className="post-media-preview">
                  <source src={selectedMedia} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
              <textarea
                className="post-caption"
                placeholder={mediaType === 'image' ? "Write a caption..." : "Add a description..."}
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="post-actions">
              <button className="cancel-button" onClick={() => setIsPostModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="post-button" 
                onClick={handleCreatePost}
                disabled={isCreatingPost || !postCaption.trim() || (!image && !video)}
              >
                {isCreatingPost ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Posting...
                  </>
                ) : (
                  'Post'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageDetail;
