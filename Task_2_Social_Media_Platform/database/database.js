
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.warn(
        "WARNING: DATABASE_URL is not configured. Set it before starting Folio."
    );
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
});

async function initializeDatabase() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL environment variable is required.");
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(20) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password TEXT NOT NULL,
            full_name VARCHAR(60) NOT NULL,
            bio VARCHAR(300) DEFAULT '',
            profile_image TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content VARCHAR(2000) NOT NULL,
            image_url TEXT DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content VARCHAR(1000) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS likes (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS follows (
            id SERIAL PRIMARY KEY,
            follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(follower_id, following_id),
            CHECK(follower_id <> following_id)
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, post_id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL
                CHECK(type IN ('like', 'comment', 'follow')),
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_posts_user_id
        ON posts(user_id);

        CREATE INDEX IF NOT EXISTS idx_posts_created_at
        ON posts(created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_comments_post_id
        ON comments(post_id);

        CREATE INDEX IF NOT EXISTS idx_likes_post_id
        ON likes(post_id);

        CREATE INDEX IF NOT EXISTS idx_follows_follower
        ON follows(follower_id);

        CREATE INDEX IF NOT EXISTS idx_follows_following
        ON follows(following_id);

        CREATE INDEX IF NOT EXISTS idx_bookmarks_user
        ON bookmarks(user_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_notifications_recipient
        ON notifications(recipient_id, is_read, created_at DESC);
    `);

    console.log("Folio PostgreSQL database initialized successfully.");
}

module.exports = {
    pool,
    initializeDatabase
};
