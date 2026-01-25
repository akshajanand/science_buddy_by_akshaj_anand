
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { DiscussionThread, DiscussionComment } from '../types';
import { MessageCircle, Plus, Search, User, ArrowLeft, Send, Loader2, X, AlertTriangle, Lock, CheckCircle, MoreVertical, Paperclip, GraduationCap } from 'lucide-react';
import { showToast } from '../utils/notificationUtils';
import { checkAndAwardDailyXP, checkContentSafety } from '../services/aiService';
import { Skeleton } from './Skeleton';

interface DiscussionBoardProps {
    user: any; // Using any to accept the full UserData object
}

const CATEGORIES = ['General Science', 'Physics', 'Chemistry', 'Biology', 'Astronomy', 'Homework Help'];
const BG_PATTERN = "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')";

const DiscussionBoard: React.FC<DiscussionBoardProps> = ({ user }) => {
    const [threads, setThreads] = useState<DiscussionThread[]>([]);
    const [activeThread, setActiveThread] = useState<DiscussionThread | null>(null);
    const [comments, setComments] = useState<DiscussionComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingComments, setLoadingComments] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Create Thread State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newCategory, setNewCategory] = useState('General Science');
    const [isPosting, setIsPosting] = useState(false);

    // Comment State
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    
    // Optimizations
    const userCache = useRef<Record<string, { username: string, display_name?: string, avatar_url?: string, role?: string }>>({});

    // Helper to get user profile with caching
    const getUserProfile = async (userId: string) => {
        if (userCache.current[userId]) return userCache.current[userId];
        
        try {
            const { data } = await supabase
                .from('users')
                .select('username, display_name, avatar_url, role')
                .eq('id', userId)
                .single();
                
            if (data) {
                userCache.current[userId] = data;
                return data;
            }
        } catch (e) { console.error("Error fetching user profile", e); }
        
        return { username: 'Unknown' };
    };

    // Initial Load
    useEffect(() => {
        fetchThreads();
        
        const channel = supabase.channel('public:discussion_threads')
            .on(
                'postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'discussion_threads' }, 
                async (payload) => {
                    if (payload.new.user_id !== user.id) {
                        const userData = await getUserProfile(payload.new.user_id);

                        const newThread: DiscussionThread = {
                            ...payload.new as DiscussionThread,
                            users: userData
                        };
                        
                        setThreads(prev => {
                            if (prev.find(t => t.id === newThread.id)) return prev;
                            return [newThread, ...prev];
                        });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Real-time Comments
    useEffect(() => {
        if (!activeThread) return;

        const channel = supabase.channel(`comments:${activeThread.id}`)
            .on(
                'postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'discussion_comments', filter: `thread_id=eq.${activeThread.id}` }, 
                async (payload) => {
                    if (payload.new.user_id !== user.id) {
                        const userData = await getUserProfile(payload.new.user_id);

                        const newComment: DiscussionComment = {
                            ...payload.new as DiscussionComment,
                            users: userData
                        };

                        setComments(prev => {
                            if (prev.find(c => c.id === newComment.id)) return prev;
                            return [...prev, newComment];
                        });
                        scrollToBottom();
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeThread?.id]); // Optimized dependency

    const scrollToBottom = () => {
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const fetchThreads = async () => {
        setLoading(true);
        // Include role in fetch
        const { data, error } = await supabase
            .from('discussion_threads')
            .select(`
                *,
                users (username, display_name, avatar_url, role)
            `)
            .order('created_at', { ascending: false });

        if (data) {
            setThreads(data);
            // Pre-fill cache
            data.forEach((t: any) => {
                if (t.users && t.user_id) userCache.current[t.user_id] = t.users;
            });
        }
        setLoading(false);
    };

    const fetchComments = async (threadId: string) => {
        setLoadingComments(true);
        // Include role in fetch
        const { data } = await supabase
            .from('discussion_comments')
            .select(`
                *,
                users (username, display_name, avatar_url, role)
            `)
            .eq('thread_id', threadId)
            .order('created_at', { ascending: true });
        
        if (data) {
            setComments(data);
            // Pre-fill cache
            data.forEach((c: any) => {
                if (c.users && c.user_id) userCache.current[c.user_id] = c.users;
            });
        }
        setLoadingComments(false);
        scrollToBottom();
    };

    const handleOpenThread = (thread: DiscussionThread) => {
        setActiveThread(thread);
        fetchComments(thread.id);
    };

    const handleCreateThread = async () => {
        if (!newTitle.trim() || !newContent.trim()) {
            showToast("Please fill in title and content", 'error');
            return;
        }

        setIsPosting(true);

        try {
            // Bypass safety check for teachers
            if (user.role !== 'teacher') {
                const safetyCheck = await checkContentSafety(newTitle + " " + newContent);
                if (!safetyCheck.safe) {
                    showToast(`Post blocked: ${safetyCheck.reason || "Inappropriate content detected."}`, 'error');
                    setIsPosting(false);
                    return;
                }
            }
        } catch (e) {
            console.error("Moderation failed, proceeding with caution", e);
        }

        const { data, error } = await supabase
            .from('discussion_threads')
            .insert({
                user_id: user.id,
                title: newTitle,
                content: newContent,
                category: newCategory
            })
            .select()
            .single();

        if (error) {
            console.error("Thread creation error:", error);
            showToast("Failed to create thread. Check DB permissions.", 'error');
        } else if (data) {
            showToast("Thread created successfully!", 'success');
            checkAndAwardDailyXP(user.id, 20, "Starting Discussion");
            
            const newThreadWithUser: DiscussionThread = {
                ...data,
                users: {
                    username: user.username,
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                    role: user.role // Cache current role
                }
            };
            
            // Cache self
            userCache.current[user.id] = newThreadWithUser.users!;

            setThreads(prev => [newThreadWithUser, ...prev]);
            setActiveThread(newThreadWithUser); // Open immediately
            setComments([]);
            setNewTitle('');
            setNewContent('');
            setShowCreateModal(false);
        }
        setIsPosting(false);
    };

    const handlePostComment = async () => {
        if (!replyText.trim() || !activeThread) return;

        setIsReplying(true);
        const textToSend = replyText;
        setReplyText(''); // Optimistic clear

        try {
            // Bypass safety check for teachers
            if (user.role !== 'teacher') {
                const safetyCheck = await checkContentSafety(textToSend);
                if (!safetyCheck.safe) {
                    showToast(`Reply blocked: ${safetyCheck.reason || "Inappropriate content."}`, 'error');
                    setReplyText(textToSend);
                    setIsReplying(false);
                    return;
                }
            }
        } catch (e) { console.error(e); }

        const { data, error } = await supabase
            .from('discussion_comments')
            .insert({
                user_id: user.id,
                thread_id: activeThread.id,
                content: textToSend
            })
            .select()
            .single();

        if (error) {
            console.error("Comment error:", error);
            setReplyText(textToSend);
            showToast("Failed to post reply", 'error');
        } else if (data) {
            // XP Removed as per request
            const newCommentWithUser: DiscussionComment = {
                ...data,
                users: {
                    username: user.username,
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                    role: user.role
                }
            };
            setComments(prev => [...prev, newCommentWithUser]);
            scrollToBottom();

            // Trigger Notification
            if (activeThread.user_id !== user.id) {
                await supabase.from('notifications').insert({
                    user_id: activeThread.user_id,
                    actor_id: user.id,
                    type: 'REPLY',
                    reference_id: activeThread.id,
                    message: `sent a message in "${activeThread.title}"`
                });
            }
        }
        setIsReplying(false);
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        if (date.toDateString() === new Date().toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString(); 
    };

    const formatTimeShort = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const filteredThreads = threads.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const TeacherBadge = () => (
        <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded border border-purple-500/50 font-bold ml-2">
            <GraduationCap size={10} /> Teacher
        </span>
    );

    return (
        <div className="flex h-full w-full bg-[#111b21] overflow-hidden md:rounded-2xl relative shadow-2xl border-t border-white/5 md:border border-white/5">
            {/* --- LEFT SIDEBAR: Thread List --- */}
            <div className={`
                flex flex-col bg-[#111b21] border-r border-white/5 transition-all duration-300
                ${activeThread ? 'hidden md:flex md:w-[350px] lg:w-[400px]' : 'w-full md:w-[350px] lg:w-[400px]'}
            `}>
                {/* Header */}
                <div className="h-16 bg-[#202c33] flex items-center justify-between px-4 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden border border-white/10">
                            {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover"/> : <User size={24} className="m-2 text-white/50"/>}
                        </div>
                        <span className="font-bold text-gray-200">Science Talk</span>
                    </div>
                    <div className="flex gap-3 text-gray-400">
                        <button onClick={() => setShowCreateModal(true)} title="New Topic" className="hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"><Plus size={24}/></button>
                    </div>
                </div>
                
                {/* Search */}
                <div className="p-2 border-b border-white/5 bg-[#111b21] shrink-0">
                    <div className="bg-[#202c33] rounded-lg flex items-center px-4 py-1.5 h-9">
                        <Search size={16} className="text-gray-500 mr-4"/>
                        <input 
                            placeholder="Search discussions..." 
                            className="bg-transparent border-none outline-none text-sm text-gray-300 w-full placeholder-gray-500" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-gray-300">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-4 space-y-3">
                            {[1,2,3,4,5].map(i => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-12 h-12 rounded-full bg-white/5 shrink-0"></div>
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 bg-white/5 w-3/4 rounded"></div>
                                        <div className="h-3 bg-white/5 w-1/2 rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="p-8 text-center opacity-40">
                            <p className="text-sm">No discussions found.</p>
                        </div>
                    ) : (
                        filteredThreads.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => handleOpenThread(t)}
                                className={`px-4 py-3 cursor-pointer flex items-center gap-3 border-b border-white/5 hover:bg-[#202c33] transition-colors group ${activeThread?.id === t.id ? 'bg-[#2a3942]' : ''}`}
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0 overflow-hidden border border-white/5">
                                     {t.users?.avatar_url ? <img src={t.users.avatar_url} className="w-full h-full object-cover"/> : <User className="m-2 text-white/50"/>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <div className="flex items-center">
                                            <h4 className="text-gray-100 text-base font-medium truncate">{t.title}</h4>
                                            {(t.users as any)?.role === 'teacher' && <div className="ml-1 scale-75 origin-left"><TeacherBadge/></div>}
                                        </div>
                                        <span className="text-[10px] text-gray-500 shrink-0 ml-2">{formatTime(t.created_at)}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 truncate group-hover:text-gray-300">{t.content}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* --- RIGHT AREA: Chat --- */}
            {activeThread ? (
                <div className="flex-1 flex flex-col bg-[#0b141a] relative w-full h-full min-w-0">
                    {/* Chat Header */}
                    <div className="h-16 bg-[#202c33] flex items-center px-4 py-2 shrink-0 z-10 shadow-md border-l border-white/5">
                        <button onClick={() => setActiveThread(null)} className="md:hidden mr-2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/5"><ArrowLeft size={20}/></button>
                        <div className="w-10 h-10 rounded-full bg-gray-600 mr-3 overflow-hidden border border-white/10 cursor-pointer shrink-0">
                            {activeThread.users?.avatar_url ? <img src={activeThread.users.avatar_url} className="w-full h-full object-cover"/> : <User className="m-2"/>}
                        </div>
                        <div className="flex-1 overflow-hidden cursor-pointer min-w-0">
                            <h4 className="text-gray-100 font-medium truncate flex items-center">
                                {activeThread.title}
                                {(activeThread.users as any)?.role === 'teacher' && <TeacherBadge/>}
                            </h4>
                            <span className="text-xs text-gray-400 truncate block">{activeThread.category} • {activeThread.users?.display_name || activeThread.users?.username}</span>
                        </div>
                    </div>

                    {/* Messages Background */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none z-0" style={{ backgroundImage: BG_PATTERN }}></div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:px-8 lg:px-16 space-y-1 relative z-0">
                        <div className="flex justify-center my-6">
                            <div className="bg-[#182229] text-yellow-300/90 text-xs px-4 py-2 rounded-lg shadow-sm border border-yellow-500/10 text-center max-w-[90%] font-medium flex flex-col items-center gap-1">
                                <span className="uppercase tracking-widest text-[10px] text-gray-500">Discussion Started</span>
                                <span className="italic">"{activeThread.content}"</span>
                            </div>
                        </div>

                        {comments.map((c, idx) => {
                            const isMe = c.user_id === user.id;
                            const prevComment = comments[idx - 1];
                            const isSameUser = prevComment && prevComment.user_id === c.user_id;
                            const isTeacher = (c.users as any)?.role === 'teacher';
                            
                            // Visual grouping logic
                            const showHeader = !isSameUser;
                            const marginTop = isSameUser ? 'mt-0.5' : 'mt-2';
                            const borderRadius = isMe 
                                ? (isSameUser ? 'rounded-tr-md rounded-br-md' : 'rounded-tr-none') 
                                : (isSameUser ? 'rounded-tl-md rounded-bl-md' : 'rounded-tl-none');

                            return (
                                <div key={c.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${marginTop} group`}>
                                    <div className={`relative max-w-[85%] md:max-w-[70%] rounded-lg p-1.5 px-2.5 text-sm shadow-sm 
                                        ${isMe ? 'bg-[#005c4b] text-white' : 'bg-[#202c33] text-white'}
                                        ${borderRadius}
                                        ${isTeacher && !isMe ? 'border border-purple-500/50' : ''}
                                    `}>
                                        {showHeader && !isMe && (
                                            <div className="text-[11px] font-bold text-teal-400 mb-0.5 cursor-pointer hover:underline flex items-center">
                                                {c.users?.display_name || c.users?.username}
                                                {isTeacher && <TeacherBadge/>}
                                            </div>
                                        )}
                                        
                                        <div className="break-words leading-snug whitespace-pre-wrap text-[14px]">{c.content}</div>
                                        
                                        <div className="text-[9px] text-white/50 text-right mt-0.5 -mb-0.5 flex items-center justify-end gap-1 select-none">
                                            {formatTimeShort(c.created_at)}
                                            {isMe && <CheckCircle size={10} className="text-blue-400"/>}
                                        </div>
                                        
                                        {/* Tail only on first message of group */}
                                        {showHeader && (
                                            <div className={`absolute top-0 w-0 h-0 border-[8px] border-transparent drop-shadow-sm ${isMe ? '-right-[8px] border-t-[#005c4b] border-l-[#005c4b]' : '-left-[8px] border-t-[#202c33] border-r-[#202c33]'}`}></div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={commentsEndRef} className="h-2"></div>
                    </div>

                    {/* Input Area */}
                    <div className="min-h-[62px] bg-[#202c33] flex items-center px-2 md:px-4 py-2 shrink-0 z-10 gap-2 border-l border-white/5">
                        <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center px-4 py-2">
                            <input 
                                className="bg-transparent text-white placeholder-gray-400 outline-none w-full text-sm h-6"
                                placeholder="Type a message"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                            />
                        </div>
                        <button 
                            onClick={handlePostComment}
                            disabled={isReplying || !replyText.trim()}
                            className={`p-2.5 rounded-full text-white transition-all shadow-lg flex items-center justify-center ${replyText.trim() ? 'bg-[#00a884] hover:bg-[#008f72] active:scale-95' : 'bg-transparent text-gray-500 cursor-default'}`}
                        >
                            {isReplying ? <Loader2 size={20} className="animate-spin"/> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            ) : (
                // Placeholder when no thread selected (Desktop only)
                <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#222e35] text-center border-l border-white/10 relative h-full">
                     <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: BG_PATTERN }}></div>
                     <div className="relative z-10 max-w-md p-8">
                        <div className="flex justify-center mb-8 relative">
                            <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full"></div>
                            <MessageCircle size={100} className="text-gray-500 relative z-10 opacity-30" />
                        </div>
                        <h2 className="text-3xl text-gray-200 font-light mb-4">Science Talk for Web</h2>
                        <p className="text-gray-400 text-sm leading-relaxed mb-8">
                            Select a discussion to start chatting. <br/>
                            Connect with fellow students and solve doubts in real-time.
                        </p>
                        <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-[#111b21] px-4 py-2 rounded-full border border-white/5">
                            <Lock size={12}/> End-to-end moderated by AI
                        </div>
                     </div>
                     <div className="absolute bottom-0 left-0 w-full h-1 bg-[#00a884]"></div>
                </div>
            )}

            {/* Create Thread Modal */}
            {showCreateModal && (
                <div className="absolute inset-0 z-50 bg-[#0b141a]/95 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#202c33] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10 flex flex-col max-h-[90vh]">
                        <div className="bg-[#008069] p-4 flex items-center gap-4 text-white shrink-0">
                            <button onClick={() => setShowCreateModal(false)}><ArrowLeft/></button>
                            <h3 className="font-bold text-lg">New Discussion</h3>
                        </div>
                        
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div>
                                <label className="text-teal-500 text-xs font-bold uppercase tracking-wider mb-2 block">Category</label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setNewCategory(cat)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${newCategory === cat ? 'bg-teal-600 border-teal-600 text-white' : 'bg-[#111b21] border-white/10 text-gray-300 hover:bg-[#2a3942]'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <input 
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="Discussion Subject"
                                        className="w-full bg-transparent border-b-2 border-[#00a884] px-0 py-2 text-white placeholder-gray-500 outline-none focus:border-[#00a884] text-lg font-medium"
                                    />
                                </div>
                                <div>
                                    <textarea 
                                        value={newContent}
                                        onChange={(e) => setNewContent(e.target.value)}
                                        placeholder="Type your question or topic details..."
                                        className="w-full bg-[#111b21] border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 outline-none focus:border-[#00a884] resize-none h-32"
                                    />
                                </div>
                            </div>

                            {user.role !== 'teacher' && (
                                <div className="flex items-center gap-2 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                                    <AlertTriangle size={16} className="text-yellow-500 shrink-0"/>
                                    <p className="text-xs text-yellow-200/70">AI Moderator is active. Keep it kind & scientific.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end p-4 border-t border-white/5 bg-[#202c33] shrink-0">
                            <button 
                                onClick={handleCreateThread}
                                disabled={isPosting}
                                className="bg-[#00a884] hover:bg-[#008f72] text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 w-full justify-center"
                            >
                                {isPosting ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
                                Create Discussion
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiscussionBoard;
