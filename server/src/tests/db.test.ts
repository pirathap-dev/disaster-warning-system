import mongoose from 'mongoose';
import { connectDB } from '../config/db';

describe('connectDB', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects with a short server selection timeout', async () => {
    const connection = { connection: { host: '127.0.0.1' } };
    const connect = jest.spyOn(mongoose, 'connect').mockResolvedValue(
      connection as unknown as typeof mongoose
    );
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(connectDB('mongodb://127.0.0.1:27017/test')).resolves.toBe(connection);
    expect(connect).toHaveBeenCalledWith(
      'mongodb://127.0.0.1:27017/test',
      { serverSelectionTimeoutMS: 5000 }
    );
    expect(log).toHaveBeenCalledWith('MongoDB Connected: 127.0.0.1');
  });

  it('reports connection failures with actionable guidance and preserves the cause', async () => {
    const connectionError = new Error('connect ECONNREFUSED');
    jest.spyOn(mongoose, 'connect').mockRejectedValue(connectionError);

    await expect(connectDB('mongodb://127.0.0.1:27017/test')).rejects.toMatchObject({
      message: expect.stringContaining('Check that MongoDB is running'),
      cause: connectionError,
    });
  });
});
