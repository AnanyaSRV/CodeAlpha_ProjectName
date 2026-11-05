
const express = require("express");
const db = require("../database/database");

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
router.get("/search", (req, res) => {
    try {
        const query = (req.query.q || "").trim();

        if (query.length < 1 || query.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Enter a search term between 1 and 50 characters."
            });
        }

        const currentUserId = req.session?.userId || null;

        const users = db.prepare(`
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.bio,
                u.profile_image,
                (SELECT COUNT(*) FROM follows f
                    WHERE f.following_id = u.id) AS followers_count,
                (SELECT COUNT(*) FROM follows f
                    WHERE f.follower_id = u.id) AS following_count,
                CASE WHEN ? IS NOT NULL AND EXISTS (
                    SELECT 1 FROM follows f
                    WHERE f.follower_id = ? AND f.following_id = u.id
                ) THEN 1 ELSE 0 END AS followed_by_me
            FROM users u
            WHERE u.username LIKE ? OR u.full_name LIKE ?
            ORDER BY u.username
            LIMIT 30
        `).all(
            currentUserId,
            currentUserId,
            `%${query}%`,
            `%${query}%`
        );

        res.json({ success: true, users });

    } catch (error) {
        console.error("User search error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to search users."
        });
    }
});

// Update the logged-in user's profile.
router.patch("/profile/update", requireLogin, (req, res) => {
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

        db.prepare(`
            UPDATE users
            SET full_name = ?, bio = ?
            WHERE id = ?
        `).run(fullName, bio, req.session.userId);

        const user = db.prepare(`
            SELECT id, username, full_name, bio, profile_image, created_at
            FROM users
            WHERE id = ?
        `).get(req.session.userId);

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
router.get("/:username", (req, res) => {
    try {
        const username = req.params.username.toLowerCase();

        const user = db.prepare(`
            SELECT id, username, full_name, bio, profile_image, created_at
            FROM users
            WHERE username = ?
        `).get(username);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const currentUserId = req.session?.userId || null;

        const followersCount = db.prepare(`
            SELECT COUNT(*) AS count
            FROM follows
            WHERE following_id = ?
        `).get(user.id).count;

        const followingCount = db.prepare(`
            SELECT COUNT(*) AS count
            FROM follows
            WHERE follower_id = ?
        `).get(user.id).count;

        const isFollowing = currentUserId
            ? Boolean(db.prepare(`
                SELECT 1 FROM follows
                WHERE follower_id = ? AND following_id = ?
            `).get(currentUserId, user.id))
            : false;

        const posts = db.prepare(`
            SELECT
                p.id,
                p.content,
                p.image_url,
                p.created_at,
                u.id AS user_id,
                u.username,
                u.full_name,
                u.profile_image,
                (SELECT COUNT(*) FROM likes l
                    WHERE l.post_id = p.id) AS like_count,
                (SELECT COUNT(*) FROM comments c
                    WHERE c.post_id = p.id) AS comment_count,
                CASE WHEN ? IS NOT NULL AND EXISTS (
                    SELECT 1 FROM likes l
                    WHERE l.post_id = p.id AND l.user_id = ?
                ) THEN 1 ELSE 0 END AS liked_by_me
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC, p.id DESC
        `).all(currentUserId, currentUserId, user.id);

        res.json({
            success: true,
            profile: {
                ...user,
                followers_count: followersCount,
                following_count: followingCount,
                posts_count: posts.length,
                is_following: isFollowing,
                is_own_profile: currentUserId === user.id
            },
            posts
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
router.post("/:id/follow", requireLogin, (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        const currentUserId = req.session.userId;

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

        const targetUser = db.prepare(
            "SELECT id FROM users WHERE id = ?"
        ).get(targetUserId);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const existingFollow = db.prepare(`
            SELECT id FROM follows
            WHERE follower_id = ? AND following_id = ?
        `).get(currentUserId, targetUserId);

        let following;

        if (existingFollow) {
            db.prepare(`
                DELETE FROM follows
                WHERE follower_id = ? AND following_id = ?
            `).run(currentUserId, targetUserId);

            following = false;
        } else {
            db.prepare(`
                INSERT INTO follows (follower_id, following_id)
                VALUES (?, ?)
            `).run(currentUserId, targetUserId);

            following = true;
        }

        const followersCount = db.prepare(`
            SELECT COUNT(*) AS count
            FROM follows
            WHERE following_id = ?
        `).get(targetUserId).count;

        res.json({
            success: true,
            following,
            followersCount
        });

    } catch (error) {
        console.error("Follow error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to update follow status."
        });
    }
});

// Get a user's followers.
router.get("/:username/followers", (req, res) => {
    try {
        const user = db.prepare(
            "SELECT id FROM users WHERE username = ?"
        ).get(req.params.username.toLowerCase());

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const followers = db.prepare(`
            SELECT u.id, u.username, u.full_name, u.profile_image
            FROM follows f
            JOIN users u ON u.id = f.follower_id
            WHERE f.following_id = ?
            ORDER BY f.created_at DESC
        `).all(user.id);

        res.json({ success: true, followers });

    } catch (error) {
        console.error("Followers error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load followers."
        });
    }
});

// Get a user's following list.
router.get("/:username/following", (req, res) => {
    try {
        const user = db.prepare(
            "SELECT id FROM users WHERE username = ?"
        ).get(req.params.username.toLowerCase());

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const following = db.prepare(`
            SELECT u.id, u.username, u.full_name, u.profile_image
            FROM follows f
            JOIN users u ON u.id = f.following_id
            WHERE f.follower_id = ?
            ORDER BY f.created_at DESC
        `).all(user.id);

        res.json({ success: true, following });

    } catch (error) {
        console.error("Following error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load following list."
        });
    }
});

module.exports = router;
