/**
 * TrekIndia — Community Service
 * Manages all community business logic: posts, stories, comments, likes, saves,
 * followers, messaging, trek sharing in chat, notifications, and discovery.
 * Dual-layered: utilizes PostgreSQL when connected and provides a fully functional,
 * persistent in-memory repository fallback.
 */

import { query, getClient } from '../config/database.js';
import messageProducer from '../kafka/producer.js';
import { createMessageSentEvent, createMessageReadEvent, createNotificationEvent } from '../kafka/schemas.js';
import wsManager from '../websocket/wsServer.js';

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
 * Search Real Registered Users from DB (DB-first with INITIAL_TREKKERS fallback)
 * Searches full_name, username, bio, city, state fields.
 * Returns only safe public profile info — never email, password, or tokens.
 */
export async function searchUsers({ searchQuery, location, experience, difficulty, limit = 30, offset = 0, currentUser }) {
  const safeLimit = Math.min(parseInt(limit, 10) || 30, 50);
  const safeOffset = parseInt(offset, 10) || 0;
  const q = searchQuery ? searchQuery.trim() : '';

  let dbUsers = [];
  let dbAvailable = false;

  try {
    // Build dynamic SQL for DB search
    const conditions = ['u.role != $1'];
    const params = ['admin'];
    let paramIdx = 2;

    if (q) {
      conditions.push(
        `(
          u.full_name ILIKE $${paramIdx} OR
          u.username ILIKE $${paramIdx} OR
          u.bio ILIKE $${paramIdx} OR
          u.city ILIKE $${paramIdx} OR
          u.state ILIKE $${paramIdx}
        )`
      );
      params.push(`%${q}%`);
      paramIdx++;
    }

    // Location filter — maps to city or state
    if (location && location !== 'all') {
      const locClean = location.toLowerCase();
      // Handle special cases from dropdown options
      const locMap = {
        pune: ['pune', 'maharashtra'],
        manali: ['manali', 'himachal'],
        dehradun: ['dehradun', 'uttarakhand'],
        bengaluru: ['bengaluru', 'bangalore', 'karnataka'],
        leh: ['leh', 'ladakh']
      };
      const locTerms = locMap[locClean] || [locClean];
      const locConditions = locTerms.map((term, i) => {
        params.push(`%${term}%`);
        const idx = paramIdx + i;
        return `(u.city ILIKE $${idx} OR u.state ILIKE $${idx})`;
      });
      paramIdx += locTerms.length;
      conditions.push(`(${locConditions.join(' OR ')})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ── Step 1: Simple reliable base query — no complex subqueries that may fail ──
    const baseSql = `
      SELECT
        u.user_id,
        u.username,
        u.full_name,
        u.profile_image,
        u.bio,
        u.city,
        u.state,
        u.is_verified,
        u.online_status,
        u.created_at
      FROM users u
      ${whereClause}
      ORDER BY
        CASE WHEN u.is_verified THEN 0 ELSE 1 END,
        u.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(safeLimit + 10, safeOffset); // fetch extra to allow filtering

    const result = await query(baseSql, params);
    dbAvailable = true;

    const currentUserId = currentUser?.user_id;

    // ── Step 2: Optional enrichment — follower counts etc. separate try-catch ──
    // If community_follows / user_treks tables don't exist yet, this just silently skips.
    let followerCounts = {};
    let followingByCurrentUser = new Set();
    try {
      if (result.rows.length > 0) {
        const userIds = result.rows.map(r => parseInt(r.user_id, 10));
        const followerRes = await query(
          `SELECT following_id, COUNT(*) AS cnt
           FROM community_follows
           WHERE following_id = ANY($1::int[])
           GROUP BY following_id`,
          [userIds]
        );
        followerRes.rows.forEach(r => {
          followerCounts[String(r.following_id)] = parseInt(r.cnt, 10);
        });
        if (currentUserId) {
          const followingRes = await query(
            `SELECT following_id FROM community_follows WHERE follower_id = $1 AND following_id = ANY($2::int[])`,
            [currentUserId, userIds]
          );
          followingRes.rows.forEach(r => followingByCurrentUser.add(String(r.following_id)));
        }
      }
    } catch (_enrichErr) {
      // Stats tables not ready — safe to ignore, users still appear with default values
    }

    dbUsers = result.rows
      .filter(row => !currentUserId || String(row.user_id) !== String(currentUserId))
      .map(row => {
        const isOnline = wsManager.isUserOnline(row.user_id);
        const seeded = INITIAL_TREKKERS.find(t => String(t.user_id) === String(row.user_id));
        const uid = String(row.user_id);
        return {
          user_id: parseInt(row.user_id, 10),
          username: row.username,
          full_name: row.full_name,
          avatar: row.profile_image || seeded?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.full_name || row.username)}&background=3a7d44&color=fff&size=150`,
          cover_image: seeded?.cover_image || null,
          bio: row.bio || seeded?.bio || '',
          location: [row.city, row.state].filter(Boolean).join(', ') || seeded?.location || 'India',
          experience_level: seeded?.experience_level || 'Explorer',
          difficulty_preference: seeded?.difficulty_preference || 'Moderate',
          treks_completed: seeded?.treks_completed || 0,
          highest_altitude: seeded?.highest_altitude || null,
          states_explored: seeded?.states_explored || null,
          followers_count: followerCounts[uid] || seeded?.followers_count || 0,
          following_count: seeded?.following_count || 0,
          posts_count: seeded?.posts_count || 0,
          is_verified: row.is_verified || false,
          is_following: followingByCurrentUser.has(uid) || seeded?.is_following || false,
          active_trek: seeded?.active_trek || null,
          online_status: isOnline ? 'online' : (row.online_status || 'offline'),
          last_active: isOnline ? 'Active now' : 'Recently',
          _is_db_user: true
        };
      });

  } catch (err) {
    console.warn('[Community Service] searchUsers DB error, falling back to in-memory:', err.message);
    dbAvailable = false;
  }

  // Merge DB results with INITIAL_TREKKERS (curated demo trekkers)
  // DB users take priority; INITIAL_TREKKERS fill in the rest
  const dbUserIds = new Set(dbUsers.map(u => String(u.user_id)));
  const currentUserId = currentUser?.user_id;

  let inMemory = INITIAL_TREKKERS.filter(t => {
    if (String(t.user_id) === String(currentUserId)) return false; // exclude self
    if (dbUserIds.has(String(t.user_id))) return false; // already in DB results
    if (q) {
      const qLower = q.toLowerCase();
      return (
        t.full_name.toLowerCase().includes(qLower) ||
        t.username.toLowerCase().includes(qLower) ||
        t.location.toLowerCase().includes(qLower) ||
        (t.bio && t.bio.toLowerCase().includes(qLower))
      );
    }
    return true;
  });

  // Apply location filter on in-memory results
  if (location && location !== 'all') {
    const loc = location.toLowerCase();
    inMemory = inMemory.filter(t => t.location.toLowerCase().includes(loc));
  }

  // Apply experience filter on in-memory results
  if (experience && experience !== 'all') {
    const exp = experience.toLowerCase();
    inMemory = inMemory.filter(t => t.experience_level.toLowerCase().includes(exp));
  }

  // Apply difficulty filter on in-memory results
  if (difficulty && difficulty !== 'all') {
    const diff = difficulty.toLowerCase();
    inMemory = inMemory.filter(t => t.difficulty_preference.toLowerCase().includes(diff));
  }

  const merged = [...dbUsers, ...inMemory];
  return merged.slice(0, safeLimit);
}

/**
 * Get Trekkers Directory (now uses searchUsers() for real DB integration)
 */
export async function getTrekkers({ query: searchQuery, location, experience, difficulty, limit = 30 }) {
  return searchUsers({ searchQuery, location, experience, difficulty, limit });
}

/**
 * Get Trekker Full Profile by ID or Username
 * Queries PostgreSQL database first, falls back to INITIAL_TREKKERS
 */
export async function getTrekkerProfile(identifier, currentUser) {
  if (!identifier) {
    const err = new Error('Trekker identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const isNumeric = /^\d+$/.test(String(identifier).trim());
  let trekker = null;

  // 1. Try querying PostgreSQL database
  try {
    const userQuery = isNumeric
      ? `SELECT u.user_id, u.username, u.full_name, u.profile_image, u.bio, u.city, u.state,
                u.is_verified, u.online_status, u.created_at,
                up.cover_image, up.location AS profile_location,
                COALESCE((SELECT COUNT(*) FROM user_treks ut WHERE ut.user_id = u.user_id AND ut.status = 'completed'), 0) AS treks_completed,
                COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.following_id = u.user_id), 0) AS followers_count,
                COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.follower_id = u.user_id), 0) AS following_count
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.user_id = $1 LIMIT 1`
      : `SELECT u.user_id, u.username, u.full_name, u.profile_image, u.bio, u.city, u.state,
                u.is_verified, u.online_status, u.created_at,
                up.cover_image, up.location AS profile_location,
                COALESCE((SELECT COUNT(*) FROM user_treks ut WHERE ut.user_id = u.user_id AND ut.status = 'completed'), 0) AS treks_completed,
                COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.following_id = u.user_id), 0) AS followers_count,
                COALESCE((SELECT COUNT(*) FROM community_follows cf WHERE cf.follower_id = u.user_id), 0) AS following_count
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE LOWER(u.username) = LOWER($1) LIMIT 1`;

    const res = await query(userQuery, [String(identifier).trim()]);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      const isOnline = wsManager.isUserOnline(row.user_id);
      const seeded = INITIAL_TREKKERS.find(t => String(t.user_id) === String(row.user_id) || t.username.toLowerCase() === row.username.toLowerCase());

      // Check if currentUser is following this user
      let isFollowing = false;
      if (currentUser?.user_id) {
        const followCheck = await query(
          `SELECT 1 FROM community_follows WHERE follower_id = $1 AND following_id = $2`,
          [currentUser.user_id, row.user_id]
        );
        isFollowing = followCheck.rows.length > 0;
      }

      trekker = {
        user_id: parseInt(row.user_id, 10),
        username: row.username,
        full_name: row.full_name,
        avatar: row.profile_image || seeded?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.full_name || row.username)}&background=3a7d44&color=fff&size=150`,
        cover_image: row.cover_image || seeded?.cover_image || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200',
        bio: row.bio || seeded?.bio || 'TrekIndia Explorer.',
        location: [row.city, row.state].filter(Boolean).join(', ') || seeded?.location || 'India',
        experience_level: seeded?.experience_level || 'Explorer',
        difficulty_preference: seeded?.difficulty_preference || 'Moderate',
        treks_completed: parseInt(row.treks_completed, 10) || seeded?.treks_completed || 0,
        highest_altitude: seeded?.highest_altitude || '3,800 m',
        states_explored: seeded?.states_explored || 3,
        followers_count: parseInt(row.followers_count, 10) || seeded?.followers_count || 0,
        following_count: parseInt(row.following_count, 10) || seeded?.following_count || 0,
        is_verified: row.is_verified || false,
        is_following: isFollowing || seeded?.is_following || false,
        active_trek: seeded?.active_trek || null,
        online_status: isOnline ? 'online' : (row.online_status || 'offline'),
        last_active: isOnline ? 'Active now' : 'Recently'
      };
    }
  } catch (err) {
    console.warn('[Community Service] getTrekkerProfile DB error:', err.message);
  }

  // 2. Fall back to INITIAL_TREKKERS if not found in DB
  if (!trekker) {
    trekker = INITIAL_TREKKERS.find(t =>
      String(t.user_id) === String(identifier) ||
      t.username.toLowerCase() === String(identifier).toLowerCase()
    );
  }

  if (!trekker) {
    const err = new Error('Trekker not found');
    err.statusCode = 404;
    throw err;
  }

  // Collect user's posts
  const userPosts = postsStore.filter(p => String(p.user_id) === String(trekker.user_id) || p.user?.username?.toLowerCase() === trekker.username.toLowerCase());

  // Completed treks list
  const completedTreks = [
    { name: trekker.active_trek || 'Kedarkantha Trek', altitude: '3,810m', season: 'Winter', difficulty: 'Moderate', state: 'Uttarakhand' },
    { name: 'Hampta Pass', altitude: '4,287m', season: 'Monsoon', difficulty: 'Advanced', state: 'Himachal Pradesh' },
    { name: 'Roopkund Mystery Lake', altitude: '5,029m', season: 'Summer', difficulty: 'Hard', state: 'Uttarakhand' }
  ];

  return {
    ...trekker,
    posts_count: userPosts.length,
    posts: userPosts,
    completed_treks_list: completedTreks
  };
}

/**
 * Toggle Follow User
 * Handles both DB persistence via community_follows and INITIAL_TREKKERS memory state
 */
export async function toggleFollow(targetUserId, currentUser) {
  const currentId = currentUser?.user_id;
  const targetId = parseInt(targetUserId, 10);

  if (currentId && String(currentId) === String(targetId)) {
    const err = new Error('You cannot follow yourself');
    err.statusCode = 400;
    throw err;
  }

  let isFollowing = false;
  let followersCount = 0;

  // 1. Check in-memory INITIAL_TREKKERS
  const targetInitial = INITIAL_TREKKERS.find(t => String(t.user_id) === String(targetUserId));
  if (targetInitial) {
    targetInitial.is_following = !targetInitial.is_following;
    targetInitial.followers_count += targetInitial.is_following ? 1 : -1;
    if (targetInitial.followers_count < 0) targetInitial.followers_count = 0;
    isFollowing = targetInitial.is_following;
    followersCount = targetInitial.followers_count;
  }

  // 2. Persist in DB if logged in and target user is a valid numeric ID
  if (currentId && !isNaN(targetId)) {
    try {
      await ensureSeedTrekkersInDb();

      const existingFollow = await query(
        `SELECT id FROM community_follows WHERE follower_id = $1 AND following_id = $2`,
        [currentId, targetId]
      );

      if (existingFollow.rows.length > 0) {
        // Unfollow
        await query(
          `DELETE FROM community_follows WHERE follower_id = $1 AND following_id = $2`,
          [currentId, targetId]
        );
        isFollowing = false;
      } else {
        // Follow
        await query(
          `INSERT INTO community_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [currentId, targetId]
        );
        isFollowing = true;

        // Send notification event
        try {
          await query(
            `INSERT INTO notifications (user_id, actor_id, type, title, message)
             VALUES ($1, $2, 'follow', 'New Follower', $3)`,
            [targetId, currentId, `${currentUser.full_name || currentUser.username} started following your trek journal.`]
          );
        } catch (_) {}
      }

      // Get updated followers count
      const countRes = await query(
        `SELECT COUNT(*) FROM community_follows WHERE following_id = $1`,
        [targetId]
      );
      followersCount = parseInt(countRes.rows[0].count, 10);
      if (targetInitial) targetInitial.followers_count = followersCount;

    } catch (err) {
      console.warn('[Community Service] toggleFollow DB warning:', err.message);
    }
  }

  return {
    is_following: isFollowing,
    followers_count: followersCount
  };
}

/**
 * Helper: Ensure test trekkers exist in the database users table so conversations reference valid foreign keys
 */
async function ensureSeedTrekkersInDb() {
  try {
    for (const t of INITIAL_TREKKERS) {
      await query(
        `INSERT INTO users (user_id, username, email, password_hash, full_name, profile_image, bio, city, state, is_verified, role, online_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'user', $11)
         ON CONFLICT (user_id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           profile_image = EXCLUDED.profile_image,
           bio = EXCLUDED.bio,
           online_status = EXCLUDED.online_status`,
        [
          t.user_id,
          t.username,
          `${t.username}@trekindia.com`,
          '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforseedusers1234567890',
          t.full_name,
          t.avatar,
          t.bio,
          t.location.split(',')[0]?.trim() || 'Pune',
          t.location.split(',')[1]?.trim() || 'Maharashtra',
          t.is_verified,
          t.online_status || 'offline'
        ]
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('[Community Service] Seed users notice:', err.message);
  }
}

/**
 * Helper: Ensure starter conversations exist for a user in DB
 */
async function ensureUserStarterConversations(userId) {
  try {
    await ensureSeedTrekkersInDb();

    // Check if user has any conversations
    const existing = await query(
      `SELECT cp.conversation_id FROM conversation_participants cp WHERE cp.user_id = $1 LIMIT 1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      // Seed default conversation with Rahul Sharma (user_id: 101)
      const convRes = await query(
        `INSERT INTO conversations (is_group, last_message_text, last_message_at)
         VALUES (FALSE, 'That route looks intense! Let''s do it.', CURRENT_TIMESTAMP)
         RETURNING conversation_id`
      );

      const convId = convRes.rows[0].conversation_id;

      // Add user and Rahul Sharma
      await query(
        `INSERT INTO conversation_participants (conversation_id, user_id, status)
         VALUES ($1, $2, 'accepted'), ($1, 101, 'accepted')
         ON CONFLICT DO NOTHING`,
        [convId, userId]
      );

      // Add starter messages
      await query(
        `INSERT INTO messages (conversation_id, sender_id, message_type, content, trek_data, status, created_at)
         VALUES
         ($1, 101, 'text', 'Hey! Thinking about doing the Sandakphu trek next month. Have you seen this route?', NULL, 'read', CURRENT_TIMESTAMP - INTERVAL '15 minutes'),
         ($1, 101, 'trek_card', NULL, $2, 'read', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
         ($1, $3, 'text', 'That route looks intense! Let''s do it.', NULL, 'read', CURRENT_TIMESTAMP - INTERVAL '5 minutes')`,
        [
          convId,
          JSON.stringify({
            name: 'Sandakphu Phalut Peak',
            slug: 'sandakphu-phalut',
            difficulty: 'HARD',
            elevation: '3,636m',
            distance: '46 km',
            duration: '6 Days',
            state: 'West Bengal',
            image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&q=80'
          }),
          userId
        ]
      );
    }
  } catch (err) {
    console.warn('[Community Service] Seed conversation notice:', err.message);
  }
}

/**
 * Get Conversations for Current User
 * Retrieves real conversations from PostgreSQL database, calculates unread counts,
 * and attaches real-time presence indicators.
 */
export async function getConversations(currentUser) {
  if (!currentUser?.user_id) return [];

  const userId = currentUser.user_id;
  await ensureUserStarterConversations(userId);

  try {
    const convSql = `
      SELECT
        c.conversation_id,
        c.is_group,
        c.group_name,
        c.group_avatar,
        c.last_message_at,
        c.last_message_text,
        cp.last_read_at,
        cp.status AS membership_status,
        -- Other participant details (for 1-on-1 direct conversations)
        other_u.user_id AS participant_id,
        other_u.full_name AS participant_name,
        other_u.username AS participant_username,
        other_u.profile_image AS participant_avatar,
        other_u.online_status AS participant_db_online,
        other_u.last_seen_at AS participant_last_seen,
        -- Calculate unread messages count
        COALESCE(
          (SELECT COUNT(*) FROM messages m
           WHERE m.conversation_id = c.conversation_id
             AND m.sender_id != $1
             AND m.created_at > cp.last_read_at
             AND m.is_deleted = FALSE), 0
        ) AS unread_count,
        -- Get latest message details
        latest_m.content AS latest_message_content,
        latest_m.message_type AS latest_message_type,
        latest_m.trek_data AS latest_message_trek_data,
        latest_m.created_at AS latest_message_created_at
      FROM conversation_participants cp
      JOIN conversations c ON cp.conversation_id = c.conversation_id
      -- Join to find other participant in direct conversation
      LEFT JOIN conversation_participants other_cp
        ON other_cp.conversation_id = c.conversation_id AND other_cp.user_id != $1
      LEFT JOIN users other_u
        ON other_cp.user_id = other_u.user_id
      -- Join latest message
      LEFT JOIN LATERAL (
        SELECT content, message_type, trek_data, created_at
        FROM messages
        WHERE conversation_id = c.conversation_id AND is_deleted = FALSE
        ORDER BY created_at DESC LIMIT 1
      ) latest_m ON TRUE
      WHERE cp.user_id = $1
      ORDER BY COALESCE(latest_m.created_at, c.last_message_at, c.created_at) DESC;
    `;

    const res = await query(convSql, [userId]);

    return res.rows.map(row => {
      const isOnline = row.participant_id ? wsManager.isUserOnline(row.participant_id) : false;
      const initialTrekker = INITIAL_TREKKERS.find(t => String(t.user_id) === String(row.participant_id));

      let lastMessagePreview = row.latest_message_content || row.last_message_text || '';
      if (!lastMessagePreview && row.latest_message_type === 'trek_card') {
        lastMessagePreview = `Shared Trek: ${row.latest_message_trek_data?.name || 'Trek'}`;
      } else if (!lastMessagePreview && row.latest_message_type === 'image') {
        lastMessagePreview = '📷 Photo';
      }

      // Format last message time
      let lastMsgTime = '';
      const msgDate = row.latest_message_created_at || row.last_message_at;
      if (msgDate) {
        const d = new Date(msgDate);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
          lastMsgTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          lastMsgTime = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
      }

      return {
        conversation_id: parseInt(row.conversation_id, 10),
        is_group: row.is_group,
        is_request: row.membership_status === 'pending',
        unread_count: parseInt(row.unread_count, 10),
        last_message: lastMessagePreview,
        last_message_time: lastMsgTime,
        last_message_at: msgDate,
        participant: {
          user_id: row.participant_id ? parseInt(row.participant_id, 10) : null,
          full_name: row.participant_name || initialTrekker?.full_name || 'Trekker',
          username: row.participant_username || initialTrekker?.username || 'trekker',
          avatar: row.participant_avatar || initialTrekker?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          online_status: isOnline ? 'online' : (row.participant_db_online || 'offline'),
          active_trek: initialTrekker?.active_trek || null,
          last_active: isOnline ? 'Active now' : 'Offline'
        }
      };
    });
  } catch (err) {
    console.error('[Community Service] getConversations error:', err);
    return [];
  }
}

/**
 * Get Conversation by ID with Full Message History
 * Automatically marks unread messages as read and publishes Kafka read event.
 */
export async function getConversation(conversationId, currentUser) {
  const convId = parseInt(conversationId, 10);
  const userId = currentUser?.user_id;

  try {
    // 1. Check conversation exists and user is participant
    const partRes = await query(
      `SELECT cp.status, cp.last_read_at
       FROM conversation_participants cp
       WHERE cp.conversation_id = $1 AND cp.user_id = $2`,
      [convId, userId]
    );

    if (partRes.rows.length === 0) {
      // Check if user is trying to open chat with a trekker ID directly
      const directConv = await getOrCreateDirectConversation(userId, convId);
      if (directConv) {
        return getConversation(directConv.conversation_id, currentUser);
      }

      const err = new Error('Conversation not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    // 2. Fetch other participant details
    const otherUserRes = await query(
      `SELECT u.user_id, u.full_name, u.username, u.profile_image, u.online_status, u.last_seen_at
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.user_id
       WHERE cp.conversation_id = $1 AND cp.user_id != $2
       LIMIT 1`,
      [convId, userId]
    );

    const otherUser = otherUserRes.rows[0] || {};
    const isOnline = otherUser.user_id ? wsManager.isUserOnline(otherUser.user_id) : false;
    const initialTrekker = INITIAL_TREKKERS.find(t => String(t.user_id) === String(otherUser.user_id));

    // 3. Fetch messages ordered by created_at ASC
    const msgRes = await query(
      `SELECT m.message_id, m.conversation_id, m.sender_id, m.message_type,
              m.content, m.trek_data, m.attachment_url, m.status, m.client_message_id,
              m.created_at, u.full_name AS sender_name, u.profile_image AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
       ORDER BY m.created_at ASC`,
      [convId]
    );

    const messages = msgRes.rows.map(m => {
      const isSelf = String(m.sender_id) === String(userId);
      const createdDate = new Date(m.created_at);
      return {
        message_id: parseInt(m.message_id, 10),
        conversation_id: convId,
        sender_id: parseInt(m.sender_id, 10),
        sender_name: m.sender_name,
        avatar: m.sender_avatar || (isSelf ? currentUser?.profile_image : initialTrekker?.avatar),
        message_type: m.message_type,
        content: m.content,
        trek_data: m.trek_data,
        attachment_url: m.attachment_url,
        status: m.status || 'sent',
        created_at: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        raw_created_at: m.created_at,
        is_self: isSelf,
        client_message_id: m.client_message_id
      };
    });

    // 4. Mark unread messages as read in DB
    const unreadMessageIds = messages
      .filter(m => !m.is_self && m.status !== 'read')
      .map(m => m.message_id);

    if (unreadMessageIds.length > 0) {
      await query(
        `UPDATE messages SET status = 'read', read_at = CURRENT_TIMESTAMP
         WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'`,
        [convId, userId]
      ).catch(() => {});

      await query(
        `UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP
         WHERE conversation_id = $1 AND user_id = $2`,
        [convId, userId]
      ).catch(() => {});

      // Publish message.read event to Kafka (or direct fallback)
      const readEvent = createMessageReadEvent({
        conversation_id: convId,
        reader_id: userId,
        message_ids: unreadMessageIds
      });
      const published = await messageProducer.publishMessageEvent(readEvent);
      if (!published) {
        wsManager.broadcastToConversationParticipants(
          convId,
          {
            type: 'message.read_receipt',
            conversation_id: convId,
            reader_id: userId,
            message_ids: unreadMessageIds,
            read_at: new Date().toISOString()
          },
          userId
        );
      }
    }

    return {
      conversation_id: convId,
      unread_count: 0,
      is_request: partRes.rows[0].status === 'pending',
      participant: {
        user_id: otherUser.user_id ? parseInt(otherUser.user_id, 10) : null,
        full_name: otherUser.full_name || initialTrekker?.full_name || 'Trekker',
        username: otherUser.username || initialTrekker?.username || 'trekker',
        avatar: otherUser.profile_image || initialTrekker?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        online_status: isOnline ? 'online' : (otherUser.online_status || 'offline'),
        active_trek: initialTrekker?.active_trek || null,
        last_active: isOnline ? 'Active now' : 'Offline'
      },
      messages
    };
  } catch (err) {
    console.error('[Community Service] getConversation error:', err);
    throw err;
  }
}

/**
 * Get or Create a 1-on-1 Direct Conversation Between Two Users
 */
export async function getOrCreateDirectConversation(userIdA, userIdB) {
  const uidA = parseInt(userIdA, 10);
  const uidB = parseInt(userIdB, 10);

  if (uidA === uidB) {
    throw new Error('Cannot start conversation with yourself');
  }

  await ensureSeedTrekkersInDb();

  // Find existing 1-on-1 conversation
  const existingSql = `
    SELECT cp1.conversation_id
    FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN conversations c ON cp1.conversation_id = c.conversation_id
    WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.is_group = FALSE
    LIMIT 1;
  `;

  const existingRes = await query(existingSql, [uidA, uidB]);
  if (existingRes.rows.length > 0) {
    return { conversation_id: parseInt(existingRes.rows[0].conversation_id, 10) };
  }

  // Create new conversation
  const convRes = await query(
    `INSERT INTO conversations (is_group, last_message_at)
     VALUES (FALSE, CURRENT_TIMESTAMP)
     RETURNING conversation_id`
  );

  const newConvId = parseInt(convRes.rows[0].conversation_id, 10);

  await query(
    `INSERT INTO conversation_participants (conversation_id, user_id, status)
     VALUES ($1, $2, 'accepted'), ($1, $3, 'accepted')`,
    [newConvId, uidA, uidB]
  );

  return { conversation_id: newConvId };
}

/**
 * Send Message in Conversation (POST / messaging API)
 * Flow: Validate -> Save to DB -> Publish Kafka message.sent event -> Return persisted message
 */
export async function sendMessage(conversationId, { user, content, message_type = 'text', trek_data, attachment_url, client_message_id }) {
  let convId = parseInt(conversationId, 10);
  const userId = user?.user_id;

  if (!userId) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  // Check if conversation exists
  let partRes = await query(
    `SELECT conversation_id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [convId, userId]
  );

  // If not found, perhaps client passed a trekker user_id to start a new chat
  if (partRes.rows.length === 0) {
    const direct = await getOrCreateDirectConversation(userId, convId);
    convId = direct.conversation_id;
  }

  // Check for duplicate / idempotent submission
  if (client_message_id) {
    const dupRes = await query(
      `SELECT message_id, conversation_id, sender_id, message_type, content, trek_data, attachment_url, status, created_at
       FROM messages WHERE client_message_id = $1 LIMIT 1`,
      [client_message_id]
    );
    if (dupRes.rows.length > 0) {
      return {
        message: dupRes.rows[0],
        conversation_id: convId
      };
    }
  }

  // 1. Insert message into PostgreSQL database
  const insertSql = `
    INSERT INTO messages (
      conversation_id, sender_id, message_type, content,
      trek_data, attachment_url, client_message_id, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent')
    RETURNING message_id, conversation_id, sender_id, message_type,
              content, trek_data, attachment_url, status, client_message_id, created_at;
  `;

  const msgRes = await query(insertSql, [
    convId,
    userId,
    message_type,
    content || null,
    trek_data ? JSON.stringify(trek_data) : null,
    attachment_url || null,
    client_message_id || null
  ]);

  const insertedMessage = msgRes.rows[0];

  // 2. Update conversation last message timestamp & snippet
  const snippet = content || (trek_data ? `Shared Trek: ${trek_data.name}` : 'Sent an attachment');
  await query(
    `UPDATE conversations
     SET last_message_at = CURRENT_TIMESTAMP, last_message_text = $1, last_message_sender_id = $2
     WHERE conversation_id = $3`,
    [snippet, userId, convId]
  );

  // 3. Find receiver id for 1-on-1 chat
  const receiverRes = await query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2 LIMIT 1`,
    [convId, userId]
  );
  const receiverId = receiverRes.rows[0]?.user_id || null;

  // 4. Publish message.sent event to Kafka with conversation_id partition key
  const kafkaEvent = createMessageSentEvent({
    message_id: insertedMessage.message_id,
    conversation_id: convId,
    sender_id: userId,
    receiver_id: receiverId,
    sender_name: user.full_name || user.username || 'You',
    sender_avatar: user.profile_image || null,
    content: insertedMessage.content,
    message_type: insertedMessage.message_type,
    trek_data: insertedMessage.trek_data,
    attachment_url: insertedMessage.attachment_url,
    client_message_id: insertedMessage.client_message_id,
    created_at: insertedMessage.created_at
  });

  const published = await messageProducer.publishMessageEvent(kafkaEvent);
  if (!published) {
    // Deliver directly via WebSocket and DB notification when Kafka is offline
    await dispatchDirectMessageFallback(kafkaEvent);
  }

  const formattedCreated = new Date(insertedMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    message: {
      ...insertedMessage,
      message_id: parseInt(insertedMessage.message_id, 10),
      conversation_id: convId,
      sender_id: parseInt(insertedMessage.sender_id, 10),
      sender_name: user.full_name || 'You',
      avatar: user.profile_image || null,
      created_at: formattedCreated,
      raw_created_at: insertedMessage.created_at,
      is_self: true,
      read: true
    },
    conversation_id: convId
  };
}

/**
 * Mark Conversation as Read
 */
export async function markConversationRead(conversationId, currentUser) {
  const convId = parseInt(conversationId, 10);
  const userId = currentUser?.user_id;
  if (!userId) return { success: false };

  await query(
    `UPDATE messages SET status = 'read', read_at = CURRENT_TIMESTAMP
     WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'`,
    [convId, userId]
  ).catch(() => {});

  await query(
    `UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP
     WHERE conversation_id = $1 AND user_id = $2`,
    [convId, userId]
  ).catch(() => {});

  const readEvent = createMessageReadEvent({
    conversation_id: convId,
    reader_id: userId
  });
  const published = await messageProducer.publishMessageEvent(readEvent);
  if (!published) {
    wsManager.broadcastToConversationParticipants(
      convId,
      {
        type: 'message.read_receipt',
        conversation_id: convId,
        reader_id: userId,
        message_ids: [],
        read_at: new Date().toISOString()
      },
      userId
    );
  }

  return { success: true, conversation_id: convId };
}

/**
 * Delete Message
 */
export async function deleteMessage(conversationId, messageId, currentUser) {
  const convId = parseInt(conversationId, 10);
  const msgId = parseInt(messageId, 10);
  const userId = currentUser?.user_id;

  await query(
    `UPDATE messages SET is_deleted = TRUE
     WHERE message_id = $1 AND conversation_id = $2 AND sender_id = $3`,
    [msgId, convId, userId]
  );

  return { success: true };
}

/**
 * Accept / Decline Message Request
 */
export async function handleMessageRequest(conversationId, action, currentUser) {
  const convId = parseInt(conversationId, 10);
  const userId = currentUser?.user_id;

  if (action === 'accept') {
    await query(
      `UPDATE conversation_participants SET status = 'accepted'
       WHERE conversation_id = $1 AND user_id = $2`,
      [convId, userId]
    );
  } else if (action === 'decline') {
    await query(
      `UPDATE conversation_participants SET status = 'declined'
       WHERE conversation_id = $1 AND user_id = $2`,
      [convId, userId]
    );
  }

  return { success: true, conversation_id: convId };
}

/**
 * Get Total Unread Messages Count across all conversations
 */
export async function getUnreadMessagesCount(currentUser) {
  const userId = currentUser?.user_id;
  if (!userId) return { count: 0 };

  try {
    const res = await query(
      `SELECT COUNT(m.message_id) AS unread_count
       FROM messages m
       JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
       WHERE cp.user_id = $1
         AND m.sender_id != $1
         AND m.created_at > cp.last_read_at
         AND m.is_deleted = FALSE`,
      [userId]
    );
    return { count: parseInt(res.rows[0]?.unread_count || 0, 10) };
  } catch (err) {
    return { count: 0 };
  }
}

/**
 * Get Notifications from DB
 */
export async function getNotifications(currentUser) {
  const userId = currentUser?.user_id;
  if (!userId) return { notifications: [], unread_count: 0 };

  try {
    const res = await query(
      `SELECT n.notification_id, n.type, n.title, n.message, n.reference_id,
              n.reference_type, n.is_read, n.created_at,
              u.full_name AS actor_name, u.profile_image AS actor_avatar
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.user_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [userId]
    );

    const notifications = res.rows.map(n => ({
      notification_id: n.notification_id,
      type: n.type,
      title: n.title,
      message: n.message,
      reference_id: n.reference_id,
      reference_type: n.reference_type,
      is_read: n.is_read,
      time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actor: {
        name: n.actor_name || 'Trekker',
        avatar: n.actor_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
      }
    }));

    const unreadCount = notifications.filter(n => !n.is_read).length;
    return { notifications, unread_count: unreadCount };
  } catch (err) {
    console.warn('[Community Service] getNotifications error:', err);
    return { notifications: [], unread_count: 0 };
  }
}

/**
 * Mark Notifications as Read
 */
export async function markNotificationsRead(notificationId, currentUser) {
  const userId = currentUser?.user_id;
  if (!userId) return { success: false };

  try {
    if (notificationId === 'all') {
      await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);
    } else if (notificationId) {
      await query(`UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2`, [notificationId, userId]);
    }
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

/**
 * Universal Community Search across Treks, Trekkers, Posts, and Hashtags
 * Searches real registered users from the database.
 */
export async function searchCommunity(q) {
  if (!q || !q.trim()) {
    return { treks: [], trekkers: [], posts: [], hashtags: [] };
  }

  const queryStr = q.trim().toLowerCase();

  // Search real users from DB + INITIAL_TREKKERS
  const matchedTrekkers = await searchUsers({ searchQuery: q.trim(), limit: 5 });

  // Search Posts
  const matchedPosts = postsStore.filter(p =>
    p.caption.toLowerCase().includes(queryStr) ||
    p.location?.toLowerCase().includes(queryStr)
  ).slice(0, 5);

  // Search Hashtags
  const allTags = new Set();
  postsStore.forEach(p => p.hashtags?.forEach(h => {
    if (h.toLowerCase().includes(queryStr.replace(/^#/, ''))) {
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
  ].filter(t => t.name.toLowerCase().includes(queryStr));

  return {
    query: q,
    treks: trekNames,
    trekkers: matchedTrekkers,
    posts: matchedPosts,
    hashtags: matchedHashtags
  };
}

/**
 * Direct WebSocket and notification fallback when Kafka KRaft broker is offline
 */
async function dispatchDirectMessageFallback(kafkaEvent) {
  try {
    const { payload } = kafkaEvent;
    const {
      message_id,
      conversation_id,
      sender_id,
      receiver_id,
      sender_name,
      sender_avatar,
      content,
      message_type,
      trek_data,
      attachment_url,
      created_at,
      client_message_id
    } = payload;

    const res = await query(
      `SELECT cp.user_id, u.full_name, u.profile_image
       FROM conversation_participants cp
       JOIN users u ON cp.user_id = u.user_id
       WHERE cp.conversation_id = $1`,
      [conversation_id]
    ).catch(() => ({ rows: [] }));

    const participants = res.rows && res.rows.length > 0 ? res.rows : [
      { user_id: sender_id, full_name: sender_name, profile_image: sender_avatar },
      ...(receiver_id ? [{ user_id: receiver_id, full_name: '', profile_image: null }] : [])
    ];

    let deliveredToAnyReceiver = false;

    for (const participant of participants) {
      const participantId = String(participant.user_id);
      const isSender = participantId === String(sender_id);

      const wsPayload = {
        type: 'message.new',
        message: {
          message_id: parseInt(message_id, 10),
          conversation_id: parseInt(conversation_id, 10),
          sender_id: parseInt(sender_id, 10),
          sender_name,
          sender_avatar,
          content,
          message_type,
          trek_data,
          attachment_url,
          status: isSender ? 'sent' : 'delivered',
          created_at,
          is_self: isSender,
          client_message_id
        }
      };

      const wasDelivered = wsManager.sendToUser(participantId, wsPayload);

      if (!isSender) {
        if (wasDelivered) {
          deliveredToAnyReceiver = true;
        } else {
          try {
            const title = `New message from ${sender_name}`;
            const snippet = content && content.length > 80 ? content.substring(0, 77) + '...' : (content || (trek_data ? `Shared Trek: ${trek_data.name}` : 'Sent an attachment'));
            await query(
              `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, reference_type)
               VALUES ($1, $2, 'message', $3, $4, $5, 'conversation')`,
              [participantId, sender_id, title, snippet, conversation_id]
            ).catch(() => {});
          } catch (_) {}
        }
      }
    }

    if (deliveredToAnyReceiver) {
      await query(
        `UPDATE messages SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
         WHERE message_id = $1 AND status = 'sent'`,
        [message_id]
      ).catch(() => {});

      wsManager.sendToUser(String(sender_id), {
        type: 'message.status_update',
        conversation_id: parseInt(conversation_id, 10),
        message_id: parseInt(message_id, 10),
        status: 'delivered',
        client_message_id
      });
    }
  } catch (err) {
    console.warn('[Direct Fallback] Dispatch notice:', err.message);
  }
}

