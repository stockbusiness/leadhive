import React from 'react';
import { 
  LayoutDashboard, 
  Search, 
  Bell, 
  ChevronDown, 
  ArrowUpRight, 
  Building, 
  MessageSquare, 
  Calendar, 
  Activity, 
  Briefcase, 
  Users,
  Settings,
  Folder,
  CheckCircle,
  Database,
  BarChart3,
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  return (
    <div className="flex h-[800px] w-[1280px] bg-[#F9FAFB] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[240px] bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">LeadHive</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">メインメニュー</div>
          <button className="w-full flex items-center gap-3 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-md text-sm font-medium transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            ダッシュボード
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md text-sm font-medium transition-colors">
            <Building className="w-4 h-4" />
            企業データ
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md text-sm font-medium transition-colors">
            <Users className="w-4 h-4" />
            リード管理
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md text-sm font-medium transition-colors">
            <Mail className="w-4 h-4" />
            アプローチ
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md text-sm font-medium transition-colors">
            <BarChart3 className="w-4 h-4" />
            レポート
          </button>
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
              YT
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-gray-900 truncate">山田 太郎</div>
              <div className="text-xs text-gray-500 truncate">yamada@example.com</div>
            </div>
            <Settings className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">ダッシュボード</h1>
            <div className="h-4 w-px bg-gray-200"></div>
            <button className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              <Folder className="w-4 h-4" />
              プロジェクト: IT業界向け営業
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5">
              <Calendar className="w-4 h-4 text-gray-500 mr-2" />
              <span className="text-sm text-gray-600 font-medium">今月 (2023年10月)</span>
            </div>
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-6">
              {/* KPI 1 */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm shadow-gray-200/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-500">収集済み企業</div>
                  <div className="w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Database className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">1,243</div>
                  <div className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    12%
                  </div>
                </div>
              </div>

              {/* KPI 2 */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm shadow-gray-200/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-500">アプローチ済み</div>
                  <div className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
                    <Mail className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">387</div>
                  <div className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    8%
                  </div>
                </div>
              </div>

              {/* KPI 3 */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm shadow-gray-200/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-500">商談中</div>
                  <div className="w-8 h-8 rounded-md bg-amber-50 flex items-center justify-center text-amber-600">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">52</div>
                  <div className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    24%
                  </div>
                </div>
              </div>

              {/* KPI 4 */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm shadow-gray-200/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-500">今週のフォロー</div>
                  <div className="w-8 h-8 rounded-md bg-rose-50 flex items-center justify-center text-rose-600">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">18</div>
                  <div className="flex items-center text-sm font-medium text-gray-500">
                    件予定
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-3 gap-6">
              {/* Bar Chart */}
              <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-6 shadow-sm shadow-gray-200/20">
                <h3 className="text-base font-semibold text-gray-900 mb-6">週別収集数</h3>
                <div className="h-64 flex items-end justify-between gap-2 px-2">
                  {[
                    { label: 'W1', value: 45, max: 100 },
                    { label: 'W2', value: 55, max: 100 },
                    { label: 'W3', value: 40, max: 100 },
                    { label: 'W4', value: 75, max: 100 },
                    { label: 'W5', value: 60, max: 100 },
                    { label: 'W6', value: 85, max: 100 },
                    { label: 'W7', value: 70, max: 100 },
                    { label: 'W8', value: 95, max: 100 },
                  ].map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-8 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                        {item.value * 12}件
                      </div>
                      <div className="w-full bg-gray-100 rounded-t-sm overflow-hidden h-full flex flex-col justify-end">
                        <div 
                          className="w-full bg-indigo-500 hover:bg-indigo-600 transition-all duration-300" 
                          style={{ height: `${(item.value / item.max) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400 mt-3">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pie/Donut Chart */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm shadow-gray-200/20">
                <h3 className="text-base font-semibold text-gray-900 mb-6">ECプラットフォーム分布</h3>
                <div className="relative h-48 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-48 h-48 transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E5E7EB" strokeWidth="16" />
                    {/* Shopify 34% */}
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#4F46E5" strokeWidth="16" strokeDasharray="85.45 251.2" strokeDashoffset="0" />
                    {/* BASE 22% */}
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#818CF8" strokeWidth="16" strokeDasharray="55.29 251.2" strokeDashoffset="-85.45" />
                    {/* WooCommerce 18% */}
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#C7D2FE" strokeWidth="16" strokeDasharray="45.21 251.2" strokeDashoffset="-140.74" />
                    {/* Others 26% */}
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E0E7FF" strokeWidth="16" strokeDasharray="65.31 251.2" strokeDashoffset="-185.95" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-medium text-gray-500">全体</span>
                    <span className="text-xl font-bold text-gray-900">1,243</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-600"></div><span className="text-gray-600">Shopify</span></div>
                    <span className="font-medium text-gray-900 tabular-nums">34%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-400"></div><span className="text-gray-600">BASE</span></div>
                    <span className="font-medium text-gray-900 tabular-nums">22%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-200"></div><span className="text-gray-600">WooCommerce</span></div>
                    <span className="font-medium text-gray-900 tabular-nums">18%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-indigo-100"></div><span className="text-gray-600">その他</span></div>
                    <span className="font-medium text-gray-900 tabular-nums">26%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-2 gap-6">
              {/* Score Distribution */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm shadow-gray-200/20">
                <h3 className="text-base font-semibold text-gray-900 mb-6">スコア分布</h3>
                <div className="space-y-5">
                  {[
                    { rank: 'A', percent: 15, count: 186, color: 'bg-emerald-500' },
                    { rank: 'B', percent: 35, count: 435, color: 'bg-blue-500' },
                    { rank: 'C', percent: 30, count: 373, color: 'bg-amber-500' },
                    { rank: 'D', percent: 20, count: 249, color: 'bg-gray-400' },
                  ].map((item) => (
                    <div key={item.rank} className="flex items-center gap-4">
                      <div className="w-6 font-bold text-gray-700">{item.rank}</div>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.percent}%` }}></div>
                      </div>
                      <div className="w-16 text-right font-medium text-sm text-gray-900 tabular-nums">{item.percent}%</div>
                      <div className="w-12 text-right text-xs text-gray-500 tabular-nums">{item.count}社</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm shadow-gray-200/20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-gray-900">直近のアクティビティ</h3>
                  <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">すべて見る</button>
                </div>
                <div className="space-y-4">
                  {[
                    { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', title: '商談化: 株式会社ABC', time: '10分前', desc: '初回面談が完了し、次回提案へ進みました。' },
                    { icon: Mail, color: 'text-blue-500', bg: 'bg-blue-50', title: 'メール開封: XYZ株式会社', time: '45分前', desc: 'ステップ2のメールが開封されました。' },
                    { icon: Database, color: 'text-indigo-500', bg: 'bg-indigo-50', title: '新規収集完了: ECアパレル', time: '2時間前', desc: '条件に合致する45件の企業データを追加しました。' },
                    { icon: MessageSquare, color: 'text-amber-500', bg: 'bg-amber-50', title: '問い合わせ受信', time: '3時間前', desc: '田中物産からインバウンドの問い合わせがありました。' },
                    { icon: Building, color: 'text-gray-500', bg: 'bg-gray-50', title: '企業情報更新', time: '昨日', desc: '32件の企業の売上情報を更新しました。' },
                  ].map((activity, i) => (
                    <div key={i} className="flex gap-4">
                      <div className={`w-8 h-8 rounded-full ${activity.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <activity.icon className={`w-4 h-4 ${activity.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                          <span className="text-xs text-gray-500">{activity.time}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{activity.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
