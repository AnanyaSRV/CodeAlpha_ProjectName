
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


// Search users.
router.get("/search", async (req, res) => {
    try {
        const query = (req.query.q || "").trim();

        if (query.length < 1 || query.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Enter a search term between 1 and 50 characters."
            });
        }

        const currentUserId = req.session?.userId || null;

        const result = await pool.query(
            `SELECT
                u.id,
                u.username,
                u.full_name,
                u.bio,
                u.profile_image,

                (SELECT COUNT(*)
                 FROM follows f
                 WHERE f.following_id = u.id) AS followers_count,

                (SELECT COUNT(*)
                 FROM follows f
                 WHERE f.follower_id = u.id) AS following_count,

                CASE
                    WHEN $1::INTEGER IS NOT NULL AND EXISTS (
                        SELECT 1
                        FROM follows f
                        WHERE f.follower_id = $1
                        AND f.following_id = u.id
                    )
                    THEN 1 ELSE 0
                END AS followed_by_me

             FROM users u
             WHERE u.username ILIKE $2
                OR u.full_name ILIKE $2
             ORDER BY u.username
             LIMIT 30`,
            [currentUserId, `%${query}%`]
        );

        res.json({
            success: true,
            users: result.rows
        });

    } catch (error) {
        console.error("User search error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to search users."
        });
    }
});


// Update the logged-in user's profile.
router.patch("/profile/update", requireLogin, async (req, res) => {
    try {
        const fullName = (req.body.fullName || "").trim();
        const bio = (req.body.bio || "").trim();

        if (fullName.length < 2 || fullName.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Full name must contain between 2 and 60 characters."
            });
        }

        if (bio.length > 300) {
            return res.status(400).json({
                success: false,
                message: "Your bio cannot exceed 300 characters."
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET full_name = $1, bio = $2
             WHERE id = $3
             RETURNING
                id,
                username,
                full_name,
                bio,
                profile_image,
                created_at`,
            [fullName, bio, req.session.userId]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User account not found."
            });
        }

        res.json({
            success: true,
            message: "Profile updated successfully.",
            user
        });

    } catch (error) {
        console.error("Profile update error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update your profile."
        });
    }
});


// Get a public profile and its posts.
router.get("/:username", async (req, res) => {
    try {
        const username = req.params.username.toLowerCase();

        const userResult = await pool.query(
            `SELECT
                id,
                username,
                full_name,
                bio,
                profile_image,
                created_at
             FROM users
             WHERE username = $1`,
            [username]
        );

        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const currentUserId = req.session?.userId
            ? Number(req.session.userId)
            : null;

        const countsResult = await pool.query(
            `SELECT
                (SELECT COUNT(*)
                 FROM follows
                 WHERE following_id = $1) AS followers_count,

                (SELECT COUNT(*)
                 FROM follows
                 WHERE follower_id = $1) AS following_count,

                EXISTS (
                    SELECT 1
                    FROM follows
                    WHERE follower_id = $2
                    AND following_id = $1
                ) AS is_following`,
            [user.id, currentUserId]
        );

        const counts = countsResult.rows[0];

        const postsResult = await pool.query(
            `SELECT
                p.id,
                p.content,
                p.image_url,
                p.created_at,
                u.id AS user_id,
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
                    WHEN $1::INTEGER IS NOT NULL AND EXISTS (
                        SELECT 1
                        FROM likes l
                        WHERE l.post_id = p.id
                        AND l.user_id = $1
                    )
                    THEN 1 ELSE 0
                END AS liked_by_me

             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.user_id = $2
             ORDER BY p.created_at DESC, p.id DESC`,
            [currentUserId, user.id]
        );

        res.json({
            success: true,
            profile: {
                ...user,
                followers_count: Number(counts.followers_count),
                following_count: Number(counts.following_count),
                posts_count: postsResult.rows.length,
                is_following: counts.is_following,
                is_own_profile: currentUserId === Number(user.id)
            },
            posts: postsResult.rows
        });

    } catch (error) {
        console.error("Profile error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load the user profile."
        });
    }
});


// Follow or unfollow a user.
router.post("/:id/follow", requireLogin, async (req, res) => {
    const client = await pool.connect();

    try {
        const targetUserId = Number(req.params.id);
        const currentUserId = Number(req.session.userId);

        if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

        if (targetUserId === currentUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot follow yourself."
            });
        }

        await client.query("BEGIN");

        const targetUser = await client.query(
            "SELECT id FROM users WHERE id = $1",
            [targetUserId]
        );

        if (targetUser.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const existingFollow = await client.query(
            `SELECT id
             FROM follows
             WHERE follower_id = $1
             AND following_id = $2
             FOR UPDATE`,
            [currentUserId, targetUserId]
        );

        let following;

        if (existingFollow.rows.length > 0) {
            await client.query(
                `DELETE FROM follows
                 WHERE follower_id = $1
                 AND following_id = $2`,
                [currentUserId, targetUserId]
            );

            following = false;

        } else {
            const inserted = await client.query(
                `INSERT INTO follows (follower_id, following_id)
                 VALUES ($1, $2)
                 ON CONFLICT (follower_id, following_id) DO NOTHING
                 RETURNING id`,
                [currentUserId, targetUserId]
            );

            following = inserted.rowCount > 0;

            if (following) {
                await client.query(
                    `INSERT INTO notifications
                        (recipient_id, actor_id, type)
                     VALUES ($1, $2, 'follow')`,
                    [targetUserId, currentUserId]
                );
            }
        }

        const countResult = await client.query(
            `SELECT COUNT(*) AS count
             FROM follows
             WHERE following_id = $1`,
            [targetUserId]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            following,
            followersCount: Number(countResult.rows[0].count)
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Follow error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update follow status."
        });

    } finally {
        client.release();
    }
});


// Get a user's followers.
router.get("/:username/followers", async (req, res) => {
    try {
        const userResult = await pool.query(
            "SELECT id FROM users WHERE username = $1",
            [req.params.username.toLowerCase()]
        );

        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const result = await pool.query(
            `SELECT
                u.id,
                u.username,
                u.full_name,
                u.profile_image
             FROM follows f
             JOIN users u ON u.id = f.follower_id
             WHERE f.following_id = $1
             ORDER BY f.created_at DESC`,
            [user.id]
        );

        res.json({
            success: true,
            followers: result.rows
        });

    } catch (error) {
        console.error("Followers error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load followers."
        });
    }
});


// Get a user's following list.
router.get("/:username/following", async (req, res) => {
    try {
        const userResult = await pool.query(
            "SELECT id FROM users WHERE username = $1",
            [req.params.username.toLowerCase()]
        );

        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const result = await pool.query(
            `SELECT
                u.id,
                u.username,
                u.full_name,
                u.profile_image
             FROM follows f
             JOIN users u ON u.id = f.following_id
             WHERE f.follower_id = $1
             ORDER BY f.created_at DESC`,
            [user.id]
        );

        res.json({
            success: true,
            following: result.rows
        });

    } catch (error) {
        console.error("Following error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load following list."
        });
    }
});

module.exports = router;
