const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Token storage key
const TOKEN_KEY = 'authToken';

/**
 * Get the stored JWT token
 */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store the JWT token
 */
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the JWT token
 */
function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Generic fetch wrapper with error handling and JWT authentication
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, { ...headers, ...options, headers });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    
    // Handle token expiration or invalid token
    if (response.status === 401) {
      removeToken();
      localStorage.removeItem('currentUser');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    throw new Error(error.error || `HTTP error ${response.status}`);
  }
  
  return response.json();
}

// ============ Auth API ============
export const authApi = {
  /**
   * Login with username and password
   * Stores JWT token on successful login
   */
  login: async (username, password) => {
    const response = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    // Store the token
    if (response.token) {
      setToken(response.token);
    }
    
    return response;
  },
  
  /**
   * Logout - calls backend to log the action, then clears stored token
   * IMPORTANT: Backend is called BEFORE clearing token so we can authenticate
   * @param {string} reason - 'manual' | 'token_expired' | 'forced'
   */
  logout: async (reason = 'manual') => {
    try {
      // Call backend to log the logout BEFORE clearing token
      // This ensures we can still authenticate with the token
      await fetchApi('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (error) {
      // If logout API fails (e.g., token already expired), continue with local cleanup
      console.warn('Logout API call failed:', error.message);
    } finally {
      // Always clear local storage regardless of API result
      removeToken();
      localStorage.removeItem('currentUser');
    }
  },
};

// ============ Users API ============
export const usersApi = {
  getAll: () => fetchApi('/users'),
  getById: (id) => fetchApi(`/users/${id}`),
  create: (userData) => fetchApi('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  update: (id, userData) => fetchApi(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  }),
  delete: (id) => fetchApi(`/users/${id}`, {
    method: 'DELETE',
  }),
};

// ============ Products API ============
export const productsApi = {
  getAll: () => fetchApi('/products'),
  getById: (id) => fetchApi(`/products/${id}`),
  create: (productData) => fetchApi('/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  }),
  update: (id, productData) => fetchApi(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  }),
  delete: (id) => fetchApi(`/products/${id}`, {
    method: 'DELETE',
  }),
};

// ============ Orders API ============
export const ordersApi = {
  getAll: () => fetchApi('/orders'),
  getById: (id) => fetchApi(`/orders/${id}`),
  create: (orderData) => fetchApi('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
  }),
  update: (id, orderData) => fetchApi(`/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(orderData),
  }),
  approve: (id) => fetchApi(`/orders/${id}/approve`, {
    method: 'PUT',
  }),
  reject: (id) => fetchApi(`/orders/${id}/reject`, {
    method: 'PUT',
  }),
};

// ============ Logs API ============
export const logsApi = {
  getAll: () => fetchApi('/logs'),
  create: (logData) => fetchApi('/logs', {
    method: 'POST',
    body: JSON.stringify(logData),
  }),
};

// ============ Health Check ============
export const healthCheck = () => fetchApi('/health');
