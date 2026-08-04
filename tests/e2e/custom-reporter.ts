import { Reporter, TestCase, TestResult, FullResult, FullConfig, Suite } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

export default class CustomReporter implements Reporter {
  private runId: string;
  private results: {
    test: TestCase;
    result: TestResult;
    severity?: string;
    module?: string;
  }[] = [];
  
  private outDir: string;
  private startTime: Date;

  constructor(options: any) {
    this.runId = process.env.RUN_ID || new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    this.outDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(this.outDir)) {
      fs.mkdirSync(this.outDir, { recursive: true });
    }
    this.startTime = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Parse severity and module from test annotations or title
    const severityAnnotation = test.annotations.find(a => a.type === 'severity');
    const moduleAnnotation = test.annotations.find(a => a.type === 'module');
    
    // We can also extract module from the file name e.g. F01, F02
    let mod = moduleAnnotation?.description || '';
    const fileMatch = test.location.file.match(/(F\d+)/);
    if (!mod && fileMatch) {
      mod = fileMatch[1];
    }
    
    this.results.push({
      test,
      result,
      severity: severityAnnotation?.description || (result.status === 'failed' ? 'HIGH' : undefined),
      module: mod,
    });
  }

  async onEnd(result: FullResult) {
    const reportPath = path.join(this.outDir, `frontend-e2e-result-${this.runId}.txt`);
    
    const passed = this.results.filter(r => r.result.status === 'passed').length;
    const failed = this.results.filter(r => r.result.status === 'failed' || r.result.status === 'timedOut').length;
    const skipped = this.results.filter(r => r.result.status === 'skipped').length;
    
    const critical = this.results.filter(r => r.result.status === 'failed' && r.severity === 'CRITICAL').length;
    const high = this.results.filter(r => r.result.status === 'failed' && r.severity === 'HIGH').length;
    const medium = this.results.filter(r => r.result.status === 'failed' && r.severity === 'MEDIUM').length;
    const low = this.results.filter(r => r.result.status === 'failed' && r.severity === 'LOW').length;
    const warn = this.results.filter(r => r.severity === 'WARN').length;

    const modulesList = [
      'F01 Frontend readiness', 'F02 Auth', 'F03 Route guard', 'F04 Staff RBAC', 
      'F05 Manager RBAC', 'F06 Admin RBAC', 'F07 Dashboard', 'F08 Station/map',
      'F09 Admin station/brand/model', 'F10 Manual-entry', 'F11 Excel import',
      'F12 Export', 'F13 Fuel history', 'F14 Adjustment', 'F15 Error handling',
      'F16 Security frontend', 'F17 Accessibility', 'F18 Responsive', 'F19 Realtime', 'F20 Consistency'
    ];

    let content = `# FRONTEND E2E TEST REPORT\n\n`;
    content += `Run time: ${this.startTime.toISOString()}\n`;
    content += `RUN_ID: ${this.runId}\n`;
    content += `Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`;
    content += `Gateway URL: ${process.env.GATEWAY_URL || 'http://localhost:4000'}\n`;
    content += `Branch: unknown\n`;
    content += `Commit: unknown\n`;
    content += `Environment: ${process.env.RUN_MODE || 'local'}\n`;
    content += `Tester: Automated Playwright Agent\n`;
    content += `Test runner folder: ${process.cwd()}\n\n`;

    content += `## SUMMARY\n`;
    content += `Total: ${this.results.length}\n`;
    content += `PASS: ${passed}\n`;
    content += `FAIL: ${failed}\n`;
    content += `SKIP: ${skipped}\n`;
    content += `WARN: ${warn}\n`;
    content += `CRITICAL: ${critical}\n`;
    content += `HIGH: ${high}\n`;
    content += `MEDIUM: ${medium}\n`;
    content += `LOW: ${low}\n\n`;

    content += `## RESULT BY MODULE\n`;
    for (const modName of modulesList) {
      const code = modName.split(' ')[0];
      const modResults = this.results.filter(r => r.module === code || r.test.title.includes(code));
      if (modResults.length === 0) {
        content += `${modName}: NOT RUN\n`;
        continue;
      }
      const mFailed = modResults.some(r => r.result.status === 'failed');
      const mSkipped = modResults.every(r => r.result.status === 'skipped');
      content += `${modName}: ${mSkipped ? 'SKIP' : (mFailed ? 'FAIL' : 'PASS')}\n`;
    }

    content += `\n## DETAILED RESULTS\n\n`;
    this.results.forEach((r, idx) => {
      content += `[TEST_${idx + 1}]\n`;
      content += `Module: ${r.module || 'Unknown'}\n`;
      content += `Role: ${r.test.annotations.find(a => a.type === 'role')?.description || 'N/A'}\n`;
      content += `Page: ${r.test.title}\n`;
      content += `Status: ${r.result.status.toUpperCase()}\n`;
      if (r.severity) {
        content += `Severity: ${r.severity}\n`;
      }
      
      const screenshot = r.result.attachments.find(a => a.name === 'screenshot');
      if (screenshot && screenshot.path) {
        content += `Screenshot: ${screenshot.path}\n`;
      }
      const video = r.result.attachments.find(a => a.name === 'video');
      if (video && video.path) {
        content += `Video: ${video.path}\n`;
      }
      
      const errors = r.result.errors.map(e => e.message).join('; ').replace(/\n/g, ' ');
      if (errors) {
        content += `Errors: ${errors.substring(0, 500)}\n`;
      }
      content += `\n`;
    });

    content += `## FINDINGS\n`;
    let findingId = 1;
    this.results.filter(r => r.result.status === 'failed').forEach(r => {
      content += `ID: FND-${findingId++}\n`;
      content += `Severity: ${r.severity || 'HIGH'}\n`;
      content += `Title: ${r.test.title} failed\n`;
      content += `Evidence: See detailed results for TEST_${this.results.indexOf(r) + 1}\n\n`;
    });

    content += `## PRODUCTION READINESS CONCLUSION\n`;
    let readiness = 'READY';
    let reason = 'All tests passed.';
    if (critical > 0 || high > 0) {
      readiness = 'NOT READY';
      reason = 'Critical or High severity failures found.';
    } else if (skipped > 0) {
      readiness = 'PARTIAL';
      reason = 'Some tests were skipped (likely due to RUN_MODE=production).';
    }
    
    content += `Ready to deploy frontend: ${readiness}\n`;
    content += `Reason: ${reason}\n`;
    content += `Required fixes before production: ${readiness !== 'READY' ? 'Check findings section' : 'None'}\n`;

    fs.writeFileSync(reportPath, content);
    console.log(`\nFrontend E2E test completed.\nReport:\n${reportPath}\n\nArtifacts:\n${path.join(process.cwd(), 'artifacts', this.runId)}\n`);
  }
}
