import mongoose from 'mongoose';

export const connectDB = async (uri: string) => {
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    throw new Error(
      'MongoDB connection failed. Check that MongoDB is running and MONGO_URI in server/.env is correct.',
      { cause: error }
    );
  }
};
