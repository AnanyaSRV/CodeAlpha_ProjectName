
const express = require("express");
const db = require("../database/database");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| SOCIAL FEATURES DATABASE SETUP
|--------------------------------------------------------------------------
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_id INTEGER NOT NULL,
        actor_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('like', 'comment', 'follow')),
        post_id INTEGER,
        comment_id INTEGER,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_user
    ON bookmarks(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_notifications_recipient
    ON notifications(recipient_id, is_read, created_at DESC);

    CREATE TRIGGER IF NOT EXISTS notify_post_like
    AFTER INSERT ON likes
    BEGIN
        INSERT INTO notifications (
            recipient_id, actor_id, type, post_id
        )
        SELECT
            posts.user_id,
            NEW.user_id,
            'like',
            NEW.post_id
        FROM posts
        WHERE posts.id = NEW.post_id
          AND posts.user_id != NEW.user_id;
    END;

    CREATE TRIGGER IF NOT EXISTS notify_post_comment
    AFTER INSERT ON comments
    BEGIN
        INSERT INTO notifications (
            recipient_id, actor_id, type, post_id, comment_id
        )
        SELECT
            posts.user_id,
            NEW.user_id,
            'comment',
            NEW.post_id,
            NEW.id
        FROM posts
        WHERE posts.id = NEW.post_id
          AND posts.user_id != NEW.user_id;
    END;

    CREATE TRIGGER IF NOT EXISTS notify_new_follow
    AFTER INSERT ON follows
    BEGIN
        INSERT INTO notifications (
            recipient_id, actor_id, type
        )
        SELECT
            NEW.following_id,
            NEW.follower_id,
            'follow'
        WHERE NEW.following_id != NEW.follower_id;
    END;
`);


/*
|--------------------------------------------------------------------------
| AUTHENTICATION MIDDLEWARE
|--------------------------------------------------------------------------
| auth.js stores the session as req.session.userId.
*/

function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue."
        });
    }

    next();
}


/*
|--------------------------------------------------------------------------
| FEED
|--------------------------------------------------------------------------
| GET /api/social/feed
| GET /api/social/feed?feed=following
| GET /api/social/feed?feed=latest
|--------------------------------------------------------------------------
*/

router.get("/feed", (req, res) => {
    try {
        const feedType = req.query.feed || "forYou";
        const userId = req.session?.userId || null;

        const baseQuery = `
            SELECT
                posts.id,
                posts.user_id,
                posts.content,
                posts.image_url,
                posts.created_at,
                users.username,
                users.full_name,
                users.profile_image,

                (SELECT COUNT(*)
                 FROM likes
                 WHERE likes.post_id = posts.id) AS like_count,

                (SELECT COUNT(*)
                 FROM comments
                 WHERE comments.post_id = posts.id) AS comment_count,

                CASE
                    WHEN ? IS NULL THEN 0
                    WHEN EXISTS (
                        SELECT 1
                        FROM likes
                        WHERE likes.post_id = posts.id
                        AND likes.user_id = ?
                    ) THEN 1
                    ELSE 0
                END AS liked_by_me,

                CASE
                    WHEN ? IS NULL THEN 0
                    WHEN EXISTS (
                        SELECT 1
                        FROM bookmarks
                        WHERE bookmarks.post_id = posts.id
                        AND bookmarks.user_id = ?
                    ) THEN 1
                    ELSE 0
                END AS bookmarked_by_me

            FROM posts
            JOIN users ON users.id = posts.user_id
        `;

        let posts;

        if (feedType === "following") {
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Log in to see posts from people you follow."
                });
            }

            posts = db.prepare(`
                ${baseQuery}
                JOIN follows ON follows.following_id = posts.user_id
                WHERE follows.follower_id = ?
                ORDER BY posts.created_at DESC
            `).all(userId, userId, userId, userId, userId);

        } else {
            posts = db.prepare(`
                ${baseQuery}
                ORDER BY posts.created_at DESC
            `).all(userId, userId, userId, userId);
        }

        return res.json({
            success: true,
            feed: feedType,
            posts
        });

    } catch (error) {
        console.error("Social feed error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load the feed."
        });
    }
});


/*
|--------------------------------------------------------------------------
| BOOKMARKS
|--------------------------------------------------------------------------
*/

// Save a post.
router.post("/bookmarks/:postId", requireLogin, (req, res) => {
    try {
        const postId = Number(req.params.postId);
        const userId = req.session.userId;

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        const post = db.prepare(
            "SELECT id FROM posts WHERE id = ?"
        ).get(postId);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        db.prepare(`
            INSERT OR IGNORE INTO bookmarks (user_id, post_id)
            VALUES (?, ?)
        `).run(userId, postId);

        return res.json({
            success: true,
            bookmarked: true,
            message: "Post saved to your bookmarks."
        });

    } catch (error) {
        console.error("Bookmark save error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not save this post."
        });
    }
});


// Remove a saved post.
router.delete("/bookmarks/:postId", requireLogin, (req, res) => {
    try {
        const postId = Number(req.params.postId);
        const userId = req.session.userId;

        db.prepare(`
            DELETE FROM bookmarks
            WHERE user_id = ? AND post_id = ?
        `).run(userId, postId);

        return res.json({
            success: true,
            bookmarked: false,
            message: "Post removed from your saved posts."
        });

    } catch (error) {
        console.error("Bookmark removal error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not remove this bookmark."
        });
    }
});


// Get the logged-in user's saved posts.
router.get("/bookmarks", requireLogin, (req, res) => {
    try {
        const userId = req.session.userId;

        const posts = db.prepare(`
            SELECT
                posts.id,
                posts.user_id,
                posts.content,
                posts.image_url,
                posts.created_at,
                users.username,
                users.full_name,
                users.profile_image,

                (SELECT COUNT(*)
                 FROM likes
                 WHERE likes.post_id = posts.id) AS like_count,

                (SELECT COUNT(*)
                 FROM comments
                 WHERE comments.post_id = posts.id) AS comment_count,

                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM likes
                        WHERE likes.post_id = posts.id
                        AND likes.user_id = ?
                    ) THEN 1
                    ELSE 0
                END AS liked_by_me,

                1 AS bookmarked_by_me

            FROM bookmarks
            JOIN posts ON posts.id = bookmarks.post_id
            JOIN users ON users.id = posts.user_id
            WHERE bookmarks.user_id = ?
            ORDER BY bookmarks.created_at DESC
        `).all(userId, userId);

        return res.json({
            success: true,
            posts
        });

    } catch (error) {
        console.error("Bookmarks fetch error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load saved posts."
        });
    }
});


/*
|--------------------------------------------------------------------------
| NOTIFICATIONS
|--------------------------------------------------------------------------
*/

// Fetch notifications.
router.get("/notifications", requireLogin, (req, res) => {
    try {
        const userId = req.session.userId;

        const notifications = db.prepare(`
            SELECT
                notifications.id,
                notifications.type,
                notifications.post_id,
                notifications.comment_id,
                notifications.is_read,
                notifications.created_at,
                users.id AS actor_id,
                users.username AS actor_username,
                users.full_name AS actor_name,
                users.profile_image AS actor_image,
                posts.content AS post_content

            FROM notifications
            JOIN users ON users.id = notifications.actor_id
            LEFT JOIN posts ON posts.id = notifications.post_id
            WHERE notifications.recipient_id = ?
            ORDER BY notifications.created_at DESC
            LIMIT 100
        `).all(userId);

        const unreadCount = db.prepare(`
            SELECT COUNT(*) AS count
            FROM notifications
            WHERE recipient_id = ? AND is_read = 0
        `).get(userId).count;

        return res.json({
            success: true,
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error("Notifications fetch error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load notifications."
        });
    }
});


// Mark one notification as read.
router.patch("/notifications/:id/read", requireLogin, (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        const userId = req.session.userId;

        const result = db.prepare(`
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND recipient_id = ?
        `).run(notificationId, userId);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        return res.json({
            success: true,
            message: "Notification marked as read."
        });

    } catch (error) {
        console.error("Notification update error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not update notification."
        });
    }
});


// Mark all notifications as read.
router.patch("/notifications/read-all", requireLogin, (req, res) => {
    try {
        const userId = req.session.userId;

        db.prepare(`
            UPDATE notifications
            SET is_read = 1
            WHERE recipient_id = ? AND is_read = 0
        `).run(userId);

        return res.json({
            success: true,
            message: "All notifications marked as read."
        });

    } catch (error) {
        console.error("Mark all notifications error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not update notifications."
        });
    }
});

module.exports = router;
