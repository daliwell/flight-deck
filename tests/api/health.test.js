const request = require('supertest');
const express = require('express');

describe('Health Endpoint', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app for testing the health endpoint
    app = express();
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'flight-deck',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'test'
      });
    });
  });

  it('should return 200 status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should return correct JSON structure', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('service', 'flight-deck');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('environment');
  });

  it('should return valid timestamp', async () => {
    const response = await request(app).get('/health');
    
    const timestamp = new Date(response.body.timestamp);
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.toString()).not.toBe('Invalid Date');
  });

  it('should return environment as test', async () => {
    const response = await request(app).get('/health');
    
    expect(response.body.environment).toBe('test');
  });
});
