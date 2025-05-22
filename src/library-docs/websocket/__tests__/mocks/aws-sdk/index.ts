// Export all mocks from the AWS SDK modules
export * from './mock-clients';
export * from './dynamodb';
export * from './apigateway';

// Reset all mocks
export const resetAwsMocks = () => {
  const { resetDynamoMocks } = require('./dynamodb');
  const { resetApiGatewayMocks } = require('./apigateway');
  resetDynamoMocks();
  resetApiGatewayMocks();
}; 