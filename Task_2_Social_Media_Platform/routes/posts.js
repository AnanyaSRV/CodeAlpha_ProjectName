
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("../database/database");

const router = express.Router();

const uploadDirectory = path.join(__dirname, "..", "public", "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, uploadDirectory);
    },
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const filename = `${crypto.randomUUID()}${extension}`;
        callback(null, filename);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(new Error("Only JPG, PNG, WEBP and GIF images are allowed."));
        }

        callback(null, true);
    }
});

function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue."
        });
    }

    next();
}

// Get the community feed.
router.get("/", (req, res) => {
    try {
        const currentUserId = req.session?.userId || null;

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
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
                CASE
                    WHEN ? IS NOT NULL AND EXISTS (
                        SELECT 1
                        FROM likes l
                        WHERE l.post_id = p.id AND l.user_id = ?
                    )
                    THEN 1
                    ELSE 0
                END AS liked_by_me
            FROM posts p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT 100
        `).all(currentUserId, currentUserId);

        res.json({
            success: true,
            posts
        });

    } catch (error) {
        console.error("Feed error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load the feed."
        });
    }
});

// Create a post.
router.post("/", requireLogin, upload.single("image"), (req, res) => {
    try {
        const content = (req.body.content || "").trim();

        if (!content && !req.file) {
            return res.status(400).json({
                success: false,
                message: "Write something or upload an image before posting."
            });
        }

        if (content.length > 2000) {
            if (req.file) fs.unlinkSync(req.file.path);

            return res.status(400).json({
                success: false,
                message: "Posts cannot exceed 2,000 characters."
            });
        }

        const imageUrl = req.file
            ? `/uploads/${req.file.filename}`
            : "";

        const result = db.prepare(`
            INSERT INTO posts (user_id, content, image_url)
            VALUES (?, ?, ?)
        `).run(req.session.userId, content, imageUrl);

        const post = db.prepare(`
            SELECT
                p.id,
                p.content,
                p.image_url,
                p.created_at,
                u.id AS user_id,
                u.username,
                u.full_name,
                u.profile_image
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE p.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: "Your post has been published!",
            post
        });

    } catch (error) {
        console.error("Create post error:", error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: "Unable to publish your post."
        });
    }
});

// Delete a post owned by the logged-in user.
router.delete("/:id", requireLogin, (req, res) => {
    try {
        const post = db.prepare(`
            SELECT id, user_id, image_url
            FROM posts
            WHERE id = ?
        `).get(req.params.id);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        if (post.user_id !== req.session.userId) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own posts."
            });
        }

        db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);

        if (post.image_url && post.image_url.startsWith("/uploads/")) {
            const filename = path.basename(post.image_url);
            const imagePath = path.join(uploadDirectory, filename);

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        res.json({
            success: true,
            message: "Post deleted successfully."
        });

    } catch (error) {
        console.error("Delete post error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete the post."
        });
    }
});

// Like or unlike a post.
router.post("/:id/like", requireLogin, (req, res) => {
    try {
        const postId = Number(req.params.id);

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

        const existingLike = db.prepare(`
            SELECT id
            FROM likes
            WHERE post_id = ? AND user_id = ?
        `).get(postId, req.session.userId);

        let liked;

        if (existingLike) {
            db.prepare(`
                DELETE FROM likes
                WHERE post_id = ? AND user_id = ?
            `).run(postId, req.session.userId);

            liked = false;
        } else {
            db.prepare(`
                INSERT INTO likes (post_id, user_id)
                VALUES (?, ?)
            `).run(postId, req.session.userId);

            liked = true;
        }

        const likeCount = db.prepare(`
            SELECT COUNT(*) AS count
            FROM likes
            WHERE post_id = ?
        `).get(postId).count;

        res.json({
            success: true,
            liked,
            likeCount
        });

    } catch (error) {
        console.error("Like error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update the like."
        });
    }
});

// Get comments for a post.
router.get("/:id/comments", (req, res) => {
    try {
        const postId = Number(req.params.id);

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        const comments = db.prepare(`
            SELECT
                c.id,
                c.post_id,
                c.content,
                c.created_at,
                u.id AS user_id,
                u.username,
                u.full_name,
                u.profile_image
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC, c.id ASC
        `).all(postId);

        res.json({
            success: true,
            comments
        });

    } catch (error) {
        console.error("Comments error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load comments."
        });
    }
});

// Add a comment.
router.post("/:id/comments", requireLogin, (req, res) => {
    try {
        const postId = Number(req.params.id);
        const content = (req.body.content || "").trim();

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        if (!content || content.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Comments must contain between 1 and 1,000 characters."
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

        const result = db.prepare(`
            INSERT INTO comments (post_id, user_id, content)
            VALUES (?, ?, ?)
        `).run(postId, req.session.userId, content);

        const comment = db.prepare(`
            SELECT
                c.id,
                c.post_id,
                c.content,
                c.created_at,
                u.id AS user_id,
                u.username,
                u.full_name,
                u.profile_image
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            message: "Comment added successfully.",
            comment
        });

    } catch (error) {
        console.error("Add comment error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to add your comment."
        });
    }
});

// Handle upload errors.
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "Image size must not exceed 5 MB."
            : "Image upload failed.";

        return res.status(400).json({
            success: false,
            message
        });
    }

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "Request failed."
        });
    }

    next();
});

module.exports = router;
