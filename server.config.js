// BigQuery Configuration
// Update these values to match your BigQuery dataset and table structure

export const BQ_CONFIG = {
  // Your BigQuery dataset ID
  DATASET_ID: 'tbproddb',
  
  // Table names
  EVENTS_TABLE: 'analytics_analyticsevent', // Events table
  USER_PROFILES_TABLE: 'user_school_profiles', // User profiles table for filtering
  
  // Column names
  COLUMNS: {
    // Events table columns
    EVENT_USER_ID: 'user_id',
    EVENT_NAME: 'name',
    EVENT_TIMESTAMP: 'sent_at',
    EVENT_PROPERTIES: 'properties', // JSON properties column
  },
  
  // Event names to track
  TRACKED_EVENTS: [
    'menuBarSelected',
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
  
  // Funnel step definitions
  FUNNEL: {
    // Step 1: Users who selected 'community' from menuBarSelected
    STEP1_EVENT: 'menuBarSelected',
    STEP1_PROPERTY: 'selected_menu',
    STEP1_VALUE: 'community',
    
    // Step 2: Active users who triggered any community events
    STEP2_EVENTS: [
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
  },
  
  // Key file path (supports both local and CI/CD paths)
  KEY_FILE_PATH: process.env.BQ_KEY_PATH || '/home/runner/workspace/key.json',
};

