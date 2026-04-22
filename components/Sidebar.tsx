'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Receipt, MessageSquare, Users, Clipboard, Star, LogOut, FlaskConical } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'Sales', Icon: LayoutDashboard },
  { id: 'operations', label: 'Operations', Icon: Clipboard },
  { id: 'chats', label: 'Chats', Icon: MessageSquare },
  { id: 'agents', label: 'Agents ', Icon: Users },
  { id: 'nps', label: 'NPS', Icon: Star },
  { id: 'pnl', label: 'P&L', Icon: Receipt },
  { id: 'evals', label: 'Evals', Icon: FlaskConical },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const router = useRouter();
  const [showSignOut, setShowSignOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/status')
      .then((r) => r.json())
      .then((data: { passwordProtection?: boolean }) => {
        if (!cancelled && data.passwordProtection) setShowSignOut(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="w-56 bg-white border-r border-slate-200 min-h-screen flex flex-col">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <img 
            src="https://maids.cc/favicon.ico" 
            alt="maids.cc" 
            className="w-12 h-12 rounded-lg"
          />
          <div>
            <h1 className="text-lg font-bold text-slate-800">PRO Services</h1>
            <p className="text-sm text-slate-400">maids.cc</p>
          </div>
        </div>
      </div>
      
      <nav className="p-2 flex-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.Icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base transition-colors mb-1 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={20} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {showSignOut && (
        <div className="p-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <LogOut size={20} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
