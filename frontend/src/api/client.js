const API_BASE = '/api/v1';

export function getAuthToken() {
  return localStorage.getItem('campusride_token') || '';
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('campusride_token', token);
  } else {
    localStorage.removeItem('campusride_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = 'Network request failed';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: () => request('/auth/me'),
  getDemoUsers: () => request('/auth/demo-users'),

  // Module 1: Student Transport
  getStops: () => request('/transport/stops'),
  getRoute: (id) => request(`/transport/routes/${id}`),
  searchTrips: (fromId, toId) => request(`/transport/trips/search?from=${fromId}&to=${toId}`),
  getStopArrivals: (stopId) => request(`/transport/stops/${stopId}/arrivals`),
  getJourney: (fromId, toId) => request(`/transport/journey?from=${fromId}&to=${toId}`),

  // Module 2: Shuttle Operations
  getActiveTrips: () => request('/operations/trips/active'),
  getTrip: (id) => request(`/operations/trips/${id}`),
  startTrip: (id, startStopId) => request(`/operations/trips/${id}/start`, { method: 'POST', body: JSON.stringify({ start_stop_id: startStopId }) }),
  progressTrip: (id, nextStopId, passengerCount, delaySec = 0) => request(`/operations/trips/${id}/progress`, {
    method: 'POST',
    body: JSON.stringify({ next_stop_id: nextStopId, passenger_count: passengerCount, delay_sec: delaySec })
  }),
  updateCrowd: (id, passengerCount, notes) => request(`/operations/trips/${id}/crowd`, {
    method: 'POST',
    body: JSON.stringify({ passenger_count: passengerCount, notes })
  }),
  endTrip: (id) => request(`/operations/trips/${id}/end`, { method: 'POST' }),
  cancelTrip: (id, reason) => request(`/operations/trips/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  undoTrip: (id) => request(`/operations/trips/${id}/undo`, { method: 'POST' }),

  // Module 3: Last-Mile & Golf Cart Booking
  getStandAvailability: (stopId) => request(`/lastmile/availability${stopId ? `?stop_id=${stopId}` : ''}`),
  getFareQuote: (fromStandId, toStandId) => request(`/lastmile/fare?from_stand_id=${fromStandId}&to_stand_id=${toStandId}`),
  getAvailableCarts: () => request('/lastmile/carts/available'),
  createBooking: (pickupStopId, dropStopId, passengerCount, isPriority, priorityReason) => request('/lastmile/bookings', {
    method: 'POST',
    body: JSON.stringify({
      pickup_stop_id: pickupStopId,
      drop_stop_id: dropStopId,
      passenger_count: passengerCount,
      is_priority: isPriority,
      priority_reason: priorityReason
    })
  }),
  getBooking: (id) => request(`/lastmile/bookings/${id}`),
  getActiveStudentBooking: () => request('/lastmile/bookings/student/active'),
  getAssignedDriverBooking: () => request('/lastmile/bookings/driver/assigned'),
  updateBookingStatus: (id, action, reason) => request(`/lastmile/bookings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ action, reason })
  })
};
