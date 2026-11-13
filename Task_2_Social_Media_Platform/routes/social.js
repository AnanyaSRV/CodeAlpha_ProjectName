
const express = require("express");
const { pool } = require("../database/database");

const router = express.Router();

function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue."
        });
    }

    next();
}

const feedSelect = `
    SELECT
        p.id,
        p.user_id,
        p.content,
        p.image_url,
        p.created_at,
        u.username,
        u.full_name,
        u.profile_image,

        (SELECT COUNT(*)
         FROM likes l
         WHERE l.post_id = p.id) AS like_count,

        (SELECT COUNT(*)
         FROM comments c
         WHERE c.post_id = p.id) AS comment_count,

        CASE
            WHEN EXISTS (
                SELECT 1
                FROM likes l
                WHERE l.post_id = p.id
                AND l.user_id = $1
            )
            THEN 1 ELSE 0
        END AS liked_by_me,

        CASE
            WHEN EXISTS (
                SELECT 1
                FROM bookmarks b
                WHERE b.post_id = p.id
                AND b.user_id = $1
            )
            THEN 1 ELSE 0
        END AS bookmarked_by_me

    FROM posts p
    JOIN users u ON u.id = p.user_id
`;


// Get the selected feed.
router.get("/feed", async (req, res) => {
    try {
        const feedType = req.query.feed || "forYou";
        const currentUserId = req.session?.userId
            ? Number(req.session.userId)
            : null;

        if (!["forYou", "following", "latest"].includes(feedType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid feed type."
            });
        }

        if (feedType === "following" && !currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Please log in to view your following feed."
            });
        }

        let query = `${feedSelect}`;

        if (feedType === "following") {
            query += `
                JOIN follows f
                    ON f.following_id = p.user_id
                    AND f.follower_id = $1
            `;
        }

        query += `
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT 50
        `;

        const result = await pool.query(
            query,
            [currentUserId]
        );

        res.json({
            success: true,
            feed: feedType,
            posts: result.rows
        });

    } catch (error) {
        console.error("Feed error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load feed."
        });
    }
});


// Save a post.
router.post("/bookmarks/:postId", requireLogin, async (req, res) => {
    try {
        const postId = Number(req.params.postId);
        const userId = Number(req.session.userId);

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        const postResult = await pool.query(
            "SELECT id FROM posts WHERE id = $1",
            [postId]
        );

        if (postResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        await pool.query(
            `INSERT INTO bookmarks (user_id, post_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, post_id) DO NOTHING`,
            [userId, postId]
        );

        res.json({
            success: true,
            bookmarked: true,
            message: "Post saved successfully."
        });

    } catch (error) {
        console.error("Bookmark error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to save post."
        });
    }
});


// Remove a saved post.
router.delete("/bookmarks/:postId", requireLogin, async (req, res) => {
    try {
        const postId = Number(req.params.postId);

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        await pool.query(
            `DELETE FROM bookmarks
             WHERE user_id = $1 AND post_id = $2`,
            [
                req.session.userId,
                postId
            ]
        );

        res.json({
            success: true,
            bookmarked: false,
            message: "Post removed from saved posts."
        });

    } catch (error) {
        console.error("Remove bookmark error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove saved post."
        });
    }
});


// Get saved posts.
router.get("/bookmarks", requireLogin, async (req, res) => {
    try {
        const userId = Number(req.session.userId);

        const result = await pool.query(
            `${feedSelect}
             JOIN bookmarks b
                ON b.post_id = p.id
                AND b.user_id = $1
             ORDER BY b.created_at DESC, b.id DESC`,
            [userId]
        );

        res.json({
            success: true,
            posts: result.rows
        });

    } catch (error) {
        console.error("Get bookmarks error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load saved posts."
        });
    }
});


// Get notifications for the logged-in user.
router.get("/notifications", requireLogin, async (req, res) => {
    try {
        const userId = Number(req.session.userId);

        const result = await pool.query(
            `SELECT
                n.id,
                n.type,
                n.post_id,
                n.comment_id,
                n.is_read,
                n.created_at,
                n.actor_id,
                u.username AS actor_username,
                u.full_name AS actor_name,
                u.profile_image AS actor_image,
                p.content AS post_content

             FROM notifications n

             JOIN users u
                ON u.id = n.actor_id

             LEFT JOIN posts p
                ON p.id = n.post_id

             WHERE n.recipient_id = $1

             ORDER BY n.created_at DESC, n.id DESC
             LIMIT 100`,
            [userId]
        );

        const unreadResult = await pool.query(
            `SELECT COUNT(*) AS count
             FROM notifications
             WHERE recipient_id = $1
             AND is_read = FALSE`,
            [userId]
        );

        res.json({
            success: true,
            notifications: result.rows,
            unreadCount: Number(unreadResult.rows[0].count)
        });

    } catch (error) {
        console.error("Notifications error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load notifications."
        });
    }
});


// Mark one notification as read.
router.patch("/notifications/:id/read", requireLogin, async (req, res) => {
    try {
        const notificationId = Number(req.params.id);

        if (!Number.isInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID."
            });
        }

        const result = await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE id = $1 AND recipient_id = $2
             RETURNING id`,
            [
                notificationId,
                req.session.userId
            ]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        res.json({
            success: true,
            message: "Notification marked as read."
        });

    } catch (error) {
        console.error("Mark notification read error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update notification."
        });
    }
});


// Mark all notifications as read.
router.patch("/notifications/read-all", requireLogin, async (req, res) => {
    try {
        await pool.query(
            `UPDATE notifications
             SET is_read = TRUE
             WHERE recipient_id = $1 AND is_read = FALSE`,
            [req.session.userId]
        );

        res.json({
            success: true,
            message: "All notifications marked as read."
        });

    } catch (error) {
        console.error("Mark all notifications read error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update notifications."
        });
    }
});

module.exports = router;
