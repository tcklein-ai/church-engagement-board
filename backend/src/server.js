import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { webhooksRouter } from './routes/webhooks.js';
import { cardsRouter } from './routes/cards.js';
import { verifyPcoSignature } from './lib/verifyPcoSignature.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? '*' }));

// The webhook route needs the RAW body to verify PCO's HMAC signature.
// It is mounted BEFORE express.json() with its own raw-body parser.
app.use(
  '/webhooks',
  express.raw({ type: 'application/json' }),
  verifyPcoSignature,
  webhooksRouter
);

app.use(express.json());
app.use('/api/cards', cardsRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`PCO Kanban backend listening on :${port}`));