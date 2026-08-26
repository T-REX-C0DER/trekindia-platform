/**
 * TrekIndia — Community Controller
 * Handles HTTP requests for Community Posts, Stories, Comments, Likes, Saves,
 * Trekkers Directory, Direct Messaging with Trek Cards, and Notifications.
 */

import * as communityService from '../services/communityService.js';

export async function listPosts(req, res, next) {
  try {
    const { tab, tag, trek_id, search, limit, offset } = req.query;
    const result = await communityService.getPosts({
      tab,
      tag,
      trek_id,
      search,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
      currentUser: req.user
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createPost(req, res, next) {
  try {
    const { caption, post_type, trek_name, trek_id, location, difficulty, distance_km, elevation_m, duration_days, hashtags, images } = req.body;
    if (!caption || !caption.trim()) {
      return res.status(400).json({ success: false, message: 'Caption is required.' });
    }

    const post = await communityService.createPost({
      user: req.user,
      caption: caption.trim(),
      post_type,
      trek_name,
      trek_id,
      location,
      difficulty,
      distance_km,
      elevation_m,
      duration_days,
      hashtags,
      images
    });

    return res.status(201).json({ success: true, message: 'Post published to TrekIndia community.', post });
  } catch (err) {
    next(err);
  }
}

export async function toggleLike(req, res, next) {
  try {
    const { id } = req.params;
    const result = await communityService.toggleLikePost(id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function toggleSave(req, res, next) {
  try {
    const { id } = req.params;
    const result = await communityService.toggleSavePost(id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function deletePost(req, res, next) {
  try {
    const { id } = req.params;
    const result = await communityService.deletePost(id, req.user?.user_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getComments(req, res, next) {
  try {
    const { id } = req.params;
    const comments = await communityService.getPostComments(id);
    return res.status(200).json({ success: true, count: comments.length, comments });
  } catch (err) {
    next(err);
  }
}

export async function addComment(req, res, next) {
  try {
    const { id } = req.params;
    const { content, parent_id } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }

    const comment = await communityService.addPostComment(id, {
      user: req.user,
      content,
      parent_id
    });

    return res.status(201).json({ success: true, comment });
  } catch (err) {
    next(err);
  }
}

export async function toggleCommentLike(req, res, next) {
  try {
    const { id, commentId } = req.params;
    const result = await communityService.toggleLikeComment(commentId, id);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const { id, commentId } = req.params;
    const result = await communityService.deleteComment(commentId, id, req.user?.user_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStories(req, res, next) {
  try {
    const stories = await communityService.getStories(req.user);
    return res.status(200).json({ success: true, stories });
  } catch (err) {
    next(err);
  }
}

export async function addStory(req, res, next) {
  try {
    const { media_url, caption, location, trek_name } = req.body;
    const story = await communityService.addStory({
      user: req.user,
      media_url,
      caption,
      location,
      trek_name
    });
    return res.status(201).json({ success: true, story });
  } catch (err) {
    next(err);
  }
}

export async function listTrekkers(req, res, next) {
  try {
    const { query: q, location, experience, difficulty, limit } = req.query;
    const trekkers = await communityService.getTrekkers({
      query: q,
      location,
      experience,
      difficulty,
      limit: parseInt(limit, 10) || 30
    });
    return res.status(200).json({ success: true, count: trekkers.length, trekkers });
  } catch (err) {
    next(err);
  }
}

export async function getTrekkerProfile(req, res, next) {
  try {
    const { identifier } = req.params;
    const profile = await communityService.getTrekkerProfile(identifier);
    return res.status(200).json({ success: true, profile });
  } catch (err) {
    next(err);
  }
}

export async function toggleFollow(req, res, next) {
  try {
    const { id } = req.params;
    const result = await communityService.toggleFollow(id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getConversations(req, res, next) {
  try {
    const conversations = await communityService.getConversations(req.user);
    return res.status(200).json({ success: true, count: conversations.length, conversations });
  } catch (err) {
    next(err);
  }
}

export async function getConversation(req, res, next) {
  try {
    const { id } = req.params;
    const conversation = await communityService.getConversation(id, req.user);
    return res.status(200).json({ success: true, conversation });
  } catch (err) {
    next(err);
  }
}

export async function getOrCreateDirectConversation(req, res, next) {
  try {
    const { participant_id } = req.body;
    const conversation = await communityService.getOrCreateDirectConversation(req.user?.user_id, participant_id);
    return res.status(200).json({ success: true, ...conversation });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content, message_type, trek_data, attachment_url, client_message_id } = req.body;
    const result = await communityService.sendMessage(id, {
      user: req.user,
      content,
      message_type,
      trek_data,
      attachment_url,
      client_message_id
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function markConversationRead(req, res, next) {
  try {
    const { id } = req.params;
    const result = await communityService.markConversationRead(id, req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadMessagesCount(req, res, next) {
  try {
    const result = await communityService.getUnreadMessagesCount(req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const { id, messageId } = req.params;
    const result = await communityService.deleteMessage(id, messageId, req.user);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleMessageRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'decline'
    const result = await communityService.handleMessageRequest(id, action, req.user);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getNotifications(req, res, next) {
  try {
    const result = await communityService.getNotifications(req.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationsRead(req, res, next) {
  try {
    const { notification_id } = req.body;
    const result = await communityService.markNotificationsRead(notification_id, req.user);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchCommunity(req, res, next) {
  try {
    const { q } = req.query;
    const results = await communityService.searchCommunity(q);
    return res.status(200).json({ success: true, ...results });
  } catch (err) {
    next(err);
  }
}
