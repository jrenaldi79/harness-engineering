import express from 'express';
import { formatResponse } from './utils';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json(formatResponse({ status: 'ok' }));
});

app.get('/api/greeting', (_req, res) => {
  res.json(formatResponse({ message: 'Hello, world!' }));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
