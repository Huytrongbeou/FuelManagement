import { test as setup, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

setup('setup data', async ({ request }) => {
  const isProd = process.env.RUN_MODE === 'production';
  const allowWrite = process.env.ALLOW_WRITE_TESTS === 'true';

  if (isProd && !allowWrite) {
    console.log('Production Gate: Write tests disabled. Skipping data setup.');
    return;
  }

  const gatewayUrl = process.env.GATEWAY_URL;
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPass) {
    console.error('Missing Admin credentials');
    throw new Error('SETUP_FAILURE: Missing Admin credentials');
  }

  // Get RUN_ID from env or generate
  const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  process.env.RUN_ID = runId;
  
  // Create fixture directory for passing RUN_ID to tests
  fs.mkdirSync(path.resolve(__dirname, '../fixtures'), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, '../fixtures/run_id.txt'), runId);

  // Login Admin
  const loginRes = await request.post(`${gatewayUrl}/auth/login`, {
    data: { username: adminUser, password: adminPass }
  });

  if (!loginRes.ok()) {
    throw new Error('SETUP_FAILURE: Admin login failed for data setup');
  }

  // We need the cookie for subsequent requests
  const headers = {
    'Content-Type': 'application/json',
    'cookie': loginRes.headers()['set-cookie'] || ''
  };

  try {
    console.log('Setting up API data...');
    // Create Brand
    const brandName = `API_BRAND_${runId}`;
    let brandRes = await request.post(`${gatewayUrl}/brands`, {
      data: { name: brandName },
      headers
    });
    if (!brandRes.ok()) throw new Error(`Failed to create brand: ${await brandRes.text()}`);
    const brand = await brandRes.json();

    // Create Model
    const modelName = `API_MODEL_${runId}`;
    let modelRes = await request.post(`${gatewayUrl}/models`, {
      data: { 
        modelName, 
        brandId: brand.id || brand.brandId,
        maxCapacity: 1000,
        consumptionRate: 2.5
      },
      headers
    });
    if (!modelRes.ok()) throw new Error(`Failed to create model: ${await modelRes.text()}`);
    const model = await modelRes.json();

    // Create Station
    const stationCode = `TST_FE_BASE_${runId}`;
    let stationRes = await request.post(`${gatewayUrl}/stations`, {
      data: {
        stationCode,
        stationName: `Trạm Base ${runId}`,
        modelId: model.id || model.modelId,
        maxCapacity: 1000,
        consumptionRate: 2.5,
        active: true,
        region: 'Hanoi',
        address: 'Test Address'
      },
      headers
    });
    if (!stationRes.ok()) throw new Error(`Failed to create station: ${await stationRes.text()}`);

    console.log(`Setup complete with RUN_ID: ${runId}`);
  } catch (err: any) {
    console.error('Setup failed:', err.message);
    throw new Error(`SETUP_FAILURE: ${err.message}`);
  }
});
