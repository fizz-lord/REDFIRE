import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastCtx {
  addToast: (message: string, type?: Toast['type']) => void
}

const Ctx = createContext<ToastCtx>({ addToast: () => {} })
export const useToast = () => useContext(Ctx)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const color = (t: Toast) => {
    switch (t.type) {
      case 'success': return 'bg-[#1a3a1a] border-[#4ac94a] text-[#66ff66]'
      case 'error': return 'bg-[#3a1a1a] border-[#c94a4a] text-[#ff6666]'
      default: return 'bg-[#1a1a3a] border-[#4a4ac9] text-[#6666ff]'
    }
  }

  return (
    <Ctx.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`${color(t)} border rounded px-4 py-2.5 text-sm shadow-lg animate-slide-in`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
