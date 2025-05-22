import axios from 'axios';
import { MagicMCPRegistration } from '../types/registration';

export class DiscoveryService {
    private discoveryUrl: string;
    private registrationInfo: MagicMCPRegistration;

    constructor() {
        this.discoveryUrl = process.env.MAGRATHEAN_DISCOVERY_URL || 'http://localhost:9627';
        this.registrationInfo = {
            id: process.env.SERVICE_ID || 'magic-mcp',
            name: 'magic-mcp',
            type: 'MCP',
            version: process.env.SERVICE_VERSION || '1.0.0',
            endpoints: {
                http: process.env.HTTP_ENDPOINT || 'http://localhost:9628/magic',
                ws: process.env.WS_ENDPOINT || 'ws://localhost:9630'
            },
            capabilities: {
                core: ['ui-generation', 'component-management'],
                optional: ['preview', 'real-time-updates'],
                tools: ['magic-ai', 'svgl']
            },
            auth: {
                required: true,
                methods: ['jwt'],
                roles: ['mcp-server']
            },
            metadata: {
                region: process.env.AWS_REGION || 'us-west-2',
                environment: process.env.STAGE || 'development',
                provider: '21st.dev'
            }
        };
    }

    async register(): Promise<void> {
        try {
            const response = await axios.post(
                `${this.discoveryUrl}/register`,
                this.registrationInfo,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.MAGRATHEAN_TOKEN}`
                    }
                }
            );

            if (response.status !== 200) {
                throw new Error(`Registration failed: ${response.statusText}`);
            }

            console.log('Successfully registered with MAGRATHEAN Discovery Service');
        } catch (error) {
            console.error('Failed to register with discovery service:', error);
            throw error;
        }
    }

    async deregister(): Promise<void> {
        try {
            await axios.delete(
                `${this.discoveryUrl}/register/${this.registrationInfo.id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.MAGRATHEAN_TOKEN}`
                    }
                }
            );
            console.log('Successfully deregistered from MAGRATHEAN Discovery Service');
        } catch (error) {
            console.error('Failed to deregister from discovery service:', error);
            throw error;
        }
    }
} 