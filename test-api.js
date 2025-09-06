// Simple test script to verify the API is working
const fetch = require('node-fetch');

async function testAPI() {
    try {
        const testData = {
            order_number: 'TEST-WP-123456',
            states: 'FL,TX,CA',
            quantity: 5,
            product_name: 'One-time Leads',
            actual_order_number: 'TEST-123'
        };

        console.log('Testing API with data:', testData);

        const response = await fetch('http://localhost:3001/orders/public', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();
        
        console.log('Response status:', response.status);
        console.log('Response data:', result);

        if (response.ok) {
            console.log('✅ API test successful!');
        } else {
            console.log('❌ API test failed!');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

testAPI();
