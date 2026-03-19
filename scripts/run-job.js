/**
 * Run Job Script
 * Usage: node scripts/run-job.js <job-name> [args...]
 */

const path = require('path');
const fs = require('fs');

const jobName = process.argv[2];
const jobArgs = process.argv.slice(3);

if (!jobName) {
  console.log(`
Usage: node scripts/run-job.js <job-name> [args...]

Available jobs:
  J0.1-validate-connection    - Test API and MongoDB connections
  J0.2-create-indexes         - Create migration indexes
  J3-fetch-deals <status>     - Fetch deals (status: 1=active, 2=won, 3=lost)
  J3.4-transform-deals [batch] [--dry-run] - Transform and import deals

Examples:
  node scripts/run-job.js J0.1-validate-connection
  node scripts/run-job.js J3-fetch-deals 1
  node scripts/run-job.js J3.4-transform-deals 100 --dry-run
`);
  process.exit(1);
}

// Map job names to files
const jobFiles = {
  'J0.1-validate-connection': '../src/jobs/J0.1-validate-connection.js',
  'J0.2-create-indexes': '../src/jobs/J0.2-create-indexes.js',
  'J3-fetch-deals': '../src/jobs/J3-fetch-deals.js',
  'J3.4-transform-deals': '../src/jobs/J3.4-transform-deals.js'
};

const jobFile = jobFiles[jobName];

if (!jobFile) {
  console.error(`Unknown job: ${jobName}`);
  console.log(`Available jobs: ${Object.keys(jobFiles).join(', ')}`);
  process.exit(1);
}

const jobPath = path.join(__dirname, jobFile);

if (!fs.existsSync(jobPath)) {
  console.error(`Job file not found: ${jobPath}`);
  process.exit(1);
}

console.log(`\n🚀 Running job: ${jobName}`);
console.log(`   Args: ${jobArgs.join(' ') || 'none'}\n`);

// Run the job
require(jobPath);
