import { HealthStatus } from '../types/health';

export class HealthService {
    private startTime: Date;
    private connectionCount: number;

    constructor() {
        this.startTime = new Date();
        this.connectionCount = 0;
    }

    incrementConnections(): void {
        this.connectionCount++;
    }

    decrementConnections(): void {
        this.connectionCount = Math.max(0, this.connectionCount - 1);
    }

    async getStatus(): Promise<HealthStatus> {
        const now = new Date();
        const uptime = now.getTime() - this.startTime.getTime();

        try {
            // Check component service health
            const componentServiceHealth = await this.checkComponentService();
            // Check AI service health
            const aiServiceHealth = await this.checkAIService();
            // Check WebSocket service health
            const wsServiceHealth = await this.checkWebSocketService();

            const issues = [];
            let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

            if (!componentServiceHealth.healthy) {
                status = 'unhealthy';
                issues.push({
                    type: 'component_service',
                    description: componentServiceHealth.error,
                    since: now.toISOString()
                });
            }

            if (!aiServiceHealth.healthy) {
                status = status === 'healthy' ? 'degraded' : status;
                issues.push({
                    type: 'ai_service',
                    description: aiServiceHealth.error,
                    since: now.toISOString()
                });
            }

            if (!wsServiceHealth.healthy) {
                status = status === 'healthy' ? 'degraded' : status;
                issues.push({
                    type: 'websocket_service',
                    description: wsServiceHealth.error,
                    since: now.toISOString()
                });
            }

            return {
                status,
                lastCheck: now.toISOString(),
                metrics: {
                    latency: await this.measureLatency(),
                    uptime,
                    connections: this.connectionCount,
                    load: process.cpuUsage().user
                },
                issues: issues.length > 0 ? issues : undefined
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                lastCheck: now.toISOString(),
                metrics: {
                    latency: -1,
                    uptime,
                    connections: this.connectionCount,
                    load: -1
                },
                issues: [{
                    type: 'system',
                    description: error instanceof Error ? error.message : 'Unknown error',
                    since: now.toISOString()
                }]
            };
        }
    }

    private async checkComponentService(): Promise<{ healthy: boolean; error?: string }> {
        try {
            // Add component service health check logic
            return { healthy: true };
        } catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'Component service check failed'
            };
        }
    }

    private async checkAIService(): Promise<{ healthy: boolean; error?: string }> {
        try {
            // Add AI service health check logic
            const apiKey = process.env.TWENTY_FIRST_API_KEY;
            if (!apiKey) {
                return {
                    healthy: false,
                    error: 'AI service API key not configured'
                };
            }
            return { healthy: true };
        } catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'AI service check failed'
            };
        }
    }

    private async checkWebSocketService(): Promise<{ healthy: boolean; error?: string }> {
        try {
            // Add WebSocket service health check logic
            return { healthy: true };
        } catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'WebSocket service check failed'
            };
        }
    }

    private async measureLatency(): Promise<number> {
        const start = process.hrtime();
        // Add latency measurement logic (e.g., ping to storage)
        const [seconds, nanoseconds] = process.hrtime(start);
        return seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
    }
} 