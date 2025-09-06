const request = require('supertest');
const mysql = require('mysql2/promise');
require('dotenv').config();
const { app } = require('../server');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'closrtech',
  port: process.env.DB_PORT || 3306
};

let db;


const testOrder = {
  order_number: 'TEST-001',
  states: 'FL,TX',
  quantity: 10,
  thresholds: 'FL=3,TX=4'
};

const oneTimeOrder = {
  order_number: 'TEST-ONETIME-001',
  states: 'FL',
  quantity: 5,
  product_name: 'One Time Product',
  actual_order_number: '5315'
};

describe('Order Assignment App - Automated Tests', () => {
  beforeAll(async () => {

    db = await mysql.createConnection(dbConfig);
    

    await db.execute('DELETE FROM lead_orders WHERE order_number LIKE "TEST-%"');
    await db.execute('DELETE FROM automation WHERE order_number = "5315"');
    await db.execute('UPDATE lead_details SET order_number = NULL WHERE order_number LIKE "TEST-%"');
  });

  afterAll(async () => {
    await db.execute('DELETE FROM lead_orders WHERE order_number LIKE "TEST-%"');
    await db.execute('DELETE FROM automation WHERE order_number = "5315"');
    await db.execute('UPDATE lead_details SET order_number = NULL WHERE order_number LIKE "TEST-%"');
    
    if (db) {
      await db.end();
    }
  });

  describe('Authentication', () => {
    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .post('/orders')
        .send(testOrder);
      
      expect(response.status).toBe(302); // Redirect to login
    });

    test('should allow access with valid credentials', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        });
      
      expect(loginResponse.status).toBe(302); // Redirect after login
    });
  });

  describe('Order Creation with Thresholds', () => {
    test('should create order and respect per-state thresholds', async () => {
      // Login first
      const agent = request.agent(app);
      await agent
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        });

      // Create order
      const response = await agent
        .post('/orders')
        .send(testOrder);

      expect(response.status).toBe(302);

      const [orders] = await db.execute(
        'SELECT * FROM lead_orders WHERE order_number = ?',
        [testOrder.order_number]
      );
      expect(orders).toHaveLength(1);

      const order = orders[0];
      expect(order.quantity).toBe(10);
      expect(order.fulfilled_count).toBeLessThanOrEqual(7);
      expect(order.status).toBe('active');

      const [stateRecords] = await db.execute(
        'SELECT * FROM lead_order_states WHERE order_id = ?',
        [order.id]
      );
      expect(stateRecords).toHaveLength(2);

      const [assignedLeads] = await db.execute(
        'SELECT state, COUNT(*) as count FROM lead_details WHERE order_number = ? GROUP BY state',
        [testOrder.order_number]
      );

      const flCount = assignedLeads.find(l => l.state === 'FL')?.count || 0;
      const txCount = assignedLeads.find(l => l.state === 'TX')?.count || 0;
      
      expect(flCount).toBeLessThanOrEqual(3);
      expect(txCount).toBeLessThanOrEqual(4);
      expect(flCount + txCount).toBeLessThanOrEqual(7);
    });
  });

  describe('Order Fulfillment', () => {
    test('should fulfill order and ignore thresholds', async () => {
      const agent = request.agent(app);
      await agent
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        });

      const [orders] = await db.execute(
        'SELECT * FROM lead_orders WHERE order_number = ?',
        [testOrder.order_number]
      );
      const orderId = orders[0].id;

      const response = await agent.get(`/orders/${orderId}/fulfill`);
      expect(response.status).toBe(302);

      const [updatedOrders] = await db.execute(
        'SELECT * FROM lead_orders WHERE id = ?',
        [orderId]
      );
      const updatedOrder = updatedOrders[0];
      
      expect(updatedOrder.status).toBe('fulfilled');
      expect(updatedOrder.fulfilled_count).toBe(updatedOrder.quantity);
      expect(updatedOrder.completed_at).not.toBeNull();
    });
  });

  describe('Order Deletion', () => {
    test('should delete order and return leads to stock', async () => {
      const agent = request.agent(app);
      await agent
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        });

      const [orders] = await db.execute(
        'SELECT * FROM lead_orders WHERE order_number = ?',
        [testOrder.order_number]
      );
      const orderId = orders[0].id;

      const response = await agent.get(`/orders/${orderId}/delete`);
      expect(response.status).toBe(302);

      const [deletedOrders] = await db.execute(
        'SELECT * FROM lead_orders WHERE id = ?',
        [orderId]
      );
      expect(deletedOrders).toHaveLength(0);

      const [stockLeads] = await db.execute(
        'SELECT COUNT(*) as count FROM lead_details WHERE order_number = ?',
        [testOrder.order_number]
      );
      expect(stockLeads[0].count).toBe(0);

      const [stateRecords] = await db.execute(
        'SELECT * FROM lead_order_states WHERE order_id = ?',
        [orderId]
      );
      expect(stateRecords).toHaveLength(0);
    });
  });

  describe('One Time Rule', () => {
    test('should block creation when automation record exists', async () => {
      await db.execute(
        'INSERT INTO automation (order_name, order_number) VALUES (?, ?)',
        ['TEST-ONETIME', '5315']
      );

      const agent = request.agent(app);
      await agent
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        });

      const response = await agent
        .post('/orders')
        .send(oneTimeOrder);

      expect(response.status).toBe(400);
      expect(response.text).toContain('Order already processed (One Time).');

      const [orders] = await db.execute(
        'SELECT * FROM lead_orders WHERE order_number = ?',
        [oneTimeOrder.order_number]
      );
      expect(orders).toHaveLength(0);
    });
  });

  describe('CSV Export', () => {
    test('should export CSV for fulfilled orders only', async () => {
      const agent = request.agent(app);
      await agent
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        });

      await agent
        .post('/orders')
        .send({
          order_number: 'TEST-CSV-001',
          states: 'FL',
          quantity: 5
        });

      const [orders] = await db.execute(
        'SELECT * FROM lead_orders WHERE order_number = ?',
        ['TEST-CSV-001']
      );
      const orderId = orders[0].id;

      await agent.get(`/orders/${orderId}/fulfill`);

      const response = await agent.get(`/orders/${orderId}/csv`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Plain Text Mode', () => {
    test('should return plain text responses for automation', async () => {
      const agent = request.agent(app);
      await agent
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        });

      const response = await agent
        .post('/orders')
        .set('Accept', 'text/plain')
        .send({
          order_number: 'TEST-PLAIN-001',
          states: 'FL',
          quantity: 3
        });

      expect(response.status).toBe(200);
      expect(response.text).toMatch(/^SUCCESS:/);
      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    });
  });

  describe('Concurrency and Atomicity', () => {
    test('should handle concurrent fulfillments safely', async () => {
      const agent = request.agent(app);
      await agent
        .post('/login')
        .send({
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123'
        }); 

      await agent
        .post('/orders')
        .send({
          order_number: 'TEST-CONCURRENT-001',
          states: 'FL,TX',
          quantity: 50
        });

      const [orders] = await db.execute(
        'SELECT * FROM lead_orders WHERE order_number = ?',
        ['TEST-CONCURRENT-001']
      );
      const orderId = orders[0].id;

      const promises = [
        agent.get(`/orders/${orderId}/fulfill`),
        agent.get(`/orders/${orderId}/fulfill`),
        agent.get(`/orders/${orderId}/fulfill`)
      ];

      await Promise.all(promises);

      const [finalOrder] = await db.execute(
        'SELECT * FROM lead_orders WHERE id = ?',
        [orderId]
      );
      
      expect(finalOrder[0].fulfilled_count).toBeLessThanOrEqual(finalOrder[0].quantity);
    });
  });
});
