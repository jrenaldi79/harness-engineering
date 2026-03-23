import { Router } from 'express';

export const usersRouter = Router();

const users: Array<{ id: number; name: string }> = [];

usersRouter.get('/', (_req, res) => {
  res.json(users);
});

usersRouter.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const user = { id: users.length + 1, name };
  users.push(user);
  res.status(201).json(user);
});
