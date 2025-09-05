const express = require('express');
const router = express.Router();
const { getDB, parseStates, parseThresholds, sendPlainTextResponse } = require('../utils/database');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
