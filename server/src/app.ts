import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health';
import reportRoutes from './routes/reports';
import rescueRoutes from './routes/rescue';
import sheltersRoutes from './routes/shelters';
import reliefResourcesRoutes from './routes/reliefResources';
import reliefAllocationsRoutes from './routes/reliefAllocations';
import warningRoutes from './routes/warnings';
import authRoutes from './routes/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();

// Middleware — increased limit for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// Module 1: Ground Reports
app.use('/api/reports', reportRoutes);

// Module 2: Hazard & Warnings
app.use('/api/warnings', warningRoutes);

// Module 3: Rescue Coordination
app.use('/api/rescue', rescueRoutes);

// Module 4: Shelter & Relief
app.use('/api/shelters', sheltersRoutes);
app.use('/api/relief-resources', reliefResourcesRoutes);
app.use('/api/relief-allocations', reliefAllocationsRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
