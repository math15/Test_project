const http = require('http');

// Test simple GET request first
console.log('Testing simple GET request...');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/test',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('GET /test Status:', res.statusCode);
  console.log('CORS Headers:');
  console.log('  Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    
    // Now test OPTIONS
    console.log('\nTesting OPTIONS request...');
    testOptions();
  });
});

req.on('error', (error) => {
  console.error('GET Error:', error.message);
});

req.end();

function testOptions() {
  const optionsReq = http.request({
    hostname: 'localhost',
    port: 3001,
    path: '/orders/public',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:8881',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  }, (res) => {
    console.log('OPTIONS Status:', res.statusCode);
    console.log('CORS Headers:');
    console.log('  Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
    console.log('  Access-Control-Allow-Methods:', res.headers['access-control-allow-methods']);
    console.log('  Access-Control-Allow-Headers:', res.headers['access-control-allow-headers']);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('OPTIONS Response:', data);
    });
  });
  
  optionsReq.on('error', (error) => {
    console.error('OPTIONS Error:', error.message);
  });
  
  optionsReq.end();
}
