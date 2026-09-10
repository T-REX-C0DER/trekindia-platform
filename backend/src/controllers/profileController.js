import * as profileService from '../services/profileService.js';
import { clearAuthCookie } from '../utils/cookies.js';

export async function getProfile(req, res, next) {
  try {
    const profile = await profileService.getUserProfile(req.user.user_id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }
    return res.status(200).json({ success: true, ...profile });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updated = await profileService.updateUserProfile(req.user.user_id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      ...updated
    });
  } catch (error) {
    next(error);
  }
}

export async function getTreks(req, res, next) {
  try {
    const { status = 'completed', difficulty, sort } = req.query;
    const treks = await profileService.getUserTreks(req.user.user_id, { status, difficulty, sort });
    return res.status(200).json({ success: true, count: treks.length, treks });
  } catch (error) {
    next(error);
  }
}

export async function setTrekStatus(req, res, next) {
  try {
    const { trekId } = req.params;
    const { status, rating, completed_at, notes } = req.body;
    const result = await profileService.setUserTrekStatus(req.user.user_id, parseInt(trekId, 10), {
      status,
      rating,
      completed_at,
      notes
    });
    return res.status(200).json({
      success: true,
      message: status === 'none' ? 'Trek removed from your profile.' : `Trek marked as ${status}.`,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function completeTrek(req, res, next) {
  try {
    const { trekId } = req.params;
    const { completed_at, notes, rating } = req.body;
    const result = await profileService.completeTrek(req.user.user_id, parseInt(trekId, 10), {
      completed_at,
      notes,
      rating
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function uncompleteTrek(req, res, next) {
  try {
    const { trekId } = req.params;
    const result = await profileService.uncompleteTrek(req.user.user_id, parseInt(trekId, 10));
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTrekUserStatus(req, res, next) {
  try {
    const { trekId } = req.params;
    const statuses = await profileService.getUserTrekStatus(req.user.user_id, parseInt(trekId, 10));
    return res.status(200).json({ success: true, ...statuses });
  } catch (error) {
    next(error);
  }
}


export async function getBadges(req, res, next) {
  try {
    const badgeData = await profileService.getUserBadges(req.user.user_id);
    return res.status(200).json({ success: true, ...badgeData });
  } catch (error) {
    next(error);
  }
}

export async function getActivity(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const activities = await profileService.getUserActivities(req.user.user_id, limit);
    return res.status(200).json({ success: true, count: activities.length, activities });
  } catch (error) {
    next(error);
  }
}

export async function getReviews(req, res, next) {
  try {
    const reviews = await profileService.getUserReviews(req.user.user_id);
    return res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    next(error);
  }
}

export async function createReview(req, res, next) {
  try {
    const review = await profileService.createOrUpdateReview(req.user.user_id, req.body);
    return res.status(200).json({ success: true, message: 'Review submitted successfully.', review });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const updated = await profileService.updateUserSettings(req.user.user_id, req.body);
    return res.status(200).json({ success: true, message: 'Settings updated successfully.', ...updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete account.' });
    }
    await profileService.deleteUserAccount(req.user.user_id, password);
    clearAuthCookie(res);
    return res.status(200).json({ success: true, message: 'Your account has been deleted.' });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatar(req, res, next) {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) {
      return res.status(400).json({ success: false, message: 'Avatar URL is required.' });
    }
    const updated = await profileService.updateUserProfile(req.user.user_id, { profile_image: avatar_url });
    return res.status(200).json({ success: true, message: 'Profile photo updated.', ...updated });
  } catch (error) {
    next(error);
  }
}

export async function getChecklist(req, res, next) {
  try {
    const checklist = await profileService.getUserChecklist(req.user.user_id);
    return res.status(200).json({ success: true, ...checklist });
  } catch (error) {
    next(error);
  }
}

export async function saveChecklist(req, res, next) {
  try {
    const { items } = req.body;
    const checklist = await profileService.saveUserChecklist(req.user.user_id, items);
    return res.status(200).json({ success: true, message: 'Checklist saved successfully.', ...checklist });
  } catch (error) {
    next(error);
  }
}

