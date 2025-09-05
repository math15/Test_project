# Order Assignment App - Test Plan

## Test Environment Setup

1. **Database Setup**
   - Import `closrtech.sql` dataset into MySQL
   - Run `npm run setup-db` to create required tables
   - Verify `lead_details` table has ~500 rows with `order_number` as NULL

2. **Application Setup**
   - Copy `env.example` to `.env`
   - Configure database credentials
   - Run `npm start`
   - Access admin interface at `http://localhost:3001`

## Test Cases

### 1. Per-State Thresholds Cap Test

**Objective**: Verify that per-state thresholds limit assignment during order creation.

**Steps**:
1. Create order with:
   - Order Number: `TEST-001`
   - States: `FL,TX`
   - Quantity: `10`
   - Thresholds: `FL=3,TX=4`

**Expected Results**:
- Initial assignment ≤ 7 total (max 3 FL and 4 TX)
- Only oldest leads (smallest id) assigned
- Counters reflect actual assigned amounts
- Order status remains 'active' if not fully fulfilled

**Verification**:
```sql
SELECT state, COUNT(*) as assigned 
FROM lead_details 
WHERE order_number = 'TEST-001' 
GROUP BY state;
```

### 2. Fulfill Order Test

**Objective**: Verify that fulfillment ignores thresholds and completes orders.

**Steps**:
1. Use order from Test 1
2. Click "Fulfill" button
3. Verify remaining quantity is assigned

**Expected Results**:
- Additional leads assigned up to remaining quantity
- Thresholds ignored during fulfillment
- Order status becomes 'fulfilled' when complete
- `completed_at` timestamp set

**Verification**:
```sql
SELECT status, fulfilled_count, quantity, completed_at 
FROM lead_orders 
WHERE order_number = 'TEST-001';
```

### 3. Delete Order Test

**Objective**: Verify that order deletion returns leads to stock.

**Steps**:
1. Use order from Test 2
2. Click "Delete" button
3. Confirm deletion

**Expected Results**:
- All leads assigned to order return to stock (`order_number` = NULL)
- Order and state records removed from database
- Leads available for new assignments

**Verification**:
```sql
-- Should return 0 rows
SELECT COUNT(*) FROM lead_details WHERE order_number = 'TEST-001';

-- Should return 0 rows
SELECT COUNT(*) FROM lead_orders WHERE order_number = 'TEST-001';
```

### 4. "One Time" Rule Test

**Objective**: Verify that "One Time" products block duplicate processing.

**Steps**:
1. Insert test record into automation table:
   ```sql
   INSERT INTO automation (order_name, order_number) VALUES ('TEST-ONETIME', '5315');
   ```
2. Attempt to create order with:
   - Order Number: `TEST-ONETIME-002`
   - Product Name: `One Time Product`
   - Actual Order Number: `5315`
   - States: `FL`
   - Quantity: `5`

**Expected Results**:
- Order creation fails with exact error: "Order already processed (One Time)."
- No order created in database

### 5. CSV Export Test

**Objective**: Verify CSV export functionality for fulfilled orders.

**Steps**:
1. Create and fulfill an order
2. Click "CSV" download link
3. Verify file contents

**Expected Results**:
- CSV file downloads successfully
- Contains required columns: phone_number, state, order_number
- Rows ordered by assignment order (oldest first)
- Only available for fulfilled orders

### 6. Plain Text Mode Test

**Objective**: Verify automation-friendly plain text responses.

**Steps**:
1. Send requests with `Accept: text/plain` header
2. Test various operations (create, fulfill, delete)

**Expected Results**:
- Responses in format: `SUCCESS: message` or `ERROR: message`
- Single line responses
- No HTML content

**Example cURL**:
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -H "Accept: text/plain" \
  -d '{"order_number":"TEST-PLAIN","states":"FL","quantity":"5"}'
```

### 7. Concurrency Test

**Objective**: Verify atomicity of assignment operations.

**Steps**:
1. Create order with quantity 100
2. Simultaneously fulfill the same order from multiple sessions
3. Verify no double assignment

**Expected Results**:
- No leads assigned to multiple orders
- Fulfillment counts remain accurate
- Database integrity maintained

### 8. Pagination Test

**Objective**: Verify order list pagination works correctly.

**Steps**:
1. Create multiple orders (30+)
2. Navigate through pages
3. Verify correct orders displayed

**Expected Results**:
- 25 orders per page (default)
- Correct pagination controls
- Orders sorted by creation date (newest first)

## Automated Test Script

Create `tests/automated-tests.js` to run these tests programmatically:

```javascript
const request = require('supertest');
const app = require('../server');

describe('Order Assignment App', () => {
  // Test implementations here
});
```

## Performance Considerations

- **Database Transactions**: All assignment operations wrapped in transactions
- **Indexing**: Proper indexes on `state`, `order_number`, `id` columns
- **Connection Pooling**: MySQL connection properly managed
- **Error Handling**: Comprehensive error handling with rollback

## Security Considerations

- **Authentication**: Basic admin authentication required
- **SQL Injection**: Parameterized queries used throughout
- **Input Validation**: All inputs validated and sanitized
- **Session Management**: Secure session handling
