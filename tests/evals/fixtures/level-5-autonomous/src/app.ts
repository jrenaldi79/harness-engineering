import express, { Express } from 'express';
import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRouter);
  app.use('/users', usersRouter);
  return app;
}
