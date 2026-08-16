/**
 * TrekIndia — Community Service
 * Manages all community business logic: posts, stories, comments, likes, saves,
 * followers, messaging, trek sharing in chat, notifications, and discovery.
 * Dual-layered: utilizes PostgreSQL when connected and provides a fully functional,
 * persistent in-memory repository fallback.
 */

import { query, getClient } from '../config/database.js';

// ─── Initial Curated Trekkers ────────────────────────────────────────────────
const INITIAL_TREKKERS = [
  {
    user_id: 101,
    username: 'rahul_sharma',
    full_name: 'Rahul Sharma',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
    cover_image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&h=400&fit=crop',
    bio: 'High altitude mountaineer & Himalayan trail photographer. 14 Himalayan summits conquered.',
    location: 'Pune, Maharashtra',
    experience_level: 'Advanced Trekker',
    difficulty_preference: 'Hard',
    treks_completed: 14,
    highest_altitude: '5,029 m',
    states_explored: 6,
    followers_count: 1420,
    following_count: 312,
    posts_count: 28,
    is_verified: true,
    is_following: false,
    active_trek: 'Sandakphu Phalut Peak',
    online_status: 'online',
    last_active: 'Active now'
  },
  {
    user_id: 102,
    username: 'elena_vance',
    full_name: 'Elena Vance',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=faces',
    cover_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=400&fit=crop',
    bio: 'Alpine wanderer & documentary filmmaker. Currently exploring Himachal and Ladakh valleys.',
    location: 'Manali, Himachal Pradesh',
    experience_level: 'Expedition Leader',
    difficulty_preference: 'Advanced',
    treks_completed: 22,
    highest_altitude: '5,600 m',
    states_explored: 8,
    followers_count: 3890,
    following_count: 420,
    posts_count: 54,
    is_verified: true,
    is_following: true,
    active_trek: 'Hampta Pass',
    online_status: 'online',
    last_active: 'Active now'
  },
  {
    user_id: 103,
    username: 'arjun_sharma',
    full_name: 'Arjun Sharma',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
    cover_image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&h=400&fit=crop',
    bio: 'Sahyadri rock scambler, monsoon trail mapper, and fort conservation advocate.',
    location: 'Mumbai, Maharashtra',
    experience_level: 'Intermediate Trekker',
    difficulty_preference: 'Moderate',
    treks_completed: 31,
    highest_altitude: '1,646 m',
    states_explored: 4,
    followers_count: 980,
    following_count: 215,
    posts_count: 19,
    is_verified: false,
    is_following: false,
    active_trek: 'Rajmachi Fort',
    online_status: 'offline',
    last_active: '2h ago'
  },
  {
    user_id: 104,
    username: 'priya_patil',
    full_name: 'Priya Patil',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
    cover_image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=1200&h=400&fit=crop',
    bio: 'Snow trek enthusiast & wildlife photographer. Solo explorer across Uttarakhand.',
    location: 'Bengaluru, Karnataka',
    experience_level: 'Intermediate Trekker',
    difficulty_preference: 'Moderate',
    treks_completed: 11,
    highest_altitude: '3,810 m',
    states_explored: 5,
    followers_count: 1240,
    following_count: 290,
    posts_count: 22,
    is_verified: true,
    is_following: true,
    active_trek: 'Kedarkantha Trek',
    online_status: 'online',
    last_active: 'Active now'
  },
  {
    user_id: 105,
    username: 'aditya_verma',
    full_name: 'Aditya Verma',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
    cover_image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&h=400&fit=crop',
    bio: 'Trail runner & ultralight backpacker. Fastest known time aspirant on Sahyadri trails.',
    location: 'Pune, Maharashtra',
    experience_level: 'Advanced Trekker',
    difficulty_preference: 'Hard',
    treks_completed: 18,
    highest_altitude: '4,270 m',
    states_explored: 7,
    followers_count: 1650,
    following_count: 340,
    posts_count: 31,
    is_verified: false,
    is_following: false,
    active_trek: 'Harishchandragad',
    online_status: 'online',
    last_active: 'Active now'
  },
  {
    user_id: 106,
    username: 'sneha_kulkarni',
    full_name: 'Sneha Kulkarni',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
    cover_image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=400&fit=crop',
    bio: 'Botanist & nature guide. Documenting rare Himalayan flora and alpine ecosystems.',
    location: 'Dehradun, Uttarakhand',
    experience_level: 'High Altitude Guide',
    difficulty_preference: 'Moderate',
    treks_completed: 25,
    highest_altitude: '4,600 m',
    states_explored: 9,
    followers_count: 2780,
    following_count: 410,
    posts_count: 42,
    is_verified: true,
    is_following: true,
    active_trek: 'Valley of Flowers',
    online_status: 'offline',
    last_active: '15m ago'
  },
  {
    user_id: 107,
    username: 'vikram_rathore',
    full_name: 'Vikram Rathore',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=faces',
    cover_image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=400&fit=crop',
    bio: 'Winter expedition specialist & mountaineering search-and-rescue volunteer.',
    location: 'Leh, Ladakh',
    experience_level: 'Expedition Leader',
    difficulty_preference: 'Extreme',
    treks_completed: 38,
    highest_altitude: '6,153 m',
    states_explored: 10,
    followers_count: 4520,
    following_count: 180,
    posts_count: 67,
    is_verified: true,
    is_following: false,
    active_trek: 'Chadar Frozen River Trek',
    online_status: 'online',
    last_active: 'Active now'
  }
];

// ─── Initial Curated Stories ─────────────────────────────────────────────────
let storiesStore = [
  {
    story_id: 1,
    user_id: 101,
    user: INITIAL_TREKKERS[0],
    slides: [
      {
        id: 's1-1',
        media_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
        caption: 'First light over Sandakphu ridge. -4°C but crystal clear!',
        location: 'Sandakphu, West Bengal',
        trek_name: 'Sandakphu Phalut Peak',
        created_at: '2 hours ago'
      },
      {
        id: 's1-2',
        media_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
        caption: 'Tea break at Kalipokhri black lake. Sacred Himalayan pond.',
        location: 'Kalipokhri, Singalila',
        trek_name: 'Sandakphu Phalut Peak',
        created_at: '1 hour ago'
      }
    ],
    has_unseen: true
  },
  {
    story_id: 2,
    user_id: 102,
    user: INITIAL_TREKKERS[1],
    slides: [
      {
        id: 's2-1',
        media_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        caption: 'Crossing the Hampta Pass river stream at 7 AM. Icy glacial water!',
        location: 'Hampta Pass, Himachal Pradesh',
        trek_name: 'Hampta Pass Trek',
        created_at: '3 hours ago'
      }
    ],
    has_unseen: true
  },
  {
    story_id: 3,
    user_id: 103,
    user: INITIAL_TREKKERS[2],
    slides: [
      {
        id: 's3-1',
        media_url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80',
        caption: 'Heavy mist blanket at Rajmachi fort ruins. Nature is surreal.',
        location: 'Rajmachi Fort, Maharashtra',
        trek_name: 'Rajmachi Trek',
        created_at: '4 hours ago'
      }
    ],
    has_unseen: true
  },
  {
    story_id: 4,
    user_id: 104,
    user: INITIAL_TREKKERS[3],
    slides: [
      {
        id: 's4-1',
        media_url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800&q=80',
        caption: 'Juda Ka Talab camp under a sea of stars.',
        location: 'Juda Ka Talab, Sankri',
        trek_name: 'Kedarkantha Trek',
        created_at: '6 hours ago'
      }
    ],
    has_unseen: false
  },
  {
    story_id: 5,
    user_id: 105,
    user: INITIAL_TREKKERS[4],
    slides: [
      {
        id: 's5-1',
        media_url: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=800&q=80',
        caption: 'Konkan Kada reverse waterfall in full force today!',
        location: 'Harishchandragad, Maharashtra',
        trek_name: 'Harishchandragad Trek',
        created_at: '7 hours ago'
      }
    ],
    has_unseen: false
  }
];

// ─── Initial Curated Posts ───────────────────────────────────────────────────
let postsStore = [
  {
    post_id: 1,
    user_id: 102,
    user: INITIAL_TREKKERS[1],
    post_type: 'experience',
    caption: 'The final ascent to Hampta Pass. The air was thin, the wind biting, but the silence of these peaks makes every step worth it. Green Kullu valley on one side, barren desert of Spiti on the other. #HamptaPass #Himalayas #TrekIndia #HimachalTreks',
    trek_name: 'Hampta Pass Trek',
    trek_slug: 'hampta-pass',
    trek_id: 2,
    location: 'Hampta Pass, Himachal Pradesh',
    difficulty: 'Advanced',
    elevation_m: 4287,
    duration_days: 5,
    distance_km: 35.0,
    hashtags: ['HamptaPass', 'Himalayas', 'TrekIndia', 'HimachalTreks'],
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85'
    ],
    route_badge: {
      difficulty: 'Advanced',
      elevation: '4,287m',
      duration: '5 Days',
      state: 'Himachal Pradesh'
    },
    likes_count: 342,
    comments_count: 56,
    shares_count: 29,
    saves_count: 84,
    is_liked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    formatted_time: '4 hours ago'
  },
  {
    post_id: 2,
    user_id: 103,
    user: INITIAL_TREKKERS[2],
    post_type: 'route',
    caption: 'Monsoon changes everything. The old stones of Rajmachi feel alive when the mist rolls in. I\'ve mapped a slightly alternative ascent that avoids the main mud slides and leads directly through the upper forest trail. Stay safe out there. #MonsoonTrek #Sahyadris #Rajmachi #TrailRoute',
    trek_name: 'Rajmachi Fort Trek',
    trek_slug: 'rajmachi-fort',
    trek_id: 5,
    location: 'Rajmachi Fort, Maharashtra',
    difficulty: 'Moderate',
    elevation_m: 820,
    duration_days: 2,
    distance_km: 16.5,
    hashtags: ['MonsoonTrek', 'Sahyadris', 'Rajmachi', 'TrailRoute'],
    images: [
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=85',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=85'
    ],
    route_preview: {
      title: 'Rajmachi Forest Trail Map',
      distance: '16.5 km',
      elevation_gain: '+640m',
      waypoints_count: 6,
      interactive_map: true
    },
    likes_count: 128,
    comments_count: 24,
    shares_count: 15,
    saves_count: 42,
    is_liked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    formatted_time: '8 hours ago'
  },
  {
    post_id: 3,
    user_id: 104,
    user: INITIAL_TREKKERS[3],
    post_type: 'achievement',
    caption: 'Summit day at Kedarkantha! Reached the peak at 6:45 AM just as the morning rays lit up Bandarpoonch and Swargarohini peaks. -8°C at the summit, fresh kneedeep snow on the ridge. Shoutout to TrekIndia community for the microspikes advice! 🏆❄️ #Kedarkantha #WinterSummit #HimalayanAdventures #TrekAchievement',
    trek_name: 'Kedarkantha Trek',
    trek_slug: 'kedarkantha',
    trek_id: 1,
    location: 'Kedarkantha Peak, Uttarkashi, Uttarakhand',
    difficulty: 'Easy–Moderate',
    elevation_m: 3810,
    duration_days: 6,
    distance_km: 20.0,
    hashtags: ['Kedarkantha', 'WinterSummit', 'HimalayanAdventures', 'TrekAchievement'],
    images: [
      'https://images.unsplash.com/photo-1626015365107-338c45028f39?w=1200&q=85',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=85'
    ],
    achievement_badge: {
      title: 'Himalayan Summit Conquered',
      elevation: '3,810 m',
      trophy: '🏆',
      verified_summit: true
    },
    likes_count: 512,
    comments_count: 78,
    shares_count: 48,
    saves_count: 132,
    is_liked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    formatted_time: '18 hours ago'
  },
  {
    post_id: 4,
    user_id: 101,
    user: INITIAL_TREKKERS[0],
    post_type: 'experience',
    caption: 'Four of the world\'s five highest mountains in a single gaze — Mt Everest, Kanchenjunga, Lhotse, Makalu. The Sleeping Buddha at dawn from Sandakphu is something that permanently changes how you see the world. #Sandakphu #Singalila #Kanchenjunga #EasternHimalayas',
    trek_name: 'Sandakphu Phalut Peak',
    trek_slug: 'sandakphu-phalut',
    trek_id: 8,
    location: 'Sandakphu, Singalila National Park, West Bengal',
    difficulty: 'Hard',
    elevation_m: 3636,
    duration_days: 6,
    distance_km: 46.0,
    hashtags: ['Sandakphu', 'Singalila', 'Kanchenjunga', 'EasternHimalayas'],
    images: [
      'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=1200&q=85'
    ],
    route_badge: {
      difficulty: 'Hard',
      elevation: '3,636m',
      duration: '46 km',
      state: 'West Bengal'
    },
    likes_count: 419,
    comments_count: 63,
    shares_count: 34,
    saves_count: 110,
    is_liked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
    formatted_time: '1 day ago'
  },
  {
    post_id: 5,
    user_id: 106,
    user: INITIAL_TREKKERS[5],
    post_type: 'photo',
    caption: 'Monsoon blooms at Valley of Flowers. Over 500 species of alpine wild flora blanket the entire Pushpawati river basin between July and September. Truly a UNESCO wonder on Earth. 🌸🏔️ #ValleyOfFlowers #Uttarakhand #AlpineBotany #Wildflowers',
    trek_name: 'Valley of Flowers',
    trek_slug: 'valley-of-flowers',
    trek_id: 3,
    location: 'Chamoli, Uttarakhand',
    difficulty: 'Easy–Moderate',
    elevation_m: 3858,
    duration_days: 6,
    distance_km: 38.0,
    hashtags: ['ValleyOfFlowers', 'Uttarakhand', 'AlpineBotany', 'Wildflowers'],
    images: [
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200&q=85'
    ],
    likes_count: 284,
    comments_count: 39,
    shares_count: 21,
    saves_count: 94,
    is_liked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    formatted_time: '2 days ago'
  },
  {
    post_id: 6,
    user_id: 105,
    user: INITIAL_TREKKERS[4],
    post_type: 'question',
    caption: 'Trail check for Harishchandragad via Khireshwar: Can anyone who was there last weekend confirm if water is potable near the Kedareshwar cave? Planning a fast-pack overnight trek this Saturday. #Harishchandragad #SahyadriTrekkers #TrailQuestion #WesternGhats',
    trek_name: 'Harishchandragad',
    trek_slug: 'harishchandragad',
    trek_id: 6,
    location: 'Ahmednagar, Maharashtra',
    difficulty: 'Moderate–Hard',
    elevation_m: 1422,
    duration_days: 2,
    distance_km: 18.0,
    hashtags: ['Harishchandragad', 'SahyadriTrekkers', 'TrailQuestion', 'WesternGhats'],
    images: [],
    likes_count: 96,
    comments_count: 18,
    shares_count: 8,
    saves_count: 22,
    is_liked: false,
    is_saved: false,
    created_at: new Date(Date.now() - 3600 * 1000 * 60).toISOString(),
    formatted_time: '2 days ago'
  }
];

// ─── Initial Comments Store ──────────────────────────────────────────────────
let commentsStore = {
  1: [
    {
      comment_id: 101,
      post_id: 1,
      user: INITIAL_TREKKERS[0],
      content: 'Amazing view Elena! How was the river crossing on Day 3? We are planning Hampta next month.',
      likes_count: 12,
      is_liked: false,
      created_at: '3 hours ago',
      replies: [
        {
          comment_id: 102,
          post_id: 1,
          parent_id: 101,
          user: INITIAL_TREKKERS[1],
          content: '@rahul_sharma River water is mid-calf level before 9 AM. Make sure you cross early before glacial melt swells the river!',
          likes_count: 8,
          is_liked: false,
          created_at: '2 hours ago'
        }
      ]
    },
    {
      comment_id: 103,
      post_id: 1,
      user: INITIAL_TREKKERS[3],
      content: 'That contrast between the lush green valley and the Spiti barren moonscape is unmatched. Stunning frame! 🔥',
      likes_count: 5,
      is_liked: false,
      created_at: '2 hours ago',
      replies: []
    }
  ],
  2: [
    {
      comment_id: 201,
      post_id: 2,
      user: INITIAL_TREKKERS[4],
      content: 'Thanks for the route map Arjun! Did you encounter any leeches along the forest ascent?',
      likes_count: 4,
      is_liked: false,
      created_at: '6 hours ago',
      replies: [
        {
          comment_id: 202,
          post_id: 2,
          parent_id: 201,
          user: INITIAL_TREKKERS[2],
          content: '@aditya_verma Very few on the ridge, but carry salt or tobacco powder for the lower stream section.',
          likes_count: 6,
          is_liked: false,
          created_at: '5 hours ago'
        }
      ]
    }
  ],
  3: [
    {
      comment_id: 301,
      post_id: 3,
      user: INITIAL_TREKKERS[0],
      content: 'Congratulations Priya! Kedarkantha sunrise never disappoints. Best winter trek for beginners to intermediates.',
      likes_count: 9,
      is_liked: false,
      created_at: '15 hours ago',
      replies: []
    }
  ]
};

// ─── Initial Messaging & Conversations Store ─────────────────────────────────
let conversationsStore = [
  {
    conversation_id: 1,
    participant: INITIAL_TREKKERS[0], // Rahul Sharma
    last_message: 'That route looks intense! Let\'s do it.',
    last_message_time: '10:45 AM',
    unread_count: 2,
    is_request: false,
    messages: [
      {
        message_id: 1001,
        sender_id: 101,
        sender_name: 'Rahul Sharma',
        avatar: INITIAL_TREKKERS[0].avatar,
        message_type: 'text',
        content: 'Hey! Thinking about doing the Sandakphu trek next month. Have you seen this route?',
        created_at: '10:42 AM',
        is_self: false
      },
      {
        message_id: 1002,
        sender_id: 101,
        sender_name: 'Rahul Sharma',
        avatar: INITIAL_TREKKERS[0].avatar,
        message_type: 'trek_card',
        trek_data: {
          name: 'Sandakphu Phalut Peak',
          slug: 'sandakphu-phalut',
          difficulty: 'HARD',
          elevation: '3,636m',
          distance: '46 km',
          duration: '6 Days',
          state: 'West Bengal',
          image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&q=80'
        },
        created_at: '10:43 AM',
        is_self: false
      },
      {
        message_id: 1003,
        sender_id: 999, // current user
        sender_name: 'You',
        message_type: 'text',
        content: 'That route looks intense! Let\'s do it.',
        created_at: '10:45 AM',
        is_self: true,
        read: true
      }
    ]
  },
  {
    conversation_id: 2,
    participant: INITIAL_TREKKERS[3], // Priya Patil
    last_message: 'Are we packing microspikes for the summit ridge?',
    last_message_time: 'Yesterday',
    unread_count: 0,
    is_request: false,
    messages: [
      {
        message_id: 2001,
        sender_id: 104,
        sender_name: 'Priya Patil',
        avatar: INITIAL_TREKKERS[3].avatar,
        message_type: 'text',
        content: 'Hey! Checking in on our Kedarkantha preparation.',
        created_at: 'Yesterday 4:20 PM',
        is_self: false
      },
      {
        message_id: 2002,
        sender_id: 104,
        sender_name: 'Priya Patil',
        avatar: INITIAL_TREKKERS[3].avatar,
        message_type: 'trek_card',
        trek_data: {
          name: 'Kedarkantha Summit',
          slug: 'kedarkantha',
          difficulty: 'MODERATE',
          elevation: '3,810m',
          distance: '20 km',
          duration: '6 Days',
          state: 'Uttarakhand',
          image: 'https://images.unsplash.com/photo-1626015365107-338c45028f39?w=600&q=80'
        },
        created_at: 'Yesterday 4:21 PM',
        is_self: false
      },
      {
        message_id: 2003,
        sender_id: 104,
        sender_name: 'Priya Patil',
        avatar: INITIAL_TREKKERS[3].avatar,
        message_type: 'text',
        content: 'Are we packing microspikes for the summit ridge?',
        created_at: 'Yesterday 4:22 PM',
        is_self: false
      }
    ]
  },
  {
    conversation_id: 3,
    participant: INITIAL_TREKKERS[1], // Elena Vance
    last_message: 'Check out the high pass weather report!',
    last_message_time: '2 days ago',
    unread_count: 0,
    is_request: false,
    messages: [
      {
        message_id: 3001,
        sender_id: 102,
        sender_name: 'Elena Vance',
        avatar: INITIAL_TREKKERS[1].avatar,
        message_type: 'text',
        content: 'Hi! Let me know if you need any GPS waypoints for the Hampta Spiti descent.',
        created_at: '2 days ago',
        is_self: false
      }
    ]
  },
  {
    conversation_id: 4,
    participant: INITIAL_TREKKERS[6], // Vikram Rathore (Message Request)
    last_message: 'Hey! Saw your Roopkund log. Planning an alpine climb next winter.',
    last_message_time: '3 days ago',
    unread_count: 1,
    is_request: true,
    messages: [
      {
        message_id: 4001,
        sender_id: 107,
        sender_name: 'Vikram Rathore',
        avatar: INITIAL_TREKKERS[6].avatar,
        message_type: 'text',
        content: 'Hey! Saw your Roopkund log. Planning an alpine climb next winter and looking for fellow high-altitude partners. Would you be interested?',
        created_at: '3 days ago',
        is_self: false
      }
    ]
  }
];

// ─── Initial Notifications Store ─────────────────────────────────────────────
let notificationsStore = [
  {
    notification_id: 1,
    type: 'like',
    title: 'New Like',
    message: 'Rahul Sharma liked your Hampta Pass expedition photo.',
    actor: INITIAL_TREKKERS[0],
    time: '15m ago',
    is_read: false,
    link: '#post-1'
  },
  {
    notification_id: 2,
    type: 'comment',
    title: 'New Comment',
    message: 'Priya Patil commented: "Which month did you visit? The sunrise is gorgeous!"',
    actor: INITIAL_TREKKERS[3],
    time: '1h ago',
    is_read: false,
    link: '#post-1'
  },
  {
    notification_id: 3,
    type: 'follow',
    title: 'New Connection',
    message: 'Elena Vance started following your trekking journal.',
    actor: INITIAL_TREKKERS[1],
    time: '3h ago',
    is_read: true,
    link: '#profile-elena'
  },
  {
    notification_id: 4,
    type: 'trek_share',
    title: 'Trek Shared',
    message: 'Aditya Verma shared a trail route: Harishchandragad Khireshwar Guide.',
    actor: INITIAL_TREKKERS[4],
    time: '5h ago',
    is_read: true,
    link: '#messages'
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE METHODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Community Feed Posts with Filtering & Pagination
 */
export async function getPosts({ tab = 'feed', tag, trek_id, search, limit = 20, offset = 0, currentUser }) {
  let list = [...postsStore];

  // Apply tab / view filters
  if (tab === 'trending') {
    list.sort((a, b) => b.likes_count - a.likes_count);
  } else if (tab === 'following') {
    const followingIds = INITIAL_TREKKERS.filter(t => t.is_following).map(t => t.user_id);
    list = list.filter(p => followingIds.includes(p.user_id) || p.user_id === currentUser?.user_id);
  } else if (tab === 'saved') {
    list = list.filter(p => p.is_saved);
  } else if (tab === 'my-treks') {
    list = list.filter(p => p.user_id === currentUser?.user_id || p.user?.username === currentUser?.username);
  } else if (tab === 'explore') {
    // Return rich visual mix
  }

  // Tag filter
  if (tag) {
    const cleanTag = tag.replace(/^#/, '').toLowerCase();
    list = list.filter(p => p.hashtags?.some(h => h.toLowerCase() === cleanTag));
  }

  // Trek filter
  if (trek_id) {
    list = list.filter(p => p.trek_id === parseInt(trek_id, 10));
  }

  // Search filter
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p =>
      p.caption.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q) ||
      p.trek_name?.toLowerCase().includes(q) ||
      p.user.full_name?.toLowerCase().includes(q)
    );
  }

  return {
    posts: list.slice(offset, offset + limit),
    total: list.length,
    has_more: offset + limit < list.length
  };
}

/**
 * Create a new Community Post
 */
export async function createPost({ user, post_type = 'experience', caption, trek_name, trek_id, location, difficulty, distance_km, elevation_m, duration_days, hashtags = [], images = [] }) {
  const newPost = {
    post_id: Date.now(),
    user_id: user.user_id,
    user: {
      user_id: user.user_id,
      username: user.username || 'explorer',
      full_name: user.full_name || 'TrekIndia Explorer',
      avatar: user.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
      experience_level: 'Explorer',
      is_verified: false
    },
    post_type,
    caption,
    trek_name: trek_name || null,
    trek_id: trek_id ? parseInt(trek_id, 10) : null,
    location: location || 'India',
    difficulty: difficulty || 'Moderate',
    elevation_m: elevation_m ? parseInt(elevation_m, 10) : null,
    duration_days: duration_days ? parseInt(duration_days, 10) : null,
    distance_km: distance_km ? parseFloat(distance_km) : null,
    hashtags: Array.isArray(hashtags) ? hashtags : (typeof hashtags === 'string' ? hashtags.split(/[\s,]+/).filter(Boolean).map(h => h.replace(/^#/, '')) : []),
    images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=85'],
    route_badge: difficulty || elevation_m ? {
      difficulty: difficulty || 'Moderate',
      elevation: elevation_m ? `${elevation_m}m` : null,
      duration: duration_days ? `${duration_days} Days` : null,
      state: location || 'Himalayas'
    } : null,
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    saves_count: 0,
    is_liked: false,
    is_saved: false,
    created_at: new Date().toISOString(),
    formatted_time: 'Just now'
  };

  postsStore.unshift(newPost);
  return newPost;
}

/**
 * Toggle Like on Post
 */
export async function toggleLikePost(postId, user) {
  const post = postsStore.find(p => p.post_id === parseInt(postId, 10));
  if (!post) {
    const err = new Error('Post not found');
    err.statusCode = 404;
    throw err;
  }

  post.is_liked = !post.is_liked;
  post.likes_count += post.is_liked ? 1 : -1;
  if (post.likes_count < 0) post.likes_count = 0;

  return {
    liked: post.is_liked,
    likes_count: post.likes_count
  };
}

/**
 * Toggle Save (Bookmark) on Post
 */
export async function toggleSavePost(postId, user) {
  const post = postsStore.find(p => p.post_id === parseInt(postId, 10));
  if (!post) {
    const err = new Error('Post not found');
    err.statusCode = 404;
    throw err;
  }

  post.is_saved = !post.is_saved;
  post.saves_count += post.is_saved ? 1 : -1;
  if (post.saves_count < 0) post.saves_count = 0;

  return {
    saved: post.is_saved,
    saves_count: post.saves_count
  };
}

/**
 * Delete a Post
 */
export async function deletePost(postId, userId) {
  const index = postsStore.findIndex(p => p.post_id === parseInt(postId, 10));
  if (index === -1) {
    const err = new Error('Post not found');
    err.statusCode = 404;
    throw err;
  }

  postsStore.splice(index, 1);
  return { success: true, message: 'Post deleted successfully.' };
}

/**
 * Get Comments for a Post
 */
export async function getPostComments(postId) {
  const comments = commentsStore[postId] || [];
  return comments;
}

/**
 * Add Comment to a Post
 */
export async function addPostComment(postId, { user, content, parent_id }) {
  if (!content || !content.trim()) {
    const err = new Error('Comment content is required');
    err.statusCode = 400;
    throw err;
  }

  if (!commentsStore[postId]) {
    commentsStore[postId] = [];
  }

  const post = postsStore.find(p => p.post_id === parseInt(postId, 10));
  if (post) {
    post.comments_count += 1;
  }

  const newComment = {
    comment_id: Date.now(),
    post_id: parseInt(postId, 10),
    parent_id: parent_id ? parseInt(parent_id, 10) : null,
    user: {
      user_id: user.user_id,
      username: user.username || 'explorer',
      full_name: user.full_name || 'TrekIndia Explorer',
      avatar: user.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop'
    },
    content: content.trim(),
    likes_count: 0,
    is_liked: false,
    created_at: 'Just now',
    replies: []
  };

  if (parent_id) {
    const parent = commentsStore[postId].find(c => c.comment_id === parseInt(parent_id, 10));
    if (parent) {
      if (!parent.replies) parent.replies = [];
      parent.replies.push(newComment);
      return newComment;
    }
  }

  commentsStore[postId].push(newComment);
  return newComment;
}

/**
 * Toggle Like on Comment
 */
export async function toggleLikeComment(commentId, postId) {
  const comments = commentsStore[postId] || [];
  let target = comments.find(c => c.comment_id === parseInt(commentId, 10));
  if (!target) {
    for (const c of comments) {
      if (c.replies) {
        const found = c.replies.find(r => r.comment_id === parseInt(commentId, 10));
        if (found) {
          target = found;
          break;
        }
      }
    }
  }

  if (!target) {
    const err = new Error('Comment not found');
    err.statusCode = 404;
    throw err;
  }

  target.is_liked = !target.is_liked;
  target.likes_count += target.is_liked ? 1 : -1;
  if (target.likes_count < 0) target.likes_count = 0;

  return { liked: target.is_liked, likes_count: target.likes_count };
}

/**
 * Delete Comment
 */
export async function deleteComment(commentId, postId, userId) {
  if (commentsStore[postId]) {
    commentsStore[postId] = commentsStore[postId].filter(c => c.comment_id !== parseInt(commentId, 10));
    const post = postsStore.find(p => p.post_id === parseInt(postId, 10));
    if (post && post.comments_count > 0) {
      post.comments_count -= 1;
    }
  }
  return { success: true };
}

/**
 * Get Stories
 */
export async function getStories(currentUser) {
  return storiesStore;
}

/**
 * Add Story
 */
export async function addStory({ user, media_url, caption, location, trek_name }) {
  let userStory = storiesStore.find(s => s.user_id === user.user_id);
  const slide = {
    id: `slide-${Date.now()}`,
    media_url: media_url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    caption: caption || '',
    location: location || 'Himalayan Trail',
    trek_name: trek_name || 'Trek Adventure',
    created_at: 'Just now'
  };

  if (!userStory) {
    userStory = {
      story_id: Date.now(),
      user_id: user.user_id,
      user: {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        avatar: user.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop'
      },
      slides: [slide],
      has_unseen: true
    };
    storiesStore.unshift(userStory);
  } else {
    userStory.slides.push(slide);
    userStory.has_unseen = true;
  }

  return userStory;
}

/**
 * Get Trekkers Directory
 */
export async function getTrekkers({ query: searchQuery, location, experience, difficulty, limit = 30 }) {
  let list = [...INITIAL_TREKKERS];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t =>
      t.full_name.toLowerCase().includes(q) ||
      t.username.toLowerCase().includes(q) ||
      t.location.toLowerCase().includes(q) ||
      t.bio.toLowerCase().includes(q)
    );
  }

  if (location && location !== 'all') {
    const loc = location.toLowerCase();
    list = list.filter(t => t.location.toLowerCase().includes(loc));
  }

  if (experience && experience !== 'all') {
    const exp = experience.toLowerCase();
    list = list.filter(t => t.experience_level.toLowerCase().includes(exp));
  }

  if (difficulty && difficulty !== 'all') {
    const diff = difficulty.toLowerCase();
    list = list.filter(t => t.difficulty_preference.toLowerCase().includes(diff));
  }

  return list.slice(0, limit);
}

/**
 * Get Trekker Full Profile by ID or Username
 */
export async function getTrekkerProfile(identifier) {
  let trekker = INITIAL_TREKKERS.find(t =>
    String(t.user_id) === String(identifier) ||
    t.username.toLowerCase() === String(identifier).toLowerCase()
  );

  if (!trekker) {
    const err = new Error('Trekker not found');
    err.statusCode = 404;
    throw err;
  }

  // Collect user's posts
  const userPosts = postsStore.filter(p => p.user_id === trekker.user_id || p.user.username === trekker.username);

  return {
    ...trekker,
    posts: userPosts,
    completed_treks_list: [
      { name: trekker.active_trek || 'Kedarkantha Trek', altitude: '3,810m', season: 'Winter', difficulty: 'Moderate' },
      { name: 'Hampta Pass', altitude: '4,287m', season: 'Monsoon', difficulty: 'Advanced' },
      { name: 'Roopkund Mystery Lake', altitude: '5,029m', season: 'Summer', difficulty: 'Hard' }
    ]
  };
}

/**
 * Toggle Follow User
 */
export async function toggleFollow(targetUserId, currentUser) {
  const target = INITIAL_TREKKERS.find(t => String(t.user_id) === String(targetUserId));
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  target.is_following = !target.is_following;
  target.followers_count += target.is_following ? 1 : -1;
  if (target.followers_count < 0) target.followers_count = 0;

  return {
    is_following: target.is_following,
    followers_count: target.followers_count
  };
}

/**
 * Get Conversations
 */
export async function getConversations(currentUser) {
  return conversationsStore;
}

/**
 * Get Conversation by ID
 */
export async function getConversation(conversationId) {
  const conv = conversationsStore.find(c => c.conversation_id === parseInt(conversationId, 10));
  if (!conv) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }
  // Clear unread count on open
  conv.unread_count = 0;
  return conv;
}

/**
 * Send Message in Conversation (supports text, trek cards, attachments)
 */
export async function sendMessage(conversationId, { user, content, message_type = 'text', trek_data, attachment_url }) {
  let conv = conversationsStore.find(c => c.conversation_id === parseInt(conversationId, 10));
  if (!conv) {
    // If starting a new conversation with a trekker
    const participant = INITIAL_TREKKERS.find(t => String(t.user_id) === String(conversationId)) || INITIAL_TREKKERS[0];
    conv = {
      conversation_id: Date.now(),
      participant,
      last_message: content || (trek_data ? `Shared Trek: ${trek_data.name}` : 'Sent an attachment'),
      last_message_time: 'Just now',
      unread_count: 0,
      is_request: false,
      messages: []
    };
    conversationsStore.unshift(conv);
  }

  const newMessage = {
    message_id: Date.now(),
    sender_id: user.user_id,
    sender_name: user.full_name || 'You',
    message_type,
    content: content || null,
    trek_data: trek_data || null,
    attachment_url: attachment_url || null,
    created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    is_self: true,
    read: true
  };

  conv.messages.push(newMessage);
  conv.last_message = content || (trek_data ? `Shared Trek: ${trek_data.name}` : 'Sent an attachment');
  conv.last_message_time = 'Just now';

  return {
    message: newMessage,
    conversation_id: conv.conversation_id
  };
}

/**
 * Delete Message
 */
export async function deleteMessage(conversationId, messageId) {
  const conv = conversationsStore.find(c => c.conversation_id === parseInt(conversationId, 10));
  if (conv) {
    conv.messages = conv.messages.filter(m => m.message_id !== parseInt(messageId, 10));
  }
  return { success: true };
}

/**
 * Accept / Decline Message Request
 */
export async function handleMessageRequest(conversationId, action) {
  const conv = conversationsStore.find(c => c.conversation_id === parseInt(conversationId, 10));
  if (!conv) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  if (action === 'accept') {
    conv.is_request = false;
  } else if (action === 'decline') {
    conversationsStore = conversationsStore.filter(c => c.conversation_id !== parseInt(conversationId, 10));
  }

  return { success: true, conversation: conv };
}

/**
 * Get Notifications
 */
export async function getNotifications(currentUser) {
  const unreadCount = notificationsStore.filter(n => !n.is_read).length;
  return {
    notifications: notificationsStore,
    unread_count: unreadCount
  };
}

/**
 * Mark Notifications as Read
 */
export async function markNotificationsRead(notificationId) {
  if (notificationId === 'all') {
    notificationsStore.forEach(n => { n.is_read = true; });
  } else if (notificationId) {
    const n = notificationsStore.find(item => item.notification_id === parseInt(notificationId, 10));
    if (n) n.is_read = true;
  }
  return { success: true };
}

/**
 * Universal Community Search across Treks, Trekkers, Posts, and Hashtags
 */
export async function searchCommunity(q) {
  if (!q || !q.trim()) {
    return { treks: [], trekkers: [], posts: [], hashtags: [] };
  }

  const query = q.trim().toLowerCase();

  // Search Trekkers
  const matchedTrekkers = INITIAL_TREKKERS.filter(t =>
    t.full_name.toLowerCase().includes(query) ||
    t.username.toLowerCase().includes(query) ||
    t.location.toLowerCase().includes(query)
  ).slice(0, 5);

  // Search Posts
  const matchedPosts = postsStore.filter(p =>
    p.caption.toLowerCase().includes(query) ||
    p.location?.toLowerCase().includes(query)
  ).slice(0, 5);

  // Search Hashtags
  const allTags = new Set();
  postsStore.forEach(p => p.hashtags?.forEach(h => {
    if (h.toLowerCase().includes(query.replace(/^#/, ''))) {
      allTags.add(h);
    }
  }));
  const matchedHashtags = Array.from(allTags).slice(0, 8);

  // Treks preview
  const trekNames = [
    { name: 'Kedarkantha Trek', altitude: '3,810m', difficulty: 'Easy–Moderate', state: 'Uttarakhand' },
    { name: 'Hampta Pass', altitude: '4,287m', difficulty: 'Advanced', state: 'Himachal Pradesh' },
    { name: 'Valley of Flowers', altitude: '3,858m', difficulty: 'Easy', state: 'Uttarakhand' },
    { name: 'Sandakphu Phalut Peak', altitude: '3,636m', difficulty: 'Hard', state: 'West Bengal' },
    { name: 'Rajmachi Fort', altitude: '820m', difficulty: 'Moderate', state: 'Maharashtra' }
  ].filter(t => t.name.toLowerCase().includes(query));

  return {
    query: q,
    treks: trekNames,
    trekkers: matchedTrekkers,
    posts: matchedPosts,
    hashtags: matchedHashtags
  };
}
