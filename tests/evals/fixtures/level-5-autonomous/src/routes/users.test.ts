import request from 'supertest';
import { createApp } from '../app';

describe('Users API', () => {
  it('GET /users returns empty array initially', async () => {
    const app = createApp();
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /users creates a user', async () => {
    const app = createApp();
    const res = await request(app).post('/users').send({ name: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Alice');
  });

  it('POST /users rejects missing name', async () => {
    const app = createApp();
    const res = await request(app).post('/users').send({});
    expect(res.status).toBe(400);
  });
});
