import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Download,
  Mail,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  HelpCircle,
  Bell,
  SearchCode,
  LineChart
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const MOCK_DATA = [
  {
    id: 1,
    name: '株式会社テクノフロント',
    domain: 'technofront.co.jp',
    score: 'A',
    platform: 'Shopify',
    ecSize: '大',
    status: '未着手',
    assignee: { name: '佐藤 健太', avatar: '' },
    followDate: '2024/03/15',
  },
  {
    id: 2,
    name: 'グローバルコマースジャパン',
    domain: 'global-commerce.jp',
    score: 'B',
    platform: 'BASE',
    ecSize: '中',
    status: 'アプローチ済',
    assignee: { name: '鈴木 美咲', avatar: '' },
    followDate: '2024/03/14',
  },
  {
    id: 3,
    name: '合同会社ネクストリテール',
    domain: 'next-retail.com',
    score: 'A',
    platform: 'Shopify',
    ecSize: '中',
    status: '商談中',
    assignee: { name: '田中 浩二', avatar: '' },
    followDate: '2024/03/12',
  },
  {
    id: 4,
    name: 'アパレルダイレクト株式会社',
    domain: 'apparel-direct.co.jp',
    score: 'C',
    platform: 'WooCommerce',
    ecSize: '小',
    status: '未着手',
    assignee: { name: '山田 花子', avatar: '' },
    followDate: '2024/03/10',
  },
  {
    id: 5,
    name: 'エコライフオンライン',
    domain: 'ecolife-online.jp',
    score: 'B',
    platform: 'Shopify',
    ecSize: '大',
    status: 'アプローチ済',
    assignee: { name: '伊藤 翔太', avatar: '' },
    followDate: '2024/03/09',
  },
  {
    id: 6,
    name: '株式会社和の匠',
    domain: 'wa-no-takumi.com',
    score: 'A',
    platform: 'MakeShop',
    ecSize: '中',
    status: '商談中',
    assignee: { name: '佐藤 健太', avatar: '' },
    followDate: '2024/03/08',
  },
  {
    id: 7,
    name: 'スマートデバイス合同会社',
    domain: 'smart-device.co.jp',
    score: 'D',
    platform: 'カラーミーショップ',
    ecSize: '小',
    status: '未着手',
    assignee: { name: '鈴木 美咲', avatar: '' },
    followDate: '2024/03/05',
  },
  {
    id: 8,
    name: 'プレミアムフード株式会社',
    domain: 'premium-food.jp',
    score: 'B',
    platform: 'Shopify',
    ecSize: '大',
    status: 'アプローチ済',
    assignee: { name: '田中 浩二', avatar: '' },
    followDate: '2024/03/01',
  },
];

const SidebarItem = ({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) => (
  <a
    href="#"
    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active 
        ? 'bg-indigo-50 text-indigo-600' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
    {label}
  </a>
);

export function Companies() {
  return (
    <div className="flex h-[800px] w-[1280px] bg-slate-50 overflow-hidden font-sans border border-slate-200">
      {/* Sidebar */}
      <aside className="w-[240px] bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight">LeadHive</span>
          </div>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-1 mb-8">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">Main Menu</div>
            <SidebarItem icon={LayoutDashboard} label="ダッシュボード" />
            <SidebarItem icon={SearchCode} label="企業検索" />
            <SidebarItem icon={Building2} label="候補企業一覧" active />
            <SidebarItem icon={LineChart} label="レポート" />
          </div>
          
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">Workspace</div>
            <SidebarItem icon={Users} label="チーム管理" />
            <SidebarItem icon={Settings} label="設定" />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">YS</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-900">Yuki Sato</span>
              <span className="text-xs text-slate-500">Admin</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">候補企業一覧</h1>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium rounded-full px-2.5">
              1,243件
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 text-slate-600 border-slate-200 hover:bg-slate-50">
              <Download className="w-4 h-4 mr-2" />
              CSV出力
            </Button>
            <Button size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-none">
              <Mail className="w-4 h-4 mr-2" />
              一括メール送信
            </Button>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white border-b border-slate-200 p-4 px-8 flex-shrink-0 z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="企業名、ドメインで検索..." 
                className="pl-9 h-9 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500"
              />
            </div>
            
            <Select defaultValue="all">
              <SelectTrigger className="w-[140px] h-9 border-slate-200 bg-slate-50">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="untouched">未着手</SelectItem>
                <SelectItem value="approached">アプローチ済</SelectItem>
                <SelectItem value="negotiating">商談中</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="w-[120px] h-9 border-slate-200 bg-slate-50">
                <SelectValue placeholder="スコア" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="a">Aランク</SelectItem>
                <SelectItem value="b">Bランク</SelectItem>
                <SelectItem value="c">Cランク</SelectItem>
                <SelectItem value="d">Dランク</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger className="w-[160px] h-9 border-slate-200 bg-slate-50">
                <SelectValue placeholder="プラットフォーム" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="base">BASE</SelectItem>
                <SelectItem value="woo">WooCommerce</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-2 border-l border-slate-200">
              <Switch id="ec-mode" className="data-[state=checked]:bg-indigo-600" />
              <Label htmlFor="ec-mode" className="text-sm text-slate-600 cursor-pointer">EC判定のみ</Label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              アクティブな条件:
            </span>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-full px-2 py-0.5 border border-indigo-100 font-normal flex items-center gap-1 cursor-pointer">
              🛍️ Shopify
              <X className="w-3 h-3 ml-1 text-indigo-400" />
            </Badge>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full px-2 py-0.5 border border-emerald-100 font-normal flex items-center gap-1 cursor-pointer">
              Aランク
              <X className="w-3 h-3 ml-1 text-emerald-400" />
            </Badge>
            <button className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 ml-2 transition-colors">
              フィルタークリア
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-white">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-0">
              <TableRow className="border-slate-200 hover:bg-slate-50">
                <TableHead className="w-12 text-center pl-6">
                  <Checkbox className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" />
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-11">企業名</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-11 w-20 text-center">スコア</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-11 w-40">CMS/プラットフォーム</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-11 w-24 text-center">EC規模</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-11 w-32">ステータス</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-11 w-40">担当者</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider h-11 w-32 text-right">フォロー日</TableHead>
                <TableHead className="w-12 pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_DATA.map((row) => (
                <TableRow key={row.id} className="border-slate-100 hover:bg-slate-50/80 transition-colors group">
                  <TableCell className="pl-6">
                    <Checkbox className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 text-sm">{row.name}</span>
                      <span className="text-xs text-slate-400 mt-0.5">{row.domain}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                      row.score === 'A' ? 'bg-emerald-100 text-emerald-700' :
                      row.score === 'B' ? 'bg-blue-100 text-blue-700' :
                      row.score === 'C' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {row.score}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200/60">
                      {row.platform === 'Shopify' && <span className="text-[10px]">🛍️</span>}
                      {row.platform}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-medium text-slate-600">{row.ecSize}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-normal px-2 py-0.5 rounded-full border-0 ${
                      row.status === '未着手' ? 'bg-slate-100 text-slate-600' :
                      row.status === 'アプローチ済' ? 'bg-indigo-50 text-indigo-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        row.status === '未着手' ? 'bg-slate-400' :
                        row.status === 'アプローチ済' ? 'bg-indigo-500' :
                        'bg-emerald-500'
                      }`} />
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="bg-slate-200 text-slate-600 text-[10px]">
                          {row.assignee.name.substring(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-slate-600">{row.assignee.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate-500 tabular-nums">
                    {row.followDate}
                  </TableCell>
                  <TableCell className="pr-6">
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="h-14 border-t border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
          <div className="text-sm text-slate-500">
            <span className="font-medium text-slate-900">1-20</span> / 1,243件
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="w-8 h-8 border-slate-200 text-slate-600 disabled:opacity-50" disabled>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="w-8 h-8 border-slate-200 text-slate-600">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
