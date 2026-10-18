import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { pluggyRouter } from './routes/pluggy.js';
import { transactionsRouter } from './routes/transactions.js';
import { insightsRouter } from './routes/insights.js';
import { webhooksRouter } from './routes/webhooks.js';
import { settingsRouter } from './routes/settings.js';
import { smartsheetRouter } from './routes/smartsheet.js';
import { investmentsRouter } from './routes/investments.js';
import { portfolioImportRouter } from './routes/portfolioImport.js';
import { enableBankingRouter } from './routes/enableBanking.js';
import { supportRouter } from './routes/support.js';
import { startScheduler } from './jobs/scheduler.js';

import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/authMiddleware.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Healthcheck (Público)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rastro-finance-backend' });
});

// Rotas de Autenticação (Públicas: /register, /login; Protegidas: /me)
app.use('/api/auth', authRouter);

// Webhooks e callbacks externos (Públicos)
app.use('/api/webhooks', webhooksRouter);
app.use('/api/enablebanking', enableBankingRouter);

// Rotas Protegidas do Sistema (Exigem Token JWT)
app.use('/api/pluggy', requireAuth, pluggyRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/insights', requireAuth, insightsRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/smartsheet', requireAuth, smartsheetRouter);
app.use('/api/investments', requireAuth, investmentsRouter);
app.use('/api/portfolio/import', requireAuth, portfolioImportRouter);
app.use('/api/support', requireAuth, supportRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

app.listen(env.PORT, () => {
  console.log(`\n🟡 Rastro Finance API rodando em http://localhost:${env.PORT}`);
  startScheduler();
});
