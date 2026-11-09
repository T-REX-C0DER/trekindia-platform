/**
 * TrekIndia — Feature 5: AI Offline Trek Companion Service
 * Offline Package Generation, Integrity Checksums, and Version Management
 */

import crypto from 'crypto';
import { query } from '../config/database.js';
import { getAltitudeZone } from './altitudeGuardianService.js';

const PACKAGE_VERSION = 'v2.1.0';

/**
 * Generate a complete, self-contained offline package for a trek
 */
export async function generateOfflinePackage(trekIdentifier, userId = null) {
  let trekQuery = `
    SELECT t.*, s.state_name, d.district_name, tl.latitude, tl.longitude, tl.location_name, tl.address, tl.village
    FROM treks t
    LEFT JOIN states s ON t.state_id = s.state_id
    LEFT JOIN districts d ON t.district_id = d.district_id
    LEFT JOIN trek_locations tl ON t.trek_id = tl.trek_id
  `;

  let trekRes;
  const isNumeric = /^\d+$/.test(String(trekIdentifier).trim());
  if (isNumeric) {
    trekRes = await query(`${trekQuery} WHERE t.trek_id = $1`, [parseInt(trekIdentifier, 10)]);
  } else {
    trekRes = await query(`${trekQuery} WHERE t.slug = $1`, [String(trekIdentifier).trim()]);
  }

  if (trekRes.rows.length === 0) {
    throw new Error('Trek not found for offline package generation.');
  }

  const trek = trekRes.rows[0];
  const maxElev = Math.max(Number(trek.elevation_m) || 0, Number(trek.highest_point_m) || 0);
  const altitudeZone = getAltitudeZone(maxElev);

  // Emergency contact directory for the region
  const emergencyContacts = [
    { agency: 'National Emergency Helpline', number: '112', type: 'All-India Universal Emergency' },
    { agency: 'State Disaster Response Force (SDRF)', number: '1070', type: 'Mountain Disaster Response' },
    { agency: 'Medical Emergency Ambulance', number: '108', type: 'Medical Care' },
    { agency: 'Indian Red Cross Mountain Support', number: '011-23716441', type: 'Mountain Relief' },
    { agency: 'Local Police Assistance', number: '100', type: 'Law Enforcement & Trail Head Verification' }
  ];

  // Verified offline preparation checklist
  const offlineChecklist = [
    { id: 'off_1', title: 'Topographical Offline Map Cached', category: 'NAVIGATION', mandatory: true },
    { id: 'off_2', title: 'Water Purification Tablets (4L daily)', category: 'HYDRATION', mandatory: true },
    { id: 'off_3', title: 'Thermal Base Layer & Waterproof Outer Shell', category: 'CLOTHING', mandatory: true },
    { id: 'off_4', title: 'Headlamp with Spare Lithium Batteries', category: 'SAFETY', mandatory: true },
    { id: 'off_5', title: 'Pulse Oximeter & First Aid Kit with ORS', category: 'MEDICAL', mandatory: maxElev >= 3000 },
    { id: 'off_6', title: 'Whistle & Fire Starter / Lighter', category: 'EMERGENCY', mandatory: true },
    { id: 'off_7', title: 'High-Density Energy Bars & Trail Mix', category: 'NUTRITION', mandatory: true }
  ];

  // Self-contained package payload
  const packagePayload = {
    version: PACKAGE_VERSION,
    generated_at: new Date().toISOString(),
    trek: {
      trek_id: trek.trek_id,
      name: trek.trek_name,
      slug: trek.slug,
      state: trek.state_name,
      district: trek.district_name,
      description: trek.description,
      short_description: trek.short_description,
      difficulty: trek.difficulty,
      trek_type: trek.trek_type,
      distance_km: trek.distance_km,
      duration: trek.duration_label || `${trek.duration_hours || 4} hours`,
      elevation_m: trek.elevation_m,
      highest_point_m: trek.highest_point_m,
      altitude_gain_m: trek.altitude_gain_m,
      starting_point: trek.starting_point,
      ending_point: trek.ending_point,
      best_time: trek.best_time,
      entry_fee: trek.entry_fee,
      permit_required: trek.permit_required,
      rating: trek.rating
    },
    location: {
      latitude: trek.latitude ? parseFloat(trek.latitude) : null,
      longitude: trek.longitude ? parseFloat(trek.longitude) : null,
      location_name: trek.location_name,
      address: trek.address,
      village: trek.village,
      bounding_box: trek.latitude && trek.longitude ? {
        min_lat: parseFloat(trek.latitude) - 0.08,
        max_lat: parseFloat(trek.latitude) + 0.08,
        min_lng: parseFloat(trek.longitude) - 0.08,
        max_lng: parseFloat(trek.longitude) + 0.08
      } : null
    },
    safety_guidelines: {
      altitude_zone: altitudeZone.label,
      risk_level: altitudeZone.riskLevel,
      ams_warning: altitudeZone.amsRisk,
      rules: altitudeZone.rules,
      emergency_protocol: 'If experiencing sudden shortness of breath, confusion, or inability to walk straight, descend at least 500m immediately. Do not sleep at higher elevation with symptoms.'
    },
    emergency_contacts: emergencyContacts,
    checklist: offlineChecklist,
    offline_usage_instructions: 'This package is cached in your browser IndexedDB and remains fully accessible without internet or cellular connectivity.'
  };

  const payloadString = JSON.stringify(packagePayload);
  const sizeBytes = Buffer.byteLength(payloadString, 'utf8');
  const checksum = crypto.createHash('sha256').update(payloadString).digest('hex');

  // Record package download in database if user is authenticated
  if (userId) {
    try {
      await query(
        `INSERT INTO offline_downloads (user_id, trek_id, package_version, size_bytes, checksum, package_metadata, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, trek_id) DO UPDATE SET
           package_version = EXCLUDED.package_version,
           size_bytes = EXCLUDED.size_bytes,
           checksum = EXCLUDED.checksum,
           package_metadata = EXCLUDED.package_metadata,
           updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          trek.trek_id,
          PACKAGE_VERSION,
          sizeBytes,
          checksum,
          JSON.stringify({ name: trek.trek_name, slug: trek.slug, generated_at: packagePayload.generated_at })
        ]
      );
    } catch (err) {
      console.warn('[OfflineCompanion] Could not record offline download:', err.message);
    }
  }

  return {
    success: true,
    package: packagePayload,
    size_bytes: sizeBytes,
    size_formatted: `${(sizeBytes / 1024).toFixed(1)} KB`,
    checksum,
    version: PACKAGE_VERSION
  };
}

/**
 * Remove an offline download record
 */
export async function removeOfflineDownload(userId, trekId) {
  await query(`DELETE FROM offline_downloads WHERE user_id = $1 AND trek_id = $2`, [userId, trekId]);
  return { success: true, message: 'Offline record removed from server.' };
}

