/**
 * TrekIndia — Feature 8: AI Trek Nutrition Planner Service
 * Practical Trail Fuel, Lightweight Rations, Dietary Customization, Shopping List & Cost Integration
 */

import { query } from '../config/database.js';
import { generateAIText } from '../ai/aiProvider.js';

/**
 * Baseline nutritional guidelines for Himalayan trekking:
 * Target: 3,000 to 4,000 kcal/day depending on altitude gain & cold exposure.
 * Carbohydrate-dense (60-65%) for efficient metabolic oxidation at altitude.
 */

/**
 * Generate a practical trekking nutrition plan
 */
export async function generateNutritionPlan({
  trekId,
  trekSlug,
  durationDays = null,
  dietType = 'Vegetarian',
  activityIntensity = 'Moderate',
  allergies = [],
  facilities = 'campsite_kitchen', // dhabas, campsite_kitchen, self_supported
  foodCarryingStyle = 'lightweight_pack',
  userId = null
}) {
  // 1. Fetch Trek Details
  let trekQuery = `SELECT t.*, s.state_name FROM treks t LEFT JOIN states s ON t.state_id = s.state_id`;
  let trekRes;
  if (trekId) {
    trekRes = await query(`${trekQuery} WHERE t.trek_id = $1`, [trekId]);
  } else if (trekSlug) {
    trekRes = await query(`${trekQuery} WHERE t.slug = $1`, [trekSlug]);
  } else {
    throw new Error('Trek ID or slug is required.');
  }

  if (trekRes.rows.length === 0) {
    throw new Error('Trek not found in database.');
  }

  const trek = trekRes.rows[0];

  // Resolve duration in days
  let days = durationDays ? parseInt(durationDays, 10) : null;
  if (!days || days <= 0) {
    if (trek.duration_label && trek.duration_label.match(/(\d+)\s*Day/i)) {
      days = parseInt(trek.duration_label.match(/(\d+)/)[1], 10);
    } else if (trek.duration_hours) {
      days = Math.max(1, Math.ceil(parseFloat(trek.duration_hours) / 7.0));
    } else {
      days = 3;
    }
  }

  const cleanAllergies = Array.isArray(allergies) ? allergies.filter(Boolean) : [];
  const maxElev = Math.max(Number(trek.elevation_m) || 0, Number(trek.highest_point_m) || 0);

  // 2. Structured Plan Generation via AI with Fallback
  const prompt = `
Create a realistic, lightweight, mountain-tested trekking meal plan for:
- Trek: ${trek.trek_name} (${trek.state_name || 'India'})
- Elevation: ${maxElev}m (High Altitude)
- Duration: ${days} days
- Diet Preference: ${dietType}
- Activity Intensity: ${activityIntensity}
- Excluded Allergies/Restrictions: ${cleanAllergies.length > 0 ? cleanAllergies.join(', ') : 'None'}
- Food facilities along route: ${facilities} (e.g. dhabas available / campsite kitchen / carry own stove)
- Food-carrying preference: ${foodCarryingStyle}

Return strictly valid JSON with this structure:
{
  "summary": "Practical overview of energy strategy for this route",
  "daily_target_calories": 3200,
  "daily_meals": [
    {
      "day": 1,
      "stage": "Base to Camp 1",
      "breakfast": { "name": "e.g., Oats with jaggery and chia seeds", "prep_time_min": 10, "weight_g": 120 },
      "trail_snack_morning": { "name": "Trail mix (almonds, raisins, dark chocolate)", "weight_g": 80 },
      "lunch": { "name": "Vegetable khichdi / packed flatbreads with peanut butter", "weight_g": 200 },
      "trail_snack_afternoon": { "name": "Electrolyte energy chew / peanut chikki", "weight_g": 60 },
      "dinner": { "name": "High-protein dal soup with instant rice / soba noodles", "prep_time_min": 15, "weight_g": 250 }
    }
  ],
  "lightweight_tips": [
    "Tip 1 on minimizing pack weight",
    "Tip 2 on altitude digestion"
  ],
  "shopping_list": [
    { "category": "Complex Carbohydrates", "items": ["Rolled oats 500g", "Instant rice 400g"] },
    { "category": "Trail Energy & Nuts", "items": ["Roasted almonds 300g", "Dates 250g"] },
    { "category": "Hydration & Electrolytes", "items": ["ORS sachets x6", "Lemon ginger drink mix"] }
  ],
  "packing_checklist": [
    "Lightweight titanium or hard-anodized pot (0.8L)",
    "Small gas canister with micro-stove",
    "Spork and insulated mug",
    "Zip-lock trash bags for zero-waste"
  ],
  "estimated_food_expense_inr": ${days * (dietType.toLowerCase().includes('vegan') ? 550 : 450)},
  "hydration_guideline": "Drink at least 3.5 to 4 liters of fluids per day. Keep urine pale yellow."
}
Generate day items for up to ${Math.min(days, 5)} days.
`;

  let planData = null;
  try {
    const aiRes = await generateAIText(prompt, 'You are an elite Himalayan expedition nutritionist. Emphasize lightweight high-energy mountain nutrition, rapid rehydration, and zero waste.');
    if (aiRes.success && aiRes.data) {
      planData = aiRes.data;
    }
  } catch (err) {
    console.warn('[NutritionPlanner] AI generation exception:', err.message);
  }

  if (!planData || !planData.daily_meals) {
    planData = generateDeterministicNutritionFallback(trek, days, dietType, cleanAllergies);
  }

  // Calculate estimated food expenses (calibrated with Cost Intelligence benchmarks)
  const estCostPerDay = dietType.toLowerCase().includes('vegan') ? 550 : 450;
  const totalFoodCost = Math.round(days * estCostPerDay);
  planData.estimated_food_expense_inr = totalFoodCost;

  // 3. Persist to PostgreSQL if authenticated
  let planId = null;
  if (userId) {
    try {
      const insRes = await query(
        `INSERT INTO nutrition_plans (
           user_id, trek_id, duration_days, diet_type, activity_intensity,
           allergies, facilities, food_carrying_style,
           daily_meals, shopping_list, packing_checklist, estimated_food_cost_inr, hydration_guideline
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING plan_id`,
        [
          userId,
          trek.trek_id,
          days,
          dietType,
          activityIntensity,
          cleanAllergies,
          facilities,
          foodCarryingStyle,
          JSON.stringify(planData.daily_meals || []),
          JSON.stringify(planData.shopping_list || []),
          JSON.stringify(planData.packing_checklist || []),
          totalFoodCost,
          planData.hydration_guideline || '3.5L to 4L daily target'
        ]
      );
      planId = insRes.rows[0].plan_id;
    } catch (dbErr) {
      console.warn('[NutritionPlanner] Could not persist nutrition plan:', dbErr.message);
    }
  }

  return {
    success: true,
    plan_id: planId,
    trek: {
      trek_id: trek.trek_id,
      name: trek.trek_name,
      slug: trek.slug,
      state: trek.state_name,
      elevation_m: maxElev
    },
    plan_parameters: {
      duration_days: days,
      diet_type: dietType,
      activity_intensity: activityIntensity,
      allergies: cleanAllergies,
      facilities,
      food_carrying_style: foodCarryingStyle
    },
    nutrition_plan: planData,
    connected_cost_estimate: {
      total_food_cost_inr: totalFoodCost,
      per_day_inr: estCostPerDay,
      currency: 'INR'
    },
    disclaimer: 'TrekIndia Nutrition Planner offers educational recommendations for general wilderness trekking and does not substitute for personalized clinical dietetic guidance.'
  };
}

/**
 * Retrieve saved nutrition plan by ID
 */
export async function getNutritionPlanById(planId, currentUserId = null) {
  const res = await query(
    `SELECT np.*, t.trek_name, t.slug AS trek_slug
     FROM nutrition_plans np
     JOIN treks t ON np.trek_id = t.trek_id
     WHERE np.plan_id = $1`,
    [planId]
  );
  if (res.rows.length === 0) {
    throw new Error('Nutrition plan not found.');
  }
  const plan = res.rows[0];
  if (plan.user_id && currentUserId && plan.user_id.toString() !== currentUserId.toString()) {
    throw new Error('Unauthorized to view this nutrition plan.');
  }
  return plan;
}

/**
 * List user's saved nutrition plans
 */
export async function getUserNutritionPlans(userId) {
  const res = await query(
    `SELECT np.*, t.trek_name, t.slug AS trek_slug
     FROM nutrition_plans np
     JOIN treks t ON np.trek_id = t.trek_id
     WHERE np.user_id = $1
     ORDER BY np.created_at DESC`,
    [userId]
  );
  return res.rows;
}

/**
 * Deterministic fallback meal generator
 */
function generateDeterministicNutritionFallback(trek, days, dietType, allergies) {
  const isNutFree = allergies.some(a => a.toLowerCase().includes('nut'));
  const trailSnack = isNutFree ? 'Roasted chickpeas & dried figs' : 'Roasted almonds, walnuts & dates';

  const dailyMeals = [];
  for (let d = 1; d <= Math.min(days, 5); d++) {
    dailyMeals.push({
      day: d,
      stage: `Day ${d} Trail Stage`,
      breakfast: { name: 'Rolled oats porridge with jaggery, chia seeds, and hot tea', prep_time_min: 8, weight_g: 110 },
      trail_snack_morning: { name: trailSnack, weight_g: 75 },
      lunch: { name: 'Energy-dense vegetable khichdi / savory granola with peanut butter', weight_g: 180 },
      trail_snack_afternoon: { name: 'Electrolyte hydration drink + sesame jaggery chikki', weight_g: 60 },
      dinner: { name: 'High-protein lentil soup with instant fortified rice and clarified butter (ghee)', prep_time_min: 15, weight_g: 220 }
    });
  }

  return {
    summary: `High-carbohydrate, easily digestible trail fuel designed for ${trek.trek_name} over ${days} days.`,
    daily_target_calories: 3200,
    daily_meals: dailyMeals,
    lightweight_tips: [
      'Repackage bulky store boxes into lightweight resealable zip bags before departure.',
      'Prioritize complex carbs during the day; avoid overly greasy foods that slow high-altitude digestion.'
    ],
    shopping_list: [
      { category: 'Base Carbohydrates', items: ['Rolled oats 500g', 'Parboiled quick-cooking rice 600g', 'Poha (flattened rice) 300g'] },
      { category: 'Trail Snacks', items: [trailSnack, 'Dark chocolate bars x3', 'Energy hydration sachets x8'] },
      { category: 'Protein & Fats', items: ['Lentil soup packets (dal mix)', 'Roasted chana 300g', 'Ghee / olive oil travel pouch'] }
    ],
    packing_checklist: [
      'Compact camping stove with wind shield',
      'Food container with tight lid (acts as eating bowl)',
      'Spork, pocket knife, and lighter',
      'Biodegradable organic dish wash scrubber'
    ],
    hydration_guideline: 'Maintain 3.5L to 4L daily fluid intake. Take an electrolyte drink mid-afternoon.'
  };
}

