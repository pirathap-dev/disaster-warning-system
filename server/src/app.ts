import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/health';
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/health', healthRoutes);

// Add future routes here
// app.use('/api/users', userRoutes);
// app.use('/api/reports', reportRoutes);
// app.use('/api/warnings', warningRoutes);
// app.use('/api/rescue', rescueRoutes);
// app.use('/api/shelters', shelterRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
