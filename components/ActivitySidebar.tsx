
import React from 'react';
import { ActivityLog } from '../types';

interface ActivitySidebarProps {
  logs: ActivityLog[];
}

export const ActivitySidebar: React.FC<ActivitySidebarProps> = ({ logs }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-200px)] lg:h-[calc(100vh-160px)] sticky top-24">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Activity Stream
        </h3>
        <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">HISTORY</span>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
        {logs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm font-medium italic">No activity logs found.</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="relative pl-6 pb-4 border-l border-slate-100 last:pb-0">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-indigo-200 border-2 border-white"></div>
              <div className="flex flex-col">
                <div className="flex justify-between items-start mb-0.5">
                  <span className="text-xs font-bold text-indigo-600">{log.nickname}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-bold text-slate-800">"{log.taskTitle}"</span> {log.action}.
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
