const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'closrtech',
  port: process.env.DB_PORT || 3306
};

async function completeSetup() {
  let connection;
  
  try {
    console.log('🚀 Starting Complete Setup for Order Assignment App...\n');
    
    // Step 1: Connect to MySQL
    console.log('📡 Connecting to MySQL...');
    const tempConfig = { ...dbConfig };
    delete tempConfig.database;
    connection = await mysql.createConnection(tempConfig);
    console.log('✅ Connected to MySQL\n');
    
    // Step 2: Create database if it doesn't exist
    console.log(`🗄️  Creating database '${dbConfig.database}' if it doesn't exist...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await connection.query(`USE \`${dbConfig.database}\``);
    console.log(`✅ Database '${dbConfig.database}' ready\n`);
    
    // Step 3: Check if lead_details table exists
    console.log('🔍 Checking for lead_details table...');
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'lead_details'
    `, [dbConfig.database]);
    
    if (tables[0].count === 0) {
      console.log('❌ lead_details table not found.');
      console.log('📥 Attempting to import closrtech.sql...');
      
      try {
        // Try to import the SQL file
        const sqlPath = path.join(__dirname, '..', 'closrtech.sql');
        if (fs.existsSync(sqlPath)) {
          console.log('📄 Found closrtech.sql, importing...');
          const sqlContent = fs.readFileSync(sqlPath, 'utf8');
          
          // Split by semicolon and execute each statement
          const statements = sqlContent.split(';').filter(stmt => stmt.trim());
          for (const statement of statements) {
            if (statement.trim()) {
              try {
                // Use query for DDL statements, execute for others
                if (statement.trim().toUpperCase().startsWith('CREATE') || 
                    statement.trim().toUpperCase().startsWith('DROP') ||
                    statement.trim().toUpperCase().startsWith('INSERT') ||
                    statement.trim().toUpperCase().startsWith('SET')) {
                  await connection.query(statement);
                } else {
                  await connection.execute(statement);
                }
              } catch (error) {
                // Skip errors for statements that might not be relevant
                if (!error.message.includes('already exists') && 
                    !error.message.includes('Duplicate entry')) {
                  console.log(`⚠️  Warning: ${error.message}`);
                }
              }
            }
          }
          console.log('✅ closrtech.sql imported successfully\n');
        } else {
          console.log('❌ closrtech.sql file not found in project root.');
          console.log('📋 Please ensure closrtech.sql is in the project directory.');
          console.log('💡 You can also import it manually: mysql -u root -p closrtech < closrtech.sql');
          process.exit(1);
        }
      } catch (error) {
        console.log('❌ Failed to import closrtech.sql:', error.message);
        console.log('💡 Please import manually: mysql -u root -p closrtech < closrtech.sql');
        process.exit(1);
      }
    } else {
      console.log('✅ lead_details table found\n');
    }
    
    // Step 4: Check if lead_details has data
    console.log('📊 Checking lead_details data...');
    const [leadCount] = await connection.execute('SELECT COUNT(*) as count FROM lead_details');
    console.log(`✅ Found ${leadCount[0].count} leads in lead_details table\n`);
    
    if (leadCount[0].count === 0) {
      console.log('⚠️  Warning: lead_details table is empty.');
      console.log('💡 Please ensure your dataset was imported correctly.\n');
    }
    
    // Step 5: Create application tables
    console.log('🏗️  Creating application tables...');
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements
    const statements = schema.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
        } catch (error) {
          // Skip errors for statements that might already exist
          if (!error.message.includes('already exists') && 
              !error.message.includes('Duplicate entry')) {
            console.log(`⚠️  Warning: ${error.message}`);
          }
        }
      }
    }
    console.log('✅ Application tables created successfully\n');
    
    // Step 6: Check environment configuration
    console.log('⚙️  Checking environment configuration...');
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) {
      console.log('📝 Creating .env file from template...');
      const envExamplePath = path.join(__dirname, '..', 'env.example');
      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created from template');
        console.log('💡 Please edit .env file with your database credentials\n');
      } else {
        console.log('❌ env.example file not found\n');
      }
    } else {
      console.log('✅ .env file exists\n');
    }
    
    // Step 7: Install dependencies
    console.log('📦 Checking dependencies...');
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('📥 Installing npm dependencies...');
      try {
        execSync('npm install', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
        console.log('✅ Dependencies installed successfully\n');
      } catch (error) {
        console.log('❌ Failed to install dependencies:', error.message);
        console.log('💡 Please run: npm install\n');
      }
    } else {
      console.log('✅ Dependencies already installed\n');
    }
    
    // Step 8: Final verification
    console.log('🔍 Final verification...');
    const [appTables] = await connection.execute(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = ? AND table_name IN ('lead_orders', 'lead_order_states', 'automation')
    `, [dbConfig.database]);
    
    console.log(`✅ Found ${appTables.length}/3 application tables:`);
    appTables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    console.log('\n🎉 Setup Complete!');
    console.log('\n📋 Next Steps:');
    console.log('1. Edit .env file with your database credentials if needed');
    console.log('2. Run: npm start');
    console.log('3. Access admin interface at: http://localhost:3001');
    console.log('4. Login with: admin / admin123 (or your configured credentials)');
    console.log('\n🧪 To run tests: npm test');
    console.log('📚 For documentation: see README.md');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure MySQL is running');
    console.error('2. Check database credentials in .env');
    console.error('3. Verify closrtech.sql file exists');
    console.error('4. Check file permissions');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run setup
completeSetup();