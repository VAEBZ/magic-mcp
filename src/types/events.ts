export interface ComponentEvent {
    event: 'componentUpdate' | 'componentCreate' | 'componentDelete';
    data: {
        action: 'create' | 'update' | 'delete';
        component: any;
        timestamp: string;
        metadata?: {
            userId?: string;
            reason?: string;
            [key: string]: any;
        };
    };
} 