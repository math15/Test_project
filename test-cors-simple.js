const http = require('http');

// Test OPTIONS request
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/orders/public',
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://localhost:8881',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type'
  }
};

console.log('Testing OPTIONS request to /orders/public...');

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:');
  console.log('  Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
  console.log('  Access-Control-Allow-Methods:', res.headers['access-control-allow-methods']);
  console.log('  Access-Control-Allow-Headers:', res.headers['access-control-allow-headers']);
  console.log('  Access-Control-Allow-Credentials:', res.headers['access-control-allow-credentials']);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();
