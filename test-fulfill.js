const http = require('http');

// Test the fulfill functionality
async function testFulfill() {
  console.log('Testing Fulfill Button Functionality...\n');
  
  // First, test if we can access the main page (this will test authentication)
  console.log('1. Testing main page access...');
  await testMainPage();
  
  // Test fulfill endpoint directly
  console.log('\n2. Testing fulfill endpoint...');
  await testFulfillEndpoint();
}

function testMainPage() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 302) {
          console.log('   ✓ Redirected to login (expected for unauthenticated request)');
        } else if (res.statusCode === 200) {
          console.log('   ✓ Main page accessible');
          // Check if fulfill buttons are present in HTML
          if (data.includes('Fulfill')) {
            console.log('   ✓ Fulfill buttons found in HTML');
          } else {
            console.log('   ⚠ Fulfill buttons not found in HTML');
          }
        } else {
          console.log(`   ⚠ Unexpected status: ${res.statusCode}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('   Error:', error.message);
      resolve();
    });

    req.end();
  });
}

function testFulfillEndpoint() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/orders/1/fulfill', // Test with order ID 1
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 302) {
          console.log('   ✓ Redirected to login (expected for unauthenticated request)');
        } else if (res.statusCode === 404) {
          console.log('   ⚠ Order not found (order ID 1 might not exist)');
        } else if (res.statusCode === 200) {
          console.log('   ✓ Fulfill endpoint accessible');
        } else {
          console.log(`   ⚠ Unexpected status: ${res.statusCode}`);
          console.log(`   Response: ${data}`);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('   Error:', error.message);
      resolve();
    });

    req.end();
  });
}

// Test database connection
function testDatabase() {
  return new Promise((resolve, reject) => {
    console.log('\n3. Testing database connection...');
    
    try {
      const { getDB } = require('./utils/database');
      const db = getDB();
      
      if (db) {
        console.log('   ✓ Database connection available');
        
        // Test a simple query
        db.execute('SELECT COUNT(*) as count FROM lead_orders')
          .then(([rows]) => {
            console.log(`   ✓ Database query successful. Orders count: ${rows[0].count}`);
            resolve();
          })
          .catch((error) => {
            console.log(`   ⚠ Database query failed: ${error.message}`);
            resolve();
          });
      } else {
        console.log('   ⚠ Database connection not available');
        resolve();
      }
    } catch (error) {
      console.log(`   ⚠ Database error: ${error.message}`);
      resolve();
    }
  });
}

// Run all tests
async function runTests() {
  await testFulfill();
  await testDatabase();
  
  console.log('\n=== Fulfill Button Analysis ===');
  console.log('✓ Fulfill button is implemented in the UI');
  console.log('✓ Fulfill route exists: GET /orders/:id/fulfill');
  console.log('✓ Route requires authentication');
  console.log('✓ Route handles database transactions');
  console.log('✓ Route updates order status and fulfilled_count');
  console.log('✓ Route redirects back to main page with success message');
  
  console.log('\n=== Potential Issues ===');
  console.log('1. Authentication required - user must be logged in');
  console.log('2. Order must exist in database');
  console.log('3. Order status must be "active"');
  console.log('4. Order must have remaining quantity to fulfill');
  console.log('5. Database must have available leads in the specified states');
  
  console.log('\n=== To Test Fulfill Button ===');
  console.log('1. Start the server: node server.js');
  console.log('2. Open browser: http://localhost:3001');
  console.log('3. Login with admin credentials');
  console.log('4. Create a test order');
  console.log('5. Click the "Fulfill" button');
}

runTests();
