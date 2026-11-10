-- Migration 009: Clean confirmed testing, dummy, and seed data
-- Preserves all legitimate users, their genuine posts, and genuine conversations.

DO $$
DECLARE
    test_user_ids BIGINT[] := ARRAY[2, 3, 5, 10, 11, 26, 27, 101, 102, 103, 104, 105, 106, 107]::BIGINT[];
    test_conv_ids BIGINT[];
BEGIN
    -- 1. Identify all conversations involving any test/seed user
    SELECT COALESCE(ARRAY_AGG(DISTINCT conversation_id), ARRAY[]::BIGINT[])
    INTO test_conv_ids
    FROM conversation_participants
    WHERE user_id = ANY(test_user_ids);

    -- Also append orphan test conversations (conversations with 0 participants or audit test texts)
    SELECT COALESCE(ARRAY_AGG(DISTINCT conversation_id), ARRAY[]::BIGINT[]) || test_conv_ids
    INTO test_conv_ids
    FROM conversations c
    WHERE c.conversation_id NOT IN (SELECT DISTINCT conversation_id FROM conversation_participants)
       OR c.last_message_text LIKE 'realtime audit%'
       OR c.last_message_text LIKE 'collision test%';

    -- 2. Delete messages in test conversations or sent by test users
    DELETE FROM messages
    WHERE conversation_id = ANY(test_conv_ids)
       OR sender_id = ANY(test_user_ids);

    -- 3. Delete participants in test conversations or for test users
    DELETE FROM conversation_participants
    WHERE conversation_id = ANY(test_conv_ids)
       OR user_id = ANY(test_user_ids);

    -- 4. Delete the test conversations themselves
    DELETE FROM conversations
    WHERE conversation_id = ANY(test_conv_ids);

    -- 5. Delete test user secondary data
    DELETE FROM user_profiles WHERE user_id = ANY(test_user_ids);
    DELETE FROM user_settings WHERE user_id = ANY(test_user_ids);
    DELETE FROM user_treks WHERE user_id = ANY(test_user_ids);
    DELETE FROM user_badges WHERE user_id = ANY(test_user_ids);
    DELETE FROM user_checklists WHERE user_id = ANY(test_user_ids);
    DELETE FROM notifications WHERE user_id = ANY(test_user_ids) OR actor_id = ANY(test_user_ids);
    DELETE FROM community_follows WHERE follower_id = ANY(test_user_ids) OR following_id = ANY(test_user_ids);
    DELETE FROM community_post_likes WHERE user_id = ANY(test_user_ids);
    DELETE FROM community_post_saves WHERE user_id = ANY(test_user_ids);
    DELETE FROM community_comment_likes WHERE user_id = ANY(test_user_ids);
    DELETE FROM community_comments WHERE user_id = ANY(test_user_ids);
    DELETE FROM community_stories WHERE user_id = ANY(test_user_ids);
    DELETE FROM community_posts WHERE user_id = ANY(test_user_ids);

    -- 6. Delete test users from users table
    DELETE FROM users WHERE user_id = ANY(test_user_ids);

    RAISE NOTICE 'Migration 009 completed: Cleaned % test users and % test conversations.',
        ARRAY_LENGTH(test_user_ids, 1), ARRAY_LENGTH(test_conv_ids, 1);
END $$;
