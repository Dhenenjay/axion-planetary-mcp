// Performance monitoring
class PerformanceMonitor {
  private measurements = new Map<string, number[]>();

  measure(operation: string, duration: number): void {
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }
    this.measurements.get(operation)!.push(duration);
  }

  getPerformanceStats(operation?: string) {
    if (operation) {
      const durations = this.measurements.get(operation) || [];
      return this.calculateStats(durations);
    }

    const allStats: Record<string, any> = {};
    this.measurements.forEach((durations, op) => {
      allStats[op] = this.calculateStats(durations);
    });
    return allStats;
  }

  private calculateStats(durations: number[]) {
    if (durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    return {
      count: durations.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(durations.length * 0.5)],
      p95: sorted[Math.floor(durations.length * 0.95)],
      p99: sorted[Math.floor(durations.length * 0.99)]
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
