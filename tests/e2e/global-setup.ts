import { request } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { createAll } = require('./scripts/create-excel-fixtures');

async function globalSetup() {
  const runMode = process.env.RUN_MODE;
  const allowWrite = process.env.ALLOW_WRITE_TESTS === 'true';
  if (runMode === 'production' && !allowWrite) {
    console.log('Skipping data setup: production mode and ALLOW_WRITE_TESTS is false.');
    return;
  }

  const gatewayUrl = (process.env.GATEWAY_URL || 'http://localhost:3000/api/').replace(/\/$/, '');
  const runId = process.env.RUN_ID;
  const stationCode = `TST_FE_BASE_${runId}`;
  const stationName = `FE Base ${runId}`;

  const context = await request.newContext({ baseURL: `${gatewayUrl}/` });

  try {
    // 1. Login Admin
    console.log('Logging in as Admin to setup data...');
    const loginRes = await context.post('auth/login', {
      data: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      },
    });
    if (!loginRes.ok()) {
      throw new Error(`Admin login failed: ${loginRes.status()} ${await loginRes.text()}`);
    }
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.accessToken;
    if (!token) throw new Error('No token returned from login');
    const headers = { Authorization: `Bearer ${token}` };

    // 2. Create Brand
    console.log(`Creating test Brand: FE_BRAND_${runId}`);
    const brandRes = await context.post('brands', {
      headers,
      data: { name: `FE_BRAND_${runId}`, country: 'VN' },
    });
    if (!brandRes.ok()) throw new Error(`Brand creation failed: ${await brandRes.text()}`);
    const brand = await brandRes.json();
    const brandId = brand.id || brand.brandId;

    // 3. Create Model
    console.log(`Creating test Model: FE_MODEL_${runId}`);
    const modelRes = await context.post('models', {
      headers,
      data: {
        brandId,
        modelName: `FE_MODEL_${runId}`,
        powerKva: 100,
        fuelType: 'diesel',
        suggestedConsumptionRate: 2.5,
        suggestedMaxCapacity: 1000,
      },
    });
    if (!modelRes.ok()) throw new Error(`Model creation failed: ${await modelRes.text()}`);
    const model = await modelRes.json();
    const modelId = model.id || model.modelId;

    // 4. Create Station
    console.log(`Creating test Station: ${stationCode}`);
    const stationRes = await context.post('stations', {
      headers,
      data: {
        stationCode,
        stationName,
        modelId,
        address: 'Hanoi Test',
        latitude: 21.0285,
        longitude: 105.8542,
        maxCapacity: 1000,
        consumptionRate: 2.5,
        active: true,
      },
    });
    if (!stationRes.ok()) throw new Error(`Station creation failed: ${await stationRes.text()}`);
    const station = await stationRes.json();
    const stationId = station.id || station.stationId;

    // 5. Create Excel fixtures
    console.log('Creating Excel fixtures...');
    const excelDir = path.join(__dirname, 'fixtures', 'excel');
    createAll(stationCode, excelDir);

    // 6. Create F14 fuel records (preview → confirm, different fuelAdded to avoid duplicate hash)
    const adjRecords: Array<{ label: string; recordId: string | null }> = [];
    for (const [label, fuelAdded] of [['adj_create', 11], ['adj_approve', 12], ['adj_reject', 13]] as [string, number][]) {
      const pvRes = await context.post('manual-entry/preview', {
        headers,
        data: { rows: [{ stationCode, fuelAdded, hoursRun: 1 }] },
      });
      if (!pvRes.ok()) {
        console.warn(`F14 setup: preview failed for ${label}: ${await pvRes.text()}`);
        adjRecords.push({ label, recordId: null });
        continue;
      }
      const pvData = await pvRes.json();
      const jobId = pvData.jobId;
      if (!jobId) {
        console.warn(`F14 setup: no jobId for ${label}`);
        adjRecords.push({ label, recordId: null });
        continue;
      }

      const cfRes = await context.post('manual-entry/confirm', {
        headers,
        data: { jobId },
      });
      if (!cfRes.ok()) {
        console.warn(`F14 setup: confirm failed for ${label}: ${await cfRes.text()}`);
        adjRecords.push({ label, recordId: null });
        continue;
      }
      const cfData = await cfRes.json();
      const recordId =
        cfData?.results?.[0]?.recordId ??
        cfData?.recordIds?.[0] ??
        cfData?.id ??
        null;
      adjRecords.push({ label, recordId });
      console.log(`F14 record created: ${label} fuelAdded=${fuelAdded} recordId=${recordId}`);
    }

    if (adjRecords.some(r => r.recordId === null)) {
      console.warn('⚠ Some F14 records missing recordId — those F14 sub-tests will skip');
    }

    // 7. Write run_context.json
    fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, 'fixtures', 'run_context.json'),
      JSON.stringify({ setupStatus: 'ok', setupErrors: [], runId, stationId, stationCode, stationName, adjRecords }, null, 2),
    );

    console.log('Test data setup successful!');
  } catch (err: any) {
    console.error('CRITICAL ERROR: Failed to setup test data:', err.message);
    process.env.SETUP_FAILED = 'true';
    fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, 'fixtures', 'run_context.json'),
      JSON.stringify({ setupStatus: 'failed', setupErrors: [err.message], runId }, null, 2),
    );
  } finally {
    await context.dispose();
  }
}

export default globalSetup;
