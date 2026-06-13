import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import marketRouter from './routes/market.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', marketRouter);

app.listen(PORT, () => {
  console.log(`Stock viewer API running on http://localhost:${PORT}`);
});
