import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ReliefResourceModel } from './models/ReliefResource';
import { ShelterModel } from './models/Shelter';
import { ShelterStatus } from './types';

dotenv.config();

async function seedDemoData() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/disaster_management_dev';
  await mongoose.connect(uri);
  try {
    await ShelterModel.updateOne(
      { name: 'Central Community Shelter' },
      {
        $setOnInsert: {
          name: 'Central Community Shelter',
          location: 'District Centre',
          capacity: 500,
          currentOccupancy: 420,
          status: ShelterStatus.OPEN,
        },
      },
      { upsert: true }
    );
    await ShelterModel.updateOne(
      { name: 'Riverside Relief Centre' },
      {
        $setOnInsert: {
          name: 'Riverside Relief Centre',
          location: 'Riverside Ward',
          capacity: 300,
          currentOccupancy: 126,
          status: ShelterStatus.OPEN,
        },
      },
      { upsert: true }
    );
    await ReliefResourceModel.updateOne(
      { name: 'Drinking Water' },
      {
        $setOnInsert: {
          name: 'Drinking Water',
          category: 'Water',
          availableQuantity: 1000,
          unit: 'litres',
          source: 'District Emergency Store',
        },
      },
      { upsert: true }
    );
    await ReliefResourceModel.updateOne(
      { name: 'Food Packs' },
      {
        $setOnInsert: {
          name: 'Food Packs',
          category: 'Food',
          availableQuantity: 600,
          unit: 'packs',
          source: 'District Emergency Store',
        },
      },
      { upsert: true }
    );
    await ReliefResourceModel.updateOne(
      { name: 'Blankets' },
      {
        $setOnInsert: {
          name: 'Blankets',
          category: 'Shelter',
          availableQuantity: 250,
          unit: 'units',
          source: 'District Emergency Store',
        },
      },
      { upsert: true }
    );
    console.log('Demo shelters and relief resources are ready.');
  } finally {
    await mongoose.disconnect();
  }
}

void seedDemoData().catch((error: unknown) => {
  console.error('Could not seed demo relief data:', error);
  process.exitCode = 1;
});
