// Server-Sent Events subscriber for CampusRide
class SSEClient {
  constructor() {
    this.source = null;
    this.listeners = new Set();
    this.connected = false;
  }

  connect() {
    if (this.source) return;

    this.source = new EventSource('/api/v1/stream/events');

    this.source.onopen = () => {
      this.connected = true;
      this.notifyListeners({ event_type: 'SSE_CONNECTED', payload: {} });
    };

    this.source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyListeners(data);
      } catch (err) {
        // Ping or parse issue
      }
    };

    this.source.onerror = () => {
      this.connected = false;
      this.notifyListeners({ event_type: 'SSE_DISCONNECTED', payload: {} });
      if (this.source) {
        this.source.close();
        this.source = null;
      }
      // Reconnect after 3 seconds
      setTimeout(() => this.connect(), 3000);
    };
  }

  subscribe(callback) {
    this.listeners.add(callback);
    if (!this.source) {
      this.connect();
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('SSE listener error:', err);
      }
    });
  }

  disconnect() {
    if (this.source) {
      this.source.close();
      this.source = null;
      this.connected = false;
    }
  }
}

export const sseClient = new SSEClient();
