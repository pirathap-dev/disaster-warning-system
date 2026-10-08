import request from 'supertest';
import app from '../app';

describe('Health API Endpoint', () => {
  it('should return 200 OK with success and timestamp', async () => {
    const res = await request(app).get('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status', 'OK');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/unknown');
    
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
