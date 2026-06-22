import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend
} from "recharts";

// ── LIVE DATA — pulled directly from Power BI model ───────────────────────────
const SPRINTS = [
  {n:1,id:"S01",q:"Q1",label:"Dec 31",vel:105,  comm:113,  thru:33, bugs:13,dd:0.394,cr:0.929,cy:13.3,ld:11.0,wip:0,  us:22, bc:13},
  {n:2,id:"S02",q:"Q1",label:"Jan 14",vel:150,  comm:157,  thru:55, bugs:14,dd:0.218,cr:0.955,cy:5.2, ld:8.2, wip:5,  us:48, bc:12},
  {n:3,id:"S03",q:"Q1",label:"Jan 28",vel:225,  comm:225,  thru:84, bugs:22,dd:0.262,cr:1.000,cy:8.0, ld:12.1,wip:0,  us:62, bc:22},
  {n:4,id:"S04",q:"Q1",label:"Feb 11",vel:295,  comm:295,  thru:89, bugs:21,dd:0.236,cr:1.000,cy:10.1,ld:12.7,wip:0,  us:70, bc:21},
  {n:5,id:"S05",q:"Q1",label:"Feb 25",vel:309,  comm:325,  thru:108,bugs:28,dd:0.259,cr:0.951,cy:9.6, ld:9.6, wip:0,  us:84, bc:28},
  {n:6,id:"S06",q:"Q1",label:"Mar 11",vel:333,  comm:333,  thru:80, bugs:20,dd:0.250,cr:1.000,cy:13.0,ld:15.3,wip:0,  us:60, bc:20},
  {n:7,id:"S07",q:"Q1",label:"Mar 25",vel:333,  comm:333,  thru:85, bugs:18,dd:0.188,cr:1.000,cy:18.9,ld:27.9,wip:2,  us:69, bc:16},
  {n:8,id:"S08",q:"Q2",label:"Apr 08",vel:359,  comm:377,  thru:124,bugs:36,dd:0.266,cr:0.952,cy:8.3, ld:13.3,wip:0,  us:101,bc:33},
  {n:9,id:"S09",q:"Q2",label:"Apr 22",vel:237.5,comm:256.5,thru:112,bugs:48,dd:0.429,cr:0.926,cy:5.6, ld:7.4, wip:3,  us:70, bc:48},
  {n:10,id:"S10",q:"Q2",label:"May 06",vel:391,  comm:407,  thru:163,bugs:58,dd:0.350,cr:0.961,cy:13.0,ld:13.2,wip:0,  us:108,bc:57},
  {n:11,id:"S11",q:"Q2",label:"May 20",vel:336.5,comm:336.5,thru:127,bugs:65,dd:0.512,cr:1.000,cy:12.8,ld:14.1,wip:0,  us:62, bc:65},
  {n:12,id:"S12",q:"Q2",label:"Jun 03",vel:392,  comm:395,  thru:131,bugs:45,dd:0.336,cr:0.992,cy:13.6,ld:14.8,wip:1,  us:88, bc:44},
];

const CURRENT = {
  vel:57, comm:901, remSP:844, thru:32, items:303,
  bugs:106, wip:192, open:271, stale:188,
  cr:0.063, daysLeft:7, us:197, bc:16, dd:0.5,
};

const TEAMS = [
  {name:"Falcons", vel:1201.5, comm:1615.5, thru:454, bugs:343, bugsClosed:196, wip:87,  cr:0.744, us:341, stale:197, color:"#6366F1"},
  {name:"Titans",  vel:1056.5, comm:1386.5, thru:302, bugs:73,  bugsClosed:63,  wip:51,  cr:0.762, us:307, stale:56,  color:"#06B6D4"},
  {name:"Dragons", vel:850.5,  comm:1038.5, thru:278, bugs:96,  bugsClosed:77,  wip:43,  cr:0.819, us:243, stale:29,  color:"#F59E0B"},
  {name:"Spartans",vel:414.5,  comm:528.5,  thru:189, bugs:71,  bugsClosed:59,  wip:22,  cr:0.784, us:169, stale:39,  color:"#10B981"},
];

const GLOBAL = {
  totalVel:3523, totalComm:4569, totalThru:1223,
  totalBugs:583, totalWIP:203, cr:0.771,
  stale:321, items:1643, l5:1414, avgSP:2.88,
  us:1060, daysLeft:7,
};

// ── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
// Dark command-center aesthetic — data surfaces feel like live readouts
const C = {
  bg:      "#0A0E1A",   // deep navy
  surface: "#111827",   // dark card
  surfaceM:"#1A2235",   // medium card
  border:  "#1F2D45",   // subtle border
  borderL: "#243450",   // lighter border
  text:    "#F0F4FF",   // near-white text
  muted:   "#6B7FA8",   // muted blue-grey
  dim:     "#3A4A6B",   // very dim

  violet:  "#818CF8",   // indigo-400
  violetD: "#4F46E5",   // indigo-600
  violetBg:"#1E1B4B",

  cyan:    "#22D3EE",   // cyan-400
  cyanD:   "#0891B2",
  cyanBg:  "#0C2A32",

  amber:   "#FBBF24",   // amber-400
  amberD:  "#D97706",
  amberBg: "#1C1500",

  emerald: "#34D399",   // emerald-400
  emeraldD:"#059669",
  emeraldBg:"#002E1A",

  rose:    "#F87171",   // rose-400
  roseD:   "#DC2626",
  roseBg:  "#1A0606",

  sky:     "#38BDF8",
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const f0  = n => n == null ? "—" : Math.round(n).toLocaleString();
const f1  = n => n == null ? "—" : Number(n).toFixed(1);
const pct = n => n == null ? "—" : `${(n*100).toFixed(1)}%`;
const tt  = {
  contentStyle:{ background:C.surfaceM, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11, color:C.text },
  labelStyle:{ color:C.muted },
  cursor:{ stroke:C.border }
};

const QUAL = n => n < 0.25 ? C.emerald : n < 0.4 ? C.amber : C.rose;

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────
function Card({ children, style, glow }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "20px 22px",
      position: "relative",
      overflow: "hidden",
      ...(glow && { boxShadow: `0 0 40px ${glow}18` }),
      ...style
    }}>
      {children}
    </div>
  );
}

function Label({ children, color }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color || C.muted, marginBottom: 6 }}>{children}</div>;
}

function Big({ value, unit, color }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-1px", color: color || C.text, lineHeight: 1 }}>{value}</span>
      {unit && <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>{unit}</span>}
    </div>
  );
}

function Delta({ val, good = "up", label }) {
  if (val == null) return null;
  const up = good === "up" ? val > 0 : val < 0;
  const color = val === 0 ? C.dim : up ? C.emerald : C.rose;
  const arrow = val > 0 ? "▲" : "▼";
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{arrow} {Math.abs(+(val*100).toFixed(1))}%</span>
      {label && <span style={{ fontSize: 11, color: C.muted }}>{label}</span>}
    </div>
  );
}

function Pill({ label, color }) {
  return <span style={{ fontSize: 10, fontWeight: 700, background: color + "22", color, borderRadius: 20, padding: "3px 9px", border: `1px solid ${color}44` }}>{label}</span>;
}

function Bar2({ val, total, color, h = 6 }) {
  const w = total > 0 ? Math.min(100, val / total * 100) : 0;
  return (
    <div style={{ height: h, background: C.dim + "44", borderRadius: h, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: h, transition: "width .6s ease" }} />
    </div>
  );
}

function SectionHead({ children, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{children}</div>
        {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

// ── NAV TABS ──────────────────────────────────────────────────────────────────
const TABS = [
  { id:"overview",  icon:"◎", label:"Overview"    },
  { id:"velocity",  icon:"⚡", label:"Velocity"    },
  { id:"quality",   icon:"⬡", label:"Quality"     },
  { id:"flow",      icon:"∿", label:"Flow"        },
  { id:"teams",     icon:"◈", label:"Teams"       },
];

// ── PAGE: OVERVIEW ────────────────────────────────────────────────────────────
function Overview() {
  const s12 = SPRINTS[11];
  const s11 = SPRINTS[10];
  const vTrend = (s12.vel - s11.vel) / s11.vel;
  const l5 = SPRINTS.slice(-5).reduce((a,s) => a + s.vel, 0) / 5;

  const velData = SPRINTS.map(s => ({
    name: s.id, vel: Math.round(s.vel), comm: Math.round(s.comm),
    fill: s.cr >= 1 ? C.emerald : C.violet
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Hero — S13 live status */}
      <div style={{ background: `linear-gradient(135deg, #0F1535 0%, #1A0B2E 100%)`, border: `1px solid ${C.violetD}55`, borderRadius: 16, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, position: "relative", overflow: "hidden" }}>
        {/* Background grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 30px, ${C.violetD}08 30px, ${C.violetD}08 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, ${C.violetD}08 30px, ${C.violetD}08 31px)`, pointerEvents: "none" }} />

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.amber, boxShadow: `0 0 8px ${C.amber}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: ".1em", textTransform: "uppercase" }}>Sprint 13 · Live · {CURRENT.daysLeft} days remaining</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.text, letterSpacing: "-1px", marginBottom: 4 }}>EngagementManager · 2026</div>
          <div style={{ fontSize: 13, color: C.muted }}>Jun 17 – Jun 30 · Q2 · User Stories & Bugs · 4 teams</div>
        </div>

        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", position: "relative" }}>
          {[
            { l: "Committed SP", v: f0(CURRENT.comm), c: C.violet },
            { l: "Remaining SP", v: f0(CURRENT.remSP), c: C.rose },
            { l: "YTD Velocity", v: f0(GLOBAL.totalVel), c: C.emerald },
            { l: "L5 Rolling Avg", v: f0(GLOBAL.l5/5*5), c: C.cyan },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: c, letterSpacing: "-1px" }}>{v}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: ".06em", textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
        {[
          { label:"S12 Velocity",      value:f0(s12.vel),      unit:"SP",   color:C.violet,  trend:vTrend,      trendGood:"up",   sub:"vs S11" },
          { label:"S12 Completion",    value:pct(s12.cr),      unit:"",     color:s12.cr>=1?C.emerald:s12.cr>=0.8?C.amber:C.rose, trend:s12.cr-s11.cr, trendGood:"up", sub:"vs S11" },
          { label:"L5 Avg Velocity",   value:f0(l5),           unit:"SP",   color:C.cyan,    trend:null,         sub:"rolling 5" },
          { label:"YTD Throughput",    value:f0(GLOBAL.totalThru), unit:"items", color:C.sky, trend:null,        sub:"all sprints" },
          { label:"WIP · S13",         value:f0(CURRENT.wip),  unit:"",     color:CURRENT.wip>150?C.rose:C.amber, trend:null,    sub:"active items" },
          { label:"Stale · S13",       value:f0(CURRENT.stale),unit:"",     color:C.rose,    trend:null,         sub:">5 days idle" },
        ].map(({ label, value, unit, color, trend, trendGood, sub }) => (
          <Card key={label} glow={color}>
            <Label>{label}</Label>
            <Big value={value} unit={unit} color={color} />
            {trend != null && <Delta val={trend} good={trendGood} label={sub} />}
            {trend == null && sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
          </Card>
        ))}
      </div>

      {/* Velocity chart */}
      <Card>
        <SectionHead sub="Committed vs velocity · green = 100% delivered · L5 reference">Velocity trend — all 12 past sprints</SectionHead>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={velData} barCategoryGap="28%" barGap={2}>
            <defs>
              <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.violet} stopOpacity={0.15} />
                <stop offset="100%" stopColor={C.violet} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <Tooltip {...tt} formatter={(v, n) => [`${f0(v)} SP`, n === "vel" ? "Velocity" : "Committed"]} />
            <ReferenceLine y={l5} stroke={C.amber} strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `L5 avg ${f0(l5)}`, position: "insideTopRight", fontSize: 10, fill: C.amber }} />
            <Bar dataKey="comm" name="Committed" fill={C.border} radius={[4, 4, 0, 0]} />
            <Bar dataKey="vel" name="Velocity" radius={[4, 4, 0, 0]}>
              {velData.map((s, i) => <Cell key={i} fill={s.fill} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <SectionHead sub="% SP delivered · 80% threshold · last 8 sprints">Completion rate</SectionHead>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={SPRINTS.slice(-8).map(s => ({ name: s.id, rate: +(s.cr * 100).toFixed(1) }))}>
              <defs>
                <linearGradient id="crGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.emerald} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={C.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="%" domain={[75, 105]} />
              <Tooltip {...tt} formatter={v => [`${v}%`, "Completion"]} />
              <ReferenceLine y={80}  stroke={C.rose}    strokeDasharray="5 3" label={{ value: "80%",  position: "insideTopLeft",  fontSize: 9, fill: C.rose    }} />
              <ReferenceLine y={100} stroke={C.emerald} strokeDasharray="5 3" label={{ value: "100%", position: "insideTopRight", fontSize: 9, fill: C.emerald }} />
              <Area type="monotone" dataKey="rate" stroke={C.emerald} fill="url(#crGrad)" strokeWidth={2} dot={{ r: 3, fill: C.emerald, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHead sub="Team YTD velocity comparison">Team breakdown</SectionHead>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {TEAMS.map(t => (
              <div key={t.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{t.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{f0(t.vel)} SP</span>
                    <Pill label={pct(t.cr)} color={t.cr >= 0.8 ? C.emerald : C.rose} />
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
function VelocityPage() {
  const [idx, setIdx] = useState(11);
  const s    = SPRINTS[idx];
  const prev = idx > 0 ? SPRINTS[idx - 1] : null;
  const l5   = SPRINTS.slice(Math.max(0, idx - 4), idx + 1).reduce((a, x) => a + x.vel, 0) / Math.min(5, idx + 1);

  const chartData = SPRINTS.map((x, i) => ({
    name: x.id, vel: Math.round(x.vel), comm: Math.round(x.comm),
    highlight: i === idx
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Sprint selector */}
      <Card style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginRight: 4 }}>Sprint:</span>
          {SPRINTS.map((x, i) => (
            <button key={x.id} onClick={() => setIdx(i)} style={{
              fontSize: 11, fontWeight: i === idx ? 700 : 400,
              background: i === idx ? C.violetD : "transparent",
              color: i === idx ? "#fff" : C.muted,
              border: `1px solid ${i === idx ? C.violetD : C.border}`,
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", transition: "all .15s"
            }}>{x.id}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Pill label={s.q} color={C.cyan} />
            {s.cr >= 1 && <Pill label="100% delivered" color={C.emerald} />}
          </div>
        </div>
      </Card>

      {/* Selected sprint hero */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        {[
          { label:"Velocity",      value:f0(s.vel),  unit:"SP",    color:C.violet  },
          { label:"Committed SP",  value:f0(s.comm), unit:"SP",    color:C.muted   },
          { label:"Completion",    value:pct(s.cr),  unit:"",      color:s.cr>=1?C.emerald:s.cr>=0.8?C.amber:C.rose },
          { label:"Throughput",    value:f0(s.thru), unit:"items", color:C.cyan    },
        ].map(({ label, value, unit, color }) => (
          <Card key={label} glow={color} style={{ textAlign: "center" }}>
            <Label>{label}</Label>
            <Big value={value} unit={unit} color={color} />
          </Card>
        ))}
      </div>

      {/* Comparison chart */}
      <Card>
        <SectionHead sub={`Sprint-by-sprint · selected: ${s.id} (highlighted) · L5 = ${f0(l5)} SP`}>Velocity vs committed</SectionHead>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} barCategoryGap="25%" barGap={2}>
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <Tooltip {...tt} formatter={(v, n) => [`${f0(v)} SP`, n === "vel" ? "Velocity" : "Committed"]} />
            <ReferenceLine y={l5} stroke={C.amber} strokeDasharray="5 3"
              label={{ value: `L5 ${f0(l5)}`, position: "insideTopRight", fontSize: 10, fill: C.amber }} />
            <Bar dataKey="comm" name="Committed" fill={C.border} radius={[4, 4, 0, 0]} />
            <Bar dataKey="vel"  name="Velocity"  radius={[4, 4, 0, 0]}>
              {chartData.map((x, i) => <Cell key={i} fill={x.highlight ? C.cyan : SPRINTS[i].cr >= 1 ? C.emerald : C.violet} opacity={x.highlight ? 1 : 0.6} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <SectionHead sub="SP delivery breakdown">Story points</SectionHead>
          {[
            { l:"Delivered", v:s.vel, c:C.emerald },
            { l:"Undelivered", v:Math.max(0, s.comm - s.vel), c:C.rose },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: C.muted }}>{l}</span>
                <span style={{ fontWeight: 700, color: c }}>{f0(v)} SP ({f1(v/s.comm*100)}%)</span>
              </div>
              <Bar2 val={v} total={s.comm} color={c} h={10} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Pill label={s.cr >= 1 ? "✓ Fully delivered" : s.cr >= 0.8 ? "On target" : "⚠ Below 80%"} color={s.cr >= 1 ? C.emerald : s.cr >= 0.8 ? C.amber : C.rose} />
          </div>
        </Card>
        <Card>
          <SectionHead sub="Sprint KPI metrics">Key indicators</SectionHead>
          {[
            { l:"vs L5 avg",      v:`${f1((s.vel/l5-1)*100)}%`,   c:(s.vel>l5?C.emerald:C.rose) },
            { l:"vs prev sprint", v:prev?`${f1((s.vel-prev.vel)/prev.vel*100)}%`:"—", c:prev&&s.vel>prev.vel?C.emerald:C.rose },
            { l:"Predictability", v:f1(s.cr),               c:s.cr>=0.8?C.emerald:C.rose },
            { l:"Cycle time P50", v:`${f1(s.cy)}d`,          c:s.cy<=14?C.emerald:C.amber },
            { l:"Lead time P50",  v:`${f1(s.ld)}d`,          c:s.ld<=14?C.emerald:C.amber },
            { l:"User stories",   v:f0(s.us),                c:C.violet },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── PAGE: QUALITY ─────────────────────────────────────────────────────────────
function QualityPage() {
  const last8 = SPRINTS.slice(-8);
  const avgDD = last8.reduce((a, s) => a + s.dd, 0) / last8.length;
  const qr    = d => d < 0.25 ? { l:"Good", c:C.emerald } : d < 0.4 ? { l:"Watch", c:C.amber } : { l:"High ⚠", c:C.rose };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12 }}>
        {[
          { label:"S12 Bugs",        value:f0(SPRINTS[11].bugs), color:C.rose,    sub:`vs S11: ${f0(SPRINTS[10].bugs)}` },
          { label:"S12 Defect Density", value:pct(SPRINTS[11].dd), color:QUAL(SPRINTS[11].dd), sub:"bugs÷closed items" },
          { label:"Avg Density L8",  value:pct(avgDD),           color:QUAL(avgDD), sub:"8-sprint avg" },
          { label:"S13 Bugs (live)", value:f0(CURRENT.bugs),     color:C.rose,    sub:"current sprint" },
          { label:"YTD Total Bugs",  value:f0(GLOBAL.totalBugs), color:C.muted,   sub:"all 12 sprints" },
          { label:"Bugs Closed S12", value:f0(SPRINTS[11].bc),   color:C.emerald, sub:`closure ${pct(SPRINTS[11].bc/SPRINTS[11].bugs)}` },
        ].map(({ label, value, color, sub }) => (
          <Card key={label} glow={color}>
            <Label>{label}</Label>
            <Big value={value} color={color} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
          </Card>
        ))}
      </div>

      {/* Defect density chart */}
      <Card>
        <SectionHead sub="Bug count + defect density % overlay · 20% healthy threshold · last 10 sprints">Defect density trend</SectionHead>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={SPRINTS.slice(-10).map(s => ({ name: s.id, bugs: s.bugs, density: +(s.dd * 100).toFixed(1) }))}>
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="%" domain={[0, 60]} />
            <Tooltip {...tt} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            <Bar     yAxisId="l" dataKey="bugs"    name="Bug count"       fill={C.rose} opacity={0.7} radius={[4, 4, 0, 0]} />
            <Line    yAxisId="r" dataKey="density" name="Defect density %" type="monotone" stroke={C.amber} strokeWidth={2.5} dot={{ r: 4, fill: C.amber, strokeWidth: 0 }} />
            <ReferenceLine yAxisId="r" y={20} stroke={C.emerald} strokeDasharray="5 3"
              label={{ value: "20% target", position: "insideTopRight", fontSize: 9, fill: C.emerald }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {/* Scorecard */}
      <Card>
        <SectionHead sub="Good <25% · Watch 25–40% · High >40%">Sprint quality scorecard — last 8 sprints</SectionHead>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 70px 65px 75px", gap: 10, fontSize: 10, fontWeight: 600, color: C.dim, padding: "6px 0", letterSpacing: ".06em", textTransform: "uppercase" }}>
            <span>Sprint</span><span>Defect density bar</span><span style={{ textAlign:"right" }}>Bugs</span><span style={{ textAlign:"right" }}>Density</span><span style={{ textAlign:"right" }}>Rating</span>
          </div>
          {last8.map(s => {
            const r = qr(s.dd);
            return (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "50px 1fr 70px 65px 75px", gap: 10, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.id}</span>
                <Bar2 val={s.dd * 100} total={60} color={r.c} h={8} />
                <span style={{ fontSize: 12, color: C.muted, textAlign: "right" }}>{f0(s.bugs)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: r.c, textAlign: "right" }}>{pct(s.dd)}</span>
                <div style={{ textAlign: "right" }}><Pill label={r.l} color={r.c} /></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── PAGE: FLOW ────────────────────────────────────────────────────────────────
function FlowPage() {
  const flowData = SPRINTS.slice(-10).map(s => ({
    name: s.id, cycle: s.cy, lead: s.ld, eff: +(s.cy / s.ld * 100).toFixed(1)
  }));
  const s12 = SPRINTS[11]; const s11 = SPRINTS[10];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 12 }}>
        {[
          { label:"Cycle Time P50 S12", value:`${f1(s12.cy)}d`, color:s12.cy<=14?C.emerald:C.amber, sub:`was ${f1(s11.cy)}d in S11` },
          { label:"Lead Time P50 S12",  value:`${f1(s12.ld)}d`, color:s12.ld<=14?C.emerald:C.amber, sub:`was ${f1(s11.ld)}d in S11` },
          { label:"Flow Efficiency S12",value:`${f1(s12.cy/s12.ld*100)}%`, color:C.cyan,   sub:"cycle÷lead time" },
          { label:"WIP · S13 now",      value:f0(CURRENT.wip),  color:CURRENT.wip>150?C.rose:C.amber, sub:"active items" },
          { label:"Stale · S13",        value:f0(CURRENT.stale),color:C.rose,    sub:">5 days no change" },
          { label:"Open Items · S13",   value:f0(CURRENT.open), color:C.muted,   sub:"New + Active + Ready" },
        ].map(({ label, value, color, sub }) => (
          <Card key={label} glow={color}>
            <Label>{label}</Label>
            <Big value={value} color={color} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHead sub="P50 median · cycle capped 90d · lead capped 180d · 14d target line · last 10 sprints">Cycle time vs lead time</SectionHead>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={flowData}>
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="d" domain={[0, 35]} />
            <Tooltip {...tt} formatter={(v, n) => [v ? `${f1(v)}d` : "—", n]} />
            <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            <ReferenceLine y={14} stroke={C.emerald} strokeDasharray="5 3"
              label={{ value: "14d target", position: "insideTopRight", fontSize: 9, fill: C.emerald }} />
            <Line type="monotone" dataKey="cycle" name="Cycle Time P50" stroke={C.amber}  strokeWidth={2.5} dot={{ r: 4, fill: C.amber,  strokeWidth: 0 }} />
            <Line type="monotone" dataKey="lead"  name="Lead Time P50"  stroke={C.violet} strokeWidth={2}   dot={{ r: 4, fill: C.violet, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <SectionHead sub="Cycle÷Lead · healthy range 15–40%">Flow efficiency</SectionHead>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={flowData}>
              <defs>
                <linearGradient id="effG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.cyan} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={C.cyan} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} unit="%" domain={[0, 80]} />
              <Tooltip {...tt} formatter={v => [`${f1(v)}%`, "Flow Efficiency"]} />
              <ReferenceLine y={15} stroke={C.rose}    strokeDasharray="4 3" label={{ value: "15%", position: "insideTopRight", fontSize: 9, fill: C.rose    }} />
              <ReferenceLine y={40} stroke={C.emerald} strokeDasharray="4 3" label={{ value: "40%", position: "insideTopRight", fontSize: 9, fill: C.emerald }} />
              <Area type="monotone" dataKey="eff" stroke={C.cyan} fill="url(#effG)" strokeWidth={2} dot={{ r: 3, fill: C.cyan, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHead sub="User stories vs bugs closed · last 10 sprints">Throughput mix</SectionHead>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={SPRINTS.slice(-10).map(s => ({ name: s.id, stories: s.thru - s.bugs, bugs: s.bugs }))} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
              <Bar dataKey="stories" name="User Stories" stackId="a" fill={C.violet} />
              <Bar dataKey="bugs"    name="Bugs"         stackId="a" fill={C.rose}   radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ── PAGE: TEAMS ───────────────────────────────────────────────────────────────
function TeamsPage() {
  const [active, setActive] = useState(null);
  const totalVel = TEAMS.reduce((a, t) => a + t.vel, 0);
  const shown = active ? TEAMS.filter(t => t.name === active) : TEAMS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Team selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Filter:</span>
        <button onClick={() => setActive(null)} style={{ fontSize: 11, fontWeight: !active ? 700 : 400, background: !active ? C.violetD : "transparent", color: !active ? "#fff" : C.muted, border: `1px solid ${!active ? C.violetD : C.border}`, borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>All Teams</button>
        {TEAMS.map(t => (
          <button key={t.name} onClick={() => setActive(active === t.name ? null : t.name)} style={{
            fontSize: 11, fontWeight: active === t.name ? 700 : 400,
            background: active === t.name ? t.color + "22" : "transparent",
            color: active === t.name ? t.color : C.muted,
            border: `1px solid ${active === t.name ? t.color : C.border}`,
            borderRadius: 6, padding: "4px 12px", cursor: "pointer", transition: "all .15s"
          }}>{t.name}</button>
        ))}
      </div>

      {/* Team cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {TEAMS.filter(t => !active || t.name === active).map(t => (
          <Card key={t.name} glow={t.color} style={{ cursor: "pointer", border: `1px solid ${active===t.name?t.color:C.border}` }} onClick={() => setActive(active===t.name?null:t.name)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{t.name}</span>
              </div>
              <Pill label={pct(t.cr)} color={t.cr >= 0.8 ? C.emerald : C.rose} />
            </div>
            {[
              { l:"Velocity",     v:f0(t.vel),              c:t.color },
              { l:"Committed SP", v:f0(t.comm),             c:C.muted },
              { l:"Throughput",   v:`${f0(t.thru)} items`,  c:C.muted },
              { l:"Bugs",         v:f0(t.bugs),             c:C.rose   },
              { l:"Bugs Closed",  v:f0(t.bugsClosed),       c:C.emerald},
              { l:"WIP",          v:f0(t.wip),              c:C.amber  },
              { l:"Stale Items",  v:f0(t.stale),            c:C.rose   },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <Bar2 val={t.vel} total={totalVel} color={t.color} h={6} />
              <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{f1(t.vel / totalVel * 100)}% of total velocity</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Velocity share + comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <SectionHead sub="YTD velocity share by team">Velocity distribution</SectionHead>
          {TEAMS.map(t => (
            <div key={t.name} style={{ marginBottom: 14, opacity: !active || active===t.name ? 1 : 0.3, transition: "opacity .2s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{t.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{f0(t.vel)} SP · {f1(t.vel/totalVel*100)}%</span>
              </div>
              <Bar2 val={t.vel} total={totalVel} color={t.color} h={10} />
            </div>
          ))}
        </Card>
        <Card>
          <SectionHead sub="Bug load vs throughput by team">Bug load comparison</SectionHead>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={TEAMS.map(t => ({ name: t.name, bugs: t.bugs, closed: t.bugsClosed }))} layout="vertical">
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} axisLine={false} tickLine={false} width={70} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
              <Bar dataKey="bugs"   name="Total Bugs"   fill={C.rose}    opacity={0.7} radius={[0, 4, 4, 0]} />
              <Bar dataKey="closed" name="Bugs Closed"  fill={C.emerald} opacity={0.9} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("overview");

  const PAGE = {
    overview: <Overview />,
    velocity: <VelocityPage />,
    quality:  <QualityPage />,
    flow:     <FlowPage />,
    teams:    <TeamsPage />,
  };

  return (
    <div style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* Top navigation */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 24px", display: "flex", alignItems: "stretch", position: "sticky", top: 0, zIndex: 30 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 24, borderRight: `1px solid ${C.border}`, marginRight: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.violetD}, ${C.cyanD})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>EM</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>EngagementManager</div>
            <div style={{ fontSize: 10, color: C.muted }}>Sprint Intelligence · 2026</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              border: "none", background: "none", cursor: "pointer",
              padding: "0 18px", display: "flex", alignItems: "center", gap: 7,
              fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              color: tab === t.id ? C.violet : C.muted,
              borderBottom: tab === t.id ? `2px solid ${C.violet}` : "2px solid transparent",
              transition: "all .15s"
            }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Live badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 16, borderLeft: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.amber, animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber }}>S13 Live</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>Jun 17–30 · {CURRENT.daysLeft}d left</div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* Page content */}
      <div style={{ padding: "22px 24px 60px", maxWidth: 1400, margin: "0 auto" }}>
        {PAGE[tab]}
      </div>
    </div>
  );
}
