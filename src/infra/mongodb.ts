import mongoose from 'mongoose';
import { mongodbConfig } from '../config/mongodb.config';

export async function connectMongoDB() {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(mongodbConfig.uri);

    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connect failed', err);
    process.exit(1);
  }
}
