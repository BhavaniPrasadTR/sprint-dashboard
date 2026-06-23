import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend
} from "recharts";

// ── THEME CSS — injected into <style> and toggled via data-theme on <html> ─────
const THEME_CSS = `
  :root[data-theme="dark"] {
    --bg:      #0A0E1A; --surface: #111827; --surfaceM:#1A2235;
    --border:  #1F2D45; --text:    #F0F4FF; --muted:   #6B7FA8; --dim:#3A4A6B;
    --tab-inactive:#6B7FA8; --tab-active:#818CF8; --tab-border:#818CF8;
    --nav-bg:  #111827; --nav-border:#1F2D45;
    --committed-bar:#1F2D45;
    --hero-bg: linear-gradient(135deg,#0F1535 0%,#1A0B2E 100%);
    --tt-bg:   #1A2235; --tt-text:#F0F4FF; --tt-muted:#6B7FA8; --tt-border:#1F2D45;
    --grid:    #1F2D45; --axis:    #6B7FA8;
    --toggle-track:#4F46E5;
  }
  :root[data-theme="light"] {
    --bg:      #F4F6FA; --surface: #FFFFFF; --surfaceM:#F0F4FB;
    --border:  #DDE5F4; --text:    #0A0F1E; --muted:   #111827; --dim:#A0AEC0;
    --tab-inactive:#111827; --tab-active:#1D4ED8; --tab-border:#1D4ED8;
    --nav-bg:  #FFFFFF; --nav-border:#DDE5F4;
    --committed-bar:#DDE5F4;
    --hero-bg: linear-gradient(135deg,#1E3A8A 0%,#1E1B4B 60%,#312E81 100%);
    --tt-bg:   #FFFFFF; --tt-text:#0A0F1E; --tt-muted:#374151; --tt-border:#DDE5F4;
    --grid:    #E8EFF8; --axis:    #64748B;
    --toggle-track:#CBD5E1;
  }
  * { box-sizing:border-box; }
  body { margin:0; transition:background .25s; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes spin  { to { transform:rotate(360deg); } }
`;

// ── ACCENT COLOURS — solid hex, readable in both themes ───────────────────────
const C = {
  // Layout (use CSS vars in JSX via "var(--xxx)")
  bg:      "var(--bg)",      surface: "var(--surface)", surfaceM:"var(--surfaceM)",
  border:  "var(--border)",  text:    "var(--text)",     muted:   "var(--muted)",
  dim:     "var(--dim)",
  // Accents — solid values used directly in recharts (can't read CSS vars from SVG)
  violet:  "#1D4ED8",  violetD: "#1D4ED8",
  cyan:    "#0891B2",  cyanD:   "#0891B2",
  amber:   "#D97706",
  emerald: "#059669",  emeraldD:"#059669",
  rose:    "#DC2626",  roseD:   "#DC2626",
  sky:     "#0284C7",
  // Chart committed-bar colour function (needs isDark context)
  committedBar: (isDark) => isDark ? "#1F2D45" : "#DDE5F4",
};

// Theme-aware tooltip style for recharts (SVG can't read CSS vars)
function getTT(isDark) {
  return {
    contentStyle:{
      background:  isDark ? "#1C2A42" : "#FFFFFF",
      border:      `1px solid ${isDark ? "#2D4060" : "#C8D5EC"}`,
      borderRadius:10, fontSize:12,
      color:       isDark ? "#F0F4FF" : "#0A0F1E",
      boxShadow:   isDark ? "0 8px 24px rgba(0,0,0,.5)" : "0 8px 24px rgba(0,0,0,.12)",
      padding:     "10px 14px", minWidth:160
    },
    labelStyle:{ color: isDark ? "#94A3B8" : "#374151", fontWeight:700, marginBottom:6, fontSize:11 },
    itemStyle:{ color: isDark ? "#F0F4FF" : "#0A0F1E", fontWeight:600 },
    cursor:{ stroke: isDark ? "#2D4060" : "#C8D5EC", strokeWidth:1 }
  };
}

// Theme-aware grid/axis colours for recharts
function getGA(isDark) {
  return {
    grid: isDark ? "#1F2D45" : "#E8EFF8",
    axis: isDark ? "#6B7FA8" : "#64748B",
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const f0  = n => (n == null || n === "") ? "—" : Math.round(Number(n)).toLocaleString();
const f1  = n => (n == null || n === "") ? "—" : Number(n).toFixed(1);
const pct = n => (n == null || n === "") ? "—" : `${(Number(n) * 100).toFixed(1)}%`;
const QUAL= n => n < 0.25 ? C.emerald : n < 0.4 ? C.amber : C.rose;
// tt is now getTT(isDark) — see above

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
function Card({ children, style, glow }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: "20px 22px", position: "relative", overflow: "hidden",
      ...(glow && { boxShadow: `0 0 40px ${glow}18` }), ...style
    }}>
      {children}
    </div>
  );
}
function Label({ children, color }) {
  return <div style={{ fontSize:10, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:color||C.muted, marginBottom:6 }}>{children}</div>;
}
function Big({ value, unit, color }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
      <span style={{ fontSize:32, fontWeight:800, letterSpacing:"-1px", color:color||C.text, lineHeight:1 }}>{value}</span>
      {unit && <span style={{ fontSize:13, color:C.muted, fontWeight:500 }}>{unit}</span>}
    </div>
  );
}
function Delta({ val, good="up", label }) {
  if (val == null) return null;
  const up    = good === "up" ? val > 0 : val < 0;
  const color = val === 0 ? C.dim : up ? C.emerald : C.rose;
  return (
    <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:4 }}>
      <span style={{ fontSize:11, fontWeight:700, color }}>{val>0?"▲":"▼"} {Math.abs(+(val*100).toFixed(1))}%</span>
      {label && <span style={{ fontSize:11, color:C.muted }}>{label}</span>}
    </div>
  );
}
function Pill({ label, color }) {
  return <span style={{ fontSize:10, fontWeight:700, background:color+"22", color, borderRadius:20, padding:"3px 9px", border:`1px solid ${color}44` }}>{label}</span>;
}
function Bar2({ val, total, color, h=6 }) {
  const w = total > 0 ? Math.min(100, val/total*100) : 0;
  return (
    <div style={{ height:h, background:"var(--border)", borderRadius:h, overflow:"hidden" }}>
      <div style={{ width:`${w}%`, height:"100%", background:color, borderRadius:h, transition:"width .6s ease" }} />
    </div>
  );
}
function SectionHead({ children, sub }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{children}</div>
      {sub && <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ── LOADING SCREEN ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"80vh", gap:20 }}>
      <div style={{ width:48, height:48, borderRadius:"50%", border:`3px solid ${C.border}`, borderTopColor:C.violet, animation:"spin 1s linear infinite" }} />
      <div style={{ fontSize:14, color:C.muted }}>Loading live data...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── ERROR SCREEN ──────────────────────────────────────────────────────────────
function ErrorScreen({ message }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"80vh", gap:16 }}>
      <div style={{ fontSize:32 }}>⚠</div>
      <div style={{ fontSize:16, fontWeight:700, color:C.rose }}>Failed to load data</div>
      <div style={{ fontSize:13, color:C.muted, maxWidth:400, textAlign:"center" }}>{message}</div>
    </div>
  );
}


// ── THEME TOGGLE ──────────────────────────────────────────────────────────────
function ThemeToggle({ isDark, onToggle }) {
  return (
    <button onClick={onToggle} title={isDark?"Switch to light mode":"Switch to dark mode"}
      style={{ display:"flex", alignItems:"center", gap:8,
        background:"transparent", border:"1px solid var(--border)",
        borderRadius:22, padding:"5px 12px", cursor:"pointer",
        color:"var(--text)", fontSize:11, fontWeight:600,
        transition:"all .2s", fontFamily:"inherit" }}>
      <div style={{ width:32, height:17, borderRadius:9,
        background: isDark?"#4F46E5":"#CBD5E1",
        position:"relative", transition:"background .25s", flexShrink:0 }}>
        <div style={{ position:"absolute", top:2,
          left: isDark?17:2, width:13, height:13,
          borderRadius:"50%", background:"#fff",
          transition:"left .25s", boxShadow:"0 1px 3px rgba(0,0,0,.3)" }} />
      </div>
      <span>{isDark?"🌙 Dark":"☀️ Light"}</span>
    </button>
  );
}
// ── CUSTOM TOOLTIP COMPONENTS ────────────────────────────────────────────────
function VelocityTooltip({ active, payload, label, isDark }) {
  if (!active || !payload || !payload.length) return null;
  const bg      = isDark ? "#1C2A42" : "#FFFFFF";
  const border  = isDark ? "#2D4060" : "#C8D5EC";
  const textCol = isDark ? "#F0F4FF" : "#0A0F1E";
  const mutedCol= isDark ? "#94A3B8" : "#6B7280";
  const dotCol  = (name) => name === "Committed SP"
    ? (isDark ? "#4A6090" : "#94A3B8")  // readable dot for committed
    : null;
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:10,
      padding:"10px 14px", minWidth:170,
      boxShadow:isDark?"0 8px 24px rgba(0,0,0,.5)":"0 8px 24px rgba(0,0,0,.12)",
      fontSize:12 }}>
      <div style={{ color:mutedCol, fontWeight:700, marginBottom:8, fontSize:11 }}>
        Sprint {label}
      </div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", gap:24, marginBottom:i<payload.length-1?5:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <div style={{ width:10, height:10, borderRadius:2,
              background:dotCol(entry.name)||entry.color, flexShrink:0 }} />
            <span style={{ color:mutedCol, fontWeight:500 }}>{entry.name}</span>
          </div>
          <span style={{ color:textCol, fontWeight:700 }}>
            {Number(entry.value).toLocaleString()} SP
          </span>
        </div>
      ))}
    </div>
  );
}

function DefectTooltip({ active, payload, label, isDark }) {
  if (!active || !payload || !payload.length) return null;
  const bg      = isDark ? "#1C2A42" : "#FFFFFF";
  const border  = isDark ? "#2D4060" : "#C8D5EC";
  const textCol = isDark ? "#F0F4FF" : "#0A0F1E";
  const mutedCol= isDark ? "#94A3B8" : "#6B7280";
  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:10,
      padding:"10px 14px", minWidth:185,
      boxShadow:isDark?"0 8px 24px rgba(0,0,0,.5)":"0 8px 24px rgba(0,0,0,.12)",
      fontSize:12 }}>
      <div style={{ color:mutedCol, fontWeight:700, marginBottom:8, fontSize:11 }}>
        Sprint {label}
      </div>
      {payload.map((entry, i) => {
        const isBug = entry.name === "Bug count";
        const val   = isBug ? `${entry.value} bugs` : `${Number(entry.value).toFixed(1)}%`;
        const dd    = entry.payload && entry.payload.dd;
        const dot   = isBug
          ? (dd < 0.25 ? "#059669" : dd < 0.4 ? "#D97706" : "#DC2626")
          : (isDark ? "#94A3B8" : "#475569");
        return (
          <div key={i} style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", gap:24, marginBottom:i<payload.length-1?5:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:10, height:10, borderRadius:isBug?2:10,
                background:dot, flexShrink:0 }} />
              <span style={{ color:mutedCol, fontWeight:500 }}>{entry.name}</span>
            </div>
            <span style={{ color:textCol, fontWeight:700 }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"overview", icon:"◎", label:"Overview"  },
  { id:"velocity", icon:"⚡", label:"Velocity"  },
  { id:"quality",  icon:"⬡", label:"Quality"   },
  { id:"flow",     icon:"∿", label:"Flow"      },
  { id:"teams",    icon:"◈", label:"Teams"     },
];

// ── PAGE: OVERVIEW ────────────────────────────────────────────────────────────
function Overview({ SPRINTS, CURRENT, TEAMS, GLOBAL, isDark }) {
  const tt = getTT(isDark);
  const ga = getGA(isDark);
  const s12    = SPRINTS[SPRINTS.length - 1];
  const s11    = SPRINTS[SPRINTS.length - 2] || s12;
  const vTrend = s11.vel ? (s12.vel - s11.vel) / s11.vel : 0;
  const l5     = SPRINTS.slice(-5).reduce((a, s) => a + s.vel, 0) / Math.min(5, SPRINTS.length);

  const velData = SPRINTS.map(s => ({
    name: s.id, vel: Math.round(s.vel), comm: Math.round(s.comm),
    fill: s.cr >= 1 ? "#059669" : "#1D4ED8"
  }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Hero */}
      <div style={{ background:"linear-gradient(135deg, #0F1535 0%, #1A0B2E 100%)", border:`1px solid ${C.violetD}55`, borderRadius:16, padding:"24px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:20, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`repeating-linear-gradient(0deg, transparent, transparent 30px, ${C.violetD}08 30px, ${C.violetD}08 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, ${C.violetD}08 30px, ${C.violetD}08 31px)`, pointerEvents:"none" }} />
        <div style={{ position:"relative" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.amber, boxShadow:`0 0 8px ${C.amber}` }} />
            <span style={{ fontSize:11, fontWeight:700, color:C.amber, letterSpacing:".1em", textTransform:"uppercase" }}>
              Live · {CURRENT.daysLeft} days remaining
            </span>
          </div>
          <div style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-1px", marginBottom:4 }}>EngagementManager · 2026</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>Sprint KPI Dashboard · User Stories & Bugs · 4 Teams</div>
        </div>
        <div style={{ display:"flex", gap:32, flexWrap:"wrap", position:"relative" }}>
          {[
            { l:"Committed SP",  v:f0(CURRENT.comm),    c:C.violet  },
            { l:"Remaining SP",  v:f0(CURRENT.remSP),   c:C.rose    },
            { l:"YTD Velocity",  v:f0(GLOBAL.totalVel), c:C.emerald },
            { l:"L5 Rolling Avg",v:f0(l5),              c:C.cyan    },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:28, fontWeight:900, color:c, letterSpacing:"-1px" }}>{v}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:2, letterSpacing:".06em", textTransform:"uppercase" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12 }}>
        {[
          { label:"S12 Velocity",    value:f0(s12.vel),      color:C.violet,  trend:vTrend,           trendGood:"up", sub:"vs prev sprint" },
          { label:"S12 Completion",  value:pct(s12.cr),      color:s12.cr>=1?C.emerald:s12.cr>=0.8?C.amber:C.rose, trend:s12.cr-s11.cr, trendGood:"up", sub:"vs prev sprint" },
          { label:"L5 Avg Velocity", value:f0(l5),            color:C.cyan,    trend:null,             sub:"rolling 5 sprints" },
          { label:"YTD Throughput",  value:f0(GLOBAL.totalThru), color:C.sky, trend:null,             sub:"all sprints" },
          { label:"WIP · Now",       value:f0(CURRENT.wip),  color:CURRENT.wip>150?C.rose:C.amber, trend:null, sub:"active items" },
          { label:"Stale · Now",     value:f0(CURRENT.stale),color:C.rose,    trend:null,             sub:">5 days idle" },
          { label:"Predictability",   value:pct(s12.cr),      color:s12.cr>=0.95?"#059669":s12.cr>=0.8?"#D97706":"#DC2626", trend:null, sub:"S12 · velocity÷committed" },
        ].map(({ label, value, color, trend, trendGood, sub }) => (
          <Card key={label} glow={color}>
            <Label>{label}</Label>
            <Big value={value} color={color} />
            {trend != null ? <Delta val={trend} good={trendGood} label={sub} /> : <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{sub}</div>}
          </Card>
        ))}
      </div>

      {/* Velocity chart */}
      <Card>
        <SectionHead sub="Committed vs velocity · green = 100% delivered · L5 reference">Velocity trend — all past sprints</SectionHead>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={velData} barCategoryGap="28%" barGap={2}>
            <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
            <Tooltip content={<VelocityTooltip isDark={isDark} />} />
            <ReferenceLine y={l5} stroke={C.amber} strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value:`L5 avg ${f0(l5)}`, position:"insideTopRight", fontSize:10, fill:C.amber }} />
            <Bar dataKey="comm" name="Committed SP" fill={isDark?"#1F2D45":"#DDE5F4"} radius={[4,4,0,0]} />
            <Bar dataKey="vel"  name="Velocity SP"  radius={[4,4,0,0]}>
              {velData.map((s,i) => <Cell key={i} fill={s.fill} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Bottom row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <Card>
          <SectionHead sub="% SP delivered · 80% threshold">Completion rate</SectionHead>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={SPRINTS.slice(-8).map(s => ({ name:s.id, rate:+(s.cr*100).toFixed(1) }))}>
              <defs>
                <linearGradient id="crGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.emerald} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={C.emerald} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} unit="%" domain={[75,105]} />
              <Tooltip {...tt} formatter={v => [`${v}%`,"Completion"]} />
              <ReferenceLine y={80}  stroke={C.rose}    strokeDasharray="5 3" label={{ value:"80%",  position:"insideTopLeft",  fontSize:9, fill:C.rose    }} />
              <ReferenceLine y={100} stroke={C.emerald} strokeDasharray="5 3" label={{ value:"100%", position:"insideTopRight", fontSize:9, fill:C.emerald }} />
              <Area type="monotone" dataKey="rate" stroke={C.emerald} fill="url(#crGrad)" strokeWidth={2} dot={{ r:3, fill:C.emerald, strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHead sub="YTD velocity comparison">Team breakdown</SectionHead>
          <div style={{ display:"flex", flexDirection:"column", gap:14, marginTop:4 }}>
            {TEAMS.map(t => (
              <div key={t.name}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:t.color }} />
                    <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{t.name}</span>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:t.color }}>{f0(t.vel)} SP</span>
                    <Pill label={pct(t.cr)} color={t.cr>=0.8?C.emerald:C.rose} />
                  </div>
                </div>
                <Bar2 val={t.vel} total={TEAMS[0].vel} color={t.color} h={8} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── PAGE: VELOCITY ────────────────────────────────────────────────────────────
function VelocityPage({ SPRINTS, CURRENT, isDark }) {
  const tt = getTT(isDark);
  const ga = getGA(isDark);
  const [idx, setIdx] = useState(SPRINTS.length - 1);
  const s    = SPRINTS[idx];
  const prev = idx > 0 ? SPRINTS[idx-1] : null;
  const l5   = SPRINTS.slice(Math.max(0,idx-4), idx+1).reduce((a,x)=>a+x.vel,0) / Math.min(5,idx+1);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card style={{ padding:"14px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:600, color:C.muted, marginRight:4 }}>Sprint:</span>
          {SPRINTS.map((x,i) => (
            <button key={x.id} onClick={() => setIdx(i)} style={{
              fontSize:11, fontWeight:i===idx?700:400,
              background:i===idx?C.violetD:"transparent",
              color:i===idx?"#fff":C.muted,
              border:`1px solid ${i===idx?C.violetD:C.border}`,
              borderRadius:6, padding:"4px 10px", cursor:"pointer", transition:"all .15s"
            }}>{x.id}</button>
          ))}
        </div>
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
        {[
          { label:"Velocity",     value:f0(s.vel),  unit:"SP",    color:C.violet },
          { label:"Committed SP", value:f0(s.comm), unit:"SP",    color:C.muted  },
          { label:"Completion",   value:pct(s.cr),  unit:"",      color:s.cr>=1?C.emerald:s.cr>=0.8?C.amber:C.rose },
          { label:"Throughput",   value:f0(s.thru), unit:"items", color:C.cyan   },
        ].map(({ label, value, unit, color }) => (
          <Card key={label} glow={color} style={{ textAlign:"center" }}>
            <Label>{label}</Label>
            <Big value={value} unit={unit} color={color} />
          </Card>
        ))}
      </div>
      <Card>
        <SectionHead sub={`Selected: ${s.id} · L5 avg = ${f0(l5)} SP`}>Velocity vs committed</SectionHead>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={SPRINTS.map((x,i) => ({ name:x.id, vel:Math.round(x.vel), comm:Math.round(x.comm), highlight:i===idx }))} barCategoryGap="25%" barGap={2}>
            <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
            <Tooltip content={<VelocityTooltip isDark={isDark} />} />
            <ReferenceLine y={l5} stroke={C.amber} strokeDasharray="5 3" label={{ value:`L5 ${f0(l5)}`, position:"insideTopRight", fontSize:10, fill:C.amber }} />
            <Bar dataKey="comm" name="Committed SP" fill={isDark?"#1F2D45":"#DDE5F4"} radius={[4,4,0,0]} />
            <Bar dataKey="vel"  name="Velocity SP"  radius={[4,4,0,0]}>
              {SPRINTS.map((x,i) => <Cell key={i} fill={i===idx?"#D97706":x.cr>=1?"#059669":"#1D4ED8"} opacity={i===idx?1:0.7} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <Card>
          <SectionHead sub="Story points breakdown">SP delivery</SectionHead>
          {[
            { l:"Delivered",   v:s.vel,                    c:C.emerald },
            { l:"Undelivered", v:Math.max(0,s.comm-s.vel), c:C.rose    },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                <span style={{ color:C.muted }}>{l}</span>
                <span style={{ fontWeight:700, color:c }}>{f0(v)} SP ({f1(v/s.comm*100)}%)</span>
              </div>
              <Bar2 val={v} total={s.comm} color={c} h={10} />
            </div>
          ))}
          <div style={{ marginTop:8 }}>
            <Pill label={s.cr>=1?"✓ Fully delivered":s.cr>=0.8?"On target":"⚠ Below 80%"} color={s.cr>=1?C.emerald:s.cr>=0.8?C.amber:C.rose} />
          </div>
        </Card>
        <Card>
          <SectionHead sub="Key metrics for selected sprint">Indicators</SectionHead>
          {[
            { l:"vs L5 avg",      v:`${f1((s.vel/l5-1)*100)}%`,                      c:s.vel>l5?C.emerald:C.rose    },
            { l:"vs prev sprint", v:prev?`${f1((s.vel-prev.vel)/prev.vel*100)}%`:"—", c:prev&&s.vel>prev.vel?C.emerald:C.rose },
            { l:"Predictability Index", v:pct(s.cr),                               c:s.cr>=0.95?"#059669":s.cr>=0.8?"#D97706":"#DC2626" },
            { l:"Cycle time P50", v:`${f1(s.cy)}d`,                                   c:s.cy<=14?C.emerald:C.amber   },
            { l:"Lead time P50",  v:`${f1(s.ld)}d`,                                   c:s.ld<=14?C.emerald:C.amber   },
            { l:"User stories",   v:f0(s.us),                                         c:C.violet                      },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:12, color:C.muted }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:700, color:c }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── PAGE: QUALITY ─────────────────────────────────────────────────────────────
function QualityPage({ SPRINTS, CURRENT, isDark }) {
  const tt = getTT(isDark);
  const ga = getGA(isDark);
  const last8  = SPRINTS.slice(-8);
  const avgDD  = last8.reduce((a,s)=>a+s.dd,0)/last8.length;
  const s12    = SPRINTS[SPRINTS.length-1];
  const s11    = SPRINTS[SPRINTS.length-2] || s12;
  const qr     = d => d<0.25?{l:"Good",c:C.emerald}:d<0.4?{l:"Watch",c:C.amber}:{l:"High ⚠",c:C.rose};

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:12 }}>
        {[
          { label:"S12 Bugs",          value:f0(s12.bugs),  color:C.rose,            sub:`was ${f0(s11.bugs)} in prev` },
          { label:"S12 Defect Density",value:pct(s12.dd),   color:QUAL(s12.dd),      sub:"bugs÷closed items" },
          { label:"Avg Density L8",    value:pct(avgDD),    color:QUAL(avgDD),       sub:"8-sprint average" },
          { label:"Current Bugs",      value:f0(CURRENT.bugs), color:C.rose,         sub:"live sprint" },
          { label:"YTD Total Bugs",    value:f0(SPRINTS.reduce((a,s)=>a+s.bugs,0)), color:C.muted, sub:"all sprints" },
          { label:"Bugs Closed S12",   value:f0(s12.bc),    color:C.emerald,         sub:`${pct(s12.bc/s12.bugs)} closure rate` },
        ].map(({ label, value, color, sub }) => (
          <Card key={label} glow={color}>
            <Label>{label}</Label>
            <Big value={value} color={color} />
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{sub}</div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionHead sub="Bug count + defect density % · 20% threshold · last 10 sprints">Defect density trend</SectionHead>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={SPRINTS.slice(-10).map(s=>({ name:s.id, bugs:s.bugs, density:+(s.dd*100).toFixed(1), dd:s.dd }))}>
            <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} unit="%" domain={[0,60]} />
            <Tooltip content={<DefectTooltip isDark={isDark} />} />
            <Legend wrapperStyle={{ fontSize:11, color:ga.axis }} />
            <Bar yAxisId="l" dataKey="bugs" name="Bug count" radius={[4,4,0,0]}>
              {SPRINTS.slice(-10).map((s, i) => (
                <Cell key={i}
                  fill={s.dd < 0.25 ? "#059669" : s.dd < 0.4 ? "#D97706" : "#DC2626"}
                  opacity={0.85}
                />
              ))}
            </Bar>
            <Line yAxisId="r" dataKey="density" name="Defect density %" type="monotone" stroke={isDark?"#94A3B8":"#475569"} strokeWidth={2} dot={(props) => {
              const { cx, cy, payload } = props;
              const col = payload.dd < 0.25 ? "#059669" : payload.dd < 0.4 ? "#D97706" : "#DC2626";
              return <circle key={cx} cx={cx} cy={cy} r={5} fill={col} stroke="#fff" strokeWidth={1.5} />;
            }} />
            <ReferenceLine yAxisId="r" y={20} stroke="#059669" strokeDasharray="5 3" strokeWidth={1.5} label={{ value:"Good ≤20%", position:"insideTopRight", fontSize:9, fill:"#059669" }} />
            <ReferenceLine yAxisId="r" y={40} stroke="#D97706" strokeDasharray="5 3" strokeWidth={1.5} label={{ value:"Watch ≤40%", position:"insideBottomRight", fontSize:9, fill:"#D97706" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <SectionHead sub="Good <25% · Watch 25–40% · High >40%">Sprint quality scorecard</SectionHead>
        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          <div style={{ display:"grid", gridTemplateColumns:"50px 1fr 70px 65px 75px", gap:10, fontSize:10, fontWeight:600, color:C.dim, padding:"6px 0", letterSpacing:".06em", textTransform:"uppercase" }}>
            <span>Sprint</span><span>Density bar</span><span style={{ textAlign:"right" }}>Bugs</span><span style={{ textAlign:"right" }}>Density</span><span style={{ textAlign:"right" }}>Rating</span>
          </div>
          {last8.map(s => {
            const r = qr(s.dd);
            return (
              <div key={s.id} style={{ display:"grid", gridTemplateColumns:"50px 1fr 70px 65px 75px", gap:10, alignItems:"center", padding:"10px 0", borderTop:`1px solid ${C.border}` }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.id}</span>
                <Bar2 val={s.dd*100} total={60} color={r.c} h={8} />
                <span style={{ fontSize:12, color:C.muted, textAlign:"right" }}>{f0(s.bugs)}</span>
                <span style={{ fontSize:13, fontWeight:700, color:r.c, textAlign:"right" }}>{pct(s.dd)}</span>
                <div style={{ textAlign:"right" }}><Pill label={r.l} color={r.c} /></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── PAGE: FLOW ────────────────────────────────────────────────────────────────
function FlowPage({ SPRINTS, CURRENT, isDark }) {
  const tt = getTT(isDark);
  const ga = getGA(isDark);
  const fd  = SPRINTS.slice(-10).map(s => ({ name:s.id, cycle:s.cy, lead:s.ld, eff:+(s.cy/s.ld*100).toFixed(1) }));
  const s12 = SPRINTS[SPRINTS.length-1];
  const s11 = SPRINTS[SPRINTS.length-2] || s12;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:12 }}>
        {[
          { label:"Cycle P50 S12",      value:`${f1(s12.cy)}d`, color:s12.cy<=14?C.emerald:C.amber, sub:`was ${f1(s11.cy)}d prev` },
          { label:"Lead P50 S12",       value:`${f1(s12.ld)}d`, color:s12.ld<=14?C.emerald:C.amber, sub:`was ${f1(s11.ld)}d prev` },
          { label:"Flow Efficiency S12",value:`${f1(s12.cy/s12.ld*100)}%`, color:C.cyan, sub:"cycle÷lead time" },
          { label:"WIP · Now",          value:f0(CURRENT.wip),  color:CURRENT.wip>150?C.rose:C.amber, sub:"active items" },
          { label:"Stale · Now",        value:f0(CURRENT.stale),color:C.rose,  sub:">5 days no change" },
          { label:"Open Items · Now",   value:f0(CURRENT.open), color:C.muted, sub:"New + Active + Ready" },
        ].map(({ label, value, color, sub }) => (
          <Card key={label} glow={color}>
            <Label>{label}</Label>
            <Big value={value} color={color} />
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{sub}</div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionHead sub="P50 median · 14d target line · last 10 sprints">Cycle time vs lead time</SectionHead>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={fd}>
            <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} unit="d" domain={[0,35]} />
            <Tooltip {...tt} formatter={(v,n) => [v?`${f1(v)}d`:"—",n]} />
            <Legend wrapperStyle={{ fontSize:11, color:ga.axis }} />
            <ReferenceLine y={14} stroke={C.emerald} strokeDasharray="5 3" label={{ value:"14d target", position:"insideTopRight", fontSize:9, fill:C.emerald }} />
            <Line type="monotone" dataKey="cycle" name="Cycle Time P50" stroke={C.amber}  strokeWidth={2.5} dot={{ r:4, fill:C.amber,  strokeWidth:0 }} />
            <Line type="monotone" dataKey="lead"  name="Lead Time P50"  stroke={C.violet} strokeWidth={2}   dot={{ r:4, fill:C.violet, strokeWidth:0 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <Card>
          <SectionHead sub="Cycle÷Lead · healthy 15–40%">Flow efficiency</SectionHead>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={fd}>
              <defs>
                <linearGradient id="effG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.cyan} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={C.cyan} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} unit="%" domain={[0,80]} />
              <Tooltip {...tt} formatter={v=>[`${f1(v)}%`,"Flow Efficiency"]} />
              <ReferenceLine y={15} stroke={C.rose}    strokeDasharray="4 3" label={{ value:"15%", position:"insideTopRight", fontSize:9, fill:C.rose    }} />
              <ReferenceLine y={40} stroke={C.emerald} strokeDasharray="4 3" label={{ value:"40%", position:"insideTopRight", fontSize:9, fill:C.emerald }} />
              <Area type="monotone" dataKey="eff" stroke={C.cyan} fill="url(#effG)" strokeWidth={2} dot={{ r:3, fill:C.cyan, strokeWidth:0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHead sub="User stories vs bugs closed · last 10 sprints">Throughput mix</SectionHead>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={SPRINTS.slice(-10).map(s=>({ name:s.id, stories:s.thru-s.bugs, bugs:s.bugs }))} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize:11, color:ga.axis }} />
              <Bar dataKey="stories" name="User Stories" stackId="a" fill={C.violet} />
              <Bar dataKey="bugs"    name="Bugs"         stackId="a" fill={C.rose}   radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ── PAGE: TEAMS ───────────────────────────────────────────────────────────────
function TeamsPage({ TEAMS, SPRINTS, isDark }) {
  const tt = getTT(isDark);
  const ga = getGA(isDark);
  const [active, setActive] = useState(null);
  const totalVel = TEAMS.reduce((a,t)=>a+t.vel,0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <span style={{ fontSize:11, color:C.muted, fontWeight:600 }}>Filter:</span>
        <button onClick={() => setActive(null)} style={{ fontSize:11, fontWeight:!active?700:400, background:!active?C.violetD:"transparent", color:!active?"#fff":C.muted, border:`1px solid ${!active?C.violetD:C.border}`, borderRadius:6, padding:"4px 12px", cursor:"pointer" }}>All Teams</button>
        {TEAMS.map(t => (
          <button key={t.name} onClick={() => setActive(active===t.name?null:t.name)} style={{
            fontSize:11, fontWeight:active===t.name?700:400,
            background:active===t.name?t.color+"22":"transparent",
            color:active===t.name?t.color:C.muted,
            border:`1px solid ${active===t.name?t.color:C.border}`,
            borderRadius:6, padding:"4px 12px", cursor:"pointer", transition:"all .15s"
          }}>{t.name}</button>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14 }}>
        {TEAMS.filter(t => !active || t.name===active).map(t => (
          <Card key={t.name} glow={t.color} style={{ cursor:"pointer", border:`1px solid ${active===t.name?t.color:C.border}` }} onClick={() => setActive(active===t.name?null:t.name)}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:t.color, boxShadow:`0 0 8px ${t.color}` }} />
                <span style={{ fontSize:16, fontWeight:800, color:C.text }}>{t.name}</span>
              </div>
              <Pill label={pct(t.cr)} color={t.cr>=0.8?C.emerald:C.rose} />
            </div>
            {[
              { l:"Velocity",     v:f0(t.vel),             c:t.color   },
              { l:"Committed SP", v:f0(t.comm),            c:C.muted   },
              { l:"Throughput",   v:`${f0(t.thru)} items`, c:C.muted   },
              { l:"Bugs",         v:f0(t.bugs),            c:C.rose    },
              { l:"Bugs Closed",  v:f0(t.bugsClosed),      c:C.emerald },
              { l:"WIP",          v:f0(t.wip),             c:C.amber   },
              { l:"Stale Items",  v:f0(t.stale),           c:C.rose    },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                <span style={{ fontSize:12, fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop:12 }}>
              <Bar2 val={t.vel} total={totalVel} color={t.color} h={6} />
              <div style={{ fontSize:10, color:C.dim, marginTop:4 }}>{f1(t.vel/totalVel*100)}% of total velocity</div>
            </div>
          </Card>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <Card>
          <SectionHead sub="YTD velocity share by team">Velocity distribution</SectionHead>
          {TEAMS.map(t => (
            <div key={t.name} style={{ marginBottom:14, opacity:!active||active===t.name?1:0.3, transition:"opacity .2s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:t.color }} />
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{t.name}</span>
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:t.color }}>{f0(t.vel)} SP · {f1(t.vel/totalVel*100)}%</span>
              </div>
              <Bar2 val={t.vel} total={totalVel} color={t.color} h={10} />
            </div>
          ))}
        </Card>
        <Card>
          <SectionHead sub="Bug load by team">Bug comparison</SectionHead>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={TEAMS.map(t => ({ name:t.name, bugs:t.bugs, closed:t.bugsClosed }))} layout="vertical">
              <CartesianGrid strokeDasharray="4 4" stroke={ga.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize:10, fill:ga.axis }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:"var(--text)" }} axisLine={false} tickLine={false} width={70} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize:11, color:ga.axis }} />
              <Bar dataKey="bugs"   name="Total Bugs"  fill={C.rose}    opacity={0.7} radius={[0,4,4,0]} />
              <Bar dataKey="closed" name="Bugs Closed" fill={C.emerald} opacity={0.9} radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,      setTab]      = useState("overview");
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [isDark,   setIsDark]   = useState(true);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    document.body.style.background = isDark ? "#0A0E1A" : "#F4F6FA";
  }, [isDark]);

  // Load data.json on every page visit
  useEffect(() => {
    fetch(`${process.env.PUBLIC_URL}/data.json?t=${Date.now()}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", background:"var(--bg)", minHeight:"100vh", color:"var(--text)" }}>
      <style>{THEME_CSS}</style>
      <LoadingScreen />
    </div>
  );

  if (error) return (
    <div style={{ fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", background:"var(--bg)", minHeight:"100vh", color:"var(--text)" }}>
      <style>{THEME_CSS}</style>
      <ErrorScreen message={error} />
    </div>
  );

  const { sprints: SPRINTS, current: CURRENT, teams: TEAMS, global: GLOBAL } = data;

  const lastRefreshed = new Date(data.lastRefreshed).toLocaleString("en-US", {
    month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"
  });

  return (
    <div style={{ fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", background:"var(--bg)", minHeight:"100vh", color:"var(--text)", transition:"background .25s" }}>
      <style>{THEME_CSS}</style>

      {/* Top navigation */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"0 24px", display:"flex", alignItems:"stretch", position:"sticky", top:0, zIndex:30, transition:"background .25s", minHeight:60 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:20, borderRight:"1px solid var(--border)", marginRight:4, paddingTop:4, paddingBottom:4 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${C.violetD}, ${C.cyanD})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff" }}>EM</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:"var(--text)", lineHeight:1.2 }}>EngagementManager</div>
            <div style={{ fontSize:10, color:"var(--muted)" }}>Sprint Intelligence · 2026</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"stretch", flex:1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              border:"none", background:"none", cursor:"pointer",
              padding:"0 16px", display:"flex", alignItems:"center", gap:7,
              fontSize:13, fontWeight:tab===t.id?700:600,
              color:tab===t.id?"var(--tab-active)":"var(--tab-inactive)",
              borderBottom:tab===t.id?"2px solid var(--tab-border)":"2px solid transparent",
              transition:"all .15s", overflow:"hidden"
            }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, paddingLeft:16, borderLeft:"1px solid var(--border)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#D97706", animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:11, fontWeight:700, color:"#D97706" }}>Live</span>
          </div>
          <div style={{ fontSize:11, color:"var(--muted)" }}>Updated {lastRefreshed}</div>
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(d => !d)} />
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding:"22px 24px 60px", maxWidth:1400, margin:"0 auto" }}>
        {tab==="overview" && <Overview  SPRINTS={SPRINTS} CURRENT={CURRENT} TEAMS={TEAMS} GLOBAL={GLOBAL} isDark={isDark} />}
        {tab==="velocity" && <VelocityPage SPRINTS={SPRINTS} CURRENT={CURRENT} isDark={isDark} />}
        {tab==="quality"  && <QualityPage  SPRINTS={SPRINTS} CURRENT={CURRENT} isDark={isDark} />}
        {tab==="flow"     && <FlowPage     SPRINTS={SPRINTS} CURRENT={CURRENT} isDark={isDark} />}
        {tab==="teams"    && <TeamsPage    TEAMS={TEAMS}     SPRINTS={SPRINTS} isDark={isDark} />}
      </div>
    </div>
  );
}