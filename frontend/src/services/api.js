// src/services/api.js
import axios from 'axios';

// Ensure API URL always ends with /api
// const getApiBaseUrl = () => {
//   const envUrl = process.env.REACT_APP_API_URL || 'https://track-trips.onrender.com';
//   // Remove trailing slash if present
//   const cleanUrl = envUrl.replace(/\/$/, '');
//   // Ensure /api is appended
//   return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
// };

const getApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl) {
    const clean = envUrl.trim().replace(/\/$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isTunnelHost = hostname.includes('devtunnels.ms') || hostname.includes('localtunnel.me') || hostname.includes('ngrok-free.app') || hostname.includes('trycloudflare.com');

    if (isLocalHost) {
      return 'http://localhost:5000/api';
    }

    if (isTunnelHost) {
      const backendHostname = hostname.replace(/-(\d+)\./, '-5000.');
      return `${protocol}//${backendHostname}/api`;
    }
  }

  return 'https://track-trips.onrender.com/api';
};


const API_BASE_URL = getApiBaseUrl();

// Log API base URL in development
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/users/register', data),
  login: (data) => api.post('/users/login', data),
  getCurrentUser: () => api.get('/users/me'),
  updateUpiId: (upi_id) => api.patch('/users/me/upi-id', { upi_id }),
  forgotPassword: (data) => api.post('/users/forgot-password', data),
  resetPassword: (data) => api.post('/users/reset-password', data),
};

// Groups API
export const groupsAPI = {
  create: (data) => api.post('/groups/create', data),
  join: (data) => api.post('/groups/join', data),
  joinByInvite: (token) => api.post('/groups/join/invite', { token }),
  getMyGroups: () => api.get('/groups/my-groups'),
  getById: (groupId) => api.get(`/groups/${groupId}`),
  getMembers: (groupId) => api.get(`/groups/${groupId}/members`),
  removeMember: (groupId, username) => api.delete(`/groups/${groupId}/members`, { data: { username } }),
  createInvite: (groupId) => api.post(`/groups/${groupId}/invite`),
  delete: (groupId) => api.delete(`/groups/${groupId}`),
  updatePassword: (groupId, password) => api.patch(`/groups/${groupId}/password`, { password }),
};

// Trips API
export const tripsAPI = {
  create: (data) => api.post('/trips', data),
  getGroupTrips: (groupId) => api.get(`/trips/group/${groupId}`),
  getById: (tripId) => api.get(`/trips/${tripId}`),
  getMembers: (tripId) => api.get(`/trips/${tripId}/members`),
  addMember: (tripId, username) => api.post(`/trips/${tripId}/members`, { username }),
  removeMember: (tripId, username) => api.delete(`/trips/${tripId}/members`, { data: { username } }),
  update: (tripId, data) => api.put(`/trips/${tripId}`, data),
  delete: (tripId) => api.delete(`/trips/${tripId}`),
};

// Expenses API
export const expensesAPI = {
  add: (data) => api.post('/expenses', data),
  getTripExpenses: (tripId) => api.get(`/expenses/trip/${tripId}`),
  delete: (expenseId) => api.delete(`/expenses/${expenseId}`),
};

// Settlements API
export const settlementsAPI = {
  getTripSettlements: (tripId) => api.get(`/settlements/trips/${tripId}`),
};
// Payments API
export const paymentsAPI = {
  listTrip: (tripId) => api.get(`/payments/trip/${tripId}`),
  initiate: (payload) => api.post('/payments/initiate', payload),
  claimPaid: (paymentId) => api.post(`/payments/${paymentId}/claim-paid`),
  reject: (paymentId) => api.post(`/payments/${paymentId}/reject`),
  complete: (paymentId) => api.patch(`/payments/${paymentId}/complete`),
  reset: (tripId, options = { mode: 'soft' }) => api.post(`/payments/trip/${tripId}/reset`, options),
};

// Places API
export const placesAPI = {
  add: (data, photoFile) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      formData.append(key, data[key]);
    });
    if (photoFile) {
      formData.append('photo', photoFile);
    }
    return api.post('/places', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getTripPlaces: (tripId) => api.get(`/places/trip/${tripId}`),
  update: (placeId, data) => api.put(`/places/${placeId}`, data),
  delete: (placeId) => api.delete(`/places/${placeId}`),
};

// Analytics API
export const analyticsAPI = {
  getTripAnalytics: (tripId) => api.get(`/analytics/trips/${tripId}`),
};

// AI API
export const aiAPI = {
  suggestCategory: (description) => api.get('/ai/suggest-category', { params: { description } }),
  getSettlementExplain: (tripId) => api.get(`/ai/trips/${tripId}/settlement-explain`),
  copilotChat: (tripId, data) => api.post(`/ai/trips/${tripId}/copilot`, data),
};

export default api;
