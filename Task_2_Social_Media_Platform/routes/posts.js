
const express = require("express");
const multer = require("multer");
const { randomUUID } = require("crypto");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
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

const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const storage = cloudinaryConfigured
    ? new CloudinaryStorage({
        cloudinary,
        params: {
            folder: "folio/posts",
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
            public_id: () => randomUUID()
        }
    })
    : multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(
                new Error("Only JPG, PNG, WEBP, and GIF images are allowed.")
            );
        }

        callback(null, true);
    }
});

function requireCloudinary(req, res, next) {
    if (!cloudinaryConfigured) {
        return res.status(503).json({
            success: false,
            message: "Image uploads are not configured yet. Please configure Cloudinary."
        });
    }
    next();
}

function handleUploadError(error, req, res, next) {
    if (!error) return next();

    console.error("Image upload error:", error);

    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: error.code === "LIMIT_FILE_SIZE"
                ? "Image must be 5MB or smaller."
                : "Unable to upload the image."
        });
    }

    return res.status(400).json({
        success: false,
        message: error.message || "Unable to upload the image."
    });
}

const postSelect = `
    SELECT
        p.id,
        p.content,
        p.image_url,
        p.created_at,
        p.user_id,
        u.username,
        u.full_name,
        u.profile_image,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
        CASE
            WHEN $1::INTEGER IS NOT NULL AND EXISTS (
                SELECT 1 FROM likes l
                WHERE l.post_id = p.id AND l.user_id = $1
            )
            THEN 1 ELSE 0
        END AS liked_by_me
    FROM posts p
    JOIN users u ON u.id = p.user_id
`;


// Get posts.
router.get("/", async (req, res) => {
    try {
        const currentUserId = req.session?.userId
            ? Number(req.session.userId)
            : null;

        const result = await pool.query(
            `${postSelect}
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT 50`,
            [currentUserId]
        );

        res.json({
            success: true,
            posts: result.rows
        });

    } catch (error) {
        console.error("Get posts error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load posts."
        });
    }
});


// Create a post.
router.post(
    "/",
    requireLogin,
    requireCloudinary,
    upload.single("image"),
    handleUploadError,
    async (req, res) => {
        try {
            const content = (req.body.content || "").trim();

            if (!content && !req.file) {
                return res.status(400).json({
                    success: false,
                    message: "A post must contain text or an image."
                });
            }

            if (content.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message: "Post content cannot exceed 2000 characters."
                });
            }

            const imageUrl = req.file
                ? (req.file.path || req.file.secure_url || "")
                : "";

            const result = await pool.query(
                `INSERT INTO posts (user_id, content, image_url)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
                [req.session.userId, content, imageUrl]
            );

            const postResult = await pool.query(
                `${postSelect}
                 WHERE p.id = $2`,
                [req.session.userId, result.rows[0].id]
            );

            res.status(201).json({
                success: true,
                message: "Post created successfully.",
                post: postResult.rows[0]
            });

        } catch (error) {
            console.error("Create post error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to create your post."
            });
        }
    }
);


// Delete a post owned by the logged-in user.
router.delete("/:id", requireLogin, async (req, res) => {
    try {
        const postId = Number(req.params.id);

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        const result = await pool.query(
            `DELETE FROM posts
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [postId, req.session.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Post not found or you do not have permission to delete it."
            });
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
router.post("/:id/like", requireLogin, async (req, res) => {
    const client = await pool.connect();

    try {
        const postId = Number(req.params.id);
        const userId = Number(req.session.userId);

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        await client.query("BEGIN");

        const postResult = await client.query(
            "SELECT id, user_id FROM posts WHERE id = $1 FOR UPDATE",
            [postId]
        );

        if (postResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        const post = postResult.rows[0];

        const existingLike = await client.query(
            `SELECT id FROM likes
             WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );

        let liked;

        if (existingLike.rows.length > 0) {
            await client.query(
                "DELETE FROM likes WHERE post_id = $1 AND user_id = $2",
                [postId, userId]
            );

            liked = false;

        } else {
            await client.query(
                `INSERT INTO likes (post_id, user_id)
                 VALUES ($1, $2)
                 ON CONFLICT (post_id, user_id) DO NOTHING`,
                [postId, userId]
            );

            liked = true;

            if (Number(post.user_id) !== userId) {
                await client.query(
                    `INSERT INTO notifications
                        (recipient_id, actor_id, type, post_id)
                     VALUES ($1, $2, 'like', $3)`,
                    [post.user_id, userId, postId]
                );
            }
        }

        const countResult = await client.query(
            "SELECT COUNT(*) AS count FROM likes WHERE post_id = $1",
            [postId]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            liked,
            like_count: Number(countResult.rows[0].count)
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Like error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update like."
        });

    } finally {
        client.release();
    }
});


// Get comments for a post.
router.get("/:id/comments", async (req, res) => {
    try {
        const postId = Number(req.params.id);

        if (!Number.isInteger(postId) || postId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID."
            });
        }

        const result = await pool.query(
            `SELECT
                c.id,
                c.post_id,
                c.user_id,
                c.content,
                c.created_at,
                u.username,
                u.full_name,
                u.profile_image
             FROM comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.post_id = $1
             ORDER BY c.created_at ASC, c.id ASC`,
            [postId]
        );

        res.json({
            success: true,
            comments: result.rows
        });

    } catch (error) {
        console.error("Get comments error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load comments."
        });
    }
});


// Add a comment.
router.post("/:id/comments", requireLogin, async (req, res) => {
    const client = await pool.connect();

    try {
        const postId = Number(req.params.id);
        const userId = Number(req.session.userId);
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
                message: "Comment must contain between 1 and 1000 characters."
            });
        }

        await client.query("BEGIN");

        const postResult = await client.query(
            "SELECT id, user_id FROM posts WHERE id = $1 FOR UPDATE",
            [postId]
        );

        if (postResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        const post = postResult.rows[0];

        const commentResult = await client.query(
            `INSERT INTO comments (post_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, post_id, user_id, content, created_at`,
            [postId, userId, content]
        );

        if (Number(post.user_id) !== userId) {
            await client.query(
                `INSERT INTO notifications
                    (recipient_id, actor_id, type, post_id, comment_id)
                 VALUES ($1, $2, 'comment', $3, $4)`,
                [
                    post.user_id,
                    userId,
                    postId,
                    commentResult.rows[0].id
                ]
            );
        }

        const userResult = await client.query(
            `SELECT username, full_name, profile_image
             FROM users
             WHERE id = $1`,
            [userId]
        );

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Comment added successfully.",
            comment: {
                ...commentResult.rows[0],
                ...userResult.rows[0]
            }
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Add comment error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to add comment."
        });

    } finally {
        client.release();
    }
});

module.exports = router;
