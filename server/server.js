import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { webhooksRouter } from './routes/webhooks.js';
import { cardsRouter } from './routes/cards.js';
import { verifyPcoSignature } from './lib/verifyPcoSignature.js';
import { syncRouter } from './routes/sync.js';
import { authRouter } from './routes/auth.js';
import { configRouter } from './routes/config.js';
import { attendanceRouter } from './routes/attendance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use('/api/config', configRouter);
app.use('/api/attendance', attendanceRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// --- MONOLITHIC STATIC FILE SERVING ---
// Serve the compiled React files from the root dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route to pass client-side routing over to React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});
// -------------------------------------

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`PCO Kanban backend listening on :${port}`);
  
  console.log('Initiating automatic startup sync...');
  fetch(`http://localhost:${port}/api/sync`, { method: 'POST' })
    .catch(err => console.error('Failed to trigger startup sync:', err));
});