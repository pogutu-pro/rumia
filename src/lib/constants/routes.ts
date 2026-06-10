// Standard Marketplace routes

export const PUBLIC_ROUTES = {
  HOME: '/',
  HOSTELS: '/hostels',
  LISTING: (id: string | number) => `/listing/${id}`,
  AGENT: (id: string | number) => `/agent/${id}`,
};

export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  CALLBACK: '/auth/callback',
};

export const STUDENT_ROUTES = {
  SAVED: '/saved',
  ACCOUNT: '/account',
};

export const DASHBOARD_ROUTES = {
  INDEX: '/dashboard',
  NEW: '/dashboard/new',
  ADMIN: '/admin',
};

export const API_ROUTES = {
  TRACK_LEAD: '/api/track-lead',
  UPLOAD_URL: '/api/upload-url',
};

export const ROUTE_GROUPS = {
  PUBLIC: PUBLIC_ROUTES,
  AUTH: AUTH_ROUTES,
  DASHBOARD: DASHBOARD_ROUTES,
  API: API_ROUTES,
};

export default ROUTE_GROUPS;
