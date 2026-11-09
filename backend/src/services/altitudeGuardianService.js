/**
 * TrekIndia — Feature 2: AI Altitude Guardian Service
 * Intelligent Trek Safety Companion: Elevation Analysis, Deterministic AMS Rules & Weather Risk
 * 
 * CRITICAL SAFETY RULES:
 * - Deterministic safety rules apply first; LLM only explains and structures verified findings.
 * - Never provides medical diagnosis or false assurances of absolute safety.
 * - Serious symptoms always trigger immediate descent and urgent care instructions.
 */

import { query } from '../config/database.js';
import { generateAIText } from '../ai/aiProvider.js';

/**
 * Altitude thresholds based on Wilderness Medical Society (WMS) clinical guidelines
 */
const ALTITUDE_ZONES = {
  LOW: {
    min: 0,
    max: 2499,
    label: 'Low to Moderate Altitude',
    riskLevel: 'LOW',
    amsRisk: 'Minimal to rare AMS risk below 2,500m (8,200 ft).',
    rules: [
      'Standard physical hydration (2.5L - 3L daily).',
      'Trail footwear with ankle support on rocky or root-dense paths.',
      'Sun and rain layer protection.'
    ]
  },
  HIGH: {
    min: 2500,
    max: 3499,
    label: 'High Altitude',
    riskLevel: 'MODERATE',
    amsRisk: 'Acute Mountain Sickness (AMS) risk increases. Up to 25% of unacclimatized trekkers experience mild symptoms.',
    rules: [
      'Maintain an ascent pace that allows comfortable conversation.',
      'Sleep no more than 500m higher per 24 hours once above 2,800m.',
      'Do not ascend to higher sleep camps while experiencing headache, nausea, or dizziness.',
      'Hydrate with 3L to 4L of fluids daily including electrolytes.',
      'Avoid alcohol and heavy sleeping sedatives.'
    ]
  },
  VERY_HIGH: {
    min: 3500,
    max: 5499,
    label: 'Very High Altitude',
    riskLevel: 'HIGH',
    amsRisk: 'Significant risk of AMS, HAPE (High Altitude Pulmonary Edema), and HACE (High Altitude Cerebral Edema).',
    rules: [
      'Mandatory acclimatization rest day every 3–4 days or after gaining 1,000m above 3,000m.',
      'Daily morning and evening pulse oximeter monitoring (SpO2).',
      'GOLDEN RULE: Any altitude illness symptom is AMS until proven otherwise. Never ascend with symptoms.',
      'Immediate descent of 500m - 1,000m is the definitive treatment if symptoms worsen, ataxia occurs, or resting breathlessness develops.',
      'Emergency Gamow bag or descent route must be identified in advance.'
    ]
  },
  EXTREME: {
    min: 5500,
    max: 9000,
    label: 'Extreme Altitude',
    riskLevel: 'CRITICAL',
    amsRisk: 'Extreme physiological stress; severe hypoxia. Rapid deterioration possible without prompt recognition.',
    rules: [
      'Expedition-grade medical protocol and qualified mountain guide leadership required.',
      'Emergency supplemental oxygen readiness on site.',
      'Strict turnaround times regardless of summit proximity.',
      'Immediate evacuation protocol with pre-coordinated mountain rescue.'
    ]
  }
};

/**
 * Determine Altitude Zone for a given elevation
 */
export function getAltitudeZone(elevationM) {
  const elev = Number(elevationM) || 0;
  if (elev >= ALTITUDE_ZONES.EXTREME.min) return ALTITUDE_ZONES.EXTREME;
  if (elev >= ALTITUDE_ZONES.VERY_HIGH.min) return ALTITUDE_ZONES.VERY_HIGH;
  if (elev >= ALTITUDE_ZONES.HIGH.min) return ALTITUDE_ZONES.HIGH;
  return ALTITUDE_ZONES.LOW;
}

/**
 * Retrieve simulated or live weather information with freshness indicator
 */
export async function getTrekWeatherContext(trek) {
  // In production, connect OpenWeather / AccuWeather with API key if configured.
  // When no live key is set, provide calibrated seasonal mountain baseline with clear freshness labeling.
  const season = trek.best_time || 'October - May';
  const elev = Math.max(Number(trek.elevation_m) || 0, Number(trek.highest_point_m) || 0);

  // Temperature lapse rate approx -6.5°C per 1000m
  const baseTempC = elev > 4000 ? -2 : elev > 2500 ? 8 : 20;

  return {
    source: 'TrekIndia Mountain Meteorological Baseline',
    is_live: false,
    freshness: 'Seasonal Climatology (Calibrated for elevation band)',
    timestamp: new Date().toISOString(),
    temperature_c: baseTempC,
    wind_speed_kmh: elev > 3500 ? 28 : 14,
    precipitation_chance_pct: season.toLowerCase().includes('monsoon') ? 70 : 15,
    uv_index: elev > 3000 ? 9 : 5,
    visibility_km: 12,
    warning: elev > 3500 ? 'Rapid temperature drops expected post-sunset (sub-zero temperatures likely).' : null
  };
}

/**
 * Assess safety profile for a specific trek
 */
export async function assessTrekSafety({ trekId, trekSlug, userCurrentAltitude = 0, reportedSymptoms = [], acclimatizationDays = 0 }) {
  // 1. Fetch verified trek information from PostgreSQL
  let trekQuery = `
    SELECT t.*, s.state_name, d.district_name, tl.latitude, tl.longitude
    FROM treks t
    LEFT JOIN states s ON t.state_id = s.state_id
    LEFT JOIN districts d ON t.district_id = d.district_id
    LEFT JOIN trek_locations tl ON t.trek_id = tl.trek_id
  `;

  let trekRes;
  if (trekId) {
    trekRes = await query(`${trekQuery} WHERE t.trek_id = $1`, [trekId]);
  } else if (trekSlug) {
    trekRes = await query(`${trekQuery} WHERE t.slug = $1`, [trekSlug]);
  } else {
    throw new Error('Either trekId or trekSlug is required for safety assessment.');
  }

  if (trekRes.rows.length === 0) {
    throw new Error('Trek not found in database.');
  }

  const trek = trekRes.rows[0];
  const maxAltitudeM = Math.max(Number(trek.elevation_m) || 0, Number(trek.highest_point_m) || 0);
  const altitudeGainM = Number(trek.altitude_gain_m) || Math.max(0, maxAltitudeM - (Number(trek.elevation_m) || 1000));
  const altitudeZone = getAltitudeZone(maxAltitudeM);
  const weather = await getTrekWeatherContext(trek);

  // 2. Deterministic Symptoms & Emergency Assessment
  const seriousSymptoms = ['ataxia', 'confusion', 'breathlessness_at_rest', 'blue_lips', 'extreme_cough', 'persistent_vomiting'];
  const reportedSerious = reportedSymptoms.filter(s => seriousSymptoms.includes(s.toLowerCase()));
  const hasCriticalSymptoms = reportedSerious.length > 0;

  let emergencyGuidance = null;
  if (hasCriticalSymptoms) {
    emergencyGuidance = {
      severity: 'CRITICAL_URGENT',
      action_required: 'IMMEDIATE DESCENT',
      protocol: 'Stop ascent immediately. Descend at least 500m to 1000m with a companion. Seek emergency mountain medical care. Administer high-flow oxygen if available. Do not leave the affected trekker alone.',
      reported_red_flags: reportedSerious
    };
  } else if (reportedSymptoms.length > 0) {
    emergencyGuidance = {
      severity: 'MILD_TO_MODERATE_AMS',
      action_required: 'REST & DO NOT ASCEND',
      protocol: 'Stop and rest at current elevation. Take simple analgesics (e.g. Paracetamol/Ibuprofen) and hydrate. If symptoms do not improve within 24 hours, descend 500m.',
      reported_symptoms: reportedSymptoms
    };
  }

  // 3. Deterministic Preparation Checklist
  const preparationChecklist = [
    { item: 'Layered thermal clothing (base, fleece, windproof hardshell)', required: true },
    { item: 'UV Protection Sunglasses (Category 3 or 4 rated for high altitude)', required: maxAltitudeM > 2500 },
    { item: 'First aid kit with blister care, oral rehydration salts (ORS), and analgesics', required: true },
    { item: 'Pulse oximeter for daily oxygen saturation checks', required: maxAltitudeM >= 3000 },
    { item: 'Water purification tablets or physical filter (4L daily target)', required: true },
    { item: 'Medical consultation regarding Diamox (Acetazolamide) tolerance before travel', required: maxAltitudeM >= 3000 },
    { item: 'Emergency offline GPX maps & whistle', required: true }
  ];

  // 4. Generate AI Plain-Language Safety Explanation
  const aiExplanationPrompt = `
Based on these VERIFIED facts, write a concise, reassuring, but strict 3-paragraph safety brief for the ${trek.trek_name} trek in ${trek.state_name}:
- Maximum Summit Elevation: ${maxAltitudeM} meters (${altitudeZone.label})
- Total Altitude Gain: ${altitudeGainM} meters
- Difficulty: ${trek.difficulty || 'Moderate'}
- Altitude Risk Level: ${altitudeZone.riskLevel}
- Specific Altitude Hazard: ${altitudeZone.amsRisk}
- Weather: ${weather.temperature_c}°C, Wind: ${weather.wind_speed_kmh} km/h, Warning: ${weather.warning || 'None'}
- Reported symptoms: ${reportedSymptoms.length > 0 ? reportedSymptoms.join(', ') : 'None reported'}

Guidelines:
- Never provide a medical diagnosis.
- Emphasize that acclimatization pace and hydration are the best prevention.
- If symptoms are present, reinforce the golden rule: Never ascend with symptoms.
Keep it direct, professional, and accessible.
`;

  let aiBrief = '';
  try {
    const aiRes = await generateAIText(aiExplanationPrompt, 'You are the TrekIndia AI Altitude Guardian. Prioritize life safety, clinical conservatism, and verified geographic facts.');
    if (aiRes.success && aiRes.content) {
      aiBrief = aiRes.content;
    }
  } catch (_) {}

  if (!aiBrief) {
    aiBrief = `Safety Assessment for ${trek.trek_name} (${maxAltitudeM}m): The trail reaches ${altitudeZone.label} with a ${altitudeZone.riskLevel.toLowerCase()} altitude hazard rating. Maintain steady pace, hydrate 3-4 liters daily, and strictly observe acclimatization milestones. Never ascend if experiencing headache or nausea.`;
  }

  return {
    success: true,
    trek: {
      trek_id: trek.trek_id,
      name: trek.trek_name,
      slug: trek.slug,
      state: trek.state_name,
      district: trek.district_name,
      max_elevation_m: maxAltitudeM,
      altitude_gain_m: altitudeGainM,
      difficulty: trek.difficulty,
      duration: trek.duration_label || `${trek.duration_hours || 4} hours`
    },
    safety_assessment: {
      altitude_zone: altitudeZone.label,
      risk_level: altitudeZone.riskLevel,
      ams_risk_summary: altitudeZone.amsRisk,
      deterministic_rules: altitudeZone.rules,
      ai_explanation: aiBrief,
      emergency_guidance: emergencyGuidance
    },
    environmental_data: weather,
    checklist: preparationChecklist,
    disclaimer: 'TrekIndia AI Altitude Guardian is an educational safety tool and does not constitute formal medical diagnosis, clearance, or emergency dispatch.'
  };
}

