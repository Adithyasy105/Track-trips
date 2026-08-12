// backend/src/utils/metrics.js

class MetricsRegistry {
  constructor() {
    this.counters = {
      redis_hit_total: 0,
      redis_miss_total: 0,
      kafka_publish_success_total: 0,
      kafka_publish_failed_total: 0,
      outbox_published_total: 0,
      outbox_failed_total: 0,
      outbox_dead_letter_total: 0,
      ai_request_total: 0,
      ai_request_success_total: 0,
      ai_request_error_total: 0,
      api_error_total: 0,
    };

    this.gauges = {
      outbox_pending_count: 0,
      ai_last_latency_ms: 0,
    };

    this.histograms = {
      ai_latency_ms: [],
    };
  }

  inc(counterName, value = 1) {
    if (this.counters[counterName] !== undefined) {
      this.counters[counterName] += value;
    } else {
      this.counters[counterName] = value;
    }
  }

  setGauge(gaugeName, value) {
    this.gauges[gaugeName] = value;
  }

  observeLatency(metricName, durationMs) {
    if (!this.histograms[metricName]) {
      this.histograms[metricName] = [];
    }
    this.histograms[metricName].push(durationMs);
    if (this.histograms[metricName].length > 100) {
      this.histograms[metricName].shift(); // Keep recent 100 observations
    }
    if (metricName === 'ai_latency_ms') {
      this.gauges.ai_last_latency_ms = durationMs;
    }
  }

  getMetrics() {
    const calcAvg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    
    return {
      counters: { ...this.counters },
      gauges: { ...this.gauges },
      latency: {
        ai_avg_latency_ms: calcAvg(this.histograms.ai_latency_ms || []),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const metrics = new MetricsRegistry();
export default metrics;
