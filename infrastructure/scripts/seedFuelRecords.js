#!/usr/bin/env node
/**
 * Seeds fuel records via API after all services are running.
 * Run: node scripts/seedFuelRecords.js
 */
const http = require('http')

const GATEWAY = 'http://localhost:3000'

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload)

    const req = http.request(`${GATEWAY}${path}`, { method, headers }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function main() {
  // 1. Login
  const loginRes = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' })
  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes.body)
    process.exit(1)
  }
  const token = loginRes.body.token
  console.log('Logged in as admin')

  // 2. Fetch stations
  const stationsRes = await request('GET', '/api/stations', null, token)
  if (stationsRes.status !== 200) {
    console.error('Failed to fetch stations:', stationsRes.body)
    process.exit(1)
  }
  const stations = stationsRes.body
  console.log(`Found ${stations.length} stations`)

  // Fuel targets: green (>50% of cap), yellow (5-20% cap), red (<5% cap)
  // CL-001 → green, CL-002 → green, CL-003 → green, CL-011 → green
  // CL-004 → yellow, CL-005 → yellow, CL-012 → yellow
  // CL-006 → red, CL-007 → red
  // CL-008, CL-009, CL-010 → no record (gray)
  const fuelTargets = {
    'CL-001': { actualFuel: 150.0 },   // green (of 200L)
    'CL-002': { actualFuel: 220.0 },   // green (of 300L)
    'CL-003': { actualFuel: 200.0 },   // green (of 300L)
    'CL-011': { actualFuel: 80.0 },    // green (of 120L)
    'CL-004': { actualFuel: 15.0 },    // yellow (of 120L)
    'CL-005': { actualFuel: 25.0 },    // yellow (of 200L)
    'CL-012': { actualFuel: 30.0 },    // yellow (of 200L)
    'CL-006': { actualFuel: 3.0 },     // red (of 25L)
    'CL-007': { actualFuel: 8.0 },     // red (of 150L)
    // CL-008, CL-009, CL-010: no record
  }

  const today = new Date().toISOString().slice(0, 10)
  let successCount = 0

  for (const station of stations) {
    const target = fuelTargets[station.code]
    if (!target) continue

    const payload = {
      stationId: station.id,
      stationCode: station.code,
      recordedDate: today,
      fuelAdded: 0,
      hoursRun: 0,
      actualFuel: target.actualFuel,
    }

    const res = await request('POST', '/api/fuel/records', payload, token)
    if (res.status === 201) {
      console.log(`✓ ${station.code}: actualFuel=${target.actualFuel}L → fuelStatus=${res.body.status || '?'}`)
      successCount++
    } else {
      console.error(`✗ ${station.code}: status=${res.status}`, res.body)
    }
  }

  console.log(`\nDone: ${successCount} fuel records seeded`)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
