import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Bot, 
  Kanban, 
  Mail, 
  Phone, 
  Filter, 
  ShoppingCart, 
  Link2,
  Moon,
  Sun,
  LogOut,
  ChevronDown
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'ダッシュボード', id: 'dashboard' },
  { icon: Building2, label: '候補企業一覧', id: 'companies' },
  { icon: Bot, label: '営業AI', id: 'sales-ai' },
  { icon: Kanban, label: 'パイプライン', id: 'pipeline' },
  { icon: Mail, label: '一括メール送信', id: 'bulk-email' },
  { icon: Phone, label: 'テレアポ', id: 'teleapo' },
  { icon: Filter, label: '検索条件管理', id: 'keywords' },
  { icon: ShoppingCart, label: 'EC企業収集', id: 'ec-collection' },
  { icon: Link2, label: 'URL収集', id: 'url-scrape' },
];

export function Sidebar() {
  const [activeItem, setActiveItem] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <div className={`flex h-[800px] w-[1280px] overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <aside className="w-[240px] flex flex-col bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 transition-colors duration-200 shrink-0">
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
              L
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-lg tracking-tight">LeadHive</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
              PRO
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          <div className="mb-4 px-3 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
            メインメニュー
          </div>
          {navItems.map((item) => {
            const isActive = activeItem === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                className={`w-full flex items-center h-12 px-3 rounded-md transition-all duration-200 group ${
                  isActive 
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300'}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Area */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 space-y-4">
          {/* Theme Toggle */}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-between px-3 h-10 rounded-md text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <div className="flex items-center">
              {isDarkMode ? <Moon className="w-4 h-4 mr-3 text-gray-400" /> : <Sun className="w-4 h-4 mr-3 text-gray-400" />}
              <span className="text-sm font-medium">{isDarkMode ? 'ダークモード' : 'ライトモード'}</span>
            </div>
            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-200'}`}>
              <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>

          {/* User Profile */}
          <button className="w-full flex items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors text-left group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium shadow-sm shrink-0">
              YS
            </div>
            <div className="ml-3 flex-1 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">山田 太郎</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">yamada@example.co.jp</p>
            </div>
            <LogOut className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 bg-[#F8F9FA] dark:bg-zinc-950 flex flex-col min-w-0 transition-colors duration-200">
        <header className="h-16 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800 flex items-center px-8 shrink-0">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {navItems.find(i => i.id === activeItem)?.label}
          </h1>
        </header>
        
        <div className="flex-1 overflow-auto p-8">
          {/* Placeholder Content */}
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 h-32 flex flex-col justify-between animate-pulse">
                  <div className="w-24 h-4 bg-gray-100 dark:bg-zinc-800 rounded"></div>
                  <div className="w-16 h-8 bg-gray-200 dark:bg-zinc-700 rounded"></div>
                </div>
              ))}
            </div>
            
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 min-h-[400px] p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="w-32 h-6 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse"></div>
                <div className="w-24 h-8 bg-gray-100 dark:bg-zinc-800 rounded-md animate-pulse"></div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
