// Simple in-memory analytics for tracking usage
// In production, you might want to use a database or external service

interface AnalyticsEvent {
  timestamp: Date;
  eventType: string;
  tool?: string;
  operation?: string;
  region?: string;
  userAgent?: string;
  duration?: number;
  error?: boolean;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private toolUsage: Map<string, number> = new Map();
  private dailyRequests: Map<string, number> = new Map();
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.ANALYTICS_ENABLED === 'true';
  }

  track(event: Omit<AnalyticsEvent, 'timestamp'>) {
    if (!this.enabled) return;

    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date()
    };

    // Store event
    this.events.push(fullEvent);

    // Update tool usage counter
    if (event.tool) {
      this.toolUsage.set(event.tool, (this.toolUsage.get(event.tool) || 0) + 1);
    }

    // Update daily requests
    const today = new Date().toISOString().split('T')[0];
    this.dailyRequests.set(today, (this.dailyRequests.get(today) || 0) + 1);

    // Keep only last 1000 events in memory
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Log to console for monitoring
    console.log(`[Analytics] ${event.eventType}`, {
      tool: event.tool,
      operation: event.operation,
      region: event.region
    });
  }

  getStats() {
    if (!this.enabled) return { enabled: false };

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentEvents = this.events.filter(e => e.timestamp > last24h);
    const errorRate = recentEvents.filter(e => e.error).length / recentEvents.length;

    return {
      enabled: true,
      totalRequests: this.events.length,
      last24hRequests: recentEvents.length,
      errorRate: errorRate || 0,
      popularTools: Array.from(this.toolUsage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tool, count]) => ({ tool, count })),
      dailyRequests: Array.from(this.dailyRequests.entries())
        .slice(-7)
        .map(([date, count]) => ({ date, count })),
      averageResponseTime: this.calculateAverageResponseTime(recentEvents),
      uniqueRegions: this.getUniqueRegions(recentEvents)
    };
  }

  private calculateAverageResponseTime(events: AnalyticsEvent[]): number {
    const eventsWithDuration = events.filter(e => e.duration);
    if (eventsWithDuration.length === 0) return 0;
    
    const totalDuration = eventsWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0);
    return Math.round(totalDuration / eventsWithDuration.length);
  }

  private getUniqueRegions(events: AnalyticsEvent[]): string[] {
    const regions = new Set<string>();
    events.forEach(e => {
      if (e.region) regions.add(e.region);
    });
    return Array.from(regions).slice(0, 20);
  }
}

// Singleton instance
export const analytics = new Analytics();