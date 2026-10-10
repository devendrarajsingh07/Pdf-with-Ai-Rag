import request from 'supertest';
import app from '../app';
import { allowedOrigins } from '../config/cors';

describe('API connectivity and CORS', () => {
  const origin = [...allowedOrigins][0];
  it('returns a noncached handshake with credentialed CORS', async () => {
    const response = await request(app).get('/api/v1/health/ping').set('Origin', origin);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ service: 'documind-api', apiVersion: 'v1' });
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('permits preflight headers', async () => {
    const response = await request(app).options('/api/v1/auth/login')
      .set('Origin', origin).set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-headers']).toContain('Idempotency-Key');
  });
  it('rejects an untrusted origin, including on a read', async () => {
    const response = await request(app).get('/api/v1/health/ping').set('Origin', 'https://malicious.example');
    expect(response.status).toBe(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('rejects mutations without an origin', async () => {
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(403);
  });
  it('allows non-browser health pings without an origin', async () => {
    expect((await request(app).get('/api/v1/health/ping')).status).toBe(200);
  });
});
