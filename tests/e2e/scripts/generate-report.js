const fs = require('fs');
const path = require('path');
require('dotenv').config();

const resultsPath = path.join(__dirname, '../reports/test-results.json');
const runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
const reportDate = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
const reportFileName = `frontend-e2e-result-${reportDate}.txt`;
const reportPath = path.join(__dirname, '../reports', reportFileName);

if (!fs.existsSync(resultsPath)) {
  console.log('No test results found at', resultsPath);
  // Just create an empty skeleton if preflight failed completely before results were generated
  const failReport = `
# FRONTEND E2E TEST REPORT

Run time: ${new Date().toISOString()}
RUN_ID: ${runId}
Frontend URL: ${process.env.FRONTEND_URL}
Gateway URL: ${process.env.GATEWAY_URL}
Environment: ${process.env.RUN_MODE}
Test runner folder: D:\\fuel-frontend-test-runner

## SUMMARY
Total: 0
PASS: 0
FAIL: 1 (Preflight or Config Error)

## PRODUCTION READINESS CONCLUSION
Ready to deploy frontend: NOT READY
Reason: Preflight check or configuration failed.
  `;
  fs.writeFileSync(reportPath, failReport.trim());
  console.log('Wrote error report to', reportPath);
  process.exit(0);
}

const raw = fs.readFileSync(resultsPath, 'utf8');
const results = JSON.parse(raw);

let pass = 0, fail = 0, skip = 0;
const modules = {};
const details = [];

results.suites?.forEach(suite => {
  suite.specs?.forEach(spec => {
    let status = 'PASS';
    if (!spec.ok) status = 'FAIL';
    else if (spec.tests[0].status === 'skipped') status = 'SKIP';
    
    if (status === 'PASS') pass++;
    if (status === 'FAIL') fail++;
    if (status === 'SKIP') skip++;

    const moduleName = suite.title || 'Other';
    if (!modules[moduleName]) modules[moduleName] = { pass: 0, fail: 0, skip: 0 };
    modules[moduleName][status.toLowerCase()]++;

    details.push(`
[TEST] ${spec.title}
Module: ${moduleName}
Status: ${status}
File: ${spec.file}
    `.trim());
  });
});

const isReady = fail === 0 ? (skip > 0 ? 'PARTIAL' : 'READY') : 'NOT READY';

const report = `
# FRONTEND E2E TEST REPORT

Run time: ${new Date().toISOString()}
RUN_ID: ${runId}
Frontend URL: ${process.env.FRONTEND_URL}
Gateway URL: ${process.env.GATEWAY_URL}
Branch: Unknown
Commit: Unknown
Environment: ${process.env.RUN_MODE}
Browser: Chromium
Test runner folder: D:\\fuel-frontend-test-runner
Artifacts folder: D:\\fuel-frontend-test-runner\\artifacts\\${reportDate}

## SUMMARY
Total: ${pass + fail + skip}
PASS: ${pass}
FAIL: ${fail}
SKIP: ${skip}

## RESULT BY MODULE
${Object.keys(modules).map(m => `${m}: PASS=${modules[m].pass} FAIL=${modules[m].fail} SKIP=${modules[m].skip}`).join('\n')}

## DETAILED RESULTS
${details.join('\n\n')}

## FINDINGS
${fail > 0 ? 'ID: 1\nSeverity: HIGH\nTitle: Some tests failed\n' : 'No critical findings.'}

## PRODUCTION READINESS CONCLUSION
Ready to deploy frontend: ${isReady}
Reason: ${isReady === 'READY' ? 'All tests passed' : isReady === 'PARTIAL' ? 'Some tests skipped' : 'Tests failed'}
`;

fs.writeFileSync(reportPath, report.trim());
console.log('Report generated at:', reportPath);
