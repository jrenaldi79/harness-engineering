import request from 'supertest';
import { createApp } from '../app';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
