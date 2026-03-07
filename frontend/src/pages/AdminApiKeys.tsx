import { useEffect, useState } from "react";
import { Key, Save, Loader2, CheckCircle, Building2, ExternalLink } from "lucide-react";
import { api } from "../api";

export default function AdminApiKeys() {
  const [gbizToken, setGbizToken] = useState("");
  const [gbizTokenSet, setGbizTokenSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.admin.getApiSettings().then((data) => {
      if (data.gbizinfo_api_token_set) {
        setGbizTokenSet(true);
        setGbizToken(data.gbizinfo_api_token || "");
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      if (gbizToken && !gbizToken.includes("••")) {
        payload.gbizinfo_api_token = gbizToken;
      }
      if (Object.keys(payload).length > 0) {
        await api.admin.updateApiSettings(payload);
        setSaved(true);
        setGbizTokenSet(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Key size={24} className="text-indigo-600" />
        <h2 className="text-2xl font-bold text-slate-800">システムAPI設定</h2>
      </div>

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
          <CheckCircle size={16} />
          設定を保存しました
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-800">gBizINFO API設定</h3>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-2 text-sm text-indigo-800">
          <p className="font-medium">gBizINFO とは</p>
          <p className="text-indigo-700">
            経済産業省が提供する法人情報データベース。約400万社の会社名・住所・企業URLを取得できます。
            URL収集ページの「法人DB」タブからご利用いただけます。
          </p>
          <a
            href="https://info.gbiz.go.jp/api/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
          >
            APIトークンを取得する（無料・即時発行）
            <ExternalLink size={13} />
          </a>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            APIトークン
            {gbizTokenSet && (
              <span className="ml-2 text-emerald-600 text-xs font-normal">✓ 設定済み</span>
            )}
          </label>
          <input
            type="password"
            value={gbizToken}
            onChange={(e) => setGbizToken(e.target.value)}
            placeholder="gBizINFO APIトークンを入力"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            このトークンは全組織で共有されます。申請はメールアドレスの登録のみで即時発行されます。
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          保存
        </button>
      </div>
    </div>
  );
}
