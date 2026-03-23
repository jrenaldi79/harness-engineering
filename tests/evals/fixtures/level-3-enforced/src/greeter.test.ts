import { greet } from './greeter';

describe('greet', () => {
  it('returns a greeting with the name', () => {
    expect(greet('World')).toBe('Hello, World!');
  });

  it('handles empty string', () => {
    expect(greet('')).toBe('Hello, !');
  });
});
