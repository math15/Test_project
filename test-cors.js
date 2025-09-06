const fetch = require('node-fetch');

async function testCORS() {
  try {
    console.log('Testing CORS configuration...');
    
    // Test basic endpoint
    const response1 = await fetch('http://localhost:3001/cors-test', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:8881',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Basic GET test:');
    console.log('Status:', response1.status);
    console.log('Headers:', response1.headers.raw());
    const data1 = await response1.json();
    console.log('Response:', data1);
    
    // Test OPTIONS preflight
    const response2 = await fetch('http://localhost:3001/orders/public', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8881',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log('\nOPTIONS preflight test:');
    console.log('Status:', response2.status);
    console.log('Headers:', response2.headers.raw());
    
    // Test actual POST request
    const response3 = await fetch('http://localhost:3001/orders/public', {
      method: 'POST',
      headers: {
        'Origin': 'http://localhost:8881',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_number: 'TEST123',
        states: 'FL',
        quantity: 1
      })
    });
    
    console.log('\nPOST request test:');
    console.log('Status:', response3.status);
    console.log('Headers:', response3.headers.raw());
    const data3 = await response3.text();
    console.log('Response:', data3);
    
  } catch (error) {
    console.error('Error testing CORS:', error.message);
  }
}

testCORS();
