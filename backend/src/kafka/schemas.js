/**
 * TrekIndia — Kafka Event Schemas & Serializers
 * Standardizes event structures across the distributed streaming architecture.
 */

export const EVENT_TYPES = {
  // Message Events
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELIVERED: 'message.delivered',
  MESSAGE_READ: 'message.read',
  MESSAGE_DELETED: 'message.deleted',

  // User & Presence Events
  USER_ONLINE: 'user.online',
  USER_OFFLINE: 'user.offline',
  USER_TYPING: 'user.typing',

  // Notification Events
  NOTIFICATION_CREATED: 'notification.created'
};

/**
 * Build a standard message.sent event
 */
export function createMessageSentEvent({
  message_id,
  conversation_id,
  sender_id,
  receiver_id,
  sender_name,
  sender_avatar,
  content,
  message_type = 'text',
  trek_data = null,
  attachment_url = null,
  client_message_id = null,
  created_at = new Date().toISOString()
}) {
  return {
    event_type: EVENT_TYPES.MESSAGE_SENT,
    event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    payload: {
      message_id: String(message_id),
      conversation_id: String(conversation_id),
      sender_id: String(sender_id),
      receiver_id: receiver_id ? String(receiver_id) : null,
      sender_name: sender_name || 'Trekker',
      sender_avatar: sender_avatar || null,
      content: content || null,
      message_type,
      trek_data,
      attachment_url,
      client_message_id,
      status: 'sent',
      created_at
    }
  };
}

/**
 * Build a message.read event
 */
export function createMessageReadEvent({
  conversation_id,
  reader_id,
  message_ids = [],
  read_at = new Date().toISOString()
}) {
  return {
    event_type: EVENT_TYPES.MESSAGE_READ,
    event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    payload: {
      conversation_id: String(conversation_id),
      reader_id: String(reader_id),
      message_ids: message_ids.map(String),
      read_at
    }
  };
}

/**
 * Build a user presence event (user.online / user.offline)
 */
export function createUserPresenceEvent({
  user_id,
  status, // 'online' | 'offline' | 'away'
  timestamp = new Date().toISOString()
}) {
  return {
    event_type: status === 'online' ? EVENT_TYPES.USER_ONLINE : EVENT_TYPES.USER_OFFLINE,
    event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp,
    payload: {
      user_id: String(user_id),
      status,
      timestamp
    }
  };
}

/**
 * Build a notification event
 */
export function createNotificationEvent({
  notification_id,
  user_id,
  actor_id,
  type,
  title,
  message,
  reference_id,
  reference_type,
  created_at = new Date().toISOString()
}) {
  return {
    event_type: EVENT_TYPES.NOTIFICATION_CREATED,
    event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    payload: {
      notification_id: String(notification_id),
      user_id: String(user_id),
      actor_id: actor_id ? String(actor_id) : null,
      type,
      title,
      message,
      reference_id: reference_id ? String(reference_id) : null,
      reference_type,
      created_at
    }
  };
}
