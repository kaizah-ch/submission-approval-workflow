import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRoutes } from './routes/authRoutes';
import { applicationRoutes } from './routes/applicationRoutes';
import { errorHandler, notFound } from './middleware/errorHandler';

dotenv.config();

export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL?.split(',') || '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api', applicationRoutes);
app.use(notFound);
app.use(errorHandler);
