import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m',  target: 200 },  // Spike to 200 concurrent users
    { duration: '30s', target: 500 },  // High load target: 500 VUs
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<500'], // 95% of requests must complete < 300ms
    http_req_failed: ['rate<0.01'],                 // Error rate < 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000/api';

export default function () {
  // 1. Health check ping
  const healthRes = http.get(`${BASE_URL.replace('/api', '')}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });

  // 2. Fetch trip analytics (Redis cached)
  const analyticsRes = http.get(`${BASE_URL}/analytics/trips/demo-trip-id`);
  check(analyticsRes, {
    'analytics status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'analytics latency < 150ms': (r) => r.timings.duration < 150,
  });

  // 3. Category AI suggestion (Non-blocking fallback test)
  const categoryRes = http.get(`${BASE_URL}/ai/suggest-category?description=Dinner+with+friends`);
  check(categoryRes, {
    'suggest category status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
