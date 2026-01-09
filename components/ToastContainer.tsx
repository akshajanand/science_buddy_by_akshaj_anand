
import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { ToastEventDetail } from '../utils/notificationUtils';

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
    visible: boolean;
}

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const handleToast = (e: Event) => {
            const detail = (e as CustomEvent<ToastEventDetail>).detail;
            const newToast: ToastItem = {
                id: Date.now(),
                message: detail.message,
                type: detail.type,
                visible: true
            };
            
            setToasts(prev => [...prev, newToast]);

            // Auto dismiss sequence
            setTimeout(() => {
                // 1. Trigger exit animation
                setToasts(prev => prev.map(t => t.id === newToast.id ? { ...t, visible: false } : t));
                
                // 2. Remove from array after animation completes
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== newToast.id));
                }, 500);
            }, 3000);
        };

        window.addEventListener('science-buddy-toast', handleToast);
        return () => window.removeEventListener('science-buddy-toast', handleToast);
    }, []);

    const removeToast = (id: number) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 500);
    };

    return (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[200] flex flex-col items-center gap-3 w-full max-w-[90vw] md:max-w-md pointer-events-none">
            {toasts.map(toast => (
                <div 
                    key={toast.id}
                    className={`
                        pointer-events-auto w-full p-1 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                        ${toast.visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-8 opacity-0 scale-90'}
                        ${toast.type === 'success' ? 'bg-gradient-to-r from-green-500/50 to-emerald-600/50' : ''}
                        ${toast.type === 'error' ? 'bg-gradient-to-r from-red-500/50 to-pink-600/50' : ''}
                        ${toast.type === 'info' ? 'bg-gradient-to-r from-blue-500/50 to-cyan-600/50' : ''}
                    `}
                >
                    <div className="bg-[#050505]/90 backdrop-blur-2xl rounded-xl p-4 flex items-center gap-4 border border-white/5 h-full">
                        <div className={`p-2 rounded-full shrink-0 shadow-lg ${
                            toast.type === 'success' ? 'bg-green-500/20 text-green-400 shadow-green-500/20' : 
                            toast.type === 'error' ? 'bg-red-500/20 text-red-400 shadow-red-500/20' : 
                            'bg-blue-500/20 text-blue-400 shadow-blue-500/20'
                        }`}>
                            {toast.type === 'success' && <CheckCircle size={24} />}
                            {toast.type === 'error' && <AlertCircle size={24} />}
                            {toast.type === 'info' && <Info size={24} />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${
                                toast.type === 'success' ? 'text-green-400' : 
                                toast.type === 'error' ? 'text-red-400' : 
                                'text-blue-400'
                            }`}>
                                {toast.type === 'info' ? 'System' : toast.type}
                            </p>
                            <p className="text-sm font-medium text-white/90 leading-snug truncate md:whitespace-normal md:overflow-visible">
                                {toast.message}
                            </p>
                        </div>

                        <button 
                            onClick={() => removeToast(toast.id)}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
