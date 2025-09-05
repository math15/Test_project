

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Order Assignment App - Quick Start\n');


const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚙️  Setting up environment...');
  try {
    execSync('npm run setup', { stdio: 'inherit' });
  } catch (error) {
    console.log('❌ Setup failed. Please run: npm run setup');
    process.exit(1);
  }
}


const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
  } catch (error) {
    console.log('❌ Failed to install dependencies');
    process.exit(1);
  }
}

console.log('🎉 Starting Order Assignment App...\n');
console.log('📋 Access the admin interface at: http://localhost:3001');
console.log('🔑 Default login: admin / admin123\n');


try {
  execSync('npm start', { stdio: 'inherit' });
} catch (error) {
  console.log('❌ Failed to start application');
  process.exit(1);
}
