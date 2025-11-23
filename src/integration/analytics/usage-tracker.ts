// Usage analytics tracking
interface UsageRecord {
  tool: string;
  identifier: string;
  timestamp: number;
  success: boolean;
}

class UsageTracker {
  private records: UsageRecord[] = [];
  private maxRecords = 10000;

  track(tool: string, identifier: string, success: boolean): void {
    this.records.push({
      tool,
      identifier,
      timestamp: Date.now(),
      success
    });

    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  getUsageStats(identifier?: string) {
    const filtered = identifier
      ? this.records.filter(r => r.identifier === identifier)
      : this.records;

    const toolCounts = filtered.reduce((acc, r) => {
      acc[r.tool] = (acc[r.tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests: filtered.length,
      successfulRequests: filtered.filter(r => r.success).length,
      toolUsage: toolCounts,
      timeRange: {
        start: Math.min(...filtered.map(r => r.timestamp)),
        end: Math.max(...filtered.map(r => r.timestamp))
      }
    };
  }
}

export const usageTracker = new UsageTracker();
