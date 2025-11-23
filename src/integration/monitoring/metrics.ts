// Performance metrics collection
interface Metric {
  tool: string;
  duration: number;
  success: boolean;
  timestamp: number;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private maxSize = 1000;

  record(tool: string, duration: number, success: boolean): void {
    this.metrics.push({
      tool,
      duration,
      success,
      timestamp: Date.now()
    });

    if (this.metrics.length > this.maxSize) {
      this.metrics = this.metrics.slice(-this.maxSize);
    }
  }

  getStats(tool?: string) {
    const filtered = tool 
      ? this.metrics.filter(m => m.tool === tool)
      : this.metrics;

    if (filtered.length === 0) return null;

    const durations = filtered.map(m => m.duration);
    const successes = filtered.filter(m => m.success).length;

    return {
      count: filtered.length,
      successRate: successes / filtered.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }

  clear(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();
