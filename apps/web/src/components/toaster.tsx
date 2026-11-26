'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { Toast, useNotificationStore } from '@/lib/stores/notification-store';

const TOAST_DURATION_MS = 6000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useNotificationStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  const body = (
    <div className="flex items-start gap-3">
      <Bell className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{toast.title}</p>
        <p className="text-sm text-gray-600 line-clamp-2">{toast.message}</p>
      </div>
    </div>
  );

  return (
    <div
      role="status"
      className="pointer-events-auto relative w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 pr-9"
    >
      {toast.actionUrl ? (
        <Link href={toast.actionUrl} onClick={() => dismiss(toast.id)}>
          {body}
        </Link>
      ) : (
        body
      )}
      <button
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Live notification toasts, bottom-right. */
export function Toaster() {
  const toasts = useNotificationStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
