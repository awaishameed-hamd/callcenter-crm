import { useEffect } from 'react'

const STYLES = {
  success: {
    wrapper: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: 'text-emerald-500',
    path: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  error: {
    wrapper: 'bg-red-50 border-red-200 text-red-800',
    icon: 'text-red-500',
    path: 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  },
}

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const s = STYLES[type] ?? STYLES.success

  return (
    <div className={`fixed top-5 right-5 z-50 flex items-start gap-3 max-w-sm w-full rounded-xl border px-4 py-3.5 shadow-lg animate-in fade-in slide-in-from-top-2 ${s.wrapper}`}>
      <svg className={`w-5 h-5 shrink-0 mt-0.5 ${s.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={s.path} />
      </svg>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button onClick={onClose} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
