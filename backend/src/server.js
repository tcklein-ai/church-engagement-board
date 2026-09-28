import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { webhooksRouter } from './routes/webhooks.js';
import { cardsRouter } from './routes/cards.js';
import { verifyPcoSignature } from './lib/verifyPcoSignature.js';
import { syncRouter } from './routes/sync.js';
import { authRouter } from './routes/auth.js';

const app = express();

app.use(cors({ 
  origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  credentials: true 
}));

app.use(cookieParser());

app.use(
  '/webhooks',
  express.raw({ type: 'application/json' }),
  verifyPcoSignature,
  webhooksRouter
);

app.use(express.json());

app.use('/auth', authRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/sync', syncRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`PCO Kanban backend listening on :${port}`);
  
  console.log('Initiating automatic startup sync...');
  fetch(`http://localhost:${port}/api/sync`, { method: 'POST' })
    .catch(err => console.error('Failed to trigger startup sync:', err));
});