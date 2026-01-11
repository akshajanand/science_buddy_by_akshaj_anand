import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Upload, FileText, Loader2, Search, X, User, Image, FileType, Plus, CheckCircle } from 'lucide-react';
import { CommunityNote } from '../types';
import { showToast } from '../utils/notificationUtils';

interface CommunityNotesProps {
    userId: string;
    username: string;
}

const CommunityNotes: React.FC<CommunityNotesProps> = ({ userId, username }) => {
    const [notes, setNotes] = useState<CommunityNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedNote, setSelectedNote] = useState<CommunityNote | null>(null);

    // Upload Form State
    const [noteTitle, setNoteTitle] = useState('');
    const [noteDescription, setNoteDescription] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        setLoading(true);
        // We now fetch avatar/display_name from the joined users table if we had relations, 
        // but for simplicity/speed in this flat structure, we rely on what was saved 
        // OR we can do a quick join. Since Supabase types here are loose, we can try to join.
        // However, to keep it simple with existing row structure, we'll fetch just notes. 
        // NOTE: Ideally, CommunityNote rows should link to user profile. 
        // Let's assume we save snapshot or fetch user details.
        
        // BETTER APPROACH: Fetch notes, then fetch user profiles for them.
        const { data: notesData } = await supabase
            .from('community_notes')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (notesData) {
            // Get unique user IDs
            const userIds = [...new Set(notesData.map(n => n.user_id))];
            const { data: usersData } = await supabase.from('users').select('id, display_name, avatar_url, username').in('id', userIds);
            
            // Map profiles to notes
            const enrichedNotes = notesData.map(note => {
                const author = usersData?.find(u => u.id === note.user_id);
                return {
                    ...note,
                    display_name: author?.display_name || author?.username || note.username,
                    avatar_url: author?.avatar_url
                };
            });
            
            setNotes(enrichedNotes);
        }
        setLoading(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handlePostNote = async () => {
        if (!noteTitle.trim()) {
            showToast("Please enter a title for your note.", 'error');
            return;
        }

        if (!noteDescription.trim() && !selectedFile) {
            showToast("Please provide text or attach a file.", 'error');
            return;
        }

        setUploading(true);
        let finalContent = noteDescription;
        let fileTypeStr = "TEXT";

        try {
            if (selectedFile) {
                const ext = selectedFile.name.split('.').pop()?.toLowerCase();
                let fileText = "";

                if (ext === 'pdf') {
                    fileTypeStr = "PDF";
                    const pdfjsLib = (window as any).pdfjsLib;
                    if (!pdfjsLib) throw new Error("PDF Engine not ready.");
                    
                    const arrayBuffer = await selectedFile.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContentPage = await page.getTextContent();
                        fileText += textContentPage.items.map((item: any) => item.str).join(' ') + '\n';
                    }
                } else if (['jpg', 'jpeg', 'png'].includes(ext || '')) {
                    fileTypeStr = "IMAGE";
                    const Tesseract = (window as any).Tesseract;
                    if (!Tesseract) throw new Error("OCR Engine not ready.");
                    const { data: { text } } = await Tesseract.recognize(selectedFile, 'eng');
                    fileText = text;
                } else {
                    fileText = await selectedFile.text();
                }

                if (fileText.trim()) {
                    finalContent += `\n\n--- EXTRACTED FROM ${selectedFile.name.toUpperCase()} ---\n\n${fileText}`;
                } else {
                    finalContent += `\n\n[Attached file ${selectedFile.name} was empty or unreadable]`;
                }
            }

            const { data, error } = await supabase.from('community_notes').insert({
                user_id: userId,
                username: username, // Fallback
                title: noteTitle,
                content: finalContent,
                file_type: fileTypeStr
            }).select().single();

            if (error) throw error;
            
            // Re-fetch to get profile data
            await fetchNotes();
            
            // Reset Form
            setShowUpload(false);
            setNoteTitle('');
            setNoteDescription('');
            setSelectedFile(null);
            showToast("Note posted successfully!", 'success');

        } catch (err: any) {
            console.error(err);
            showToast("Post failed. Try text only if file is large.", 'error');
        }
        setUploading(false);
    };

    return (
        <div className="h-full flex flex-col p-6 relative">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-300 to-pink-300">Community Notes</h2>
                    <p className="opacity-60">Share your revision notes, summaries, or files.</p>
                </div>
                <button 
                    onClick={() => setShowUpload(true)} 
                    className="glass-button px-6 py-3 rounded-xl flex items-center gap-2 font-bold bg-white/10 hover:bg-white/20 shadow-lg"
                >
                    <Plus size={18} /> New Post
                </button>
            </div>

            {/* Upload Modal - Enhanced */}
            {showUpload && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl bg-[#1e1e2e] flex flex-col max-h-[90vh]">
                        <div className="flex justify-between mb-4 border-b border-white/10 pb-4">
                            <h3 className="text-xl font-bold">Create Note</h3>
                            <button onClick={() => setShowUpload(false)}><X/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                            <div>
                                <label className="block text-sm font-bold opacity-60 mb-1 ml-1">TITLE</label>
                                <input 
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 focus:border-cyan-400 outline-none" 
                                    placeholder="e.g. Force and Pressure Revision"
                                    value={noteTitle}
                                    onChange={(e) => setNoteTitle(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold opacity-60 mb-1 ml-1">YOUR NOTES (UNLIMITED TEXT)</label>
                                <textarea 
                                    className="w-full h-48 bg-black/30 border border-white/10 rounded-xl px-4 py-3 focus:border-cyan-400 outline-none resize-none custom-scrollbar"
                                    placeholder="Type your detailed notes here..."
                                    value={noteDescription}
                                    onChange={(e) => setNoteDescription(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold opacity-60 mb-1 ml-1">ATTACHMENT (OPTIONAL)</label>
                                <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-cyan-500 transition-colors bg-white/5">
                                    <input 
                                        type="file" 
                                        id="fileUpload" 
                                        className="hidden" 
                                        accept=".pdf,.txt,.png,.jpg,.jpeg" 
                                        onChange={handleFileSelect} 
                                    />
                                    {selectedFile ? (
                                        <div className="flex items-center justify-center gap-2 text-green-300">
                                            <CheckCircle size={20} />
                                            <span className="font-bold truncate max-w-[200px]">{selectedFile.name}</span>
                                            <button onClick={() => setSelectedFile(null)} className="p-1 hover:text-red-400"><X size={16}/></button>
                                        </div>
                                    ) : (
                                        <label htmlFor="fileUpload" className="cursor-pointer flex flex-col items-center gap-2">
                                            <Upload className="opacity-50" />
                                            <span className="text-sm opacity-50">Click to attach PDF, Image, or Text (Max 100MB)</span>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/10 mt-4">
                            <button 
                                onClick={handlePostNote}
                                disabled={uploading}
                                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2"
                            >
                                {uploading ? <Loader2 className="animate-spin" /> : <Upload size={18} />}
                                {uploading ? 'Processing & Posting...' : 'Post Note'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Note Reader Overlay */}
            {selectedNote && (
                 <div className="absolute inset-0 z-40 bg-black/95 flex flex-col animate-in fade-in duration-200">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#13131a]">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${selectedNote.file_type === 'PDF' ? 'bg-red-500/20 text-red-300' : selectedNote.file_type === 'IMAGE' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                {selectedNote.file_type === 'PDF' ? <FileType size={24}/> : selectedNote.file_type === 'IMAGE' ? <Image size={24}/> : <FileText size={24}/>}
                            </div>
                            <div>
                                <h3 className="font-bold text-xl text-white">{selectedNote.title}</h3>
                                <p className="text-sm opacity-50 flex items-center gap-2 text-white">
                                    <div className="w-4 h-4 rounded-full overflow-hidden bg-white/10">
                                        {selectedNote.avatar_url ? <img src={selectedNote.avatar_url} className="w-full h-full object-cover"/> : <User size={12}/>}
                                    </div>
                                    {selectedNote.display_name || selectedNote.username} • {new Date(selectedNote.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedNote(null)} className="p-2 glass-button rounded-full hover:bg-white/20 text-white"><X/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#0a0a0f]">
                        <div className="max-w-4xl mx-auto bg-white/5 p-8 rounded-2xl border border-white/10 shadow-2xl">
                             <div className="whitespace-pre-wrap leading-relaxed opacity-90 font-sans text-base md:text-lg text-white">
                                {selectedNote.content}
                            </div>
                        </div>
                    </div>
                 </div>
            )}

            {/* Notes Grid */}
            {loading ? <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-cyan-400" size={48} /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pb-10">
                    {notes.map(note => (
                        <div 
                            key={note.id} 
                            onClick={() => setSelectedNote(note)}
                            className="glass-panel p-5 rounded-xl cursor-pointer hover:bg-white/10 transition-all group flex flex-col border border-white/5 hover:border-cyan-500/30"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${note.file_type === 'PDF' ? 'bg-red-500/20 text-red-300' : note.file_type === 'IMAGE' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                    {note.file_type === 'PDF' ? <FileType size={20}/> : note.file_type === 'IMAGE' ? <Image size={20}/> : <FileText size={20}/>}
                                </div>
                                <span className="text-[10px] bg-white/10 px-2 py-1 rounded border border-white/10">{new Date(note.created_at).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-cyan-300 transition-colors">{note.title}</h3>
                            <p className="text-sm opacity-50 line-clamp-3 mb-4 flex-1">{note.content.substring(0, 100)}...</p>
                            <div className="flex items-center gap-2 text-xs opacity-50 mt-auto pt-4 border-t border-white/5">
                                <div className="w-5 h-5 rounded-full overflow-hidden bg-white/10 border border-white/10">
                                    {note.avatar_url ? <img src={note.avatar_url} className="w-full h-full object-cover"/> : <User size={12} className="w-full h-full p-1"/>}
                                </div>
                                {note.display_name || note.username}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommunityNotes;