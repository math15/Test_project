const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const { initDB, getDB, formatDateTime } = require('./utils/database');
const { requireAuth } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;


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

app.use('/', authRoutes);
app.use('/orders', orderRoutes);


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
      <html>
      <head>
        <title>Order Assignment Admin</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .form-section { background: #f5f5f5; padding: 20px; margin-bottom: 20px; border-radius: 5px; }
          .form-row { margin-bottom: 10px; }
          .form-row label { display: inline-block; width: 150px; }
          .form-row input, .form-row select { width: 200px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .pagination { margin-top: 20px; }
          .pagination a { margin-right: 10px; }
          .actions { white-space: nowrap; }
          .actions a { margin-right: 5px; }
          .success { color: green; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Order Assignment Admin</h1>
          <form method="post" action="/logout" style="display: inline;">
            <button type="submit">Logout</button>
          </form>
        </div>
        
        ${req.query.success ? `<div class="success">${decodeURIComponent(req.query.success)}</div>` : ''}
        
        <div class="form-section">
          <h3>Create New Order</h3>
          <form method="post" action="/orders">
            <div class="form-row">
              <label>Order Number:</label>
              <input type="text" name="order_number" required>
            </div>
            <div class="form-row">
              <label>States (CSV):</label>
              <input type="text" name="states" placeholder="FL, TX, GA" required>
            </div>
            <div class="form-row">
              <label>Quantity:</label>
              <input type="number" name="quantity" min="1" required>
            </div>
            <div class="form-row">
              <label>Thresholds (optional):</label>
              <input type="text" name="thresholds" placeholder="FL=250,TX=100">
            </div>
            <div class="form-row">
              <label>Product Name (optional):</label>
              <input type="text" name="product_name">
            </div>
            <div class="form-row">
              <label>Actual Order Number (optional):</label>
              <input type="text" name="actual_order_number">
            </div>
            <button type="submit">Create Order</button>
          </form>
        </div>
        
        <h3>Orders (Page ${page} of ${totalPages})</h3>
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>States</th>
              <th>Quantity</th>
              <th>Fulfilled</th>
              <th>Status</th>
              <th>Created</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${formattedOrders.map(order => `
              <tr>
                <td>${order.order_number}</td>
                <td>${order.states}</td>
                <td>${order.quantity}</td>
                <td>${order.fulfilled_count}</td>
                <td>${order.status}</td>
                <td>${order.created_at}</td>
                <td>${order.completed_at || '-'}</td>
                <td class="actions">
                  ${order.status === 'active' ? `<a href="/orders/${order.id}/fulfill">Fulfill</a>` : ''}
                  <a href="/orders/${order.id}/delete" onclick="return confirm('Are you sure?')">Delete</a>
                  ${order.status === 'fulfilled' ? `<a href="/orders/${order.id}/csv">CSV</a>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="pagination">
          ${page > 1 ? `<a href="/?page=${page - 1}">Previous</a>` : ''}
          ${page < totalPages ? `<a href="/?page=${page + 1}">Next</a>` : ''}
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