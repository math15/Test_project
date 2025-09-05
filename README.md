# Order Assignment App

A Node.js admin application for managing lead assignments to orders with automatic fulfillment and state-based thresholds.

## Features

- ✅ **Order Creation**: Create orders with automatic lead assignment (oldest first)
- ✅ **State Thresholds**: Per-state assignment limits during creation
- ✅ **Manual Fulfillment**: Complete orders by assigning additional leads
- ✅ **Order Management**: Delete orders and return leads to stock
- ✅ **CSV Export**: Export fulfilled orders with lead details
- ✅ **Pagination**: Browse orders with 25 per page
- ✅ **Plain Text Mode**: Automation-friendly API responses
- ✅ **One Time Rule**: Prevent duplicate processing of "One Time" products
- ✅ **Admin Interface**: Simple web-based administration

## Quick Start

### Prerequisites

- Node.js 16+
- MySQL 8.0+ (XAMPP recommended)
- The provided `closrtech.sql` dataset

### One-Command Setup

**For automatic setup (recommended):**
```bash
npm run setup
```

This will:
- ✅ Create the database if it doesn't exist
- ✅ Import `closrtech.sql` if needed
- ✅ Create all required application tables
- ✅ Set up environment configuration
- ✅ Install dependencies
- ✅ Verify everything is working

### Manual Setup

If you prefer manual setup:

1. **Install dependencies:**
```bash
npm install
```

2. **Set up database:**
```bash
# Import the provided lead_details dataset
mysql -u root -p closrtech < closrtech.sql

# Create required tables
npm run setup-db
```

3. **Configure environment:**
```bash
# Copy example environment file
cp env.example .env

# Edit .env with your database credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=closrtech
DB_PORT=3306
PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

4. **Start the application:**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

5. **Access admin interface:**
- URL: `http://localhost:3001`
- Login: `admin` / `admin123` (configurable in .env)

## Database Schema

### Required Tables

The application creates these tables automatically:

#### `lead_orders`
- `id`: Primary key
- `order_number`: Unique order identifier
- `states`: CSV of 2-letter state codes
- `quantity`: Total quantity required
- `fulfilled_count`: Currently assigned leads
- `status`: 'active' or 'fulfilled'
- `product_name`: Optional product name
- `actual_order_number`: Optional actual order number
- `created_at`: UTC timestamp
- `completed_at`: UTC timestamp (when fulfilled)

#### `lead_order_states`
- `id`: Primary key
- `order_id`: Foreign key to lead_orders
- `state`: 2-letter state code
- `threshold`: Maximum leads for this state (default 999)
- `fulfilled_count`: Leads assigned to this state
- `created_at`: UTC timestamp

#### `automation`
- `id`: Primary key
- `order_name`: Order name for "One Time" rule
- `order_number`: Order number for "One Time" rule
- `created_at`: UTC timestamp

#### `lead_details` (Provided Dataset)
- `id`: Primary key (ascending = oldest first)
- `phone_number`: Lead phone number
- `state`: 2-letter state code
- `order_number`: NULL/empty = in stock
- Additional columns as provided in dataset

## API Endpoints

### Web Interface
- `GET /` - Admin dashboard with order list and creation form
- `GET /login` - Login page
- `POST /login` - Authentication
- `POST /logout` - Logout

### Order Management
- `POST /orders` - Create new order
- `GET /orders/:id/fulfill` - Fulfill order (assign remaining leads)
- `GET /orders/:id/delete` - Delete order (return leads to stock)
- `GET /orders/:id/csv` - Export CSV for fulfilled orders

### Plain Text Mode

For automation, include `Accept: text/plain` header:

```bash
# Create order
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -H "Accept: text/plain" \
  -d '{
    "order_number": "AUTO-001",
    "states": "FL,TX",
    "quantity": 10,
    "thresholds": "FL=3,TX=4"
  }'

# Response: SUCCESS: Order created successfully. Assigned 7 leads.
```

## Business Rules

### Order Creation
1. **Required Fields**: order_number (unique), states, quantity (>0)
2. **State Processing**: CSV input trimmed, deduped, stored uppercase
3. **Thresholds**: Optional per-state limits (format: "FL=250,TX=100")
4. **Auto-Assignment**: Immediately assigns leads from stock (oldest first)
5. **One Time Rule**: Blocks creation if product_name contains "One Time" and actual_order_number exists in automation table

### Lead Assignment
1. **Stock Leads**: `order_number` is NULL or empty
2. **Oldest First**: Assigned by ascending `id` (smallest = oldest)
3. **State Filtering**: Only leads matching order's state list
4. **Threshold Limits**: Applied during creation, ignored during fulfillment
5. **Atomic Operations**: All assignments wrapped in database transactions

### Order Fulfillment
1. **Manual Action**: Assigns remaining quantity from stock
2. **Threshold Ignored**: No per-state limits during fulfillment
3. **Completion**: Status becomes 'fulfilled' when quantity reached
4. **Timestamp**: `completed_at` set when order fulfilled

### Order Deletion
1. **Lead Return**: All assigned leads return to stock (`order_number` = NULL)
2. **Cascade Delete**: Removes order and state records
3. **Atomic Operation**: Wrapped in transaction

## CSV Export

Available only for fulfilled orders. Includes:
- `phone_number`: Lead phone number
- `state`: 2-letter state code  
- `order_number`: Order identifier
- Rows ordered by assignment order (oldest first)

## Time Zone Handling

- **Storage**: All timestamps stored in UTC
- **Display**: Converted to America/New_York with EST/EDT suffix
- **Format**: "2025-07-27 12:13 PM EDT"

## Concurrency & Integrity

- **Transactions**: All assignment operations use database transactions
- **Parameterized Queries**: SQL injection protection
- **Atomic Operations**: Prevents double assignment on concurrent requests
- **Idempotent Fulfillment**: Safe to re-run fulfillment operations

## Testing

Run the comprehensive test suite:

```bash
# Run automated tests
npm test

# Manual testing
# See tests/test-plan.md for detailed test cases
```

### Key Test Scenarios
1. **Threshold Limits**: Verify per-state caps during creation
2. **Fulfillment**: Test manual fulfillment ignores thresholds
3. **Deletion**: Confirm leads return to stock
4. **One Time Rule**: Test duplicate prevention
5. **CSV Export**: Verify export functionality
6. **Plain Text Mode**: Test automation responses

## Production Deployment

### Environment Variables
```bash
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=closrtech
DB_PORT=3306
PORT=3001
ADMIN_USERNAME=your-admin-user
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-random-session-secret
```

### Security Considerations
- Change default admin credentials
- Use HTTPS in production
- Implement proper session security
- Regular database backups
- Monitor for SQL injection attempts

### Performance Optimization
- Database connection pooling
- Proper indexing on frequently queried columns
- Regular database maintenance
- Monitor query performance

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL is running
   - Verify credentials in `.env`
   - Ensure `closrtech` database exists

2. **Import Dataset Failed**
   - Verify `closrtech.sql` file exists
   - Check file permissions
   - Ensure database is empty before import

3. **Order Creation Fails**
   - Check for duplicate order numbers
   - Verify state codes are valid 2-letter codes
   - Ensure quantity > 0

4. **Leads Not Assigning**
   - Verify leads exist with `order_number` = NULL
   - Check state codes match between leads and orders
   - Review threshold settings

### Debug Mode

Enable detailed logging:
```bash
DEBUG=order-app:* npm start
```

## License

MIT
