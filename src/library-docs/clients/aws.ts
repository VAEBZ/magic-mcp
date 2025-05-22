import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-1'
});

export const docClient = DynamoDBDocumentClient.from(client);

export const getApiGatewayEndpoint = (domainName: string, stage: string) => {
  return `https://${domainName}/${stage}`;
}; 