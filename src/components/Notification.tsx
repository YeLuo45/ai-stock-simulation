import { useStore } from '../store'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import clsx from 'clsx'

export default function Notification() {
  const { notification, clearNotification } = useStore()

  if (!notification) return null

  const icons = {
    success: <CheckCircle size={18} className="text-accent-success" />,
    error: <AlertCircle size={18} className="text-accent-danger" />,
    info: <Info size={18} className="text-accent-primary" />,
  }

  const bgColors = {
    success: 'border-accent-success/30 bg-accent-success/10',
    error: 'border-accent-danger/30 bg-accent-danger/10',
    info: 'border-accent-primary/30 bg-accent-primary/10',
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg max-w-sm',
          bgColors[notification.type]
        )}
      >
        {icons[notification.type]}
        <span className="text-sm flex-1">{notification.message}</span>
        <button
          onClick={clearNotification}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
