import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const ROLE_DASHBOARD = {
  admin:    '/admin/dashboard',
  director: '/director/dashboard',
  manager:  '/manager/dashboard',
  agent:    '/agent/dashboard',
}

// Dark palette - used only for the popups
const C = {
  navy:  '#061321', slate: '#3F4753', steel: '#5C6D82',
  muted: '#9FA7B2', peach: '#FBDCB4', brown: '#AA7F56', dark: '#49311E',
}

const LOGO = "data:image/png;base64,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"

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()

  const [form, setForm]             = useState({ username: '', password: '' })
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [attPopup, setAttPopup]     = useState(null)
  const [wdPopup, setWdPopup]       = useState(false)
  const [pendingNav, setPendingNav] = useState(null)
  const [showPw, setShowPw]         = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      if (!data.success) { setError(data.message || 'Login failed.'); return }
      login(data.token, data.user)
      const dest = ROLE_DASHBOARD[data.user.role] ?? '/'
      if (data.attendance_marked && data.attendance_info) {
        setPendingNav(data.show_working_days_popup ? { dest, showWd: true } : { dest, showWd: false })
        setAttPopup({ ...data.attendance_info, role: data.user.role })
      } else if (data.show_working_days_popup) {
        setWdPopup(true)
        setPendingNav({ dest })
      } else {
        navigate(dest, { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const dismissAttPopup = () => {
    setAttPopup(null)
    if (pendingNav?.showWd) {
      setWdPopup(true)
    } else {
      navigate(pendingNav?.dest ?? '/', { replace: true })
      setPendingNav(null)
    }
  }

  const dismissWdPopup = (goSetup = false) => {
    setWdPopup(false)
    if (goSetup) {
      navigate('/manager/working-days', { replace: true })
    } else {
      navigate(pendingNav?.dest ?? '/', { replace: true })
    }
    setPendingNav(null)
  }

  // Working Days popup
  if (wdPopup) {
    const nowMonth = new Date().toLocaleString('en-US', { month: 'long', timeZone: 'Asia/Karachi' })
    const nowYear  = new Date().toLocaleString('en-US', { year: 'numeric', timeZone: 'Asia/Karachi' })
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(6,19,33,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
        <div style={{ background: C.slate, border:`1px solid ${C.steel}`, borderRadius:16, padding:'2.5rem 2rem', textAlign:'center', maxWidth:400, width:'90%', boxShadow:'0 25px 60px rgba(0,0,0,0.6)' }}>
          <div style={{ height:4, background:'linear-gradient(90deg,' + C.dark + ',' + C.brown + ',' + C.dark + ')', borderRadius:'4px 4px 0 0', margin:'-2.5rem -2rem 2rem' }} />
          <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
          <h2 style={{ color: C.peach, fontFamily:"'Rajdhani',sans-serif", fontSize:'1rem', fontWeight:700, margin:'0 0 6px', letterSpacing:'0.05em' }}>
            New Month Detected
          </h2>
          <p style={{ color: C.brown, fontSize:'1.05rem', fontWeight:700, margin:'0 0 12px', fontFamily:"'Rajdhani',sans-serif", letterSpacing:'0.05em' }}>
            {nowMonth} {nowYear}
          </p>
          <p style={{ color: C.muted, fontSize:'0.85rem', margin:'0 0 28px', lineHeight:1.6 }}>
            Working days for this month have not been configured yet. Please set up the monthly calendar before employees start logging in.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
            <button onClick={() => dismissWdPopup(false)}
              style={{ background:'transparent', color: C.muted, border:'1px solid ' + C.steel, borderRadius:8, padding:'9px 20px', fontSize:'0.9rem', fontFamily:"'Rajdhani',sans-serif", fontWeight:600, cursor:'pointer', letterSpacing:'0.04em' }}
              onMouseEnter={e => { e.currentTarget.style.color=C.peach; e.currentTarget.style.borderColor=C.brown }}
              onMouseLeave={e => { e.currentTarget.style.color=C.muted; e.currentTarget.style.borderColor=C.steel }}>
              Remind Me Later
            </button>
            <button onClick={() => dismissWdPopup(true)}
              style={{ background:'linear-gradient(135deg,' + C.dark + ',#6b4527)', color: C.peach, border:'none', borderRadius:8, padding:'9px 24px', fontSize:'0.9rem', fontFamily:"'Rajdhani',sans-serif", fontWeight:700, letterSpacing:'0.06em', cursor:'pointer', boxShadow:'0 4px 15px rgba(73,49,30,0.5)' }}
              onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg,' + C.brown + ',' + C.dark + ')'}
              onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg,' + C.dark + ',#6b4527)'}>
              Setup Now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Attendance popup
  if (attPopup) {
    return (
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(1200px 700px at 20% 10%, #f3f6f8 0%, transparent 60%), radial-gradient(900px 600px at 90% 90%, #d9e0e4 0%, transparent 55%), linear-gradient(135deg, #eef1f3 0%, #dde3e7 50%, #cdd5da 100%)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
        <div style={{ background:'linear-gradient(180deg, rgba(255,255,255,.88), rgba(255,255,255,.72))', backdropFilter:'blur(20px) saturate(1.1)', WebkitBackdropFilter:'blur(20px) saturate(1.1)', border:'1px solid rgba(255,255,255,.7)', borderRadius:22, padding:'2.5rem 2.2rem', textAlign:'center', maxWidth:360, width:'90%', boxShadow:'0 30px 60px -20px rgba(74,90,99,.35), 0 18px 36px -18px rgba(74,90,99,.25)' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg, #5d6f78, #4a5a63)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 8px 20px -6px rgba(74,90,99,.45)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width:30, height:30 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontFamily:"'Outfit', sans-serif", color:'#4a5a63', fontSize:'1.25rem', fontWeight:700, margin:'0 0 6px', letterSpacing:'-0.01em' }}>
            {attPopup.is_late ? 'Late Attendance Marked' : 'Attendance Marked'}
          </h2>
          <p style={{ color:'#8a9aa2', fontSize:'0.85rem', margin:'0 0 20px' }}>
            Your attendance has been recorded for today
          </p>
          <div style={{ height:1, background:'linear-gradient(90deg, transparent, #d4dade, transparent)', margin:'0 0 18px' }} />
          <div style={{ fontFamily:"'Outfit', sans-serif", color:'#4a5a63', fontSize:'3rem', fontWeight:700, lineHeight:1, marginBottom:6, letterSpacing:'-0.02em' }}>
            {attPopup.time}
          </div>
          <div style={{ color:'#8a9aa2', fontSize:'0.9rem', marginBottom: attPopup.is_late ? 14 : 28 }}>
            {attPopup.date}
          </div>
          {attPopup.is_late && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(74,90,99,0.08)', border:'1px solid #c4cdd3', borderRadius:20, padding:'5px 16px', marginBottom:24, color:'#5d6f78', fontSize:'0.8rem', fontFamily:"'Outfit', sans-serif", fontWeight:700, letterSpacing:'0.06em' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width:14, height:14 }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              LATE +{attPopup.late_minutes} min
            </div>
          )}
          <button onClick={dismissAttPopup}
            style={{ width:'100%', padding:'13px 0', border:0, borderRadius:12, background:'linear-gradient(180deg, #5d6f78 0%, #4a5a63 100%)', color:'#fff', fontFamily:"'Outfit', sans-serif", fontSize:'0.95rem', fontWeight:600, letterSpacing:'.18em', textTransform:'uppercase', cursor:'pointer', boxShadow:'0 8px 20px -8px rgba(74,90,99,.55), inset 0 1px 0 rgba(255,255,255,.18)', transition:'filter .2s ease' }}
            onMouseEnter={e => e.currentTarget.style.filter='brightness(1.08)'}
            onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}>
            OK, GOT IT
          </button>
        </div>
      </div>
    )
  }

  const fieldStyle = {
    position:'relative', display:'flex', alignItems:'center',
    background:'#e6ebee', border:'1px solid transparent',
    borderRadius:12, padding:'0 14px', transition:'all .25s ease',
  }
  const inputStyle = {
    flex:1, border:0, background:'transparent', outline:'none',
    padding:'16px 12px', fontFamily:"'Inter', sans-serif",
    fontSize:15, color:'#4a5a63', fontWeight:500, letterSpacing:'.01em',
  }
  const iconStyle = { width:18, height:18, color:'#8a9aa2', flexShrink:0 }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500&display=swap');
        @keyframes rise    { from { opacity:0; transform:translateY(18px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes floaty  { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
        .lcard  { animation: rise .8s cubic-bezier(.2,.7,.2,1) both; }
        .lwrap  { animation: floaty 4s ease-in-out infinite; display:flex; justify-content:center; margin-bottom:22px; }
        .lfield:focus-within { background:#fff !important; border-color:#8a9aa2 !important; box-shadow:0 0 0 4px rgba(122,140,149,.12) !important; }
        .lbtn::after { content:""; position:absolute; inset:0; background:linear-gradient(120deg, transparent 30%, rgba(255,255,255,.25) 50%, transparent 70%); transform:translateX(-100%); transition:transform .6s ease; pointer-events:none; }
        .lbtn:hover::after { transform:translateX(100%); }
        .lbtn:hover { filter:brightness(1.05); }
        .lbtn:active { transform:translateY(1px); }
        input::placeholder { color:#aab6bd; font-weight:400; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #e6ebee inset !important;
          box-shadow: 0 0 0 1000px #e6ebee inset !important;
          -webkit-text-fill-color: #4a5a63 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .lfield:focus-within input:-webkit-autofill,
        .lfield:focus-within input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          box-shadow: 0 0 0 1000px #ffffff inset !important;
        }
      `}</style>

      <div style={{
        fontFamily:"'Inter', sans-serif",
        background:'radial-gradient(1200px 700px at 20% 10%, #f3f6f8 0%, transparent 60%), radial-gradient(900px 600px at 90% 90%, #d9e0e4 0%, transparent 55%), linear-gradient(135deg, #eef1f3 0%, #dde3e7 50%, #cdd5da 100%)',
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        padding:'32px 16px', color:'#5d6f78', overflowX:'hidden', position:'relative',
      }}>

        <div style={{
          position:'fixed', inset:0, pointerEvents:'none', opacity:.35,
          backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'2\' stitchTiles=\'stitch\'/><feColorMatrix values=\'0 0 0 0 0.36  0 0 0 0 0.43  0 0 0 0 0.47  0 0 0 0.08 0\'/></filter><rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/></svg>")',
          mixBlendMode:'multiply',
        }} />

        <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(40px)', opacity:.55, zIndex:0, width:340, height:340, background:'radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0) 70%)', top:-80, left:-80 }} />
        <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(40px)', opacity:.55, zIndex:0, width:420, height:420, background:'radial-gradient(circle, #c2ccd2 0%, rgba(194,204,210,0) 70%)', bottom:-120, right:-100 }} />

        <main className="lcard" style={{
          position:'relative', zIndex:2, width:'100%', maxWidth:432,
          background:'linear-gradient(180deg, rgba(255,255,255,.85), rgba(255,255,255,.7))',
          backdropFilter:'blur(20px) saturate(1.1)',
          WebkitBackdropFilter:'blur(20px) saturate(1.1)',
          border:'1px solid rgba(255,255,255,.7)',
          borderRadius:22, padding:'44px 38px 44px',
          boxShadow:'0 30px 60px -20px rgba(74,90,99,.35), 0 18px 36px -18px rgba(74,90,99,.25)',
        }}>

          <header style={{ textAlign:'center', marginBottom:32 }}>
            <div className="lwrap">
              <img src={LOGO} alt="Meta Voice logo" style={{ width:130, height:'auto', filter:'drop-shadow(0 12px 22px rgba(74,90,99,.3))' }} />
            </div>
            <h1 style={{ fontFamily:"'Outfit', sans-serif", fontSize:38, fontWeight:700, letterSpacing:'-.02em', color:'#4a5a63', lineHeight:1.05, margin:0 }}>
              User Login
            </h1>
            <p style={{ marginTop:16, fontSize:13, letterSpacing:'.22em', textTransform:'uppercase', color:'#8a9aa2', fontWeight:700 }}>
              Welcome to Meta-Voice
            </p>
          </header>

          {error && (
            <div style={{ marginBottom:14, background:'rgba(214,40,40,0.08)', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', color:'#b91c1c', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
              <svg style={{ width:16, height:16, flexShrink:0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14, marginTop:8 }}>

            <div className="lfield" style={fieldStyle}>
              <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input name="username" type="text" autoComplete="username" required
                value={form.username} onChange={handleChange}
                placeholder="Username" style={inputStyle} />
            </div>

            <div className="lfield" style={fieldStyle}>
              <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input name="password" type={showPw ? 'text' : 'password'}
                autoComplete="current-password" required
                value={form.password} onChange={handleChange}
                placeholder="Password" style={inputStyle} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ background:'transparent', border:0, color:'#8a9aa2', cursor:'pointer', padding:6, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6, transition:'color .2s' }}
                onMouseEnter={e => e.currentTarget.style.color='#4a5a63'}
                onMouseLeave={e => e.currentTarget.style.color='#8a9aa2'}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {showPw
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6, padding:'0 4px' }}>
              <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none', fontSize:13, color:'#5d6f78' }}
                onClick={() => setRememberMe(v => !v)}>
                <span style={{
                  width:18, height:18, borderRadius:5,
                  border: rememberMe ? 'none' : '1.5px solid #8a9aa2',
                  background: rememberMe ? '#5d6f78' : '#fff',
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  transition:'all .2s', flexShrink:0,
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                    style={{ width:12, height:12, opacity: rememberMe ? 1 : 0, transform: rememberMe ? 'scale(1)' : 'scale(.6)', transition:'all .2s' }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                Remember me
              </label>
              <a href="#" style={{ fontSize:13, color:'#8a9aa2', textDecoration:'none', fontStyle:'italic', transition:'color .2s' }}
                onClick={e => e.preventDefault()}
                onMouseEnter={e => { e.currentTarget.style.color='#4a5a63'; e.currentTarget.style.textDecoration='underline' }}
                onMouseLeave={e => { e.currentTarget.style.color='#8a9aa2'; e.currentTarget.style.textDecoration='none' }}>
                Forgot your password?
              </a>
            </div>

            <div style={{ height:1, background:'linear-gradient(90deg, transparent, #d4dade, transparent)', margin:'6px 0 4px' }} />

            <button type="submit" disabled={loading} className="lbtn"
              style={{
                width:'100%', padding:16, border:0, borderRadius:12,
                background:'linear-gradient(180deg, #5d6f78 0%, #4a5a63 100%)',
                color:'#fff', fontFamily:"'Outfit', sans-serif",
                fontSize:15, fontWeight:600, letterSpacing:'.18em', textTransform:'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                boxShadow:'0 8px 20px -8px rgba(74,90,99,.55), inset 0 1px 0 rgba(255,255,255,.18)',
                transition:'transform .15s ease, box-shadow .25s ease, filter .2s ease',
                position:'relative', overflow:'hidden', opacity: loading ? 0.7 : 1,
              }}
              onMouseDown={e => { if(!loading) e.currentTarget.style.transform='translateY(1px)' }}
              onMouseUp={e => e.currentTarget.style.transform=''}>
              {loading ? (
                <>
                  <svg style={{ width:16, height:16 }} viewBox="0 0 24 24" fill="none" className="animate-spin">
                    <circle style={{ opacity:.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity:.75 }} fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Login
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width:16, height:16 }}>
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>

          </form>

        </main>
      </div>
    </>
  )
}