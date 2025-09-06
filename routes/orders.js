const express = require('express');
const router = express.Router();
const { getDB, parseStates, parseThresholds, sendPlainTextResponse } = require('../utils/database');
const { requireAuth } = require('../middleware/auth');

// Public API endpoint for WordPress integration (no auth required)
router.post('/public', async (req, res) => {
  const isPlainText = req.get('Accept') === 'text/plain';
  
  try {
    const { order_number, states, quantity, thresholds, product_name, actual_order_number } = req.body;
    
    if (!order_number || !states || !quantity || quantity <= 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Missing required fields or invalid quantity')
        : res.status(400).json({ error: 'Missing required fields or invalid quantity' });
    }
    
    const stateList = parseStates(states);
    if (stateList.length === 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Invalid states format')
        : res.status(400).json({ error: 'Invalid states format' });
    }
    
    if (product_name && product_name.includes('One Time') && actual_order_number) {
      const db = getDB();
      const [existing] = await db.execute(
        'SELECT id FROM automation WHERE order_number = ?',
        [actual_order_number]
      );
      
      if (existing.length > 0) {
        return isPlainText 
          ? sendPlainTextResponse(res, false, 'Order already processed (One Time).')
          : res.status(400).json({ error: 'Order already processed (One Time).' });
      }
    }
    
    const db = getDB();
    await db.beginTransaction();
    
    try {
      const [orderResult] = await db.execute(`
        INSERT INTO lead_orders (order_number, states, quantity, product_name, actual_order_number)
        VALUES (?, ?, ?, ?, ?)
      `, [order_number, stateList.join(','), quantity, product_name || null, actual_order_number || null]);
      
      const orderId = orderResult.insertId;
      
      const thresholdMap = parseThresholds(thresholds);
      
      for (const state of stateList) {
        const threshold = thresholdMap[state] || 999;
        await db.execute(`
          INSERT INTO lead_order_states (order_id, state, threshold)
          VALUES (?, ?, ?)
        `, [orderId, state, threshold]);
      }
      
      let totalAssigned = 0;
      const stateAssignments = {};
      
      for (const state of stateList) {
        const stateThreshold = thresholdMap[state] || 999;
        const remainingQuantity = quantity - totalAssigned;
        const stateLimit = Math.min(stateThreshold, remainingQuantity);
        
        if (stateLimit <= 0) continue;
        
        const [leads] = await db.execute(`
          SELECT id FROM lead_details 
          WHERE state = ? AND (order_number IS NULL OR order_number = '')
          ORDER BY id ASC
          LIMIT ?
        `, [state, stateLimit]);
        
        for (const lead of leads) {
          await db.execute(`
            UPDATE lead_details SET order_number = ? WHERE id = ?
          `, [order_number, lead.id]);
          
          totalAssigned++;
          stateAssignments[state] = (stateAssignments[state] || 0) + 1;
        }
      }
      
      await db.execute(`
        UPDATE lead_orders SET fulfilled_count = ? WHERE id = ?
      `, [totalAssigned, orderId]);
      
      for (const [state, count] of Object.entries(stateAssignments)) {
        await db.execute(`
          UPDATE lead_order_states SET fulfilled_count = ? 
          WHERE order_id = ? AND state = ?
        `, [count, orderId, state]);
      }
      
      if (totalAssigned >= quantity) {
        await db.execute(`
          UPDATE lead_orders 
          SET status = 'fulfilled', completed_at = NOW() 
          WHERE id = ?
        `, [orderId]);
      }
      
      if (order_number && actual_order_number) {
        try {
          await db.execute(`
            INSERT INTO automation (order_name, order_number)
            VALUES (?, ?)
          `, [order_number, actual_order_number]);
        } catch (error) {
          console.log('Non-blocking automation insert failed:', error.message);
        }
      }
      
      await db.commit();
      
      const message = `Order created successfully. Assigned ${totalAssigned} leads.`;
      return isPlainText 
        ? sendPlainTextResponse(res, true, message)
        : res.json({ success: true, message: message, assigned: totalAssigned });
        
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error creating order:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      const message = 'Order number already exists';
      return isPlainText 
        ? sendPlainTextResponse(res, false, message)
        : res.status(400).json({ error: message });
    }
    
    const message = 'Failed to create order: ' + error.message;
    return isPlainText 
      ? sendPlainTextResponse(res, false, message)
      : res.status(500).json({ error: message });
  }
});

// Original authenticated endpoint
router.post('/', requireAuth, async (req, res) => {
  const isPlainText = req.get('Accept') === 'text/plain';
  
  try {
    const { order_number, states, quantity, thresholds, product_name, actual_order_number } = req.body;
    
    if (!order_number || !states || !quantity || quantity <= 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Missing required fields or invalid quantity')
        : res.status(400).send('Missing required fields or invalid quantity');
    }
    
    const stateList = parseStates(states);
    if (stateList.length === 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Invalid states format')
        : res.status(400).send('Invalid states format');
    }
    
    if (product_name && product_name.includes('One Time') && actual_order_number) {
      const db = getDB();
      const [existing] = await db.execute(
        'SELECT id FROM automation WHERE order_number = ?',
        [actual_order_number]
      );
      
      if (existing.length > 0) {
        return isPlainText 
          ? sendPlainTextResponse(res, false, 'Order already processed (One Time).')
          : res.status(400).send('Order already processed (One Time).');
      }
    }
    
    const db = getDB();
    await db.beginTransaction();
    
    try {
      const [orderResult] = await db.execute(`
        INSERT INTO lead_orders (order_number, states, quantity, product_name, actual_order_number)
        VALUES (?, ?, ?, ?, ?)
      `, [order_number, stateList.join(','), quantity, product_name || null, actual_order_number || null]);
      
      const orderId = orderResult.insertId;
      

      const thresholdMap = parseThresholds(thresholds);
      
      for (const state of stateList) {
        const threshold = thresholdMap[state] || 999;
        await db.execute(`
          INSERT INTO lead_order_states (order_id, state, threshold)
          VALUES (?, ?, ?)
        `, [orderId, state, threshold]);
      }
      
      let totalAssigned = 0;
      const stateAssignments = {};
      
      for (const state of stateList) {
        const stateThreshold = thresholdMap[state] || 999;
        const remainingQuantity = quantity - totalAssigned;
        const stateLimit = Math.min(stateThreshold, remainingQuantity);
        
        if (stateLimit <= 0) continue;
        
        const [leads] = await db.execute(`
          SELECT id FROM lead_details 
          WHERE state = ? AND (order_number IS NULL OR order_number = '')
          ORDER BY id ASC
          LIMIT ?
        `, [state, stateLimit]);
        
        for (const lead of leads) {
          await db.execute(`
            UPDATE lead_details SET order_number = ? WHERE id = ?
          `, [order_number, lead.id]);
          
          totalAssigned++;
          stateAssignments[state] = (stateAssignments[state] || 0) + 1;
        }
      }
      

                await db.execute(`
        UPDATE lead_orders SET fulfilled_count = ? WHERE id = ?
      `, [totalAssigned, orderId]);
      

      for (const [state, count] of Object.entries(stateAssignments)) {
        await db.execute(`
          UPDATE lead_order_states SET fulfilled_count = ? 
          WHERE order_id = ? AND state = ?
        `, [count, orderId, state]);
      }
      

      if (totalAssigned >= quantity) {
        await db.execute(`
          UPDATE lead_orders 
          SET status = 'fulfilled', completed_at = NOW() 
          WHERE id = ?
        `, [orderId]);
      }
      
      if (order_number && actual_order_number) {
        try {
          await db.execute(`
            INSERT INTO automation (order_name, order_number)
            VALUES (?, ?)
          `, [order_number, actual_order_number]);
        } catch (error) {

          console.log('Non-blocking automation insert failed:', error.message);
        }
      }
      
      await db.commit();
      
      const message = `Order created successfully. Assigned ${totalAssigned} leads.`;
      return isPlainText 
        ? sendPlainTextResponse(res, true, message)
        : res.redirect('/?success=' + encodeURIComponent(message));
        
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error creating order:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      const message = 'Order number already exists';
      return isPlainText 
        ? sendPlainTextResponse(res, false, message)
        : res.status(400).send(message);
    }
    
    const message = 'Failed to create order: ' + error.message;
    return isPlainText 
      ? sendPlainTextResponse(res, false, message)
      : res.status(500).send(message);
  }
});


router.get('/:id/fulfill', requireAuth, async (req, res) => {
  const isPlainText = req.get('Accept') === 'text/plain';
  
  try {
    const orderId = req.params.id;
    const db = getDB();
    

    const [orders] = await db.execute('SELECT * FROM lead_orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Order not found')
        : res.status(404).send('Order not found');
    }
    
    const order = orders[0];
    if (order.status === 'fulfilled') {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Order already fulfilled')
        : res.status(400).send('Order already fulfilled');
    }
    
    const remaining = order.quantity - order.fulfilled_count;
    if (remaining <= 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'No remaining quantity to fulfill')
        : res.status(400).send('No remaining quantity to fulfill');
    }
    
    await db.beginTransaction();
    
    try {
      const stateList = parseStates(order.states);
      let totalAssigned = 0;
      const stateAssignments = {};
      
      const [stateRecords] = await db.execute(`
        SELECT state, fulfilled_count FROM lead_order_states WHERE order_id = ?
      `, [orderId]);
      
      const currentStateCounts = {};
      stateRecords.forEach(record => {
        currentStateCounts[record.state] = record.fulfilled_count;
      });
      

      for (const state of stateList) {
        const stateRemaining = remaining - totalAssigned;
        if (stateRemaining <= 0) break;
        

        const [leads] = await db.execute(`
          SELECT id FROM lead_details 
          WHERE state = ? AND (order_number IS NULL OR order_number = '')
          ORDER BY id ASC
          LIMIT ?
        `, [state, stateRemaining]);
        

        for (const lead of leads) {
          await db.execute(`
            UPDATE lead_details SET order_number = ? WHERE id = ?
          `, [order.order_number, lead.id]);
          
          totalAssigned++;
          stateAssignments[state] = (stateAssignments[state] || 0) + 1;
        }
      }
      

      const newFulfilledCount = order.fulfilled_count + totalAssigned;
                await db.execute(`
        UPDATE lead_orders SET fulfilled_count = ? WHERE id = ?
      `, [newFulfilledCount, orderId]);
      
      for (const [state, count] of Object.entries(stateAssignments)) {
        const newStateCount = (currentStateCounts[state] || 0) + count;
        await db.execute(`
          UPDATE lead_order_states SET fulfilled_count = ? 
          WHERE order_id = ? AND state = ?
        `, [newStateCount, orderId, state]);
      }
      
        
      if (newFulfilledCount >= order.quantity) {
        await db.execute(`
          UPDATE lead_orders 
          SET status = 'fulfilled', completed_at = NOW() 
          WHERE id = ?
        `, [orderId]);
      }
      
      await db.commit();
      
      const message = `Order fulfilled. Assigned ${totalAssigned} additional leads.`;
      return isPlainText 
        ? sendPlainTextResponse(res, true, message)
        : res.redirect('/?success=' + encodeURIComponent(message));
        
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error fulfilling order:', error);
    const message = 'Failed to fulfill order: ' + error.message;
    return isPlainText 
      ? sendPlainTextResponse(res, false, message)
      : res.status(500).send(message);
  }
});


router.get('/:id/delete', requireAuth, async (req, res) => {
  const isPlainText = req.get('Accept') === 'text/plain';
  
  try {
    const orderId = req.params.id;
    const db = getDB();

    const [orders] = await db.execute('SELECT * FROM lead_orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Order not found')
        : res.status(404).send('Order not found');
    }
    
    const order = orders[0];
    
    await db.beginTransaction();
    
    try {
 
                await db.execute(`
        UPDATE lead_details SET order_number = NULL WHERE order_number = ?
      `, [order.order_number]);
      
      await db.execute('DELETE FROM lead_order_states WHERE order_id = ?', [orderId]);
      
      await db.execute('DELETE FROM lead_orders WHERE id = ?', [orderId]);
      
      await db.commit();
      
      const message = 'Order deleted successfully. Leads returned to stock.';
      return isPlainText 
        ? sendPlainTextResponse(res, true, message)
        : res.redirect('/?success=' + encodeURIComponent(message));
        
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error deleting order:', error);
    const message = 'Failed to delete order: ' + error.message;
    return isPlainText 
      ? sendPlainTextResponse(res, false, message)
      : res.status(500).send(message);
  }
});


router.get('/:id/csv', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const db = getDB();
    
    const [orders] = await db.execute('SELECT * FROM lead_orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return res.status(404).send('Order not found');
    }
    
    const order = orders[0];
    if (order.status !== 'fulfilled') {
      return res.status(400).send('CSV export only available for fulfilled orders');
    }
    
    const [leads] = await db.execute(`
      SELECT phone_number, state, order_number 
      FROM lead_details 
      WHERE order_number = ? 
      ORDER BY id ASC
    `, [order.order_number]);
    

    const createCsvWriter = require('csv-writer').createObjectCsvWriter;
    const csvWriter = createCsvWriter({
      path: `temp_export_${orderId}.csv`,
      header: [
        { id: 'phone_number', title: 'Phone Number' },
        { id: 'state', title: 'State' },
        { id: 'order_number', title: 'Order Number' }
      ]
    });
    
    await csvWriter.writeRecords(leads);
    
    res.download(`temp_export_${orderId}.csv`, `order_${order.order_number}_export.csv`, (err) => {
      if (err) {
        console.error('Error sending CSV:', err);
      }
      require('fs').unlink(`temp_export_${orderId}.csv`, () => {});
    });
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).send('Failed to export CSV');
  }
});

// New endpoint for storing detailed order information
router.post('/info', async (req, res) => {
  const isPlainText = req.get('Accept') === 'text/plain';
  
  try {
    const {
      order_id,
      order_number,
      total,
      currency,
      payment_method,
      payment_method_title,
      status,
      date_created,
      customer,
      shipping,
      items
    } = req.body;
    
    // Validate required fields
    if (!order_id || !order_number || !total || !currency || !payment_method || 
        !payment_method_title || !status || !date_created || !customer || !shipping || !items) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Missing required fields')
        : res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate customer object
    if (!customer.first_name || !customer.last_name || !customer.email || 
        !customer.address_1 || !customer.city || !customer.state || 
        !customer.postcode || !customer.country) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Missing required customer fields')
        : res.status(400).json({ error: 'Missing required customer fields' });
    }
    
    // Validate shipping object
    if (!shipping.first_name || !shipping.last_name || !shipping.address_1 || 
        !shipping.city || !shipping.state || !shipping.postcode || !shipping.country) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Missing required shipping fields')
        : res.status(400).json({ error: 'Missing required shipping fields' });
    }
    
    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return isPlainText 
        ? sendPlainTextResponse(res, false, 'Items array is required and must not be empty')
        : res.status(400).json({ error: 'Items array is required and must not be empty' });
    }
    
    // Validate each item
    for (const item of items) {
      if (!item.product_id || !item.product_name || !item.quantity || 
          !item.subtotal || !item.total || !item.price) {
        return isPlainText 
          ? sendPlainTextResponse(res, false, 'Missing required item fields')
          : res.status(400).json({ error: 'Missing required item fields' });
      }
    }
    
    const db = getDB();
    await db.beginTransaction();
    
    try {
      // Insert order info
      const [orderResult] = await db.execute(`
        INSERT INTO order_info (order_id, order_number, total, currency, payment_method, 
                              payment_method_title, status, date_created)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [order_id, order_number, parseFloat(total), currency, payment_method, 
          payment_method_title, status, date_created]);
      
      const orderInfoId = orderResult.insertId;
      
      // Insert customer information
      await db.execute(`
        INSERT INTO order_customers (order_id, first_name, last_name, email, phone, 
                                   address_1, address_2, city, state, postcode, country, company)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderInfoId, customer.first_name, customer.last_name, customer.email, 
          customer.phone || null, customer.address_1, customer.address_2 || null,
          customer.city, customer.state, customer.postcode, customer.country, 
          customer.company || null]);
      
      // Insert shipping information
      await db.execute(`
        INSERT INTO order_shipping (order_id, first_name, last_name, address_1, address_2,
                                  city, state, postcode, country, company)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderInfoId, shipping.first_name, shipping.last_name, shipping.address_1,
          shipping.address_2 || null, shipping.city, shipping.state, shipping.postcode,
          shipping.country, shipping.company || null]);
      
      // Insert order items
      for (const item of items) {
        await db.execute(`
          INSERT INTO order_items (order_id, product_id, product_name, quantity, 
                                 subtotal, total, sku, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [orderInfoId, item.product_id, item.product_name, parseInt(item.quantity),
            parseFloat(item.subtotal), parseFloat(item.total), item.sku || null,
            parseFloat(item.price)]);
      }
      
      await db.commit();
      
      const message = `Order information stored successfully. Order ID: ${orderInfoId}`;
      return isPlainText 
        ? sendPlainTextResponse(res, true, message)
        : res.json({ 
            success: true, 
            message: message, 
            order_info_id: orderInfoId,
            order_number: order_number 
          });
        
    } catch (error) {
      await db.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error storing order information:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      const message = 'Order number already exists';
      return isPlainText 
        ? sendPlainTextResponse(res, false, message)
        : res.status(400).json({ error: message });
    }
    
    const message = 'Failed to store order information: ' + error.message;
    return isPlainText 
      ? sendPlainTextResponse(res, false, message)
      : res.status(500).json({ error: message });
  }
});

module.exports = router;
