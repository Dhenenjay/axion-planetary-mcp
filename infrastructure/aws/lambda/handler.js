// AWS Lambda Handler - Migrated from GCP Cloud Functions
const AWS = require('aws-sdk');

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'X-Cloud-Provider': 'AWS'
        },
        body: JSON.stringify({
            message: 'AWS Lambda - Migration from GCP',
            timestamp: new Date().toISOString(),
            environment: process.env.ENVIRONMENT || 'production'
        })
    };
    
    return response;
};
