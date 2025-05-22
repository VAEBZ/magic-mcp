export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: string;
    metrics: {
        latency: number;
        uptime: number;
        connections: number;
        load: number;
    };
    issues?: Array<{
        type: string;
        description: string | undefined;
        since: string;
    }>;
} 