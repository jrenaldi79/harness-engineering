import { createApp } from './app';

describe('createApp', () => {
  it('returns an express application', () => {
    const app = createApp();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });
});
