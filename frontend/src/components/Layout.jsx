import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children, sidebarCollapsed, onSidebarCollapsedChange }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)

  // If parent passes controlled props, use them; otherwise manage internally
  const collapsed    = sidebarCollapsed          !== undefined ? sidebarCollapsed          : internalCollapsed
  const setCollapsed = onSidebarCollapsedChange  !== undefined ? onSidebarCollapsedChange  : setInternalCollapsed

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F0F2F5' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <main className="flex-1 overflow-y-auto relative min-w-0" style={{ background: '#F0F2F5' }}>
        {/* Re-open button — visible only when sidebar is collapsed */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="Open sidebar"
            className="absolute top-3 left-3 z-20 flex items-center justify-center w-7 h-7 rounded-lg shadow-lg transition-all"
            style={{ background: '#EDF0F3', color: '#132E57', border: '1px solid #E0DDD5', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1E8496'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#1E8496' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EDF0F3'; e.currentTarget.style.color = '#132E57'; e.currentTarget.style.borderColor = '#E0DDD5' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {children}
      </main>
    </div>
  )
}
