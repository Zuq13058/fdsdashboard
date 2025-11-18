# FDS Dashboard

A React.js dashboard for visualizing user engagement metrics, connected to Google BigQuery.

## Features

- **Funnel Analytics**: Track user conversion through key engagement steps
- **Event Summary**: View community event statistics
- **Active Users**: Daily, weekly, and monthly active user charts
- **User Retention**: Cohort-based retention analysis

## Prerequisites

- Node.js (v16 or higher)
- Google Cloud BigQuery service account credentials (stored in `src/key.json`)
- Access to BigQuery dataset with user events and user data

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure BigQuery Connection

Edit `server.config.js` and update the following:

```javascript
export const BQ_CONFIG = {
  DATASET_ID: 'your_dataset', // Your BigQuery dataset ID
  EVENTS_TABLE: 'events',     // Your events table name
  USERS_TABLE: 'users',       // Your users table name
  
  // Update column names if different
  COLUMNS: {
    EVENT_USER_ID: 'user_id',
    EVENT_NAME: 'event_name',
    EVENT_TIMESTAMP: 'timestamp',
    USER_ID: 'user_id',
    USER_CREATED_AT: 'created_at',
  },
  
  // Update event names to match your tracking
  TRACKED_EVENTS: [
    'communityToggleLike',
    'communityNewPost',
    // ... add your event names
  ],
};
```

### 3. Verify Service Account Key

Ensure `src/key.json` contains your Google Cloud service account credentials with BigQuery access.

### 4. Run the Application

**Option 1: Run both frontend and backend together**
```bash
npm run dev:all
```

**Option 2: Run separately**

Terminal 1 (Backend):
```bash
npm run dev:server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

The dashboard will be available at:
- Frontend: `http://localhost:5173` (or 5174 if 5173 is in use)
- Backend API: `http://localhost:3001`

### 5. Build for Production

```bash
npm run build
```

## Deploying to GitHub Pages

1. **Repository setup**
   - Push this project to a GitHub repository named `fdsdashboard` (or update `repoBase` in `vite.config.js` to match your repo name).
   - Enable GitHub Pages for the repository (Settings → Pages → Build from branch → `gh-pages` branch once it exists).

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Deploy (manual)**
   ```bash
   npm run deploy
   ```
   This runs `vite build` and publishes the contents of `dist/` to the `gh-pages` branch via the `gh-pages` npm package.

4. **Access the site**
   - Once the GitHub Pages build finishes (usually < 1 minute), your dashboard is available at `https://<username>.github.io/fdsdashboard/`.
   - If you use a different repository name, update the `repoBase` constant in `vite.config.js` accordingly and re-deploy.

> ⚠️ **API backend**: GitHub Pages only hosts static files. Keep the Express/BigQuery server deployed elsewhere (e.g., Render, Railway, Cloud Run) and update the frontend API base URL/environment variables so the static build can reach it.

### Automatic Deployments

- Every push to `main` triggers the GitHub Actions workflow in `.github/workflows/deploy.yml`.
- The workflow installs dependencies, runs `npm run build`, and publishes `dist/` to the `gh-pages` branch using `peaceiris/actions-gh-pages`.
- To trigger a manual redeploy, head to the repo’s **Actions** tab and run the “Deploy to GitHub Pages” workflow via **Run workflow**.
- Ensure GitHub Pages (Settings → Pages) is configured to use the `gh-pages` branch.

## Project Structure

```
fdsdashboard/
├── src/
│   ├── App.jsx          # Main dashboard component
│   ├── App.css          # Dashboard styles
│   ├── main.jsx         # React entry point
│   ├── index.css        # Global styles
│   ├── api.js           # Frontend API client
│   └── key.json         # BigQuery service account credentials
├── server.js            # Express backend server
├── server.config.js     # BigQuery configuration
├── index.html           # HTML template
├── vite.config.js       # Vite configuration (with API proxy)
└── package.json         # Project dependencies
```

## API Endpoints

The backend server provides the following endpoints:

- `GET /api/funnel?start={start}&end={end}` - Funnel conversion metrics
- `GET /api/event-summary?start={start}&end={end}` - Event statistics
- `GET /api/active-users?start={start}&end={end}` - Active user metrics
- `GET /api/retention?start={start}&end={end}` - User retention data
- `GET /health` - Health check endpoint

## Technologies

- **Frontend**: React 18, Vite 5, Framer Motion
- **Backend**: Node.js, Express
- **Database**: Google Cloud BigQuery
- **HTTP Client**: Axios

## Configuration

### BigQuery Table Structure

The queries expect tables with the following structure:

**Events Table:**
- `user_id` (or as configured): User identifier
- `event_name` (or as configured): Event name
- `timestamp` (or as configured): Event timestamp

**Users Table:**
- `user_id` (or as configured): User identifier
- `created_at` (or as configured): User creation timestamp

Update `server.config.js` if your column names differ.

## Troubleshooting

1. **Connection Errors**: Verify `src/key.json` has valid credentials
2. **Query Errors**: Check `server.config.js` matches your BigQuery schema
3. **Port Conflicts**: Change PORT in `server.js` or Vite port in `vite.config.js`
4. **CORS Issues**: Backend includes CORS middleware, should work out of the box

## Security Note

⚠️ **Important**: Never commit `src/key.json` to version control. It's already in `.gitignore`, but double-check before pushing to a repository.

