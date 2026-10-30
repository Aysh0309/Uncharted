import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB, closeDB } from './config/db.js';
import apiRouter from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Mount API routes
app.use('/api', apiRouter);

// Catch-all route to serve SPA frontend
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('💥 [Server Error]:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start server and initialize database connection
async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`
==========================================================
🚀 Agentic Memory System Server Online!
📡 URL: http://localhost:${PORT}
💾 MongoDB Atlas Vector Search ($vectorSearch): ENABLED
📂 Serving UI from: ${publicDir}
==========================================================
    `);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

startServer();
