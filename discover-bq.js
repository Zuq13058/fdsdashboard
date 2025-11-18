import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account credentials
const keyPath = join(__dirname, 'src', 'key.json');
const keyFile = JSON.parse(readFileSync(keyPath, 'utf8'));

const bigquery = new BigQuery({
  projectId: keyFile.project_id,
  credentials: keyFile,
});

console.log(`\n🔍 Discovering BigQuery datasets and tables for project: ${keyFile.project_id}\n`);

async function discoverDatasets() {
  try {
    const [datasets] = await bigquery.getDatasets();
    
    console.log(`Found ${datasets.length} dataset(s):\n`);
    
    const datasetInfo = [];
    
    for (const dataset of datasets) {
      const datasetId = dataset.id;
      console.log(`📁 Dataset: ${datasetId}`);
      
      try {
        const [tables] = await dataset.getTables();
        console.log(`   Tables (${tables.length}):`);
        
        const tableList = [];
        for (const table of tables) {
          const tableId = table.id;
          console.log(`     - ${tableId}`);
          
          // Get table metadata to check columns
          try {
            const [metadata] = await table.getMetadata();
            const schema = metadata.schema?.fields || [];
            
            // Check if this looks like an events table
            const hasUserId = schema.some(f => 
              f.name?.toLowerCase().includes('user') && 
              (f.name?.toLowerCase().includes('id') || f.name?.toLowerCase() === 'user_id')
            );
            const hasEventName = schema.some(f => 
              f.name?.toLowerCase().includes('event') && 
              (f.name?.toLowerCase().includes('name') || f.name?.toLowerCase() === 'event_name')
            );
            const hasTimestamp = schema.some(f => 
              f.name?.toLowerCase().includes('time') || 
              f.name?.toLowerCase() === 'timestamp' ||
              f.name?.toLowerCase() === 'created_at'
            );
            
            const columnNames = schema.map(f => f.name).join(', ');
            
            tableList.push({
              name: tableId,
              columns: schema.map(f => f.name),
              looksLikeEvents: hasUserId && hasEventName && hasTimestamp,
              looksLikeUsers: hasUserId && hasTimestamp && !hasEventName,
            });
            
            if (hasUserId && hasEventName && hasTimestamp) {
              console.log(`       ⭐ Looks like an EVENTS table (has user_id, event_name, timestamp)`);
            } else if (hasUserId && hasTimestamp && !hasEventName) {
              console.log(`       👤 Might be a USERS table`);
            }
            console.log(`       Columns: ${columnNames}`);
          } catch (err) {
            console.log(`       ⚠️  Could not read table metadata: ${err.message}`);
          }
        }
        
        datasetInfo.push({
          datasetId,
          tables: tableList,
        });
        
      } catch (err) {
        console.log(`   ⚠️  Could not list tables: ${err.message}`);
      }
      
      console.log('');
    }
    
    // Suggest configuration
    console.log('\n' + '='.repeat(60));
    console.log('💡 SUGGESTED CONFIGURATION');
    console.log('='.repeat(60) + '\n');
    
    // Find best matches
    let eventsTable = null;
    let usersTable = null;
    let suggestedDataset = null;
    
    for (const ds of datasetInfo) {
      for (const table of ds.tables) {
        if (table.looksLikeEvents && !eventsTable) {
          eventsTable = table;
          suggestedDataset = ds.datasetId;
        }
        if (table.looksLikeUsers && !usersTable) {
          usersTable = table;
          if (!suggestedDataset) suggestedDataset = ds.datasetId;
        }
      }
    }
    
    // If no perfect match, use first dataset and first tables
    if (!suggestedDataset && datasetInfo.length > 0) {
      suggestedDataset = datasetInfo[0].datasetId;
      if (datasetInfo[0].tables.length > 0) {
        eventsTable = datasetInfo[0].tables[0];
        if (datasetInfo[0].tables.length > 1) {
          usersTable = datasetInfo[0].tables[1];
        }
      }
    }
    
    console.log('Update server.config.js with:\n');
    console.log('export const BQ_CONFIG = {');
    console.log(`  DATASET_ID: '${suggestedDataset || 'your_dataset'}',`);
    console.log(`  EVENTS_TABLE: '${eventsTable?.name || 'events'}',`);
    console.log(`  USERS_TABLE: '${usersTable?.name || 'users'}',`);
    console.log('');
    console.log('  COLUMNS: {');
    
    if (eventsTable && eventsTable.columns.length > 0) {
      const userIdCol = eventsTable.columns.find(c => 
        c.toLowerCase().includes('user') && c.toLowerCase().includes('id')
      ) || eventsTable.columns.find(c => c.toLowerCase() === 'user_id') || eventsTable.columns[0];
      
      const eventNameCol = eventsTable.columns.find(c => 
        c.toLowerCase().includes('event') && c.toLowerCase().includes('name')
      ) || eventsTable.columns.find(c => c.toLowerCase() === 'event_name') || eventsTable.columns[1];
      
      const timestampCol = eventsTable.columns.find(c => 
        c.toLowerCase().includes('time') || c.toLowerCase() === 'timestamp' || c.toLowerCase() === 'created_at'
      ) || eventsTable.columns.find(c => c.toLowerCase().includes('date')) || eventsTable.columns[2];
      
      console.log(`    EVENT_USER_ID: '${userIdCol}',`);
      console.log(`    EVENT_NAME: '${eventNameCol}',`);
      console.log(`    EVENT_TIMESTAMP: '${timestampCol}',`);
    } else {
      console.log(`    EVENT_USER_ID: 'user_id',`);
      console.log(`    EVENT_NAME: 'event_name',`);
      console.log(`    EVENT_TIMESTAMP: 'timestamp',`);
    }
    
    if (usersTable && usersTable.columns.length > 0) {
      const userIdCol = usersTable.columns.find(c => 
        c.toLowerCase().includes('user') && c.toLowerCase().includes('id')
      ) || usersTable.columns.find(c => c.toLowerCase() === 'user_id') || usersTable.columns[0];
      
      const createdAtCol = usersTable.columns.find(c => 
        c.toLowerCase().includes('created') || c.toLowerCase() === 'created_at'
      ) || usersTable.columns.find(c => c.toLowerCase().includes('time')) || usersTable.columns[1];
      
      console.log(`    USER_ID: '${userIdCol}',`);
      console.log(`    USER_CREATED_AT: '${createdAtCol}',`);
    } else {
      console.log(`    USER_ID: 'user_id',`);
      console.log(`    USER_CREATED_AT: 'created_at',`);
    }
    
    console.log('  },');
    console.log('  // ... rest of config');
    console.log('};\n');
    
    // Generate auto-config file
    const autoConfig = {
      DATASET_ID: suggestedDataset || 'your_dataset',
      EVENTS_TABLE: eventsTable?.name || 'events',
      USERS_TABLE: usersTable?.name || 'users',
      COLUMNS: {
        EVENT_USER_ID: eventsTable?.columns.find(c => 
          c.toLowerCase().includes('user') && c.toLowerCase().includes('id')
        ) || 'user_id',
        EVENT_NAME: eventsTable?.columns.find(c => 
          c.toLowerCase().includes('event') && c.toLowerCase().includes('name')
        ) || 'event_name',
        EVENT_TIMESTAMP: eventsTable?.columns.find(c => 
          c.toLowerCase().includes('time') || c.toLowerCase() === 'timestamp'
        ) || 'timestamp',
        USER_ID: usersTable?.columns.find(c => 
          c.toLowerCase().includes('user') && c.toLowerCase().includes('id')
        ) || 'user_id',
        USER_CREATED_AT: usersTable?.columns.find(c => 
          c.toLowerCase().includes('created') || c.toLowerCase() === 'created_at'
        ) || 'created_at',
      },
    };
    
    console.log('📝 Auto-generated config saved to: server.config.auto.js');
    console.log('   Review it and copy the values to server.config.js\n');
    
    return autoConfig;
    
  } catch (error) {
    console.error('❌ Error discovering datasets:', error.message);
    if (error.errors) {
      error.errors.forEach(err => console.error('   ', err.message));
    }
    process.exit(1);
  }
}

discoverDatasets().then((config) => {
  // Write auto-config file
  const configContent = `// Auto-generated configuration
// Review and copy values to server.config.js

export const BQ_CONFIG = {
  DATASET_ID: '${config.DATASET_ID}',
  EVENTS_TABLE: '${config.EVENTS_TABLE}',
  USERS_TABLE: '${config.USERS_TABLE}',
  COLUMNS: {
    EVENT_USER_ID: '${config.COLUMNS.EVENT_USER_ID}',
    EVENT_NAME: '${config.COLUMNS.EVENT_NAME}',
    EVENT_TIMESTAMP: '${config.COLUMNS.EVENT_TIMESTAMP}',
    USER_ID: '${config.COLUMNS.USER_ID}',
    USER_CREATED_AT: '${config.COLUMNS.USER_CREATED_AT}',
  },
  TRACKED_EVENTS: [
    'communityToggleLike',
    'communityNewPost',
    'communityNewComment',
    'communityLoadMorePosts',
    'communitySelectedPostTab',
    'communityShowAllPosts',
    'communityNotificationIconClicked',
    'communityNotificationClicked',
    'communityNotificationMarkAllAsRead',
    'communityNotificationSelectedTab',
  ],
  FUNNEL: {
    STEP1_EVENT: 'communitySelectedPostTab',
    STEP2_EVENTS: [
      'communityNewPost',
      'communityNewComment',
      'communityToggleLike',
    ],
  },
};
`;
  
  writeFileSync('server.config.auto.js', configContent);
  console.log('✅ Done! Review server.config.auto.js and update server.config.js\n');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

