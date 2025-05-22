export interface MagicMCPRegistration {
    id: string;
    name: string;
    type: 'MCP';
    version: string;
    endpoints: {
        http: string;
        ws: string;
    };
    capabilities: {
        core: string[];
        optional: string[];
        tools: string[];
    };
    auth: {
        required: boolean;
        methods: string[];
        roles: string[];
    };
    metadata: {
        region: string;
        environment: string;
        provider: string;
    };
} 