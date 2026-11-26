import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  userType: 'GAMER' | 'DEVELOPER';
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Exchanges the refresh-token cookie for a new access token. Throws if the session is gone. */
  refresh: () => Promise<string>;
  initialize: () => Promise<void>;
}

const signedOut = { user: null, accessToken: null, isAuthenticated: false } as const;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setAccessToken: (token) => set({ accessToken: token }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ accessToken: string }>('/auth/login', {
        email,
        password,
      });
      set({ accessToken: response.accessToken });

      // Fetch user data
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Login failed', isLoading: false });
      throw error;
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ accessToken: string }>('/auth/register', {
        email,
        username,
        password,
      });
      set({ accessToken: response.accessToken });

      // Fetch user data
      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Registration failed', isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      // Ignore errors
    }
    set({ ...signedOut });
  },

  refresh: async () => {
    const response = await api.post<{ accessToken: string }>('/auth/refresh', {});
    set({ accessToken: response.accessToken });
    return response.accessToken;
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      // Restore the session from the refresh-token cookie. This goes through the client's
      // shared refresh, so it can't race a refresh triggered by a 401 elsewhere on the page.
      const token = await api.refreshAccessToken();
      if (!token) {
        set({ ...signedOut, isLoading: false });
        return;
      }

      const user = await api.get<User>('/auth/me');
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ ...signedOut, isLoading: false });
    }
  },
}));

// Give the API client access to the in-memory token (done here to avoid a circular import).
api.configureAuth({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refresh: () => useAuthStore.getState().refresh(),
  onAuthFailure: () => useAuthStore.setState({ ...signedOut }),
});
