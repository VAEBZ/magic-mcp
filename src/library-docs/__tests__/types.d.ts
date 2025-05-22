import '@types/jest';

declare global {
  namespace NodeJS {
    interface Global {
      WebSocket: any;
    }
  }
} 