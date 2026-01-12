
import React, { useState } from 'react';

interface NicknameModalProps {
  onJoin: (nickname: string, isAdmin: boolean) => void;
}

export const NicknameModal: React.FC<NicknameModalProps> = ({ onJoin }) => {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    const isLoggingAsAdmin = nickname.trim().toLowerCase() === 'admin' && password === 'wetlands';
    onJoin(nickname.trim(), isLoggingAsAdmin);
  };

  const handleGuestJoin = () => {
    onJoin('Guest User', false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300 border border-slate-100">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-200">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-1 uppercase tracking-tight">Access Portal</h2>
        <p className="text-slate-500 text-sm mb-6 font-medium">Event Tracking System</p>
        
        <button 
          onClick={handleGuestJoin}
          className="w-full bg-indigo-50 border-2 border-indigo-100 text-indigo-700 py-4 rounded-2xl font-black text-sm hover:bg-indigo-100 transition-all uppercase tracking-widest mb-6 flex items-center justify-center gap-3 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          ENTER AS GUEST (VIEW ONLY)
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase font-black text-slate-400"><span className="bg-white px-4">OR ADMIN SIGN IN</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Username</label>
              <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-700 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-700 bg-slate-50/50"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-black text-xs hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] uppercase tracking-widest"
          >
            Authorize Admin Access
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-50">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            PERSISTENT LOCAL STORAGE ACTIVE
          </p>
        </div>
      </div>
    </div>
  );
};
