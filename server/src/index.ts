import dotenv from 'dotenv';
import path from 'path';
import app from './app';
import { connectDB } from './config/db';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/disaster_management_dev';

async function startServer() {
  try {
    await connectDB(MONGO_URI);
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void startServer();
