import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Star, X, Save, UserCircle, Globe } from "lucide-react";
import { api } from "../api";

interface FormProfile {
  id: number;
  name: string;
  company_name: string;
  display_name: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  website_url: string;
  prefecture: string;
  address: string;
  is_default: boolean;
  created_at: string | null;
}

interface ProfileFormValues {
  name: string;
  company_name: string;
  display_name: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  website_url: string;
  prefecture: string;
  address: string;
  is_default: boolean;
}

const emptyForm = (): ProfileFormValues => ({
  name: "",
  company_name: "",
  display_name: "",
  title: "",
  department: "",
  phone: "",
  email: "",
  website_url: "",
  prefecture: "",
  address: "",
  is_default: false,
});

interface ProfileFormProps {
  form: ProfileFormValues;
  setForm: (f: ProfileFormValues) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  saving: boolean;
  error: string;
}

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

function ProfileForm({ form, setForm, onSave, onCancel, saveLabel, saving, error }: ProfileFormProps) {
  return (
    <div className="space-y-4 p-5 bg-slate-50 border border-slate-200 rounded-xl">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">プロフィール名（識別用） <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="例: 田中（ECチーム）、山田（代表）"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400 mt-0.5">送信時の選択画面に表示される名前です</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">会社名</label>
          <input
            type="text"
            value={form.company_name}
            onChange={e => setForm({ ...form, company_name: e.target.value })}
            placeholder="空白の場合は組織設定の会社名を使用"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-0.5">ブランド名・屋号など組織名と異なる場合に入力してください</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">担当者名</label>
          <input
            type="text"
            value={form.display_name}
            onChange={e => setForm({ ...form, display_name: e.target.value })}
            placeholder="山田 太郎"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">部署名</label>
          <input
            type="text"
            value={form.department}
            onChange={e => setForm({ ...form, department: e.target.value })}
            placeholder="営業部"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">役職</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="営業部 マネージャー"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">電話番号</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="03-1234-5678"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">メールアドレス（送信元）</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="sales@example.com（空白ならSMTP設定を使用）"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">自社URL</label>
          <input
            type="url"
            value={form.website_url}
            onChange={e => setForm({ ...form, website_url: e.target.value })}
            placeholder="https://example.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">都道府県</label>
          <select
            value={form.prefecture}
            onChange={e => setForm({ ...form, prefecture: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">住所（都道府県以降）</label>
          <input
            type="text"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="千代田区丸の内1-1-1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_default"
          checked={form.is_default}
          onChange={e => setForm({ ...form, is_default: e.target.checked })}
          className="w-4 h-4 rounded border-slate-300 text-blue-600"
        />
        <label htmlFor="is_default" className="text-sm text-slate-700">デフォルトとして設定（送信時に自動選択）</label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "保存中..." : <><Save size={14} />{saveLabel}</>}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <X size={14} />キャンセル
        </button>
      </div>
    </div>
  );
}

export default function FormProfiles() {
  const [profiles, setProfiles] = useState<FormProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ProfileFormValues>(emptyForm());
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<ProfileFormValues>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.formProfiles.list()
      .then(d => { setProfiles(d.profiles); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (p: FormProfile) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name, company_name: p.company_name, display_name: p.display_name,
      title: p.title, department: p.department, phone: p.phone, email: p.email,
      website_url: p.website_url, prefecture: p.prefecture, address: p.address,
      is_default: p.is_default,
    });
    setError("");
  };

  const cancelEdit = () => { setEditingId(null); setError(""); };

  const handleCreate = async () => {
    if (!createForm.name.trim()) { setError("プロフィール名は必須です"); return; }
    setSaving(true); setError("");
    try {
      await api.formProfiles.create(createForm);
      setCreateForm(emptyForm());
      setShowCreate(false);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "作成に失敗しました");
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: number) => {
    if (!editForm.name.trim()) { setError("プロフィール名は必須です"); return; }
    setSaving(true); setError("");
    try {
      await api.formProfiles.update(id, editForm);
      setEditingId(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "更新に失敗しました");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("このプロフィールを削除しますか？")) return;
    await api.formProfiles.delete(id);
    load();
  };

  const handleSetDefault = async (id: number) => {
    await api.formProfiles.setDefault(id);
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe size={24} className="text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-800">フォーム送信プロフィール</h2>
            <p className="text-sm text-slate-500 mt-0.5">送信時に選択できる担当者情報のセットを管理します</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setError(""); setCreateForm(emptyForm()); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} />
          新規追加
        </button>
      </div>

      {showCreate && (
        <ProfileForm
          form={createForm}
          setForm={setCreateForm}
          onSave={handleCreate}
          onCancel={() => { setShowCreate(false); setError(""); }}
          saveLabel="追加"
          saving={saving}
          error={error}
        />
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 space-y-1">
        <p className="font-semibold flex items-center gap-1.5"><Globe size={14} />使い方</p>
        <p>営業AI → 送信確認ダイアログ → フォーム送信モードで「送信者プロフィール」を選択して使います。</p>
        <p className="text-blue-500">担当者ごとに作成しておくと、送信時に切り替えられます。ここで設定した情報が、相手先のお問い合わせフォームの各入力欄にAIが自動で入力します。</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">読み込み中...</p>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <UserCircle size={40} className="text-slate-300 mx-auto" />
          <p className="text-slate-500 font-medium">プロフィールがありません</p>
          <p className="text-sm text-slate-400">「新規追加」ボタンで担当者プロフィールを作成してください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border shadow-sm ${p.is_default ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200"}`}>
              {editingId === p.id ? (
                <div className="p-5">
                  <ProfileForm
                    form={editForm}
                    setForm={setEditForm}
                    onSave={() => handleUpdate(p.id)}
                    onCancel={cancelEdit}
                    saveLabel="保存"
                    saving={saving}
                    error={error}
                  />
                </div>
              ) : (
                <div className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h4 className="font-semibold text-slate-800">{p.name}</h4>
                      {p.is_default && (
                        <span className="flex items-center gap-1 text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          <Star size={10} className="fill-blue-500 text-blue-500" />
                          デフォルト
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                      {p.company_name && (
                        <div><span className="text-xs text-slate-400">会社名</span><p className="text-slate-700 font-medium">{p.company_name}</p></div>
                      )}
                      {p.display_name && (
                        <div><span className="text-xs text-slate-400">担当者名</span><p className="text-slate-700 font-medium">{p.display_name}</p></div>
                      )}
                      {p.department && (
                        <div><span className="text-xs text-slate-400">部署</span><p className="text-slate-700">{p.department}</p></div>
                      )}
                      {p.title && (
                        <div><span className="text-xs text-slate-400">役職</span><p className="text-slate-700">{p.title}</p></div>
                      )}
                      {p.phone && (
                        <div><span className="text-xs text-slate-400">電話</span><p className="text-slate-700">{p.phone}</p></div>
                      )}
                      {p.email && (
                        <div><span className="text-xs text-slate-400">メール</span><p className="text-slate-700 truncate">{p.email}</p></div>
                      )}
                      {p.website_url && (
                        <div><span className="text-xs text-slate-400">自社URL</span><p className="text-slate-700 truncate">{p.website_url}</p></div>
                      )}
                      {(p.prefecture || p.address) && (
                        <div className="col-span-2 md:col-span-3">
                          <span className="text-xs text-slate-400">住所</span>
                          <p className="text-slate-700">{[p.prefecture, p.address].filter(Boolean).join(" ")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!p.is_default && (
                      <button onClick={() => handleSetDefault(p.id)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-md hover:bg-amber-50" title="デフォルトに設定">
                        <Star size={15} />
                      </button>
                    )}
                    <button onClick={() => startEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50" title="編集">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50" title="削除">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
