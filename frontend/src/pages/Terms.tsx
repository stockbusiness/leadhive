import { Link } from "react-router-dom";
import { Building2, ChevronLeft } from "lucide-react";

const SECTIONS = [
  {
    title: "第1条（適用）",
    content: `本規約は、COOLWORKS株式会社（以下「当社」といいます。）が提供するサービス「LeadHive」（以下「本サービス」といいます。）の利用条件を定めるものです。登録ユーザーの皆さま（以下「ユーザー」といいます。）には、本規約に従って、本サービスをご利用いただきます。`,
  },
  {
    title: "第2条（利用登録）",
    content: `1. 本サービスにおいては、登録希望者が本規約に同意の上、当社の定める方法によって利用登録を申請し、当社がこれを承認することによって、利用登録が完了するものとします。\n\n2. 当社は、利用登録の申請者に以下の事由があると判断した場合、利用登録の申請を承認しないことがあり、その理由については一切の開示義務を負わないものとします。\n\n・利用登録の申請に際して虚偽の事項を届け出た場合\n・本規約に違反したことがある者からの申請である場合\n・その他、当社が利用登録を相当でないと判断した場合`,
  },
  {
    title: "第3条（ユーザーIDおよびパスワードの管理）",
    content: `1. ユーザーは、自己の責任において、本サービスのユーザーIDおよびパスワードを適切に管理するものとします。\n\n2. ユーザーは、いかなる場合にも、ユーザーIDおよびパスワードを第三者に譲渡または貸与し、もしくは第三者と共用することはできません。\n\n3. 当社は、ユーザーIDとパスワードの組み合わせが登録情報と一致してログインされた場合には、そのユーザーIDを登録しているユーザー自身による利用とみなします。`,
  },
  {
    title: "第4条（禁止事項）",
    content: `ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。\n\n・法令または公序良俗に違反する行為\n・犯罪行為に関連する行為\n・本サービスの内容等、本サービスに含まれる著作権、商標権ほか知的財産権を侵害する行為\n・当社、ほかのユーザー、またはその他第三者のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為\n・本サービスによって得られた情報を商業的に利用する行為\n・当社のサービスの運営を妨害するおそれのある行為\n・不正アクセスをし、またはこれを試みる行為\n・他のユーザーに関する個人情報等を収集または蓄積する行為\n・不正な目的を持って本サービスを利用する行為\n・本サービスの他のユーザーまたはその他の第三者に不利益、損害、不快感を与える行為\n・その他、当社が不適切と判断する行為`,
  },
  {
    title: "第5条（本サービスの提供の停止等）",
    content: `1. 当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。\n\n・本サービスにかかるコンピュータシステムの保守点検または更新を行う場合\n・地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合\n・コンピュータまたは通信回線等が事故により停止した場合\n・その他、当社が本サービスの提供が困難と判断した場合\n\n2. 当社は、本サービスの提供の停止または中断により、ユーザーまたは第三者が被ったいかなる不利益または損害についても、一切の責任を負わないものとします。`,
  },
  {
    title: "第6条（利用制限および登録抹消）",
    content: `1. 当社は、ユーザーが以下のいずれかに該当する場合には、事前の通知なく、ユーザーに対して、本サービスの全部もしくは一部の利用を制限し、またはユーザーとしての登録を抹消することができるものとします。\n\n・本規約のいずれかの条項に違反した場合\n・登録事項に虚偽の事実があることが判明した場合\n・料金等の支払債務の不履行があった場合\n・当社からの連絡に対し、一定期間返答がない場合\n・本サービスについて、最終の利用から一定期間利用がない場合\n・その他、当社が本サービスの利用を適当でないと判断した場合\n\n2. 当社は、本条に基づき当社が行った行為によりユーザーに生じた損害について、一切の責任を負いません。`,
  },
  {
    title: "第7条（保証の否認および免責事項）",
    content: `1. 当社は、本サービスに事実上または法律上の瑕疵（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティなどに関する欠陥、エラーやバグ、権利侵害などを含みます。）がないことを明示的にも黙示的にも保証しておりません。\n\n2. 当社は、本サービスに起因してユーザーに生じたあらゆる損害について一切の責任を負いません。ただし、本サービスに関する当社とユーザーとの間の契約（本規約を含みます。）が消費者契約法に定める消費者契約となる場合、この免責規定は適用されません。`,
  },
  {
    title: "第8条（サービス内容の変更等）",
    content: `当社は、ユーザーに通知することなく、本サービスの内容を変更しまたは本サービスの提供を中止することができるものとし、これによってユーザーに生じた損害について一切の責任を負いません。`,
  },
  {
    title: "第9条（利用規約の変更）",
    content: `当社は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。なお、本規約の変更後、本サービスの利用を開始した場合には、当該ユーザーは変更後の規約に同意したものとみなします。`,
  },
  {
    title: "第10条（個人情報の取扱い）",
    content: `当社は、本サービスの利用によって取得する個人情報については、当社「プライバシーポリシー」に従い適切に取り扱うものとします。`,
  },
  {
    title: "第11条（通知または連絡）",
    content: `ユーザーと当社との間の通知または連絡は、当社の定める方法によって行うものとします。当社は、ユーザーから、当社が別途定める方式に従った変更届け出がない限り、現在登録されている連絡先が有効なものとみなして当該連絡先へ通知または連絡を行い、これらは、発信時にユーザーへ到達したものとみなします。`,
  },
  {
    title: "第12条（権利義務の譲渡の禁止）",
    content: `ユーザーは、当社の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務を第三者に譲渡し、または担保に供することはできません。`,
  },
  {
    title: "第13条（準拠法・裁判管轄）",
    content: `本規約の解釈にあたっては、日本法を準拠法とします。\n本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。`,
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-base">LeadHive</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={15} />
            トップに戻る
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Terms of Service</p>
          <h1 className="text-3xl font-extrabold text-slate-900">利用規約</h1>
          <p className="text-sm text-slate-500 mt-2">最終更新日：2026年1月1日</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="divide-y divide-slate-100">
            {SECTIONS.map((section) => (
              <div key={section.title} className="px-6 py-5">
                <h2 className="font-bold text-slate-800 text-sm mb-2">{section.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{section.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-400 justify-center">
          <Link to="/company" className="hover:text-slate-700 transition-colors">会社概要</Link>
          <span>·</span>
          <Link to="/privacy-policy" className="hover:text-slate-700 transition-colors">プライバシーポリシー</Link>
          <span>·</span>
          <Link to="/" className="hover:text-slate-700 transition-colors">トップページ</Link>
        </div>
      </main>
    </div>
  );
}
