/**
 * TrekIndia — Emergency SOS Intelligence Controller
 * Incident Reporting, GPS Location Audit, and Trusted Contacts Management
 */

import * as emergencySosService from '../services/emergencySosService.js';
import { query } from '../config/database.js';

/**
 * Report an emergency incident
 * POST /api/sos/incidents
 */
export async function reportIncident(req, res, next) {
  try {
    const {
      trek_id,
      trek_slug,
      incident_type,
      severity,
      description,
      latitude,
      longitude,
      location_accuracy_m,
      location_timestamp
    } = req.body;

    const userId = req.user?.user_id || null;

    let resolvedTrekId = trek_id ? parseInt(trek_id, 10) : null;
    if (!resolvedTrekId && trek_slug) {
      const trekRes = await query('SELECT trek_id FROM treks WHERE slug = $1 LIMIT 1', [trek_slug]);
      if (trekRes.rows.length > 0) {
        resolvedTrekId = trekRes.rows[0].trek_id;
      }
    }

    const result = await emergencySosService.createEmergencyIncident({
      userId,
      trekId: resolvedTrekId,
      incidentType: incident_type || 'medical',
      severity: severity || 'high',
      description: description || '',
      latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
      longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
      locationAccuracyM: location_accuracy_m !== undefined && location_accuracy_m !== null ? parseFloat(location_accuracy_m) : null,
      locationTimestamp: location_timestamp || null
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get incident status
 * GET /api/sos/incidents/:id
 */
export async function getIncident(req, res, next) {
  try {
    const result = await emergencySosService.getEmergencyIncident(req.params.id, req.user?.user_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * List trusted emergency contacts
 * GET /api/sos/contacts
 */
export async function getContacts(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required to manage SOS contacts.' });
    }
    const contacts = await emergencySosService.getEmergencyContacts(req.user.user_id);
    return res.status(200).json({ success: true, contacts });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a trusted emergency contact
 * POST /api/sos/contacts
 */
export async function addContact(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required to add SOS contacts.' });
    }
    const { name, phone, email, relationship } = req.body;
    const contact = await emergencySosService.addEmergencyContact(req.user.user_id, {
      name, phone, email, relationship
    });
    return res.status(201).json({ success: true, contact, message: 'Trusted contact added successfully.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a trusted emergency contact
 * DELETE /api/sos/contacts/:id
 */
export async function deleteContact(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    await emergencySosService.deleteEmergencyContact(req.user.user_id, req.params.id);
    return res.status(200).json({ success: true, message: 'Emergency contact removed.' });
  } catch (err) {
    next(err);
  }
}

