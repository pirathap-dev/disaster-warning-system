import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health';
import reportRoutes from './routes/reports';
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

// Add future routes here
// app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
// app.use('/api/warnings', warningRoutes);
// app.use('/api/rescue', rescueRoutes);
// app.use('/api/shelters', shelterRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
