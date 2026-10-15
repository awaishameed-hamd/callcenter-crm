import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  ComposedChart, Line, Area,
  RadialBarChart, RadialBar,
} from 'recharts'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { P, CHART_COLORS, AGENT_BAR_COLORS } from '../constants/palette'

const PERIODS = [
  { key: 'daily',   label: 'Today'      },
  { key: 'weekly',  label: 'This Week'  },
  { key: 'monthly', label: 'This Month' },
  { key: 'custom',  label: 'Custom'     },
]

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardStyle = {
  background:   P.bgCard,
  borderRadius: 8,
  padding:      '12px 14px',
  boxShadow:    P.shadow,
}
const titleStyle = {
  color:         P.navy,
  fontSize:      12,
  fontWeight:    700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom:  8,
}
const tooltipProps = {
  contentStyle: { background:'#fff', border:`1px solid ${P.border}`, borderRadius:6, fontSize:11, color:P.navy },
  labelStyle:   { color:P.textLabel, fontWeight:600 },
  itemStyle:    { color:P.slate },
}
const axisProps = { tick:{ fill:P.textLabel, fontSize:9 }, axisLine:false, tickLine:false }

// ── Sale Type — Div Treemap (no Recharts, no SVG fill inheritance) ────────────
const SALE_TREE_COLORS = ['#132E57','#1E8496','#D7A520','#CBB26A','#3A6B3A','#808080']

function SaleTypeTreemap({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:148, color:P.textMuted, fontSize:11 }}>No data</div>
  }
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ display:'flex', height:148, gap:2, borderRadius:4, overflow:'hidden' }}>
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round(d.value / total * 100) : 0
        return (
          <div key={i} style={{
            flex:            d.value,
            background:      SALE_TREE_COLORS[i % SALE_TREE_COLORS.length],
            display:         'flex',
            flexDirection:   'column',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             4,
            minWidth:        0,
          }}>
            <div style={{ fontSize:14, fontWeight:900, color:'#D7A520', textAlign:'center', padding:'0 4px' }}>{d.name}</div>
            <div style={{ fontSize:12, fontWeight:800, color:'rgba(215,165,32,0.9)', textAlign:'center' }}>{pct}%</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Cancellation Reasons — Pie ────────────────────────────────────────────────
const CANCEL_COLORS = ['#1E8496','#D7A520','#C25A1F','#132E57','#3A6B3A','#7B2D8E']

function CancellationPie({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:148, color:P.textMuted, fontSize:11 }}>No cancellation data</div>
  }
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:148, height:148, flexShrink:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={68}
              stroke="none" startAngle={90} endAngle={-270}>
              {data.map((_, i) => <Cell key={i} fill={CANCEL_COLORS[i % CANCEL_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background:'#fff', border:`1px solid ${P.border}`, borderRadius:6, fontSize:11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round(d.value / total * 100) : 0
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:P.textLabel }}>
              <span style={{ width:8, height:8, background:CANCEL_COLORS[i % CANCEL_COLORS.length], borderRadius:2, flexShrink:0 }} />
              <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:85 }}>{d.name}</span>
              <span style={{ color:P.navy, fontWeight:700, marginLeft:3 }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vertical Donut ────────────────────────────────────────────────────────────
const VERTICAL_COLORS = ['#132E57','#1E8496','#D7A520','#C25A1F']

function VerticalDonut({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:148, color:P.textMuted, fontSize:11 }}>No data</div>
  }
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ display:'flex', gap:12, alignItems:'center', justifyContent:'center' }}>
      <div style={{ position:'relative', width:148, height:148, flexShrink:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
              dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
              {data.map((_, i) => <Cell key={i} fill={VERTICAL_COLORS[i % VERTICAL_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background:'#fff', border:`1px solid ${P.border}`, borderRadius:6, fontSize:11 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <div style={{ fontSize:22, fontWeight:700, color:P.navy, lineHeight:1 }}>{total}</div>
          <div style={{ fontSize:7.5, color:P.textMuted, letterSpacing:'0.08em', marginTop:2 }}>TOTAL</div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round(d.value / total * 100) : 0
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:P.textLabel, whiteSpace:'nowrap' }}>
              <span style={{ width:9, height:9, background:VERTICAL_COLORS[i % VERTICAL_COLORS.length], borderRadius:2, flexShrink:0 }} />
              <span>{d.name}</span>
              <span style={{ color:P.navy, fontWeight:700, marginLeft:3 }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Pie legend shared ─────────────────────────────────────────────────────────
function PieLegend({ data, colors }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 10px', marginTop:6 }}>
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round(d.value / total * 100) : 0
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:P.textLabel, whiteSpace:'nowrap' }}>
            <span style={{ width:8, height:8, background:colors[i % colors.length], borderRadius:2, flexShrink:0 }} />
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', maxWidth:80 }}>{d.name}</span>
            <span style={{ color:P.navy, fontWeight:700 }}>{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const role = user?.role

  const [period,          setPeriod]          = useState('daily')
  const [fromDate,        setFromDate]        = useState(null)
  const [toDate,          setToDate]          = useState(null)
  const [showDateModal,   setShowDateModal]   = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')

  const [stats,           setStats]           = useState({
    total:0, approved:0, pending:0, rejected:0,
    approvedByManager:0, approvedByDirector:0,
    pendingAtManager:0,  pendingAtDirector:0,
    rejectedByAgent:0,   rejectedByManager:0, rejectedByDirector:0,
  })
  const [approvalRate,    setApprovalRate]    = useState({ rate:0, approved:0, pending:0, rejected:0, total:0 })
  const [trend,           setTrend]           = useState([])
  const [hourlyTrend,     setHourlyTrend]     = useState([])
  const [leaderboard,     setLeaderboard]     = useState([])
  const [saleTypePie,     setSaleTypePie]     = useState([])
  const [clientPie,       setClientPie]       = useState([])
  const [monthlyTrend,    setMonthlyTrend]    = useState([])
  const [cancellationPie, setCancellationPie] = useState([])
  const [verticalPie,     setVerticalPie]     = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = { period }
      if (period === 'custom' && fromDate && toDate) {
        params.from_date = fromDate.toISOString().split('T')[0]
        params.to_date   = toDate.toISOString().split('T')[0]
      }
      const { data } = await api.get('/dashboard/stats', { params })
      setStats(data.stats           ?? { total:0, approved:0, pending:0, rejected:0 })
      setApprovalRate(data.approvalRate  ?? { rate:0, approved:0, pending:0, rejected:0, total:0 })
      setTrend(data.trend           ?? [])
      setHourlyTrend(data.hourlyTrend   ?? [])
      setLeaderboard(data.leaderboard  ?? [])
      setSaleTypePie(data.saleTypePie  ?? [])
      setClientPie(data.clientPie    ?? [])
      setMonthlyTrend(data.monthlyTrend ?? [])
      setCancellationPie(data.cancellationPie ?? [])
      setVerticalPie(data.verticalPie ?? [])
    } catch {
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [period, fromDate, toDate])

  useEffect(() => {
    if (period === 'custom' && (!fromDate || !toDate)) return
    fetchData()
  }, [fetchData])

  const showLeaderboard = role !== 'agent'

  // Stat cards config
  const statCards = [
    {
      label: 'TOTAL CUSTOMERS', value: stats.total,
      border: P.navy, fill: P.fillNavy, textColor: P.navy,
      hint: null, breakdown: null,
    },
    {
      label: 'APPROVED', value: stats.approved,
      border: P.teal, fill: P.fillTeal, textColor: P.teal,
      hint: `${approvalRate.rate}% approval rate`,
      breakdown: [
        { label: 'By Manager',  value: stats.approvedByManager  },
        { label: 'By Director', value: stats.approvedByDirector },
      ],
    },
    {
      label: 'PENDING', value: stats.pending,
      border: P.gold, fill: P.fillGold, textColor: P.gold,
      hint: null,
      breakdown: [
        { label: 'At Manager',  value: stats.pendingAtManager  },
        { label: 'At Director', value: stats.pendingAtDirector },
      ],
    },
    {
      label: 'REJECTED', value: stats.rejected,
      border: P.brick, fill: P.fillBrick, textColor: P.brick,
      hint: null,
      breakdown: [
        { label: 'By Agent',    value: stats.rejectedByAgent    },
        { label: 'By Manager',  value: stats.rejectedByManager  },
        { label: 'By Director', value: stats.rejectedByDirector },
      ],
    },
  ]

  return (
    <Layout>
      <style>{`
        .custom-dp-input { width:100%; padding:7px 10px; border:1px solid ${P.border}; border-radius:6px; font-size:12px; color:${P.navy}; outline:none; }
        .custom-dp-input:focus { border-color:${P.navy}; }
        .react-datepicker__day--selected, .react-datepicker__day--in-range, .react-datepicker__day--range-start, .react-datepicker__day--range-end { background-color:${P.navy} !important; color:#fff !important; }
        .react-datepicker__day--keyboard-selected { background-color:${P.teal} !important; }
        .react-datepicker__header { background:${P.navy}; color:#fff; }
        .react-datepicker__current-month, .react-datepicker__day-name { color:#fff; }
        .react-datepicker-popper { z-index:9999 !important; }
      `}</style>

      <div style={{ background:'#EDF0F3', minHeight:'100vh', padding:'14px 18px', boxSizing:'border-box' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontSize:24, fontWeight:900, color:P.navy, letterSpacing:'0.04em', fontFamily:"'Rajdhani', sans-serif" }}>Dashboard</div>
          </div>

          {/* Period tabs */}
          <div style={{ display:'flex', gap:2, background:'#fff', border:`1px solid ${P.border}`, borderRadius:8, padding:3 }}>
            {PERIODS.map(p => (
              <button key={p.key}
                onClick={() => {
                  if (p.key === 'custom') { setShowDateModal(true) }
                  else { setPeriod(p.key) }
                }}
                style={{
                  background: period === p.key ? P.navy : 'transparent',
                  color:      period === p.key ? '#fff'  : P.slate,
                  border:     'none',
                  padding:    '5px 13px',
                  borderRadius: 6,
                  fontSize:   11,
                  fontWeight: period === p.key ? 600 : 400,
                  cursor:     'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
                {p.key === 'custom' && period === 'custom' && fromDate && toDate && (
                  <span style={{ marginLeft:5, fontSize:9, opacity:0.85 }}>
                    ({fromDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} → {toDate.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:'#FEE2E2', border:'1px solid #FCA5A5', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#991B1B', marginBottom:10 }}>
            {error}
          </div>
        )}

        {/* ── Row 1 — Stat Cards ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:10 }}>
          {statCards.map((c, i) => (
            <div key={i} style={{
              background:   `linear-gradient(135deg, ${c.fill} 0%, #fff 100%)`,
              borderLeft:   `4px solid ${c.border}`,
              borderRadius: 8,
              padding:      '11px 14px',
              boxShadow:    `0 1px 4px ${c.border}18`,
              display:      'flex',
              justifyContent: 'space-between',
              alignItems:   'flex-start',
            }}>
              {/* Left: label + number + hint */}
              <div>
                <div style={{ fontSize:9, color:P.textMuted, letterSpacing:'0.08em', fontWeight:600 }}>{c.label}</div>
                {loading
                  ? <div style={{ width:60, height:28, background:P.border, borderRadius:4, marginTop:5 }} />
                  : <div style={{ fontSize:26, fontWeight:700, color:c.textColor, marginTop:3, lineHeight:1 }}>{c.value}</div>
                }
                {c.hint && <div style={{ fontSize:9, color:P.textMuted, marginTop:2 }}>{c.hint}</div>}
              </div>
              {/* Right: breakdown stacked */}
              {c.breakdown && !loading && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, paddingTop:6, flexShrink:0 }}>
                  {c.breakdown.map((b, bi) => (
                    <div key={bi} style={{ fontSize:11, color:P.textMuted, whiteSpace:'nowrap' }}>
                      {b.label}&nbsp;&nbsp;<span style={{ fontWeight:700, color:c.textColor }}>{b.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Row 1 — Daily Performance + Top Agents ── */}
        <div style={{ display:'grid', gridTemplateColumns: showLeaderboard ? '1.5fr 1fr' : '1fr', gap:10, marginBottom:10 }}>

          {/* Daily / Hourly Performance */}
          <div style={cardStyle}>
            {period === 'daily' ? (
              <>
                <div style={titleStyle}>Hourly Performance — Today's Shift (7 PM – 4 AM PKT)</div>
                <ResponsiveContainer width="100%" height={168}>
                  <ComposedChart data={hourlyTrend} margin={{ top:6, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.gridLine} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Legend wrapperStyle={{ fontSize:10, color:P.textLabel, paddingTop:2 }} iconSize={8} />
                    <Bar dataKey="submissions" name="Submissions" fill={P.navy} barSize={18} radius={[3,3,0,0]} />
                    <Line dataKey="approved" name="Approvals" stroke={P.gold} strokeWidth={2.5} dot={{ r:3, fill:P.gold, strokeWidth:0 }} activeDot={{ r:4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            ) : (
              <>
                <div style={titleStyle}>Daily Performance — Submissions &amp; Approvals (Last 7 Days)</div>
                <ResponsiveContainer width="100%" height={168}>
                  <ComposedChart data={trend} margin={{ top:6, right:8, left:-22, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={P.gridLine} vertical={false} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Legend wrapperStyle={{ fontSize:10, color:P.textLabel, paddingTop:2 }} iconSize={8} />
                    <Bar dataKey="submissions" name="Submissions" fill={P.navy} barSize={24} radius={[3,3,0,0]} />
                    <Line dataKey="approved" name="Approvals" stroke={P.gold} strokeWidth={2.5} dot={{ r:3, fill:P.gold, strokeWidth:0 }} activeDot={{ r:4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* Top Agents */}
          {showLeaderboard && (
            <div style={cardStyle}>
              <div style={titleStyle}>Top Agents — By Approval Count</div>
              {leaderboard.length === 0
                ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, color:P.textMuted, fontSize:11 }}>No data</div>
                : <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:190, overflowY:'auto', paddingRight:4 }}>
                    {leaderboard.map((a, i) => {
                      const maxA  = Math.max(...leaderboard.map(x => x.approvals), 1)
                      const pct   = Math.round((a.approvals / maxA) * 100)
                      const color = AGENT_BAR_COLORS[i % AGENT_BAR_COLORS.length]
                      const light = color === P.gold || color === P.khaki
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:80, fontSize:10, color:P.navy, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{a.name}</div>
                          <div style={{ flex:1, height:17, background:P.bgMain, borderRadius:3, position:'relative', overflow:'hidden' }}>
                            <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.4s' }} />
                            <div style={{
                              position:'absolute',
                              left: pct > 14 ? `calc(${pct}% - 26px)` : `${pct + 2}%`,
                              top:'50%', transform:'translateY(-50%)',
                              fontSize:9, fontWeight:700,
                              color: pct > 14 ? (light ? '#4A3A0A' : '#fff') : P.navy,
                            }}>{a.approvals}</div>
                          </div>
                          <div style={{ fontSize:9, color:P.textMuted, width:28, textAlign:'right', flexShrink:0 }}>{a.approval_rate}%</div>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>
          )}
        </div>

        {/* ── Row 2 — Approval Rate + Sales by Vertical + Sales by Client ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>

          {/* Approval Rate Donut */}
          <div style={cardStyle}>
            <div style={titleStyle}>Approval Rate</div>
            <div style={{ display:'flex', gap:12, alignItems:'center', justifyContent:'center' }}>
              <div style={{ position:'relative', width:148, height:148, flexShrink:0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name:'Approved', value: approvalRate.approved || 0 },
                      { name:'Pending',  value: approvalRate.pending  || 0 },
                      { name:'Rejected', value: approvalRate.rejected || 0 },
                    ]} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                      dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                      <Cell fill={P.teal} /><Cell fill={P.gold} /><Cell fill={P.brick} />
                    </Pie>
                    <Tooltip {...tooltipProps} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                  <div style={{ fontSize:22, fontWeight:700, color:P.navy, lineHeight:1 }}>{approvalRate.rate}%</div>
                  <div style={{ fontSize:7, color:P.textMuted, letterSpacing:'0.08em', marginTop:2 }}>APPROVED</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {[
                  { label:'Approved', color:P.teal,  count:approvalRate.approved },
                  { label:'Pending',  color:P.gold,  count:approvalRate.pending  },
                  { label:'Rejected', color:P.brick, count:approvalRate.rejected },
                ].map((r, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:P.textLabel, whiteSpace:'nowrap' }}>
                    <span style={{ width:9, height:9, background:r.color, borderRadius:2, flexShrink:0 }} />
                    <span>{r.label}</span>
                    <span style={{ color:P.navy, fontWeight:700, marginLeft:3 }}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sales by Vertical Donut */}
          <div style={cardStyle}>
            <div style={titleStyle}>Sales by Vertical</div>
            <VerticalDonut data={verticalPie} />
          </div>

          {/* Sales by Client Pie */}
          <div style={cardStyle}>
            <div style={titleStyle}>Sales by Client (Approved)</div>
            {clientPie.length === 0
              ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:148, color:P.textMuted, fontSize:11 }}>No approved sales</div>
              : (() => {
                  const tot = clientPie.reduce((s, d) => s + d.value, 0)
                  return (
                    <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:148, height:148, flexShrink:0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={clientPie} dataKey="value" cx="50%" cy="50%" outerRadius={68}
                              stroke="none" startAngle={90} endAngle={-270}>
                              {clientPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip {...tooltipProps} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                        {clientPie.map((d, i) => {
                          const pct = tot > 0 ? Math.round(d.value / tot * 100) : 0
                          return (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:P.textLabel }}>
                              <span style={{ width:8, height:8, background:CHART_COLORS[i % CHART_COLORS.length], borderRadius:2, flexShrink:0 }} />
                              <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:85 }}>{d.name}</span>
                              <span style={{ color:P.navy, fontWeight:700, marginLeft:3 }}>{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()
            }
          </div>
        </div>

        {/* ── Row 3 — Sale Type + Cancellation Reason (3-col grid, 3rd slot empty) ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>

          {/* Sale Type — Treemap */}
          <div style={cardStyle}>
            <div style={titleStyle}>Sale Type (CPA vs CPL)</div>
            <SaleTypeTreemap data={saleTypePie} />
          </div>

          {/* Cancellation Reasons — Pie */}
          <div style={cardStyle}>
            <div style={titleStyle}>Cancellation Reasons</div>
            <CancellationPie data={cancellationPie} />
          </div>
        </div>

        {/* ── Monthly Performance — only when period === monthly ── */}
        {period === 'monthly' && (
          <div style={{ ...cardStyle, marginBottom:10 }}>
            <div style={titleStyle}>Monthly Performance — Last 12 Months</div>
            <ResponsiveContainer width="100%" height={148}>
              <ComposedChart data={monthlyTrend} margin={{ top:6, right:8, left:-22, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={P.gridLine} vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip {...tooltipProps} />
                <Legend wrapperStyle={{ fontSize:10, color:P.textLabel, paddingTop:2 }} iconSize={8} />
                <Area type="monotone" dataKey="approvals" name="Approvals" fill={P.teal} fillOpacity={0.12} stroke={P.teal} strokeWidth={2} />
                <Bar dataKey="submissions" name="Submissions" fill={P.navy} barSize={16} radius={[2,2,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Custom Date Range Modal ── */}
      {showDateModal && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(6,19,33,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
          onClick={() => setShowDateModal(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:12, padding:24, minWidth:320, boxShadow:'0 10px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize:14, fontWeight:700, color:P.navy, marginBottom:16 }}>Select Date Range</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:11, color:P.textLabel, display:'block', marginBottom:4, fontWeight:600 }}>From Date</label>
                <DatePicker
                  selected={fromDate}
                  onChange={d => setFromDate(d)}
                  selectsStart startDate={fromDate} endDate={toDate}
                  maxDate={toDate || new Date()}
                  dateFormat="dd MMM yyyy"
                  placeholderText="Select start date"
                  className="custom-dp-input"
                />
              </div>
              <div>
                <label style={{ fontSize:11, color:P.textLabel, display:'block', marginBottom:4, fontWeight:600 }}>To Date</label>
                <DatePicker
                  selected={toDate}
                  onChange={d => setToDate(d)}
                  selectsEnd startDate={fromDate} endDate={toDate}
                  minDate={fromDate} maxDate={new Date()}
                  dateFormat="dd MMM yyyy"
                  placeholderText="Select end date"
                  className="custom-dp-input"
                />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
              <button
                onClick={() => { setShowDateModal(false); setPeriod('weekly') }}
                style={{ background:'transparent', color:P.slate, border:`1px solid ${P.border}`, padding:'7px 16px', borderRadius:6, fontSize:12, cursor:'pointer' }}
              >Cancel</button>
              <button
                onClick={() => { if (fromDate && toDate) { setPeriod('custom'); setShowDateModal(false) } }}
                disabled={!fromDate || !toDate}
                style={{ background:P.navy, color:'#fff', border:'none', padding:'7px 16px', borderRadius:6, fontSize:12, cursor:'pointer', opacity:(!fromDate || !toDate) ? 0.5 : 1 }}
              >Apply</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
