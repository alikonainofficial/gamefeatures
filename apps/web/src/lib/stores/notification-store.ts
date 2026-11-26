import { create } from 'zustand';

export interface Toast {
  id: string;
  title: string;
  message: string;
  actionUrl?: string | null;
}

interface NotificationState {
  /** Unread notifications for the signed-in user (header badge). */
  unreadCount: number;
  toasts: Toast[];
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: () => void;
  pushToast: (toast: Toast) => void;
  dismissToast: (id: string) => void;
}

/** At most this many toasts are shown; older ones drop off. */
const MAX_TOASTS = 3;

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  toasts: [],
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  decrementUnread: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  pushToast: (toast) =>
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== toast.id), toast].slice(-MAX_TOASTS) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
