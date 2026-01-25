
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, Medal, Crown, User } from 'lucide-react';
import { Skeleton } from './Skeleton';

interface LeaderboardProps {
    currentUserId: string;
    currentUserPoints: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ currentUserId, currentUserPoints }) => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            // Fetch users ordered by total_points (All time), excluding teachers
            const { data, error } = await supabase
                .from('users')
                .select('id, username, display_name, avatar_url, total_points, role')
                .neq('role', 'teacher') // Exclude teachers
                .order('total_points', { ascending: false })
                .limit(20);

            if (data) {
                // Client-side patch: Merge the potentially newer currentUserPoints from props into the DB data
                // This handles the "read-after-write" lag where DB might still have old score
                let patchedData = data.map(u => {
                    if (u.id === currentUserId) {
                        // Use the greater value (usually props are newer if user just played)
                        return { ...u, total_points: Math.max(u.total_points, currentUserPoints) };
                    }
                    return u;
                });

                // Re-sort the list because the user's position might have changed due to the patch
                patchedData.sort((a, b) => b.total_points - a.total_points);

                setUsers(patchedData);
            }
            
            setLoading(false);
        };
        fetchLeaderboard();
    }, [currentUserPoints]); // Refetch/re-calc if my points change (e.g. reset or quiz)

    const getRankIcon = (index: number) => {
        if (index === 0) return <Crown className="text-yellow-400 fill-yellow-400" size={24} />;
        if (index === 1) return <Medal className="text-gray-300 fill-gray-300" size={24} />;
        if (index === 2) return <Medal className="text-amber-600 fill-amber-600" size={24} />;
        return <span className="font-bold opacity-50 w-6 text-center">{index + 1}</span>;
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
            <div className="mb-6 text-center">
                 <div className="inline-block p-4 rounded-full bg-yellow-500/10 mb-2 border border-yellow-500/20">
                    <Trophy size={40} className="text-yellow-300" />
                 </div>
                <h2 className="text-3xl font-bold">Leaderboard</h2>
                <p className="opacity-60">Top performing Science Buddies (All Time)</p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar max-w-2xl mx-auto w-full glass-panel rounded-2xl bg-black/20">
                <div className="flex items-center justify-between p-4 border-b border-white/10 text-xs font-bold uppercase tracking-widest opacity-40">
                    <span className="w-12 text-center">Rank</span>
                    <span className="flex-1 px-4">Student</span>
                    <span>Points</span>
                </div>
                
                {loading ? (
                    <div className="p-4 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                ) : (
                    users.length === 0 ? (
                        <div className="p-8 text-center opacity-30">
                            No active scores yet. Be the first!
                        </div>
                    ) : (
                        users.map((u, i) => (
                            <div 
                                key={u.id}
                                className={`flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${u.id === currentUserId ? 'bg-cyan-900/20 border-l-4 border-l-cyan-400' : ''}`}
                            >
                                <div className="w-12 flex justify-center">{getRankIcon(i)}</div>
                                <div className="flex-1 px-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                                        {u.avatar_url ? (
                                            <img src={u.avatar_url} alt="Av" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={14} className="opacity-50" />
                                        )}
                                    </div>
                                    <span className={`font-medium ${u.id === currentUserId ? 'text-cyan-300' : ''}`}>
                                        {u.display_name || u.username} {u.id === currentUserId && '(You)'}
                                    </span>
                                </div>
                                <div className="font-mono font-bold text-yellow-300">
                                    {u.total_points || 0}
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
