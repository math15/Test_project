const axios = require('axios');

// Test data matching the provided structure
const testOrderData = {
  "order_id": 1234,
  "order_number": "1234",
  "total": "99.98",
  "currency": "USD",
  "payment_method": "stripe",
  "payment_method_title": "Credit Card (Stripe)",
  "status": "processing",
  "date_created": "2024-01-15 14:30:00",
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "address_1": "123 Main St",
    "address_2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postcode": "10001",
    "country": "US",
    "company": "ABC Corp"
  },
  "shipping": {
    "first_name": "John",
    "last_name": "Doe",
    "address_1": "123 Main St",
    "address_2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postcode": "10001",
    "country": "US",
    "company": "ABC Corp"
  },
  "items": [
    {
      "product_id": 21,
      "product_name": "Premium Product",
      "quantity": 2,
      "subtotal": "49.99",
      "total": "49.99",
      "sku": "PREMIUM-001",
      "price": "24.99"
    }
  ]
};

async function testOrderInfoEndpoint() {
  try {
    console.log('Testing POST /orders/info endpoint...');
    console.log('Sending data:', JSON.stringify(testOrderData, null, 2));
    
    const response = await axios.post('http://localhost:3001/orders/info', testOrderData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('\n❌ Error occurred:');
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      console.log('❌ Server is not running! Please start the server first with: npm start');
      console.log('   Then run this test again.');
    } else if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test with missing required fields
async function testValidation() {
  try {
    console.log('\n\nTesting validation with missing fields...');
    
    const invalidData = {
      "order_id": 1234,
      "order_number": "1234",
      // Missing total, currency, etc.
    };
    
    const response = await axios.post('http://localhost:3001/orders/info', invalidData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Unexpected success:', response.data);
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      console.log('❌ Server is not running! Skipping validation test.');
      return;
    }
    
    console.log('✅ Validation working correctly');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test with plain text response
async function testPlainTextResponse() {
  try {
    console.log('\n\nTesting plain text response...');
    
    const response = await axios.post('http://localhost:3001/orders/info', testOrderData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain'
      }
    });
    
    console.log('✅ Plain text response:');
    console.log('Status:', response.status);
    console.log('Response:', response.data);
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      console.log('❌ Server is not running! Skipping plain text test.');
      return;
    }
    
    console.log('❌ Plain text test failed:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get('http://localhost:3001', { timeout: 2000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Order Info Endpoint Tests\n');
  
  // Check if server is running first
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server is not running on http://localhost:3001');
    console.log('📝 Please start the server first with: npm start');
    console.log('   Then run this test again.\n');
    return;
  }
  
  console.log('✅ Server is running, proceeding with tests...\n');
  
  await testOrderInfoEndpoint();
  await testValidation();
  await testPlainTextResponse();
  
  console.log('\n🏁 All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testOrderInfoEndpoint,
  testValidation,
  testPlainTextResponse,
  runAllTests
};
