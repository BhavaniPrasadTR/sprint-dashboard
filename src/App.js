import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend
} from "recharts";

// ── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#0A0E1A",
  surface: "#111827",
  surfaceM:"#1A2235",
  border:  "#1F2D45",
  text:    "#F0F4FF",
  muted:   "#6B7FA8",
  dim:     "#3A4A6B",
  violet:  "#818CF8",
  violetD: "#4F46E5",
  cyan:    "#22D3EE",
  cyanD:   "#0891B2",
  amber:   "#FBBF24",
  emerald: "#34D399",
  emeraldD:"#059669",
  rose:    "#F87171",
  roseD:   "#DC2626",
  sky:     "#38BDF8",
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const f0  = n => (n == null || n === "") ? "—" : Math.round(Number(n)).toLocaleString();
const f1  = n => (n == null || n === "") ? "—" : Number(n).toFixed(1);
const pct = n => (n == null || n === "") ? "—" : `${(Number(n) * 100).toFixed(1)}%`;
const QUAL= n => n < 0.25 ? C.emerald : n < 0.4 ? C.amber : C.rose;
const tt  = {
  contentStyle:{ background:C.surfaceM, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11, color:C.text },
  labelStyle:{ color:C.muted },
  cursor:{ stroke:C.border }
};

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
    <div style={{ height:h, background:C.dim+"44", borderRadius:h, overflow:"hidden" }}>
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

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id:"overview", icon:"◎", label:"Overview"  },
  { id:"velocity", icon:"⚡", label:"Velocity"  },
  { id:"quality",  icon:"⬡", label:"Quality"   },
  { id:"flow",     icon:"∿", label:"Flow"      },
  { id:"teams",    icon:"◈", label:"Teams"     },
];

// ── PAGE: OVERVIEW ────────────────────────────────────────────────────────────
function Overview({ SPRINTS, CURRENT, TEAMS, GLOBAL }) {
  const s12    = SPRINTS[SPRINTS.length - 1];
  const s11    = SPRINTS[SPRINTS.length - 2] || s12;
  const vTrend = s11.vel ? (s12.vel - s11.vel) / s11.vel : 0;
  const l5     = SPRINTS.slice(-5).reduce((a, s) => a + s.vel, 0) / Math.min(5, SPRINTS.length);

  const velData = SPRINTS.map(s => ({
    name: s.id, vel: Math.round(s.vel), comm: Math.round(s.comm),
    fill: s.cr >= 1 ? C.emerald : C.violet
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
          <div style={{ fontSize:26, fontWeight:900, color:C.text, letterSpacing:"-1px", marginBottom:4 }}>EngagementManager · 2026</div>
          <div style={{ fontSize:13, color:C.muted }}>Sprint KPI Dashboard · User Stories & Bugs · 4 Teams</div>
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
              <div style={{ fontSize:10, color:C.muted, marginTop:2, letterSpacing:".06em", textTransform:"uppercase" }}>{l}</div>
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
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
            <Tooltip {...tt} formatter={(v,n) => [`${f0(v)} SP`, n==="vel"?"Velocity":"Committed"]} />
            <ReferenceLine y={l5} stroke={C.amber} strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value:`L5 avg ${f0(l5)}`, position:"insideTopRight", fontSize:10, fill:C.amber }} />
            <Bar dataKey="comm" name="Committed" fill={C.border} radius={[4,4,0,0]} />
            <Bar dataKey="vel"  name="Velocity"  radius={[4,4,0,0]}>
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
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} unit="%" domain={[75,105]} />
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
function VelocityPage({ SPRINTS, CURRENT }) {
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
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
            <Tooltip {...tt} formatter={(v,n) => [`${f0(v)} SP`, n==="vel"?"Velocity":"Committed"]} />
            <ReferenceLine y={l5} stroke={C.amber} strokeDasharray="5 3" label={{ value:`L5 ${f0(l5)}`, position:"insideTopRight", fontSize:10, fill:C.amber }} />
            <Bar dataKey="comm" name="Committed" fill={C.border} radius={[4,4,0,0]} />
            <Bar dataKey="vel"  name="Velocity"  radius={[4,4,0,0]}>
              {SPRINTS.map((x,i) => <Cell key={i} fill={i===idx?C.cyan:x.cr>=1?C.emerald:C.violet} opacity={i===idx?1:0.6} />)}
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
            { l:"Predictability", v:f1(s.cr),                                         c:s.cr>=0.8?C.emerald:C.rose   },
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
function QualityPage({ SPRINTS, CURRENT }) {
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
          <ComposedChart data={SPRINTS.slice(-10).map(s=>({ name:s.id, bugs:s.bugs, density:+(s.dd*100).toFixed(1) }))}>
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} unit="%" domain={[0,60]} />
            <Tooltip {...tt} />
            <Legend wrapperStyle={{ fontSize:11, color:C.muted }} />
            <Bar  yAxisId="l" dataKey="bugs"    name="Bug count"        fill={C.rose}  opacity={0.7} radius={[4,4,0,0]} />
            <Line yAxisId="r" dataKey="density" name="Defect density %"  type="monotone" stroke={C.amber} strokeWidth={2.5} dot={{ r:4, fill:C.amber, strokeWidth:0 }} />
            <ReferenceLine yAxisId="r" y={20} stroke={C.emerald} strokeDasharray="5 3" label={{ value:"20% target", position:"insideTopRight", fontSize:9, fill:C.emerald }} />
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
function FlowPage({ SPRINTS, CURRENT }) {
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
            <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} unit="d" domain={[0,35]} />
            <Tooltip {...tt} formatter={(v,n) => [v?`${f1(v)}d`:"—",n]} />
            <Legend wrapperStyle={{ fontSize:11, color:C.muted }} />
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
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} unit="%" domain={[0,80]} />
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
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize:11, color:C.muted }} />
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
function TeamsPage({ TEAMS, SPRINTS }) {
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
              <CartesianGrid strokeDasharray="4 4" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize:10, fill:C.muted }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:C.text }} axisLine={false} tickLine={false} width={70} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize:11, color:C.muted }} />
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
    <div style={{ fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>
      <LoadingScreen />
    </div>
  );

  if (error) return (
    <div style={{ fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>
      <ErrorScreen message={error} />
    </div>
  );

  const { sprints: SPRINTS, current: CURRENT, teams: TEAMS, global: GLOBAL } = data;

  const lastRefreshed = new Date(data.lastRefreshed).toLocaleString("en-US", {
    month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"
  });

  return (
    <div style={{ fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      {/* Top navigation */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", display:"flex", alignItems:"stretch", position:"sticky", top:0, zIndex:30 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:24, borderRight:`1px solid ${C.border}`, marginRight:4 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg, ${C.violetD}, ${C.cyanD})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:"#fff" }}>EM</div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:C.text, lineHeight:1.2 }}>EngagementManager</div>
            <div style={{ fontSize:10, color:C.muted }}>Sprint Intelligence · 2026</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"stretch", flex:1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              border:"none", background:"none", cursor:"pointer",
              padding:"0 18px", display:"flex", alignItems:"center", gap:7,
              fontSize:13, fontWeight:tab===t.id?700:400,
              color:tab===t.id?C.violet:C.muted,
              borderBottom:tab===t.id?`2px solid ${C.violet}`:"2px solid transparent",
              transition:"all .15s"
            }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, paddingLeft:16, borderLeft:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:C.amber, animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:11, fontWeight:700, color:C.amber }}>Live</span>
          </div>
          <div style={{ fontSize:11, color:C.muted }}>Updated {lastRefreshed}</div>
        </div>
      </div>

      {/* Page content */}
      <div style={{ padding:"22px 24px 60px", maxWidth:1400, margin:"0 auto" }}>
        {tab==="overview" && <Overview  SPRINTS={SPRINTS} CURRENT={CURRENT} TEAMS={TEAMS}   GLOBAL={GLOBAL}  />}
        {tab==="velocity" && <VelocityPage SPRINTS={SPRINTS} CURRENT={CURRENT} />}
        {tab==="quality"  && <QualityPage  SPRINTS={SPRINTS} CURRENT={CURRENT} />}
        {tab==="flow"     && <FlowPage     SPRINTS={SPRINTS} CURRENT={CURRENT} />}
        {tab==="teams"    && <TeamsPage    TEAMS={TEAMS}     SPRINTS={SPRINTS} />}
      </div>
    </div>
  );
}
