-- SELECT current_database();

-- CREATE EXTENSION postgis;

-- SELECT PostGIS_Version();

-- CREATE TABLE users (
--     user_id BIGSERIAL PRIMARY KEY,

--     username VARCHAR(50) NOT NULL UNIQUE,

--     email VARCHAR(255) NOT NULL UNIQUE,

--     password_hash TEXT NOT NULL,

--     full_name VARCHAR(150) NOT NULL,

--     profile_image TEXT,

--     bio TEXT,

--     phone VARCHAR(20),

--     state VARCHAR(100),

--     city VARCHAR(100),

--     is_verified BOOLEAN NOT NULL DEFAULT FALSE,

--     role VARCHAR(30) NOT NULL DEFAULT 'user',

--     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     last_login TIMESTAMPTZ
-- );

-- SELECT *
-- FROM users;

-- SELECT
--     column_name,
--     data_type,
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'users'
-- ORDER BY ordinal_position;


-- CREATE TABLE user_profiles (
--     profile_id BIGSERIAL PRIMARY KEY,

--     user_id BIGINT NOT NULL UNIQUE,

--     cover_image TEXT,

--     website TEXT,

--     social_links JSONB,

--     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     CONSTRAINT fk_user_profiles_user
--         FOREIGN KEY (user_id)
--         REFERENCES users(user_id)
--         ON DELETE CASCADE
-- );

-- SELECT *
-- FROM user_profiles;

-- SELECT
--     column_name,
--     data_type,
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'user_profiles'
-- ORDER BY ordinal_position;

-- SELECT
--     tc.constraint_name,
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS referenced_table,
--     ccu.column_name AS referenced_column
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
--     AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
--     AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
-- AND tc.table_schema = 'public';

-- CREATE TABLE user_settings (
--     setting_id BIGSERIAL PRIMARY KEY,

--     user_id BIGINT NOT NULL UNIQUE,

--     email_notifications BOOLEAN NOT NULL DEFAULT TRUE,

--     push_notifications BOOLEAN NOT NULL DEFAULT TRUE,

--     dark_mode BOOLEAN NOT NULL DEFAULT FALSE,

--     language VARCHAR(20) NOT NULL DEFAULT 'en',

--     privacy_level VARCHAR(30) NOT NULL DEFAULT 'public',

--     created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     CONSTRAINT fk_user_settings_user
--         FOREIGN KEY (user_id)
--         REFERENCES users(user_id)
--         ON DELETE CASCADE
-- );

-- SELECT *
-- FROM user_settings;

-- SELECT
--     column_name,
--     data_type,
--     is_nullable,
--     column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'user_settings'
-- ORDER BY ordinal_position;

-- SELECT
--     table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;

-- SELECT
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS referenced_table,
--     ccu.column_name AS referenced_column
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
--     AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
--     AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
-- AND tc.table_schema = 'public';