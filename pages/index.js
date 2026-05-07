import { useState } from "react";

const TOOLS = [
  {
    id: "proposal",
    label: "提案書ドラフト",
    icon: "◈",
    desc: "顧客情報を入力するだけで提案書の骨格を自動生成",
    fields: [
      { key: "company", label: "顧客企業名", placeholder: "例：株式会社〇〇" },
      { key: "product", label: "自社製品・サービス", placeholder: "例：クラウド型在庫管理システム" },
      { key: "issue", label: "顧客の課題・ニーズ", placeholder: "例：在庫の二重管理が発生しており、月次棚卸しに3日かかっている" },
      { key: "budget", label: "想定予算・規模（任意）", placeholder: "例：年間300万円、従業員50名規模" },
    ],
    buildPrompt: (f) => `提案書ドラフトを作成してください。\n顧客:${f.company}\nサービス:${f.product}\n課題:${f.issue}\n予算:${f.budget||"未記入"}\n\n構成：1.エグゼクティブサマリー 2.現状課題 3.提案内容 4.導入メリット 5.スケジュール 6.次のステップ`,
  },
  {
    id: "email",
    label: "営業メール",
    icon: "◉",
    desc: "初回アプローチから商談後フォローまで状況別に生成",
    fields: [
      { key: "scene", label: "メールの目的", placeholder: "例：初回アプローチ" },
      { key: "recipient", label: "送り先（役職・部門）", placeholder: "例：経営企画部長" },
      { key: "product", label: "自社製品・サービス", placeholder: "例：AI請求書処理ツール" },
      { key: "hook", label: "差別化ポイント", placeholder: "例：月40時間の工数削減を実現" },
    ],
    buildPrompt: (f) => `営業メールを3パターン作成してください。\n目的:${f.scene}\n送り先:${f.recipient}\nサービス:${f.product}\nフック:${f.hook}\n\nA:数字訴求型 B:課題共感型 C:短文型。各パターンに件名と本文を含めてください。`,
  },
  {
    id: "script",
    label: "トークスクリプト",
    icon: "◎",
    desc: "商談の流れに沿ったトーク台本をリアルに生成",
    fields: [
      { key: "product", label: "自社製品・サービス", placeholder: "例：中小企業向け給与計算クラウド" },
      { key: "persona", label: "顧客ペルソナ", placeholder: "例：従業員30名の製造業、総務担当者" },
      { key: "objection", label: "想定される断り文句", placeholder: "例：今は予算がない" },
    ],
    buildPrompt: (f) => `商談トークスクリプトを作成してください。\nサービス:${f.product}\nペルソナ:${f.persona}\n断り文句:${f.objection}\n\n構成：1.オープニング 2.現状確認質問 3.課題深掘り 4.ソリューション提示 5.切り返し 6.クロージング\n担当者と顧客の対話形式で記載してください。`,
  },
  {
    id: "objection",
    label: "反論対応集",
    icon: "◇",
    desc: "よくある断り文句への最強の切り返しを即生成",
    fields: [
      { key: "product", label: "自社製品・サービス", placeholder: "例：月額5万円のSEOコンサル" },
      { key: "objections", label: "受けた断り文句（複数OK）", placeholder: "例：\n・高すぎる\n・他社で検討中" },
    ],
    buildPrompt: (f) => `以下の断り文句への反論処理スクリプトを作成してください。\nサービス:${f.product}\n断り文句:\n${f.objections}\n\n各断り文句に対して【共感フレーズ】【本音の仮説】【切り返しトーク】【確認クロージング】を明示してください。`,
  },
];

export default function SalesForge() {
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [fields, setFields] = useState({});
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleFieldChange = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    const prompt = activeTool.buildPrompt(fields);
    setIsLoading(true);
    setOutput("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setOutput(data.text);
      } else {
        setOutput(data.error || "エラーが発生しました");
      }
    } catch {
      setOutput("通信エラーが発生しました。再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  const allFilled = activeTool.fields
    .filter((f) => !f.label.includes("任意"))
    .every((f) => fields[f.key]?.trim());

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const switchTool = (tool) => {
    setActiveTool(tool);
    setFields({});
    setOutput("");
  };

  return (
    <div style={s.root}>
      <style>{css}</style>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <div style={s.brandIcon}>S</div>
          <div>
            <div style={s.brandName}>SalesForge</div>
            <div style={s.brandTag}>AI営業支援</div>
          </div>
        </div>
        <div style={s.sideNav}>
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => switchTool(t)} style={{...s.navItem,...(activeTool.id===t.id?s.navItemActive:{})}}>
              <span style={s.navIcon}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </aside>
      <main style={s.main}>
        <div style={s.topbar}>
          <div style={s.toolTitle}><span style={s.toolTitleIcon}>{activeTool.icon}</span>{activeTool.label}</div>
          <div style={s.toolDesc}>{activeTool.desc}</div>
        </div>
        <div style={s.content}>
          <div style={s.inputPanel}>
            <div style={s.sectionLabel}>入力情報</div>
            {activeTool.fields.map((f) => (
              <div key={f.key} style={s.fieldWrap}>
                <label style={s.fieldLabel}>{f.label}</label>
                <textarea style={s.fieldInput} placeholder={f.placeholder} value={fields[f.key]||""} onChange={(e)=>handleFieldChange(f.key,e.target.value)} rows={f.label.includes("文句")?4:2}/>
              </div>
            ))}
            <button style={{...s.genBtn,opacity:isLoading||!allFilled?0.45:1,cursor:isLoading||!allFilled?"not-allowed":"pointer"}} onClick={handleGenerate} disabled={isLoading||!allFilled}>
              {isLoading?<span style={s.loadRow}><span className="spinner" style={s.spinner}/>AIが生成中…</span>:`⚡ ${activeTool.label}を生成する`}
            </button>
          </div>
          <div style={s.outputPanel}>
            <div style={s.outputHeader}>
              <div style={s.sectionLabel}>生成結果</div>
              {output&&<button style={s.copyBtn} onClick={handleCopy}>{copied?"✓ コピー完了":"コピー"}</button>}
            </div>
            <div style={s.outputBox}>
              {isLoading?(
                <div style={s.loadingState}>
                  <div><span className="dot"/><span className="dot" style={{animationDelay:"0.15s"}}/><span className="dot" style={{animationDelay:"0.3s"}}/></div>
                  <div style={s.loadText}>AIが生成中...</div>
                </div>
              ):output?(
                <pre style={s.outputText}>{output}</pre>
              ):(
                <div style={s.emptyState}>
                  <div style={s.emptyIcon}>{activeTool.icon}</div>
                  <div style={s.emptyTitle}>左に情報を入力してください</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const css=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Noto+Sans+JP:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes dotPulse{0%,80%,100%{transform:scale(0.6);opacity:0.3;}40%{transform:scale(1);opacity:1;}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
  .spinner{animation:spin 0.75s linear infinite;}
  .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#2563eb;animation:dotPulse 1.4s ease-in-out infinite;margin:0 3px;}
`;

const s={
  root:{display:"flex",height:"100vh",background:"#f8f9fc",fontFamily:"'Noto Sans JP','DM Sans',sans-serif",color:"#1a1a2e",overflow:"hidden"},
  sidebar:{width:"220px",flexShrink:0,background:"#fff",borderRight:"1px solid #eaecf0",display:"flex",flexDirection:"column"},
  brand:{display:"flex",alignItems:"center",gap:"10px",padding:"20px 18px 16px",borderBottom:"1px solid #f0f2f5"},
  brandIcon:{width:"34px",height:"34px",borderRadius:"9px",background:"linear-gradient(135deg,#1d4ed8,#2563eb)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"16px",flexShrink:0},
  brandName:{fontWeight:700,fontSize:"15px",color:"#0f172a"},
  brandTag:{fontSize:"10px",color:"#94a3b8"},
  sideNav:{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:"2px"},
  navItem:{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"8px",border:"none",background:"transparent",color:"#64748b",fontSize:"13px",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:500,cursor:"pointer",textAlign:"left",width:"100%"},
  navItemActive:{background:"#eff6ff",color:"#1d4ed8"},
  navIcon:{fontSize:"14px",flexShrink:0},
  main:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
  topbar:{padding:"20px 28px 16px",borderBottom:"1px solid #eaecf0",background:"#fff"},
  toolTitle:{display:"flex",alignItems:"center",gap:"8px",fontWeight:700,fontSize:"18px",color:"#0f172a"},
  toolTitleIcon:{color:"#2563eb",fontSize:"16px"},
  toolDesc:{fontSize:"12px",color:"#94a3b8",marginTop:"3px"},
  content:{flex:1,display:"flex",overflow:"hidden"},
  inputPanel:{width:"380px",flexShrink:0,borderRight:"1px solid #eaecf0",padding:"20px",overflowY:"auto",background:"#fff",display:"flex",flexDirection:"column",gap:"14px"},
  sectionLabel:{fontSize:"10px",fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"1px"},
  fieldWrap:{display:"flex",flexDirection:"column",gap:"5px"},
  fieldLabel:{fontSize:"12px",fontWeight:600,color:"#374151"},
  fieldInput:{width:"100%",padding:"10px 12px",borderRadius:"8px",border:"1px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:"12.5px",fontFamily:"'Noto Sans JP',sans-serif",lineHeight:1.7,resize:"vertical"},
  genBtn:{width:"100%",padding:"13px",borderRadius:"10px",border:"none",background:"linear-gradient(135deg,#1d4ed8,#2563eb)",color:"#fff",fontSize:"13.5px",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 14px rgba(37,99,235,0.25)"},
  loadRow:{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"},
  spinner:{width:"14px",height:"14px",border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid #fff",borderRadius:"50%",display:"inline-block"},
  outputPanel:{flex:1,display:"flex",flexDirection:"column",padding:"20px 24px",gap:"12px",overflow:"hidden"},
  outputHeader:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  copyBtn:{padding:"6px 14px",borderRadius:"6px",border:"1px solid #e2e8f0",background:"#fff",color:"#475569",fontSize:"12px",fontWeight:600,cursor:"pointer"},
  outputBox:{flex:1,borderRadius:"12px",border:"1px solid #eaecf0",background:"#fff",overflow:"auto",padding:"20px"},
  outputText:{fontSize:"13px",lineHeight:1.85,color:"#1e293b",whiteSpace:"pre-wrap",fontFamily:"'Noto Sans JP',sans-serif",animation:"fadeUp 0.35s ease"},
  emptyState:{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"10px"},
  emptyIcon:{fontSize:"40px",color:"#cbd5e1"},
  emptyTitle:{fontSize:"14px",fontWeight:600,color:"#94a3b8"},
  loadingState:{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"14px"},
  loadText:{fontSize:"12px",color:"#94a3b8"},
};
