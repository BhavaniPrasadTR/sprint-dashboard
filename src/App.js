import React, { useState, useEffect } from "react";
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


// ── INFOTIP — modern ⓘ icon with portal-style tooltip (no card overflow) ─────
function InfoTip({ title, body, formula }) {
  const [pos, setPos]     = React.useState(null);
  const btnRef            = React.useRef(null);

  function open() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      // anchor to bottom-left of the icon; clamp so it never goes off-screen
      x: Math.min(r.left, window.innerWidth - 236),
      y: r.bottom + 6,
    });
  }
  function close() { setPos(null); }

  return (
    <>
      {/* Icon — SVG circle-question used by Linear / Notion / Figma */}
      <span
        ref={btnRef}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        tabIndex={0}
        aria-label={title}
        style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
          cursor:"help", flexShrink:0, verticalAlign:"middle", outline:"none",
          opacity:.55, transition:"opacity .15s" }}
        onMouseOver={e => e.currentTarget.style.opacity = 1}
        onMouseOut={e  => e.currentTarget.style.opacity = .55}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
          xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7.25 6.5C7.25 6.09 7.58 5.75 8 5.75C8.42 5.75 8.75 6.09 8.75 6.5
            C8.75 6.78 8.59 7.03 8.35 7.16L8 7.35V8.5" stroke="currentColor"
            strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="8" cy="10.5" r=".7" fill="currentColor"/>
        </svg>
      </span>
      {/* Portal-style popup — rendered at document root, never clipped by cards */}
      {pos && (
        <div
          style={{
            position:"fixed", left:pos.x, top:pos.y,
            width:228, zIndex:9999,
            background:"var(--surface)",
            border:"1px solid var(--border)",
            borderRadius:10, padding:"11px 14px",
            boxShadow:"0 4px 20px rgba(0,0,0,.15)",
            pointerEvents:"none",
          }}
        >
          <div style={{ fontSize:12, fontWeight:600, color:"var(--text)",
            marginBottom:5, lineHeight:1.4 }}>{title}</div>
          <div style={{ fontSize:11, fontWeight:400, color:"var(--muted)",
            lineHeight:1.55 }}>{body}</div>
          {formula && (
            <div style={{ marginTop:7, display:"inline-block",
              fontSize:10, fontWeight:500, color:C.cyan,
              background:isDarkMode()?"#0C1E30":"#EFF6FF",
              borderRadius:4, padding:"2px 8px", fontFamily:"monospace",
              letterSpacing:".02em" }}>{formula}</div>
          )}
        </div>
      )}
    </>
  );
}
function isDarkMode() {
  return document.documentElement.getAttribute("data-theme") === "dark";
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
  const liveDaysLeft = (() => {
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const S01 = new Date("2025-12-31");
      const lastNum = SPRINTS.length > 0 ? parseInt(SPRINTS[SPRINTS.length-1].id.replace("S",""),10) : 12;
      const currNum = lastNum + 1;
      const sprintStart = new Date(S01); sprintStart.setDate(S01.getDate()+(currNum-1)*14);
      const sprintEnd = new Date(sprintStart); sprintEnd.setDate(sprintStart.getDate()+13);
      sprintEnd.setHours(23,59,59,999);
      if (today > sprintEnd) return 0;
      let count=0; const d=new Date(today);
      while(d<=sprintEnd){if(d.getDay()!==0&&d.getDay()!==6)count++;d.setDate(d.getDate()+1);}
      return count;
    } catch(e){return CURRENT.daysLeft||0;}
  })();
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
              Live · {liveDaysLeft} days remaining
            </span>
          </div>
          <div style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-1px", marginBottom:4 }}>Engagement Manager · 2026</div>
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
          { label:"S12 Velocity",    value:f0(s12.vel),      color:C.violet,  trend:vTrend,           trendGood:"up", sub:"vs prev sprint", tip:{ title:"Velocity", body:"Total story points delivered and accepted in Sprint 12. Higher means more work completed.", formula:"Σ closed SP in sprint" } },
          { label:"S12 Completion",  value:pct(s12.cr),      color:s12.cr>=1?C.emerald:s12.cr>=0.8?C.amber:C.rose, trend:s12.cr-s11.cr, trendGood:"up", sub:"vs prev sprint", tip:{ title:"Sprint completion rate", body:"Percentage of committed story points actually delivered. 95% or above is excellent. Below 80% needs attention.", formula:"Velocity ÷ Committed SP" } },
          { label:"L5 Avg Velocity", value:f0(l5),            color:C.cyan,    trend:null,             sub:"rolling 5 sprints", tip:{ title:"Rolling 5-sprint average", body:"Average velocity over the last 5 sprints. A stable predictor of how much the team can deliver per sprint.", formula:"Avg(SP last 5 sprints)" } },
          { label:"YTD Throughput",  value:f0(GLOBAL.totalThru), color:C.sky, trend:null,             sub:"all sprints", tip:{ title:"YTD throughput", body:"Total User Stories and Bugs closed across all sprints this year. Measures overall output volume.", formula:"Σ closed items YTD" } },
          { label:"WIP · Now",       value:f0(CURRENT.wip),  color:CURRENT.wip>150?C.rose:C.amber, trend:null, sub:"active items", tip:{ title:"Work in progress", body:"Items currently in Active state. High WIP slows delivery. Finish before starting new work. Target below 150.", formula:"Count of Active items" } },
          { label:"Stale · Now",     value:f0(CURRENT.stale),color:C.rose,    trend:null,             sub:">5 days idle", tip:{ title:"Stale items", body:"Active items with no state change in more than 5 working days. May indicate blockers or forgotten work.", formula:"Active items with no update over 5 days" } },
          { label:"Predictability",   value:pct(s12.cr),      color:s12.cr>=0.95?"#059669":s12.cr>=0.8?"#D97706":"#DC2626", trend:null, sub:"S12 · velocity÷committed", tip:{ title:"Predictability index", body:"How consistently the team delivers what they commit to. 95% or above means forecasts are reliable for planning.", formula:"Velocity ÷ Committed SP" } },
        ].map(({ label, value, color, trend, trendGood, sub, tip }) => (
          <Card key={label} glow={color}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
              <Label>{label}</Label>
              {tip && <InfoTip title={tip.title} body={tip.body} formula={tip.formula} />}
            </div>
            <Big value={value} color={color} />
            {trend != null ? <Delta val={trend} good={trendGood} label={sub} /> : <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{sub}</div>}
          </Card>
        ))}
      </div>

      {/* Velocity chart */}
      <Card>
        <SectionHead sub="Committed vs velocity · green = 100% delivered · L5 reference">Velocity trend — all past sprints <InfoTip title="Velocity trend" body="Each sprint shows committed SP (grey) vs delivered (coloured). Green bars mean 100% delivered. The amber dashed line is the L5 rolling average — your expected capacity per sprint." /></SectionHead>
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
          <SectionHead sub="% SP delivered · 80% threshold">Completion rate <InfoTip title="Completion rate" body="Percentage of committed story points delivered per sprint. 100% means everything promised was delivered. The red line marks the 80% minimum target." formula="Velocity ÷ Committed SP × 100" /></SectionHead>
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
          <SectionHead sub="YTD velocity comparison">Team breakdown <InfoTip title="Team velocity share" body="Year-to-date story points delivered by each team. Longer bar means more delivery. Use this to balance workload planning across teams." /></SectionHead>
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
        <SectionHead sub={`Selected: ${s.id} · L5 avg = ${f0(l5)} SP`}>Velocity vs committed <InfoTip title="Velocity vs committed" body="What the team committed to (grey bars) vs what they actually delivered (coloured) per sprint. The highlighted bar is the selected sprint." /></SectionHead>
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
          <SectionHead sub="Story points breakdown">SP delivery <InfoTip title="SP delivery breakdown" body="How the selected sprint's committed story points split between delivered (green) and undelivered (red). Aim for the green bar to reach 100%." /></SectionHead>
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
          <SectionHead sub="Key metrics for selected sprint">Indicators <InfoTip title="Sprint indicators" body="Key performance metrics for the selected sprint. Hover each row label for a plain-English explanation of what it measures and what a good result looks like." /></SectionHead>
          {[
            { l:"vs L5 avg",      v:`${f1((s.vel/l5-1)*100)}%`,                      c:s.vel>l5?C.emerald:C.rose,    tip:{ title:"vs L5 average", body:"How this sprint compares to the 5-sprint rolling average. Positive means above trend, negative means below." } },
            { l:"vs prev sprint", v:prev?`${f1((s.vel-prev.vel)/prev.vel*100)}%`:"—", c:prev&&s.vel>prev.vel?C.emerald:C.rose, tip:{ title:"vs previous sprint", body:"Velocity change compared to the immediately preceding sprint. Shows whether the team is speeding up or slowing down." } },
            { l:"Predictability Index", v:pct(s.cr),                               c:s.cr>=0.95?"#059669":s.cr>=0.8?"#D97706":"#DC2626", tip:{ title:"Predictability index", body:"How reliably the team delivered what they committed. 95% or above is excellent. Below 80% signals planning or execution issues.", formula:"Velocity ÷ Committed SP" } },
            { l:"Cycle time P50", v:`${f1(s.cy)}d`,                                   c:s.cy<=14?C.emerald:C.amber,   tip:{ title:"Median cycle time", body:"Half of all items were completed within this many days of starting work. Target is 14 days or fewer.", formula:"Median(days Active → Done)" } },
            { l:"Lead time P50",  v:`${f1(s.ld)}d`,                                   c:s.ld<=14?C.emerald:C.amber,   tip:{ title:"Median lead time", body:"Half of all items were completed within this many days of being created, including waiting time before work began.", formula:"Median(days Created → Done)" } },
            { l:"User stories",   v:f0(s.us),                                         c:C.violet,                     tip:{ title:"User stories closed", body:"Number of User Story items closed this sprint. Excludes bugs — shows pure feature delivery output." } },
          ].map(({ l, v, c, tip }) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                {tip && <InfoTip title={tip.title} body={tip.body} formula={tip.formula} />}
              </div>
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
          { label:"S12 Bugs",          value:f0(s12.bugs),  color:C.rose,            sub:`was ${f0(s11.bugs)} in prev`, tip:{ title:"Sprint bugs", body:"Total bugs closed in Sprint 12. Compare with previous sprints to spot quality trends. Fewer bugs means higher quality.", formula:"Count of Bug items closed" } },
          { label:"S12 Defect Density",value:pct(s12.dd),   color:QUAL(s12.dd),      sub:"bugs÷closed items", tip:{ title:"Defect density", body:"Bugs as a percentage of all items closed. Below 25% is healthy (green), 25–40% is a watch zone (amber), above 40% needs action (red).", formula:"Bugs ÷ Total closed items" } },
          { label:"Avg Density L8",    value:pct(avgDD),    color:QUAL(avgDD),       sub:"8-sprint average", tip:{ title:"Average defect density (L8)", body:"Mean defect density across the last 8 sprints. Shows the team's quality baseline over time and whether it is improving.", formula:"Avg(defect density, last 8 sprints)" } },
          { label:"Current Bugs",      value:f0(CURRENT.bugs), color:C.rose,         sub:"live sprint", tip:{ title:"Live bug count", body:"Bugs currently open in the active sprint. Updates on every data refresh. High live bugs may impact sprint completion rate.", formula:"Active sprint: open Bug items" } },
          { label:"YTD Total Bugs",    value:f0(SPRINTS.reduce((a,s)=>a+s.bugs,0)), color:C.muted, sub:"all sprints", tip:{ title:"YTD total bugs", body:"Total bugs raised across all completed sprints this year. Useful for understanding the overall quality trend.", formula:"Σ bugs all sprints YTD" } },
          { label:"Bugs Closed S12",   value:f0(s12.bc),    color:C.emerald,         sub:`${pct(s12.bc/s12.bugs)} closure rate`, tip:{ title:"Bugs closed", body:"Bugs resolved and closed this sprint. A closure rate above 90% means quality debt is being kept under control.", formula:"Closed bugs ÷ Total sprint bugs" } },
        ].map(({ label, value, color, sub, tip }) => (
          <Card key={label} glow={color}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
              <Label>{label}</Label>
              {tip && <InfoTip title={tip.title} body={tip.body} formula={tip.formula} />}
            </div>
            <Big value={value} color={color} />
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{sub}</div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionHead sub="Bug count + defect density % · 20% threshold · last 10 sprints">Defect density trend <InfoTip title="Defect density trend" body="Bars show bug count per sprint, colour-coded by severity — green below 25%, amber 25–40%, red above 40%. The line shows defect density percentage. 20% is the healthy target." formula="Bugs ÷ Closed items" /></SectionHead>
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
        <SectionHead sub="Good <25% · Watch 25–40% · High >40%">Sprint quality scorecard <InfoTip title="Quality scorecard" body="Each sprint rated by defect density. Green means Good (below 25%), Amber means Watch (25–40%), Red means High (above 40%). Track quality improvement sprint over sprint." /></SectionHead>
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
          { label:"Cycle P50 S12",      value:`${f1(s12.cy)}d`, color:s12.cy<=14?C.emerald:C.amber, sub:`was ${f1(s11.cy)}d prev`, tip:{ title:"Median cycle time", body:"Half of all S12 items were completed within this many days of starting work. Target is 14 days or fewer.", formula:"Median(days Active → Done)" } },
          { label:"Lead P50 S12",       value:`${f1(s12.ld)}d`, color:s12.ld<=14?C.emerald:C.amber, sub:`was ${f1(s11.ld)}d prev`, tip:{ title:"Median lead time", body:"Half of all S12 items were completed within this many days of being created, including waiting time before work began.", formula:"Median(days Created → Done)" } },
          { label:"Flow Efficiency S12",value:`${f1(s12.cy/s12.ld*100)}%`, color:C.cyan, sub:"cycle÷lead time", tip:{ title:"Flow efficiency", body:"Percentage of total lead time that items were actively being worked on. 15–40% is typical for software teams. Very high values may indicate items were rushed.", formula:"Cycle time ÷ Lead time" } },
          { label:"WIP · Now",          value:f0(CURRENT.wip),  color:CURRENT.wip>150?C.rose:C.amber, sub:"active items", tip:{ title:"Work in progress", body:"Items currently in Active state. High WIP increases context-switching and slows individual items down. Target below 150.", formula:"Count of Active items" } },
          { label:"Stale · Now",        value:f0(CURRENT.stale),color:C.rose,  sub:">5 days no change", tip:{ title:"Stale items", body:"Active items with no status change in more than 5 working days. These may be blocked or forgotten and each one needs follow-up.", formula:"Active items with no update over 5 days" } },
          { label:"Open Items · Now",   value:f0(CURRENT.open), color:C.muted, sub:"New + Active + Ready", tip:{ title:"Open items", body:"Total items not yet done — includes New (not started), Ready (queued), and Active (in progress). Shows total backlog pressure on the team.", formula:"New + Active + Ready items" } },
        ].map(({ label, value, color, sub, tip }) => (
          <Card key={label} glow={color}>
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
              <Label>{label}</Label>
              {tip && <InfoTip title={tip.title} body={tip.body} formula={tip.formula} />}
            </div>
            <Big value={value} color={color} />
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{sub}</div>
          </Card>
        ))}
      </div>
      <Card>
        <SectionHead sub="P50 median · 14d target line · last 10 sprints">Cycle time vs lead time <InfoTip title="Cycle vs lead time" body="Amber line is cycle time — days from work started to done. Violet dashed line is lead time — days from created to done, including waiting. The gap between them shows how long items wait before work begins." /></SectionHead>
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
          <SectionHead sub="Cycle÷Lead · healthy 15–40%">Flow efficiency <InfoTip title="Flow efficiency" body="Cycle time as a percentage of lead time per sprint. The healthy band is 15–40% for software teams. Very high values may indicate items were rushed through review." formula="Cycle time ÷ Lead time" /></SectionHead>
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
          <SectionHead sub="User stories vs bugs closed · last 10 sprints">Throughput mix <InfoTip title="Throughput mix" body="Items closed per sprint split by type — User Stories in blue and Bugs in red. A high bug proportion means quality issues are consuming delivery capacity." /></SectionHead>
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
function TeamsPage({ TEAMS, SPRINTS, MEMBER_STATS, isDark }) {
  const tt = getTT(isDark);
  const ga = getGA(isDark);
  const [active,       setActive]       = useState(null);
  const [activeSprint, setActiveSprint] = useState("all");
  const totalVel = TEAMS.reduce((a,t)=>a+t.vel,0);

  const sprintOptions = active
    ? [...new Set((MEMBER_STATS||[]).filter(r=>r.team===active).map(r=>r.sprint))]
        .sort((a,b)=>parseInt(b.slice(1))-parseInt(a.slice(1)))
    : [];

  const filteredStats = (MEMBER_STATS||[]).filter(r =>
    r.team === active &&
    (activeSprint === "all" || r.sprint === activeSprint)
  );

  const memberRows = (() => {
    const map = {};
    filteredStats.forEach(r => {
      if (!map[r.member]) map[r.member] = { member:r.member, items:0, sp:0, done:0, closed:0, wip:0, spill:0 };
      const m = map[r.member];
      m.items  += r.items;  m.sp    += r.sp;
      m.done   += r.done;   m.closed += r.closed;
      m.wip    += r.wip;    m.spill  += r.spill;
    });
    return Object.values(map).sort((a,b) => b.done - a.done);
  })();

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
      <div style={{ display:"grid", gridTemplateColumns:active?"280px 1fr":"repeat(4,1fr)", gap:14, alignItems:"start" }}>
        <div style={{ display:active?"flex":"contents", flexDirection:"column", gap:12 }}>
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

        {active && (
          <Card style={{ padding:"16px 20px", minHeight:320 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{active} · Member Breakdown</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                  {memberRows.length} members · {filteredStats.reduce((a,r)=>a+r.items,0)} items
                </div>
              </div>
              <select value={activeSprint} onChange={e=>setActiveSprint(e.target.value)}
                style={{ fontSize:11, background:"var(--surfaceM)", color:"var(--text)",
                  border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 10px",
                  cursor:"pointer", fontFamily:"inherit" }}>
                <option value="all">All Sprints</option>
                {sprintOptions.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 80px 80px 70px 70px 70px",
              gap:4, padding:"6px 10px", borderBottom:`2px solid ${C.border}`,
              fontSize:10, fontWeight:700, letterSpacing:".04em", textTransform:"uppercase", color:C.muted }}>
              <span>Member</span>
              <span style={{textAlign:"right"}}># Work Items</span>
              <span style={{textAlign:"right"}}>Assigned SP</span>
              <span style={{textAlign:"right",color:C.emerald}}>Completed SP</span>
              <span style={{textAlign:"right"}}># Closed</span>
              <span style={{textAlign:"right",color:C.amber}}># WIP</span>
              <span style={{textAlign:"right",color:C.rose}}># Spillover</span>
            </div>
            <div style={{ maxHeight:460, overflowY:"auto" }}>
              {memberRows.length === 0
                ? <div style={{ padding:"40px 0", textAlign:"center", color:C.muted, fontSize:12 }}>No data for this selection</div>
                : memberRows.map((m, idx) => {
                    const pct = m.sp > 0 ? m.done / m.sp : 0;
                    return (
                      <div key={m.member} style={{ display:"grid",
                        gridTemplateColumns:"1fr 70px 80px 80px 70px 70px 70px",
                        gap:4, padding:"8px 10px", alignItems:"center",
                        borderBottom:`1px solid ${C.border}`,
                        background:idx%2===0?"transparent":"var(--surfaceM)" }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:500, color:C.text,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {m.member}
                          </div>
                          <div style={{ height:3, background:C.border, borderRadius:2, marginTop:4 }}>
                            <div style={{ height:"100%", borderRadius:2, transition:"width .3s",
                              width:`${Math.min(pct*100,100)}%`,
                              background:pct>=0.9?C.emerald:pct>=0.6?C.amber:C.rose }} />
                          </div>
                        </div>
                        <span style={{textAlign:"right",fontSize:12,fontWeight:500,color:C.muted}}>{m.items}</span>
                        <span style={{textAlign:"right",fontSize:12,fontWeight:600,color:C.text}}>{m.sp>0?m.sp:"—"}</span>
                        <span style={{textAlign:"right",fontSize:13,fontWeight:700,color:m.done>0?C.emerald:C.muted}}>{m.done>0?m.done:"—"}</span>
                        <span style={{textAlign:"right",fontSize:12,fontWeight:500,color:m.closed>0?C.emerald:C.muted}}>{m.closed>0?m.closed:"—"}</span>
                        <span style={{textAlign:"right",fontSize:12,fontWeight:500,color:m.wip>0?C.amber:C.muted}}>{m.wip>0?m.wip:"—"}</span>
                        <span style={{textAlign:"right",fontSize:12,fontWeight:500,color:m.spill>0?C.rose:C.muted}}>{m.spill>0?m.spill:"—"}</span>
                      </div>
                    );
                  })
              }
            </div>
            {memberRows.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 80px 80px 70px 70px 70px",
                gap:4, padding:"8px 10px", borderTop:`2px solid ${C.border}`, marginTop:4 }}>
                <span style={{fontSize:11,fontWeight:700,color:C.muted}}>TOTAL</span>
                <span style={{textAlign:"right",fontSize:12,fontWeight:700,color:C.text}}>{memberRows.reduce((a,m)=>a+m.items,0)}</span>
                <span style={{textAlign:"right",fontSize:12,fontWeight:700,color:C.text}}>{f1(memberRows.reduce((a,m)=>a+m.sp,0))}</span>
                <span style={{textAlign:"right",fontSize:13,fontWeight:700,color:C.emerald}}>{f1(memberRows.reduce((a,m)=>a+m.done,0))}</span>
                <span style={{textAlign:"right",fontSize:12,fontWeight:700,color:C.emerald}}>{memberRows.reduce((a,m)=>a+m.closed,0)}</span>
                <span style={{textAlign:"right",fontSize:12,fontWeight:700,color:C.amber}}>{memberRows.reduce((a,m)=>a+m.wip,0)}</span>
                <span style={{textAlign:"right",fontSize:12,fontWeight:700,color:C.rose}}>{memberRows.reduce((a,m)=>a+m.spill,0)}</span>
              </div>
            )}
          </Card>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <Card>
          <SectionHead sub="YTD velocity share by team">Velocity distribution <InfoTip title="Velocity distribution" body="How total story points this year split across teams. Larger share means more delivery. Use this to understand capacity balance." /></SectionHead>
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
          <SectionHead sub="Bug load by team">Bug comparison <InfoTip title="Bug load by team" body="Total bugs raised (light bar) vs bugs closed (solid bar) per team this year. A large gap between raised and closed means a growing quality backlog for that team." /></SectionHead>
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
  const [isDark,   setIsDark]   = useState(false);

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

  const lastRefreshed = (() => {
    try {
      return new Date(data.lastRefreshed).toLocaleString(undefined, {
        month:"short", day:"numeric", hour:"2-digit", minute:"2-digit", timeZoneName:"short"
      });
    } catch(e) { return new Date(data.lastRefreshed).toLocaleString(); }
  })();

  return (
    <div style={{ fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", background:"var(--bg)", minHeight:"100vh", color:"var(--text)", transition:"background .25s" }}>
      <style>{THEME_CSS}</style>

      {/* Top navigation */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"0 24px", display:"flex", alignItems:"stretch", position:"sticky", top:0, zIndex:30, transition:"background .25s", minHeight:60 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:20, borderRight:"1px solid var(--border)", marginRight:4, paddingTop:4, paddingBottom:4 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${C.violetD}, ${C.cyanD})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff" }}>EM</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:"var(--text)", lineHeight:1.2 }}>Engagement Manager</div>
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
        {tab==="teams"    && <TeamsPage    TEAMS={TEAMS}     SPRINTS={SPRINTS} MEMBER_STATS={data.memberStats||[]} isDark={isDark} />}
      </div>
    </div>
  );
}