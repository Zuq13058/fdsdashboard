import express from 'express';
import cors from 'cors';
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BQ_CONFIG } from './server.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// Initialize BigQuery client
let bigquery;
try {
  // Try multiple key file paths
  const keyPaths = [
    BQ_CONFIG.KEY_FILE_PATH || '/home/runner/workspace/key.json', // CI/CD path
    join(__dirname, 'src', 'key.json'), // Local development path
    join(__dirname, 'key.json'), // Alternative local path
  ];
  
  let keyFile = null;
  let keyPath = null;
  
  for (const path of keyPaths) {
    try {
      if (readFileSync(path, 'utf8')) {
        keyFile = JSON.parse(readFileSync(path, 'utf8'));
        keyPath = path;
        break;
      }
    } catch (err) {
      // Try next path
      continue;
    }
  }
  
  if (!keyFile) {
    throw new Error(`Could not find key.json in any of these locations: ${keyPaths.join(', ')}`);
  }
  
  bigquery = new BigQuery({
    projectId: keyFile.project_id,
    credentials: keyFile,
  });
  
  console.log(`✅ Connected to BigQuery project: ${keyFile.project_id}`);
  console.log(`📁 Using key file: ${keyPath}`);
  console.log(`📊 Using dataset: ${BQ_CONFIG.DATASET_ID}`);
} catch (error) {
  console.error('❌ Error initializing BigQuery:', error.message);
  process.exit(1);
}

// Configuration from config file
const { DATASET_ID, EVENTS_TABLE, USER_PROFILES_TABLE, COLUMNS, TRACKED_EVENTS, FUNNEL } = BQ_CONFIG;

// Validate configuration
console.log(`📋 Configuration:`);
console.log(`   - Dataset: ${DATASET_ID}`);
console.log(`   - Events Table: ${EVENTS_TABLE}`);
console.log(`   - User Profiles Table: ${USER_PROFILES_TABLE}`);
console.log(`   - Step 1 Event: ${FUNNEL.STEP1_EVENT} (${FUNNEL.STEP1_PROPERTY} = '${FUNNEL.STEP1_VALUE}')`);
console.log(`   - Step 2 Events: ${FUNNEL.STEP2_EVENTS.length} community events`);

// Helper function to execute BigQuery queries
async function runQuery(query) {
  const [job] = await bigquery.createQueryJob({ query });
  const [rows] = await job.getQueryResults();
  return rows;
}

// API Endpoint: Funnel Data
app.get('/api/funnel', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Query to get funnel metrics based on user requirements
    // Step 1: Users who selected 'community' from menuBarSelected
    // Step 2: Users who triggered any community events
    const query = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      ),
      step1_users AS (
        SELECT COUNT(DISTINCT e.${COLUMNS.EVENT_USER_ID}) as total_step1_users
        FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
        INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
        WHERE e.${COLUMNS.EVENT_NAME} = '${FUNNEL.STEP1_EVENT}'
          AND JSON_EXTRACT_SCALAR(e.${COLUMNS.EVENT_PROPERTIES}, '$.${FUNNEL.STEP1_PROPERTY}') = '${FUNNEL.STEP1_VALUE}'
          AND e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
      ),
      step2_users AS (
        SELECT COUNT(DISTINCT e.${COLUMNS.EVENT_USER_ID}) as total_step2_users
        FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
        INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
        WHERE e.${COLUMNS.EVENT_NAME} IN (${FUNNEL.STEP2_EVENTS.map(e => `'${e}'`).join(', ')})
          AND e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
      ),
      total_school_users AS (
        SELECT COUNT(DISTINCT user_id) as total_users
        FROM school_users
      )
      SELECT 
        (SELECT total_users FROM total_school_users) as total_users,
        (SELECT total_step1_users FROM step1_users) as total_step1_users,
        (SELECT total_step2_users FROM step2_users) as total_engaged_users,
        SAFE_DIVIDE(
          (SELECT total_step2_users FROM step2_users),
          (SELECT total_step1_users FROM step1_users)
        ) as conversion_rate
    `;

    const options = {
      query,
      params: {
        start,
        end,
      },
    };

    const [rows] = await bigquery.query(options);
    const result = rows[0] || {
      total_users: 0,
      total_step1_users: 0,
      total_engaged_users: 0,
      conversion_rate: 0,
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      query: query.substring(0, 200) + '...',
    });
    res.status(500).json({ 
      error: error.message,
      details: error.errors || error.message,
      hint: 'Check server console for full error details'
    });
  }
});

// API Endpoint: Event Summary
app.get('/api/event-summary', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const eventsList = TRACKED_EVENTS.map(e => `'${e}'`).join(', ');
    const query = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      )
      SELECT 
        e.${COLUMNS.EVENT_NAME} as name,
        COUNT(*) as event_count,
        COUNT(DISTINCT e.${COLUMNS.EVENT_USER_ID}) as user_count
      FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
      INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
      WHERE e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
        AND e.${COLUMNS.EVENT_NAME} IN (${eventsList})
      GROUP BY e.${COLUMNS.EVENT_NAME}
      ORDER BY event_count DESC
    `;

    const options = {
      query,
      params: {
        start,
        end,
      },
    };

    const [rows] = await bigquery.query(options);
    res.json({ events: rows });
  } catch (error) {
    console.error('Error fetching event summary:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
    });
    res.status(500).json({ 
      error: error.message,
      details: error.errors || error.message,
      hint: 'Check server console for full error details'
    });
  }
});

// API Endpoint: Active Users
app.get('/api/active-users', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Active users are those who triggered any community events (Step 2 events)
    const communityEventsList = FUNNEL.STEP2_EVENTS.map(e => `'${e}'`).join(', ');
    
    // Daily active users
    const dailyQuery = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      )
      SELECT 
        DATE(e.${COLUMNS.EVENT_TIMESTAMP}) as date,
        COUNT(DISTINCT e.${COLUMNS.EVENT_USER_ID}) as active_users
      FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
      INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
      WHERE e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
        AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
      GROUP BY date
      ORDER BY date ASC
    `;

    // Weekly active users
    const weeklyQuery = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      )
      SELECT 
        DATE_TRUNC(DATE(e.${COLUMNS.EVENT_TIMESTAMP}), WEEK) as date,
        COUNT(DISTINCT e.${COLUMNS.EVENT_USER_ID}) as active_users
      FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
      INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
      WHERE e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
        AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
      GROUP BY date
      ORDER BY date ASC
    `;

    // Monthly active users
    const monthlyQuery = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      )
      SELECT 
        DATE_TRUNC(DATE(e.${COLUMNS.EVENT_TIMESTAMP}), MONTH) as date,
        COUNT(DISTINCT e.${COLUMNS.EVENT_USER_ID}) as active_users
      FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
      INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
      WHERE e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
        AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
      GROUP BY date
      ORDER BY date ASC
    `;

    // Get total users who selected community menu (Step 1 users) - this will be the denominator
    const step1UsersQuery = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      )
      SELECT 
        COUNT(DISTINCT e.${COLUMNS.EVENT_USER_ID}) as total_step1_users
      FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
      INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
      WHERE e.${COLUMNS.EVENT_NAME} = '${FUNNEL.STEP1_EVENT}'
        AND JSON_EXTRACT_SCALAR(e.${COLUMNS.EVENT_PROPERTIES}, '$.${FUNNEL.STEP1_PROPERTY}') = '${FUNNEL.STEP1_VALUE}'
        AND e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
    `;

    const options = { params: { start, end } };

    const [dailyRows] = await bigquery.query({ ...options, query: dailyQuery });
    const [weeklyRows] = await bigquery.query({ ...options, query: weeklyQuery });
    const [monthlyRows] = await bigquery.query({ ...options, query: monthlyQuery });
    const [step1UsersRows] = await bigquery.query({ ...options, query: step1UsersQuery });

    // Format dates as ISO strings
    const formatRows = (rows) => rows.map(row => ({
      date: row.date.value || row.date,
      active_users: parseInt(row.active_users) || 0,
    }));

    // Total users who selected community menu (Step 1) - used as denominator for percentage
    const totalStep1Users = parseInt(step1UsersRows[0]?.total_step1_users) || 0;

    res.json({
      daily: formatRows(dailyRows),
      weekly: formatRows(weeklyRows),
      monthly: formatRows(monthlyRows),
      total_step1_users: totalStep1Users, // Users who selected community menu
      total_distinct_daily: totalStep1Users, // Use Step 1 users as denominator
      total_distinct_weekly: totalStep1Users, // Use Step 1 users as denominator
      total_distinct_monthly: totalStep1Users, // Use Step 1 users as denominator
    });
  } catch (error) {
    console.error('Error fetching active users:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
    });
    res.status(500).json({ 
      error: error.message,
      details: error.errors || error.message,
      hint: 'Check server console for full error details'
    });
  }
});

// API Endpoint: Retention
app.get('/api/retention', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Daily retention
    const communityEventsList = FUNNEL.STEP2_EVENTS.map(e => `'${e}'`).join(', ');
    const dailyQuery = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      ),
      cohorts AS (
        SELECT 
          DATE(e.${COLUMNS.EVENT_TIMESTAMP}) as cohort_date,
          e.${COLUMNS.EVENT_USER_ID} as user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
        INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
        WHERE e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
          AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
        GROUP BY cohort_date, user_id
      ),
      returns AS (
        SELECT 
          c.cohort_date as period_start,
          COUNT(DISTINCT c.user_id) as cohort_size,
          COUNT(DISTINCT CASE WHEN e.${COLUMNS.EVENT_USER_ID} IS NOT NULL THEN c.user_id END) as retained_users
        FROM cohorts c
        LEFT JOIN \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
          ON c.user_id = e.${COLUMNS.EVENT_USER_ID}
          AND DATE(e.${COLUMNS.EVENT_TIMESTAMP}) > c.cohort_date
          AND DATE(e.${COLUMNS.EVENT_TIMESTAMP}) <= LEAST(DATE_ADD(c.cohort_date, INTERVAL 1 DAY), DATE(@end))
          AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
        GROUP BY c.cohort_date
      )
      SELECT 
        period_start,
        cohort_size,
        retained_users,
        SAFE_DIVIDE(retained_users, cohort_size) as retention_rate
      FROM returns
      ORDER BY period_start DESC
    `;

    // Weekly retention
    const weeklyQuery = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      ),
      cohorts AS (
        SELECT 
          DATE_TRUNC(DATE(e.${COLUMNS.EVENT_TIMESTAMP}), WEEK) as cohort_date,
          e.${COLUMNS.EVENT_USER_ID} as user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
        INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
        WHERE e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
          AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
        GROUP BY cohort_date, user_id
      ),
      returns AS (
        SELECT 
          c.cohort_date as period_start,
          COUNT(DISTINCT c.user_id) as cohort_size,
          COUNT(DISTINCT CASE WHEN e.${COLUMNS.EVENT_USER_ID} IS NOT NULL THEN c.user_id END) as retained_users
        FROM cohorts c
        LEFT JOIN \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
          ON c.user_id = e.${COLUMNS.EVENT_USER_ID}
          AND DATE(e.${COLUMNS.EVENT_TIMESTAMP}) > c.cohort_date
          AND DATE(e.${COLUMNS.EVENT_TIMESTAMP}) <= LEAST(DATE_ADD(c.cohort_date, INTERVAL 7 DAY), DATE(@end))
          AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
        GROUP BY c.cohort_date
      )
      SELECT 
        period_start,
        cohort_size,
        retained_users,
        SAFE_DIVIDE(retained_users, cohort_size) as retention_rate
      FROM returns
      ORDER BY period_start DESC
    `;

    // Monthly retention
    const monthlyQuery = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      ),
      cohorts AS (
        SELECT 
          DATE_TRUNC(DATE(e.${COLUMNS.EVENT_TIMESTAMP}), MONTH) as cohort_date,
          e.${COLUMNS.EVENT_USER_ID} as user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
        INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
        WHERE e.${COLUMNS.EVENT_TIMESTAMP} BETWEEN @start AND @end
          AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
        GROUP BY cohort_date, user_id
      ),
      returns AS (
        SELECT 
          c.cohort_date as period_start,
          COUNT(DISTINCT c.user_id) as cohort_size,
          COUNT(DISTINCT CASE WHEN e.${COLUMNS.EVENT_USER_ID} IS NOT NULL THEN c.user_id END) as retained_users
        FROM cohorts c
        LEFT JOIN \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
          ON c.user_id = e.${COLUMNS.EVENT_USER_ID}
          AND DATE(e.${COLUMNS.EVENT_TIMESTAMP}) > c.cohort_date
          AND DATE(e.${COLUMNS.EVENT_TIMESTAMP}) <= LEAST(DATE_ADD(c.cohort_date, INTERVAL 1 MONTH), DATE(@end))
          AND e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
        GROUP BY c.cohort_date
      )
      SELECT 
        period_start,
        cohort_size,
        retained_users,
        SAFE_DIVIDE(retained_users, cohort_size) as retention_rate
      FROM returns
      ORDER BY period_start DESC
    `;

    const options = { params: { start, end } };

    const [dailyRows] = await bigquery.query({ ...options, query: dailyQuery });
    const [weeklyRows] = await bigquery.query({ ...options, query: weeklyQuery });
    const [monthlyRows] = await bigquery.query({ ...options, query: monthlyQuery });

    // Format rows
    const formatRows = (rows) => rows.map(row => ({
      period_start: row.period_start.value || row.period_start,
      cohort_size: parseInt(row.cohort_size) || 0,
      retained_users: parseInt(row.retained_users) || 0,
      retention_rate: parseFloat(row.retention_rate) || 0,
    }));

    res.json({
      daily: formatRows(dailyRows),
      weekly: formatRows(weeklyRows),
      monthly: formatRows(monthlyRows),
    });
  } catch (error) {
    console.error('Error fetching retention data:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
    });
    res.status(500).json({ 
      error: error.message,
      details: error.errors || error.message,
      hint: 'Check server console for full error details'
    });
  }
});

// Engagement health report: inactive vs new users within date range
app.get('/api/engagement-report', async (req, res) => {
  try {
    const { start, end } = req.query;
    const communityEventsList = FUNNEL.STEP2_EVENTS.map(e => `'${e}'`).join(', ');

    const query = `
      WITH school_users AS (
        SELECT DISTINCT user_id
        FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`
      ),
      events AS (
        SELECT 
          e.${COLUMNS.EVENT_USER_ID} as user_id,
          e.${COLUMNS.EVENT_TIMESTAMP} as ts
        FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\` e
        INNER JOIN school_users su ON e.${COLUMNS.EVENT_USER_ID} = su.user_id
        WHERE e.${COLUMNS.EVENT_NAME} IN (${communityEventsList})
      ),
      current_active AS (
        SELECT DISTINCT user_id
        FROM events
        WHERE ts BETWEEN @start AND @end
      ),
      prior_active AS (
        SELECT DISTINCT user_id
        FROM events
        WHERE ts < @start
      ),
      inactive_users AS (
        SELECT COUNT(*) as count
        FROM prior_active pa
        WHERE NOT EXISTS (
          SELECT 1 FROM current_active ca WHERE ca.user_id = pa.user_id
        )
      ),
      first_engagement AS (
        SELECT user_id, MIN(ts) as first_ts
        FROM events
        GROUP BY user_id
      ),
      new_users AS (
        SELECT COUNT(*) as count
        FROM first_engagement fe
        WHERE fe.first_ts BETWEEN @start AND @end
      )
      SELECT
        (SELECT count FROM inactive_users) as inactive_users,
        (SELECT count FROM new_users) as new_users
    `;

    const options = {
      query,
      params: { start, end },
    };

    const [rows] = await bigquery.query(options);
    const data = rows[0] || { inactive_users: 0, new_users: 0 };

    res.json({
      inactive_users: Number(data.inactive_users || 0),
      new_users: Number(data.new_users || 0),
    });
  } catch (error) {
    console.error('Error fetching engagement report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint to test BigQuery connection and configuration
app.get('/api/diagnostic', async (req, res) => {
  try {
    const diagnostics = {
      config: {
        projectId: bigquery.projectId,
        datasetId: DATASET_ID,
        eventsTable: EVENTS_TABLE,
        userProfilesTable: USER_PROFILES_TABLE,
        columns: COLUMNS,
        funnel: FUNNEL,
      },
      connection: 'ok',
      testQuery: null,
      error: null,
    };

    // Try a simple query to test connection
    const testQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users
      FROM \`${bigquery.projectId}.${DATASET_ID}.${EVENTS_TABLE}\`
      WHERE user_id IN (SELECT user_id FROM \`${bigquery.projectId}.${DATASET_ID}.${USER_PROFILES_TABLE}\`)
      LIMIT 1
    `;

    try {
      const [rows] = await bigquery.query(testQuery);
      diagnostics.testQuery = {
        success: true,
        totalEvents: rows[0]?.total_events || 0,
        uniqueUsers: rows[0]?.unique_users || 0,
      };
    } catch (queryError) {
      diagnostics.testQuery = {
        success: false,
        error: queryError.message,
        code: queryError.code,
        details: queryError.errors,
      };
    }

    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: error.errors || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Diagnostic: http://localhost:${PORT}/api/diagnostic`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`\nTo fix this:`);
    console.error(`1. Find the process using port ${PORT}:`);
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error(`2. Kill the process, or`);
    console.error(`3. Change PORT in server.js (currently ${PORT})`);
    console.error(`\nAlternatively, wait a few seconds and try again.\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

