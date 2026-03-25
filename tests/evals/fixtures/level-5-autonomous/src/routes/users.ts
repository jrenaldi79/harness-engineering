import { Request, Response, Router } from 'express';

export const usersRouter = Router();

const users: Array<{ id: number; name: string }> = [];

usersRouter.get('/', (_req: Request, res: Response) => {
  res.json(users);
});

usersRouter.post('/', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const user = { id: users.length + 1, name };
  users.push(user);
  res.status(201).json(user);
});
