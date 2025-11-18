# Troubleshooting Guide

## Port Already in Use (EADDRINUSE)

If you see `Error: listen EADDRINUSE: address already in use :::3001`:

### Quick Fix (Windows PowerShell):
```powershell
.\fix-port.ps1
```

### Manual Fix:
1. Find the process:
   ```powershell
   Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess
   ```

2. Kill the process (replace PID with the number from step 1):
   ```powershell
   Stop-Process -Id <PID> -Force
   ```

3. Or wait 30-60 seconds for the port to be released

### Alternative: Change Port
Edit `server.js` and change:
```javascript
const PORT = process.env.PORT || 3001;  // Change 3001 to another port
```
Then update `vite.config.js` proxy target to match.

## 500 Internal Server Error

If you're seeing 500 errors from the API endpoints, follow these steps:

### Step 1: Check Server Console

The server logs detailed error information. Look at the terminal where you ran `npm run dev:server` or `npm run dev:all`. You should see error messages like:

```
Error fetching funnel data: [Error details]
Error details: { message: ..., code: ..., errors: ... }
```

### Step 2: Verify Configuration

1. Open `server.config.js`
2. Make sure `DATASET_ID` is set to your actual BigQuery dataset name (not `'your_dataset'`)
3. Verify `EVENTS_TABLE` and `USERS_TABLE` match your actual table names
4. Check that column names in `COLUMNS` match your table schema

### Step 3: Test Connection

Visit the diagnostic endpoint in your browser:
```
http://localhost:3001/api/diagnostic
```

This will show:
- Current configuration
- Connection status
- Available tables in your dataset
- Any query errors

### Step 4: Common Issues

#### Issue: "Dataset not found" or "Table not found"
**Solution**: Update `server.config.js` with correct dataset and table names

#### Issue: "Column not found"
**Solution**: Update the `COLUMNS` object in `server.config.js` to match your table schema

#### Issue: "Access Denied" or "Permission denied"
**Solution**: 
- Verify your service account has BigQuery Data Viewer and Job User roles
- Check that `src/key.json` contains valid credentials

#### Issue: SQL Syntax Error
**Solution**: The queries may need adjustment based on your table structure. Check the error message for the specific SQL issue.

### Step 5: Check BigQuery Console

1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Verify:
   - Your dataset exists
   - Your tables exist
   - Column names match the configuration
   - You have access to query the tables

### Step 6: Test a Simple Query

Try running a simple query in BigQuery console to verify your data:

```sql
SELECT COUNT(*) 
FROM `your-project.your_dataset.your_events_table`
LIMIT 10
```

Replace with your actual project, dataset, and table names.

## Getting Help

If you're still stuck:
1. Check the server console for the full error message
2. Visit `/api/diagnostic` endpoint for configuration details
3. Verify your BigQuery setup matches the expected schema
4. Check that dates in the query parameters are valid (format: `YYYY-MM-DDTHH:mm:ssZ`)

