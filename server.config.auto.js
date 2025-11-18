// Auto-generated configuration
// Review and copy values to server.config.js

export const BQ_CONFIG = {
  DATASET_ID: 'bl_proddb',
  EVENTS_TABLE: 'events',
  USERS_TABLE: 'comments',
  COLUMNS: {
    EVENT_USER_ID: 'user_id',
    EVENT_NAME: 'event_name',
    EVENT_TIMESTAMP: 'timestamp',
    USER_ID: 'user_id',
    USER_CREATED_AT: 'created_at',
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
