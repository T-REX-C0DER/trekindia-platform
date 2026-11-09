import { query } from '../backend/src/config/database.js';
import * as visualIntelligenceService from '../backend/src/services/visualIntelligenceService.js';

const CURATED_POSTS = [
  {
    caption: 'The final ascent to Hampta Pass. The air was thin, the wind biting, but the silence of these peaks makes every step worth it. Green Kullu valley on one side, barren desert of Spiti on the other. #HamptaPass #Himalayas #TrekIndia #HimachalTreks',
    trek_name: 'Hampta Pass Trek',
    trek_id: 172,
    location: 'Hampta Pass, Himachal Pradesh',
    difficulty: 'Moderate',
    elevation_m: 4287,
    duration_days: 5,
    distance_km: 35.0,
    hashtags: ['HamptaPass', 'Himalayas', 'TrekIndia', 'HimachalTreks'],
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=85'
    ]
  },
  {
    caption: 'Valley of Flowers in full monsoon bloom! Rare Himalayan blue poppies, Brahma kamal, and carpet of wild alpine flora stretching as far as the eye can see. #ValleyOfFlowers #Uttarakhand #AlpineFlora #MonsoonTrek',
    trek_name: 'Valley of Flowers',
    trek_id: 611,
    location: 'Chamoli, Uttarakhand',
    difficulty: 'Easy',
    elevation_m: 3658,
    duration_days: 6,
    distance_km: 38.0,
    hashtags: ['ValleyOfFlowers', 'Uttarakhand', 'AlpineFlora', 'MonsoonTrek'],
    images: [
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=85'
    ]
  },
  {
    caption: 'Camp 2 beneath the snow-laden deodar forests of Kedarkantha. Sunrise turned the entire ridge gold. #Kedarkantha #WinterWonderland #Garhwal #SnowTrek',
    trek_name: 'Kedarkantha Trek',
    trek_id: 199,
    location: 'Sankri, Uttarakhand',
    difficulty: 'Easy',
    elevation_m: 3810,
    duration_days: 4,
    distance_km: 20.0,
    hashtags: ['Kedarkantha', 'WinterWonderland', 'Garhwal', 'SnowTrek'],
    images: [
      'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=1200&q=85',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85'
    ]
  },
  {
    caption: 'Cradle-shaped Har Ki Dun valley following the Supin river. Ancient wooden villages of Osla and views of Swargarohini peaks. #HarKiDun #GarhwalHimalayas',
    trek_name: 'Har Ki Dun',
    trek_id: 198,
    location: 'Uttarkashi, Uttarakhand',
    difficulty: 'Moderate',
    elevation_m: 3566,
    duration_days: 7,
    distance_km: 47.0,
    hashtags: ['HarKiDun', 'GarhwalHimalayas'],
    images: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=85'
    ]
  },
  {
    caption: 'Misty trek through dense Sahyadri forests up to Rajmachi twin forts: Shrivardhan and Manaranjan. Waterfalls everywhere! #Rajmachi #Sahyadri #Lonavala #MonsoonMagic',
    trek_name: 'Rajmachi Fort Trek',
    trek_id: 395,
    location: 'Lonavala, Maharashtra',
    difficulty: 'Easy',
    elevation_m: 825,
    duration_days: 1,
    distance_km: 16.0,
    hashtags: ['Rajmachi', 'Sahyadri', 'Lonavala', 'MonsoonMagic'],
    images: [
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=85'
    ]
  }
];

async function seedPostsAndBackfill() {
  const userRes = await query('SELECT user_id FROM users LIMIT 1');
  const userId = userRes.rows[0]?.user_id || 1;

  for (const post of CURATED_POSTS) {
    const existing = await query(
      'SELECT post_id FROM community_posts WHERE caption = $1',
      [post.caption]
    );

    if (existing.rows.length === 0) {
      // Find actual canonical trek
      const trek = await visualIntelligenceService.resolveCanonicalTrek(post.trek_name);
      await query(
        `INSERT INTO community_posts (
           user_id, post_type, caption, trek_id, location, difficulty, distance_km, elevation_m, duration_days, hashtags, images
         ) VALUES ($1, 'experience', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          post.caption,
          trek ? trek.trek_id : post.trek_id,
          post.location,
          post.difficulty,
          post.distance_km,
          post.elevation_m,
          post.duration_days,
          post.hashtags,
          JSON.stringify(post.images)
        ]
      );
    }
  }

  console.log('✅ Curated community posts synchronized with database.');

  const backfill = await visualIntelligenceService.runHistoricalPostsBackfill(25);
  console.log('Backfill results:', backfill);

  const metrics = await visualIntelligenceService.getVisualIntelligenceMetrics();
  console.log('Updated Metrics:', metrics);
}

seedPostsAndBackfill().catch(console.error).finally(() => process.exit(0));

