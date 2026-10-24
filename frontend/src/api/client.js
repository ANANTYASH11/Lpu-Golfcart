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
  getStopsNearMe: (lat, lon, limit = 5) => request(`/transport/stops/near-me?lat=${lat}&lon=${lon}&limit=${limit}`),
  getRoute: (id) => request(`/transport/routes/${id}`),
  searchTrips: (fromId, toId) => request(`/transport/trips/search?from=${fromId}&to=${toId}`),
  getStopArrivals: (stopId) => request(`/transport/stops/${stopId}/arrivals`),
  getShuttleProgress: (shuttleId) => request(`/transport/shuttle/${shuttleId}/progress`),
  getTimetable: (scheduleType = 'REGULAR') => request(`/transport/timetable?schedule_type=${scheduleType}`),
  getNextDepartures: (stopId) => request(`/transport/timetable/next-departures/${stopId}`),
  exportTimetableCsvUrl: () => `${API_BASE}/transport/timetable/export-csv`,
  importTimetableCsv: (formData) => {
    const token = getAuthToken();
    return fetch(`${API_BASE}/transport/timetable/import-csv`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    }).then(res => res.json());
  },
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

  // Fare Engine & Calculator
  calculateFare: (pickupStopId, dropStopId, vehicleType = null, isPriority = null) => {
    let url = `/fares/calculate?pickup_stop_id=${pickupStopId}&drop_stop_id=${dropStopId}`;
    if (vehicleType) url += `&vehicle_type=${vehicleType}`;
    if (isPriority !== null) url += `&is_priority=${isPriority}`;
    return request(url);
  },
  getFareRules: () => request('/fares/rules'),

  // Module 3: Last-Mile & Golf Cart Booking
  getStandAvailability: (stopId) => request(`/lastmile/availability${stopId ? `?stop_id=${stopId}` : ''}`),
  getFareQuote: (fromStandId, toStandId) => request(`/lastmile/fare?from_stand_id=${fromStandId}&to_stand_id=${toStandId}`),
  getAvailableCarts: () => request('/lastmile/carts/available'),
  createBooking: (params) => request('/lastmile/bookings', {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  getBooking: (id) => request(`/lastmile/bookings/${id}`),
  getActiveStudentBooking: () => request('/lastmile/bookings/student/active'),
  getAssignedDriverBooking: () => request('/lastmile/bookings/driver/assigned'),
  updateBookingStatus: (id, action, reason) => request(`/lastmile/bookings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ action, reason })
  }),
  cancelBooking: (id, reason = 'Cancelled by user') => request(`/lastmile/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  rateBooking: (id, rating, feedback = '') => request(`/lastmile/bookings/${id}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating, feedback })
  }),

  // Payments & Campus Wallet (Razorpay Test Mode)
  createPaymentOrder: (amountPaise, bookingId = null) => request('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ amount_paise: amountPaise, booking_id: bookingId })
  }),
  verifyPayment: (razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId = null) => request('/payments/verify', {
    method: 'POST',
    body: JSON.stringify({
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: razorpaySignature,
      booking_id: bookingId
    })
  }),
  getWalletBalance: () => request('/payments/wallet/balance'),
  getWalletLedger: () => request('/payments/wallet/ledger'),
  topupWallet: (amountInr) => request('/payments/wallet/topup', {
    method: 'POST',
    body: JSON.stringify({ amount_inr: amountInr })
  }),
  payWithWallet: (bookingId) => request('/payments/wallet/pay', {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId })
  }),
  getPaymentReceipt: (bookingId) => request(`/payments/receipt/${bookingId}`),
  getAdminCollections: () => request('/payments/admin/collections'),

  // Priority Access & Document Vault
  applyPriority: (formData) => {
    const token = getAuthToken();
    return fetch(`${API_BASE}/priority/apply`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Priority application submission failed');
      }
      return res.json();
    });
  },
  getPriorityStatus: () => request('/priority/status'),
  getPriorityDocumentUrl: (id) => `${API_BASE}/priority/document/${id}`,
  getAdminPriorityApplications: (status = null) => request(`/priority/admin/applications${status ? `?status_filter=${status}` : ''}`),
  reviewPriorityApplication: (id, action, notes = '', validityDays = 180) => request(`/priority/admin/applications/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, notes, validity_days: validityDays })
  }),

  // Campus Safety & SOS Emergency Beacon
  getSafetyHelpline: () => request('/safety/helpline'),
  triggerSos: (params) => request('/safety/sos/trigger', {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  updateSosLocation: (sosId, params) => request(`/safety/sos/${sosId}/location`, {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  resolveSos: (sosId, resolutionNotes = '') => request(`/safety/sos/${sosId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution_notes: resolutionNotes })
  }),
  getActiveSosBeacons: () => request('/safety/sos/active'),
  submitIncidentReport: (params) => request('/safety/incident/report', {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  getMyIncidentReports: () => request('/safety/incident/my-reports'),
  getAdminIncidents: () => request('/safety/admin/incidents')
};




