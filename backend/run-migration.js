const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'pagelm_root_password',
    database: process.env.DB_DATABASE || 'pagelm'
  });

  try {
    console.log('🔄 Running Study with AI platform integration migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations/003_study_with_ai_platform_integration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        await connection.execute(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Check if it's a "duplicate column" or "table already exists" error
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_TABLE_EXISTS_ERROR' ||
            error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log('🎉 Migration completed successfully!');

    // Verify the new tables exist
    console.log('\n🔍 Verifying migration...');
    
    const [tables] = await connection.execute("SHOW TABLES LIKE 'external_platforms'");
    if (tables.length > 0) {
      console.log('✅ external_platforms table created');
    } else {
      console.log('❌ external_platforms table not found');
    }

    const [userPlatforms] = await connection.execute("SHOW TABLES LIKE 'user_platforms'");
    if (userPlatforms.length > 0) {
      console.log('✅ user_platforms table created');
    } else {
      console.log('❌ user_platforms table not found');
    }

    // Check if new columns were added to users table
    try {
      const [columns] = await connection.execute("DESCRIBE users");
      const columnNames = columns.map(col => col.Field);
      
      const newColumns = ['phone', 'birth_date', 'credits', 'domain_url', 'external_platform_id', 'source_platform'];
      newColumns.forEach(col => {
        if (columnNames.includes(col)) {
          console.log(`✅ users.${col} column added`);
        } else {
          console.log(`❌ users.${col} column not found`);
        }
      });
    } catch (error) {
      console.log('⚠️  Could not verify users table columns:', error.message);
    }

    // Show platform data
    console.log('\n📋 Configured platforms:');
    const [platforms] = await connection.execute('SELECT platform_code, name, token_type FROM external_platforms');
    platforms.forEach(platform => {
      console.log(`  - ${platform.platform_code}: ${platform.name} (${platform.token_type})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n🚀 Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
