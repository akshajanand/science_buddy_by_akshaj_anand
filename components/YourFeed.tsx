
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { FeedPost, FeedComment } from '../types';
import { Upload, Image as ImageIcon, Video, Send, Loader2, User, Trash2, Heart, AlertTriangle, X, MessageCircle, Bookmark, Globe, Lock, GraduationCap } from 'lucide-react';
import { showToast } from '../utils/notificationUtils';
import { checkContentSafety, checkAndAwardDailyXP } from '../services/aiService';
import { Skeleton } from './Skeleton';

interface YourFeedProps {
    userId: string;
    username: string;
    avatarUrl?: string;
    readOnly?: boolean;
    filterByUserId?: string;
}

const YourFeed: React.FC<YourFeedProps> = ({ userId, username, avatarUrl, readOnly = false, filterByUserId }) => {
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [viewMode, setViewMode] = useState<'GLOBAL' | 'SAVED'>('GLOBAL');
    const [userRole, setUserRole] = useState<string>('student');
    
    // Post Creation State
    const [postText, setPostText] = useState('');
    const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
    const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO' | null>(null);

    // Interaction State
    const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
    const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
    const [commentsMap, setCommentsMap] = useState<Record<string, FeedComment[]>>({});
    const [newCommentText, setNewCommentText] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    useEffect(() => {
        // Fetch current user role first
        const fetchRole = async () => {
            const { data } = await supabase.from('users').select('role').eq('id', userId).single();
            if (data) setUserRole(data.role || 'student');
        };
        fetchRole();

        fetchPosts();
        fetchSavedPosts();
        
        // Subscribe to real-time changes
        const channel = supabase.channel('public:feed_posts')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_posts' }, async (payload) => {
                 // Logic for real-time: if filter is active, only add if matches user.
                 if (filterByUserId && payload.new.user_id !== filterByUserId) return;

                 if (payload.new.user_id !== userId || filterByUserId) {
                     const { data: userProfile } = await supabase.from('users').select('username, display_name, avatar_url, role').eq('id', payload.new.user_id).single();
                     const newPost = { ...payload.new, users: userProfile } as FeedPost;
                     setPosts(prev => [newPost, ...prev]);
                 }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); }
    }, [filterByUserId]);

    const fetchPosts = async () => {
        setLoading(true);
        let query = supabase
            .from('feed_posts')
            .select(`
                *,
                users (username, display_name, avatar_url, role)
            `)
            .order('created_at', { ascending: false });

        if (filterByUserId) {
            query = query.eq('user_id', filterByUserId);
        }

        const { data } = await query;

        if (data) {
            setPosts(data);
        }
        setLoading(false);
    };

    const fetchSavedPosts = async () => {
        const { data } = await supabase.from('feed_saved_posts').select('post_id').eq('user_id', userId);
        if (data) {
            setSavedPostIds(new Set(data.map(item => item.post_id)));
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'IMAGE' | 'VIDEO') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 50 * 1024 * 1024) {
                showToast("File too large. Max 50MB.", 'error');
                return;
            }
            setSelectedMedia(file);
            setMediaType(type);
        }
    };

    const handleCreatePost = async () => {
        if (!postText.trim()) {
            showToast("Please write something to post.", 'error');
            return;
        }

        setUploading(true);

        try {
            // Bypass safety check for teachers
            if (userRole !== 'teacher') {
                const safety = await checkContentSafety(postText);
                if (!safety.safe) {
                    showToast(`Post blocked by AI: ${safety.reason}`, 'error');
                    setUploading(false);
                    return;
                }
            }

            let mediaUrl = null;

            if (selectedMedia) {
                const ext = selectedMedia.name.split('.').pop();
                const fileName = `${userId}-${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('feed_uploads')
                    .upload(fileName, selectedMedia);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('feed_uploads').getPublicUrl(fileName);
                mediaUrl = urlData.publicUrl;
            }

            const { data, error } = await supabase.from('feed_posts').insert({
                user_id: userId,
                content: postText,
                media_url: mediaUrl,
                media_type: mediaType
            }).select(`
                *,
                users (username, display_name, avatar_url, role)
            `).single();

            if (error) throw error;

            if (data) {
                setPosts(prev => [data, ...prev]);
                setPostText('');
                setSelectedMedia(null);
                setMediaType(null);
                showToast("Posted successfully!", 'success');
                checkAndAwardDailyXP(userId, 10, "Sharing on Feed");
            }

        } catch (err: any) {
            console.error(err);
            showToast("Failed to post. " + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("Are you sure you want to delete this post?")) return;
        
        await supabase.from('feed_posts').delete().eq('id', postId);
        setPosts(prev => prev.filter(p => p.id !== postId));
        showToast("Post deleted.", 'info');
    };

    const handleLike = async (postId: string) => {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p));
        await supabase.rpc('increment_feed_likes', { row_id: postId });

        // Trigger Notification
        const post = posts.find(p => p.id === postId);
        if (post && post.user_id !== userId) {
            await supabase.from('notifications').insert({
                user_id: post.user_id, // Post owner
                actor_id: userId, // Liker
                type: 'LIKE',
                reference_id: postId,
                message: 'liked your post'
            });
        }
    };

    const handleSave = async (postId: string) => {
        const isSaved = savedPostIds.has(postId);
        const newSet = new Set(savedPostIds);
        
        const post = posts.find(p => p.id === postId);

        if (isSaved) {
            newSet.delete(postId);
            await supabase.from('feed_saved_posts').delete().eq('user_id', userId).eq('post_id', postId);
            showToast("Removed from saved.", 'info');
        } else {
            newSet.add(postId);
            await supabase.from('feed_saved_posts').insert({ user_id: userId, post_id: postId });
            showToast("Saved for later!", 'success');
            
            // Trigger Notification
            if (post && post.user_id !== userId) {
                await supabase.from('notifications').insert({
                    user_id: post.user_id,
                    actor_id: userId,
                    type: 'SAVE',
                    reference_id: postId,
                    message: 'saved your post'
                });
            }
        }
        setSavedPostIds(newSet);
    };

    const toggleComments = async (postId: string) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
        } else {
            setExpandedPostId(postId);
            if (!commentsMap[postId]) {
                const { data } = await supabase
                    .from('feed_comments')
                    .select('*, users(username, display_name, avatar_url, role)')
                    .eq('post_id', postId)
                    .order('created_at', { ascending: true });
                
                if (data) {
                    setCommentsMap(prev => ({ ...prev, [postId]: data }));
                }
            }
        }
    };

    const handlePostComment = async (postId: string) => {
        if (!newCommentText.trim()) return;
        setCommentLoading(true);

        // Bypass safety check for teachers
        if (userRole !== 'teacher') {
            const safety = await checkContentSafety(newCommentText);
            if (!safety.safe) {
                showToast(`Comment blocked: ${safety.reason}`, 'error');
                setCommentLoading(false);
                return;
            }
        }

        const { data, error } = await supabase.from('feed_comments').insert({
            post_id: postId,
            user_id: userId,
            content: newCommentText
        }).select('*, users(username, display_name, avatar_url, role)').single();

        if (data && !error) {
            setCommentsMap(prev => ({
                ...prev,
                [postId]: [...(prev[postId] || []), data]
            }));
            setNewCommentText('');
            showToast("Comment posted.", 'success');
            checkAndAwardDailyXP(userId, 2, "Commenting on Feed");

            // Trigger Notification
            const post = posts.find(p => p.id === postId);
            if (post && post.user_id !== userId) {
                await supabase.from('notifications').insert({
                    user_id: post.user_id,
                    actor_id: userId,
                    type: 'COMMENT',
                    reference_id: postId,
                    message: 'commented on your post'
                });
            }

        } else {
            showToast("Failed to post comment.", 'error');
        }
        setCommentLoading(false);
    };

    const displayPosts = viewMode === 'GLOBAL' 
        ? posts 
        : posts.filter(p => savedPostIds.has(p.id));

    const TeacherBadge = () => (
        <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded border border-purple-500/50 font-bold ml-1 align-middle">
            <GraduationCap size={10} /> Teacher
        </span>
    );

    return (
        <div className="h-full flex flex-col p-4 md:p-6 relative max-w-2xl mx-auto w-full overflow-y-auto custom-scrollbar">
            <div className="mb-6 flex flex-col gap-4">
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-orange-400 mb-2">
                        {filterByUserId ? "Student Activity" : "Your Feed"}
                    </h2>
                    <p className="text-white/60">
                        {filterByUserId ? "Viewing student's posts and interactions." : `Share your science discoveries! ${userRole !== 'teacher' ? '(AI Moderated)' : ''}`}
                    </p>
                </div>

                {/* View Switcher - Only if not filtering by user */}
                {!filterByUserId && (
                    <div className="flex p-1 bg-white/10 rounded-xl w-fit">
                        <button 
                            onClick={() => setViewMode('GLOBAL')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'GLOBAL' ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                        >
                            <Globe size={16} /> Global Feed
                        </button>
                        <button 
                            onClick={() => setViewMode('SAVED')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'SAVED' ? 'bg-yellow-400 text-black shadow-lg' : 'text-white/60 hover:text-white'}`}
                        >
                            <Bookmark size={16} fill={viewMode === 'SAVED' ? "black" : "none"}/> Saved ({savedPostIds.size})
                        </button>
                    </div>
                )}
            </div>

            {/* Create Post Section (Only if not readOnly) */}
            {!readOnly && viewMode === 'GLOBAL' && (
                <div className="glass-panel p-4 rounded-2xl mb-8 border border-white/10 relative z-10 bg-[#1e1e24]/80">
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0 bg-black/20">
                            {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <User size={24} className="m-2 opacity-50"/>}
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={postText}
                                onChange={(e) => setPostText(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-white placeholder-white/40 resize-none min-h-[60px]"
                                placeholder={`What's on your mind, ${username}?`}
                            />
                            
                            {selectedMedia && (
                                <div className="mt-2 relative inline-block">
                                    <button onClick={() => { setSelectedMedia(null); setMediaType(null); }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><X size={12} fill="white" /></button>
                                    {mediaType === 'IMAGE' ? (
                                        <img src={URL.createObjectURL(selectedMedia)} className="h-24 w-auto rounded-lg border border-white/10" />
                                    ) : (
                                        <div className="h-24 w-32 bg-black/40 rounded-lg flex items-center justify-center border border-white/10">
                                            <Video size={24} className="opacity-50" />
                                            <span className="text-xs ml-2 opacity-50">{selectedMedia.name}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/5">
                                <div className="flex gap-2">
                                    <label className="p-2 hover:bg-white/5 rounded-full cursor-pointer transition-colors text-cyan-400" title="Add Image">
                                        <ImageIcon size={20} />
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'IMAGE')} />
                                    </label>
                                    <label className="p-2 hover:bg-white/5 rounded-full cursor-pointer transition-colors text-pink-400" title="Add Video">
                                        <Video size={20} />
                                        <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'VIDEO')} />
                                    </label>
                                </div>
                                <button 
                                    onClick={handleCreatePost}
                                    disabled={uploading || !postText.trim()}
                                    className="glass-button px-6 py-2 rounded-full font-bold flex items-center gap-2 bg-gradient-to-r from-cyan-600/50 to-blue-600/50 disabled:opacity-50"
                                >
                                    {uploading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                    Post
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feed List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-40 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="space-y-6 pb-10">
                    {displayPosts.length === 0 && (
                        <div className="text-center opacity-40 py-10 flex flex-col items-center">
                            {viewMode === 'SAVED' ? (
                                <>
                                    <Bookmark size={48} className="mb-4 text-yellow-400/50" />
                                    <p>No saved posts yet.</p>
                                    <p className="text-xs mt-2">Click the bookmark icon on any post to save it here.</p>
                                </>
                            ) : (
                                <p>{filterByUserId ? "This student hasn't posted anything yet." : "No posts yet. Be the first to share!"}</p>
                            )}
                        </div>
                    )}
                    {displayPosts.map(post => (
                        <div key={post.id} className="glass-panel p-5 rounded-2xl animate-in fade-in slide-in-from-bottom-4 bg-black/20 border border-white/5">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-white/5">
                                        {post.users?.avatar_url ? <img src={post.users.avatar_url} className="w-full h-full object-cover"/> : <User size={20} className="m-2.5 opacity-50"/>}
                                    </div>
                                    <div>
                                        <div className="flex items-center">
                                            <h4 className="font-bold text-sm">{post.users?.display_name || post.users?.username}</h4>
                                            {(post.users as any)?.role === 'teacher' && <TeacherBadge/>}
                                        </div>
                                        <p className="text-[10px] opacity-50">{new Date(post.created_at).toLocaleDateString()} • {new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </div>
                                {(post.user_id === userId || userRole === 'teacher') && (
                                    <button onClick={() => handleDeletePost(post.id)} className="text-white/20 hover:text-red-400 transition-colors p-1"><Trash2 size={16}/></button>
                                )}
                            </div>

                            {/* Content */}
                            <p className="text-sm md:text-base mb-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                            {/* Media */}
                            {post.media_url && (
                                <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                                    {post.media_type === 'IMAGE' ? (
                                        <img src={post.media_url} alt="Post media" className="w-full max-h-[400px] object-contain" />
                                    ) : (
                                        <video src={post.media_url} controls className="w-full max-h-[400px]" />
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                <div className="flex gap-4">
                                    <button onClick={() => handleLike(post.id)} className="flex items-center gap-2 text-xs font-bold text-white/60 hover:text-pink-400 transition-colors group">
                                        <Heart size={18} className="group-active:scale-125 transition-transform" /> {post.likes || 0} Likes
                                    </button>
                                    <button onClick={() => toggleComments(post.id)} className={`flex items-center gap-2 text-xs font-bold transition-colors group ${expandedPostId === post.id ? 'text-cyan-400' : 'text-white/60 hover:text-cyan-400'}`}>
                                        <MessageCircle size={18} /> Comment
                                    </button>
                                </div>
                                <button onClick={() => handleSave(post.id)} className={`flex items-center gap-2 text-xs font-bold transition-colors ${savedPostIds.has(post.id) ? 'text-yellow-400' : 'text-white/60 hover:text-yellow-400'}`}>
                                    <Bookmark size={18} fill={savedPostIds.has(post.id) ? "currentColor" : "none"} /> {savedPostIds.has(post.id) ? 'Saved' : 'Save'}
                                </button>
                            </div>

                            {/* Comments Section */}
                            {expandedPostId === post.id && (
                                <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 fade-in">
                                    {/* List */}
                                    <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {commentsMap[post.id]?.length === 0 && <p className="text-xs opacity-40 text-center py-2">No comments yet.</p>}
                                        {commentsMap[post.id]?.map(comment => (
                                            <div key={comment.id} className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0 border border-white/10">
                                                    {comment.users?.avatar_url ? <img src={comment.users.avatar_url} className="w-full h-full object-cover"/> : <User size={16} className="m-2 opacity-50"/>}
                                                </div>
                                                <div className="flex-1 bg-white/5 rounded-xl p-3 rounded-tl-none">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <div className="flex items-center">
                                                            <span className="text-xs font-bold text-cyan-300">{comment.users?.display_name || comment.users?.username}</span>
                                                            {(comment.users as any)?.role === 'teacher' && <TeacherBadge/>}
                                                        </div>
                                                        <span className="text-[10px] opacity-40">{new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                    <p className="text-sm opacity-90">{comment.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Input (Teachers can comment, or students) */}
                                    <div className="flex gap-2">
                                        <input 
                                            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm outline-none focus:border-cyan-400 border border-transparent transition-all"
                                            placeholder="Write a comment..."
                                            value={newCommentText}
                                            onChange={(e) => setNewCommentText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handlePostComment(post.id)}
                                        />
                                        <button 
                                            onClick={() => handlePostComment(post.id)}
                                            disabled={commentLoading || !newCommentText.trim()}
                                            className="p-2 bg-cyan-600 rounded-full hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                                        >
                                            {commentLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default YourFeed;
