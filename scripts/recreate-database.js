const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'closrtech',
  port: process.env.DB_PORT || 3306
};

async function recreateDatabase() {
  let connection;
  
  try {
    console.log('🚀 Recreating Database with New Tables...\n');
    
    // Step 1: Connect to MySQL (without database)
    console.log('📡 Connecting to MySQL...');
    const tempConfig = { ...dbConfig };
    delete tempConfig.database;
    connection = await mysql.createConnection(tempConfig);
    console.log('✅ Connected to MySQL\n');
    
    // Step 2: Drop existing database
    console.log(`🗑️  Dropping existing database '${dbConfig.database}'...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${dbConfig.database}\``);
    console.log(`✅ Database dropped\n`);
    
    // Step 3: Create new database
    console.log(`🗄️  Creating new database '${dbConfig.database}'...`);
    await connection.query(`CREATE DATABASE \`${dbConfig.database}\``);
    await connection.query(`USE \`${dbConfig.database}\``);
    console.log(`✅ Database created\n`);
    
    // Step 4: Import original data (closrtech.sql)
    console.log('📥 Importing original data from closrtech.sql...');
    const sqlPath = path.join(__dirname, '..', 'closrtech.sql');
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = sqlContent.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await connection.query(statement);
          } catch (error) {
            if (!error.message.includes('already exists') && 
                !error.message.includes('Duplicate entry')) {
              console.log(`⚠️  Warning: ${error.message}`);
            }
          }
        }
      }
      console.log('✅ Original data imported\n');
    } else {
      console.log('❌ closrtech.sql file not found. Skipping original data import.\n');
    }
    
    // Step 5: Create application tables (including new order tables)
    console.log('🏗️  Creating application tables (including new order tables)...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schema.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
          console.log(`✅ Created table from statement`);
        } catch (error) {
          if (!error.message.includes('already exists') && 
              !error.message.includes('Duplicate entry')) {
            console.log(`⚠️  Warning: ${error.message}`);
          }
        }
      }
    }
    console.log('✅ All application tables created successfully\n');
    
    // Step 6: Verify all tables
    console.log('🔍 Verifying all tables...');
    const [tables] = await connection.execute(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = ?
      ORDER BY table_name
    `, [dbConfig.database]);
    
    console.log(`✅ Found ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    // Check for our new tables specifically
    const newTables = ['order_info', 'order_customers', 'order_shipping', 'order_items'];
    const [newTableCheck] = await connection.execute(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = ? AND table_name IN ('order_info', 'order_customers', 'order_shipping', 'order_items')
    `, [dbConfig.database]);
    
    console.log(`\n✅ New order tables created: ${newTableCheck.length}/4`);
    newTableCheck.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    console.log('\n🎉 Database Recreation Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Restart your server: npm start');
    console.log('2. Test the new endpoint: node test-order-info.js');
    
  } catch (error) {
    console.error('❌ Database recreation failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure MySQL is running');
    console.error('2. Check database credentials in .env');
    console.error('3. Verify you have DROP/CREATE permissions');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run recreation
recreateDatabase();
