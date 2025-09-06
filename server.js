const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const { initDB, getDB, formatDateTime } = require('./utils/database');
const { requireAuth } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Allow ALL requests from ANY origin
app.use((req, res, next) => {
  console.log(`CORS: ${req.method} ${req.path} from origin: ${req.headers.origin}`);
  
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

  
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');

// API status endpoint for health checks
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'Order Assignment API',
    cors: 'enabled'
  });
});

// Simple test endpoint for CORS verification
app.get('/api/test', (req, res) => {
  res.json({
    message: 'CORS test successful',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// CORS test endpoint specifically for debugging
app.get('/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});


// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Order Assignment API',
    version: '1.0.0',
    description: 'API for managing order assignments and lead distribution',
    endpoints: {
      'GET /api/status': 'Health check endpoint',
      'POST /api/orders': 'Create new order',
      'GET /api/orders/:id/fulfill': 'Fulfill order (assign remaining leads)',
      'GET /api/orders/:id/delete': 'Delete order (return leads to stock)',
      'GET /api/orders/:id/csv': 'Export CSV for fulfilled orders'
    },
    cors: {
      enabled: true,
      origins: ['http://localhost:8881', 'https://testproject.ddns.net'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true
    }
  });
});

// API endpoints
app.use('/api/orders', orderRoutes);
app.use('/', authRoutes);
app.use('/orders', orderRoutes);

// Debug: Log all registered routes
console.log('Registered routes:');
console.log('- GET / (admin interface)');
console.log('- POST /orders (authenticated)');
console.log('- POST /orders/public (public API)');
console.log('- GET /orders/:id/fulfill');
console.log('- GET /orders/:id/delete');
console.log('- GET /orders/:id/csv');

// Simple test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Catch-all OPTIONS handler for any route
app.options('*', (req, res) => {
  console.log(`Catch-all OPTIONS: ${req.method} ${req.path}`);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});


app.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDB();
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;
    
    const [orders] = await db.execute(`
      SELECT * FROM lead_orders 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    

    const [countResult] = await db.execute('SELECT COUNT(*) as total FROM lead_orders');
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    

    const formattedOrders = orders.map(order => ({
      ...order,
      created_at: formatDateTime(order.created_at),
      completed_at: formatDateTime(order.completed_at)
    }));
    
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Assignment Admin</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                  }
                }
              }
            }
          }
        </script>
      </head>
      <body class="bg-gray-50 min-h-screen">
        <div class="bg-white shadow-sm border-b border-gray-200">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center py-6">
              <h1 class="text-3xl font-bold text-gray-900">Order Assignment Admin</h1>
              <form method="post" action="/logout" class="inline">
                <button type="submit" class="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200">
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          ${req.query.success ? `
            <div class="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
              ${decodeURIComponent(req.query.success)}
            </div>
          ` : ''}
          
          <div class="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
            <h3 class="text-xl font-semibold text-gray-900 mb-6">Create New Order</h3>
            <form method="post" action="/orders" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Order Number</label>
                  <input type="text" name="order_number" required 
                         class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <input type="number" name="quantity" min="1" required
                         class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">States (CSV)</label>
                <input type="text" name="states" placeholder="FL, TX, GA" required
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Thresholds (optional)</label>
                <input type="text" name="thresholds" placeholder="FL=250,TX=100"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Product Name (optional)</label>
                  <input type="text" name="product_name"
                         class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Actual Order Number (optional)</label>
                  <input type="text" name="actual_order_number"
                         class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                </div>
              </div>
              
              <div class="pt-4">
                <button type="submit" class="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200">
                  Create Order
                </button>
              </div>
            </form>
          </div>
        
          <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Orders (Page ${page} of ${totalPages})</h3>
            </div>
            
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">States</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fulfilled</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  ${formattedOrders.map(order => `
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${order.order_number}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.states}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.quantity}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.fulfilled_count}</td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${order.status === 'active' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                          ${order.status}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.created_at}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.completed_at || '-'}</td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        ${order.status === 'active' ? `<a href="/orders/${order.id}/fulfill" class="text-primary-600 hover:text-primary-900">Fulfill</a>` : ''}
                        <a href="/orders/${order.id}/delete" onclick="return confirm('Are you sure?')" class="text-red-600 hover:text-red-900">Delete</a>
                        ${order.status === 'fulfilled' ? `<a href="/orders/${order.id}/csv" class="text-green-600 hover:text-green-900">CSV</a>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="flex justify-between items-center mt-6">
            <div class="text-sm text-gray-700">
              Showing page ${page} of ${totalPages}
            </div>
            <div class="flex space-x-2">
              ${page > 1 ? `
                <a href="/?page=${page - 1}" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  Previous
                </a>
              ` : ''}
              ${page < totalPages ? `
                <a href="/?page=${page + 1}" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  Next
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading admin page:', error);
    res.status(500).send('Internal server error');
  }
});


async function startServer() {
  await initDB();
  
  app.listen(PORT, () => {
    console.log(`Order Assignment App running on port ${PORT}`);
    console.log(`Admin interface: http://localhost:${PORT}`);
    console.log(`Login: ${process.env.ADMIN_USERNAME || 'admin'} / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  });
}


process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  const db = getDB();
  if (db) {
    await db.end();
  }
  process.exit(0);
}); 

startServer().catch(console.error);