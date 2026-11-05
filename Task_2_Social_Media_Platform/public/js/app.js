
document.addEventListener("DOMContentLoaded", () => {

    // --------------------------------------------------
    // ELEMENTS
    // --------------------------------------------------

    const postsContainer = document.getElementById("postsContainer");
    const createPostForm = document.getElementById("createPostForm");
    const postContent = document.getElementById("postContent");
    const postImage = document.getElementById("postImage");
    const imagePreview = document.getElementById("imagePreview");
    const imagePreviewContainer = document.getElementById("imagePreviewContainer");
    const removeImageButton = document.getElementById("removeImageButton");
    const publishButton = document.getElementById("publishButton");
    const composerMessage = document.getElementById("composerMessage");
    const loginToPost = document.getElementById("loginToPost");
    const feedCount = document.getElementById("feedCount");

    const sidebarProfileLink = document.getElementById("sidebarProfileLink");
    const sidebarLoginLink = document.getElementById("sidebarLoginLink");
    const sidebarLogoutButton = document.getElementById("sidebarLogoutButton");
    const notificationBadge = document.getElementById("notificationBadge");

    const accountAvatar = document.getElementById("accountAvatar");
    const accountName = document.getElementById("accountName");
    const accountUsername = document.getElementById("accountUsername");
    const accountActionLink = document.getElementById("accountActionLink");

    const forYouFilter = document.getElementById("forYouFilter");
    const followingFilter = document.getElementById("followingFilter");
    const latestFilter = document.getElementById("latestFilter");

    // --------------------------------------------------
    // STATE
    // --------------------------------------------------

    let currentUser = null;
    let selectedImage = null;
    let currentFilter = "forYou";
    let cachedPosts = [];

    // --------------------------------------------------
    // GENERAL HELPERS
    // --------------------------------------------------

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Something went wrong.");
        }

        return data;
    }

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function formatDate(dateValue) {
        if (!dateValue) {
            return "Recently";
        }

        const normalizedDate = dateValue.includes("T")
            ? dateValue
            : dateValue.replace(" ", "T") + "Z";

        const date = new Date(normalizedDate);

        if (Number.isNaN(date.getTime())) {
            return "Recently";
        }

        return date.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function showComposerMessage(message, type) {
        composerMessage.textContent = message;
        composerMessage.className = `composer-message show ${type}`;
    }

    function showFeedMessage(message, className = "feed-error") {
        postsContainer.replaceChildren(
            createElement("div", className, message)
        );
    }

    function updateFeedCount(count) {
        feedCount.textContent =
            `${count} ${count === 1 ? "post" : "posts"}`;
    }

    function setCurrentDate() {
        const dateElement = document.getElementById("currentDate");

        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        }
    }

    // --------------------------------------------------
    // ACCOUNT AND AUTHENTICATION
    // --------------------------------------------------

    function updateAccountInterface() {
        if (currentUser) {
            const firstLetter = currentUser.full_name
                ? currentUser.full_name.charAt(0).toUpperCase()
                : "F";

            accountAvatar.textContent = firstLetter;
            accountName.textContent = currentUser.full_name;
            accountUsername.textContent = `@${currentUser.username}`;

            accountActionLink.textContent = "View my profile ↗";
            accountActionLink.href =
                `profile.html?username=${encodeURIComponent(currentUser.username)}`;

            sidebarProfileLink.href =
                `profile.html?username=${encodeURIComponent(currentUser.username)}`;

            sidebarProfileLink.hidden = false;
            sidebarLoginLink.hidden = true;
            sidebarLogoutButton.hidden = false;

            document.getElementById("composerAvatar").textContent = firstLetter;

            document.getElementById("composerTitle").textContent =
                `Hello, ${currentUser.full_name}.`;

            document.getElementById("composerSubtitle").textContent =
                "What's worth sharing today?";

            document.getElementById("welcomeHeading").innerHTML =
                `Welcome back,<br><em>${escapeHTML(currentUser.full_name)}.</em>`;

            createPostForm.hidden = false;
            loginToPost.hidden = true;

        } else {
            accountAvatar.textContent = "F";
            accountName.textContent = "Welcome, curious mind.";
            accountUsername.textContent = "Your story starts here.";

            accountActionLink.textContent = "Create your account ↗";
            accountActionLink.href = "register.html";

            sidebarProfileLink.href = "login.html";
            sidebarProfileLink.hidden = false;
            sidebarLoginLink.hidden = false;
            sidebarLogoutButton.hidden = true;

            createPostForm.hidden = true;
            loginToPost.hidden = false;

            notificationBadge.hidden = true;
        }
    }

    async function loadCurrentUser() {
        try {
            const data = await apiRequest("/api/auth/me");
            currentUser = data.user;
        } catch (error) {
            currentUser = null;
        }

        updateAccountInterface();
    }

    async function logout() {
        try {
            await apiRequest("/api/auth/logout", {
                method: "POST"
            });

            window.location.href = "/";

        } catch (error) {
            alert(error.message);
        }
    }

    sidebarLogoutButton.addEventListener("click", logout);

    // --------------------------------------------------
    // NOTIFICATION BADGE
    // --------------------------------------------------

    async function loadNotificationCount() {
        if (!currentUser) {
            notificationBadge.hidden = true;
            return;
        }

        try {
            const data = await apiRequest("/api/social/notifications");

            const unreadCount = Number(data.unreadCount || 0);

            notificationBadge.textContent =
                unreadCount > 99 ? "99+" : unreadCount;

            notificationBadge.hidden = unreadCount === 0;

        } catch (error) {
            console.error("Notification count error:", error);
        }
    }

    // --------------------------------------------------
    // IMAGE PREVIEW
    // --------------------------------------------------

    postImage.addEventListener("change", () => {
        const file = postImage.files[0];

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            alert("Please select a JPG, PNG, WEBP or GIF image.");
            postImage.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Image size must not exceed 5 MB.");
            postImage.value = "";
            return;
        }

        selectedImage = file;

        const reader = new FileReader();

        reader.onload = event => {
            imagePreview.src = event.target.result;
            imagePreviewContainer.hidden = false;
        };

        reader.readAsDataURL(file);
    });

    removeImageButton.addEventListener("click", () => {
        selectedImage = null;
        postImage.value = "";
        imagePreview.src = "";
        imagePreviewContainer.hidden = true;
    });

    // --------------------------------------------------
    // CREATE A POST
    // --------------------------------------------------

    createPostForm.addEventListener("submit", async event => {
        event.preventDefault();

        const content = postContent.value.trim();

        if (!content && !selectedImage) {
            showComposerMessage(
                "Write something or select an image before publishing.",
                "error"
            );
            return;
        }

        if (content.length > 2000) {
            showComposerMessage(
                "Posts cannot exceed 2,000 characters.",
                "error"
            );
            return;
        }

        const formData = new FormData();
        formData.append("content", content);

        if (selectedImage) {
            formData.append("image", selectedImage);
        }

        publishButton.disabled = true;
        publishButton.textContent = "Publishing...";

        try {
            await apiRequest("/api/posts", {
                method: "POST",
                body: formData
            });

            createPostForm.reset();

            selectedImage = null;
            imagePreview.src = "";
            imagePreviewContainer.hidden = true;

            showComposerMessage(
                "Your story has been published!",
                "success"
            );

            currentFilter = "forYou";
            updateFilterAppearance();

            await loadPosts();

        } catch (error) {
            showComposerMessage(error.message, "error");

        } finally {
            publishButton.disabled = false;
            publishButton.textContent = "Publish story ↗";
        }
    });

    // --------------------------------------------------
    // COMMENTS
    // --------------------------------------------------

    async function loadComments(postId, commentsSection) {
        const commentsList = commentsSection.querySelector(".comments-list");

        commentsList.replaceChildren(
            createElement("p", "feed-loading", "Loading comments...")
        );

        try {
            const data = await apiRequest(`/api/posts/${postId}/comments`);

            commentsList.replaceChildren();

            if (!data.comments || data.comments.length === 0) {
                commentsList.append(
                    createElement(
                        "p",
                        "feed-loading",
                        "No comments yet. Start the conversation!"
                    )
                );
            }

            (data.comments || []).forEach(comment => {
                const item = createElement("div", "comment-item");

                const avatar = createElement(
                    "div",
                    "comment-avatar",
                    (comment.full_name || comment.username || "U")
                        .charAt(0).toUpperCase()
                );

                const body = createElement("div", "comment-body");

                const profileLink = createElement(
                    "a",
                    "comment-profile-link",
                    comment.full_name || comment.username
                );

                profileLink.href =
                    `profile.html?username=${encodeURIComponent(comment.username)}`;

                body.append(
                    profileLink,
                    createElement("p", "", comment.content)
                );

                item.append(avatar, body);
                commentsList.append(item);
            });

        } catch (error) {
            commentsList.replaceChildren(
                createElement("p", "feed-error", error.message)
            );
        }
    }

    function createCommentsSection(post) {
        const section = createElement("section", "comments-section");
        const list = createElement("div", "comments-list");

        section.append(list);

        if (currentUser) {
            const form = createElement("form", "comment-form");

            const input = createElement("input");
            input.type = "text";
            input.placeholder = "Write a comment...";
            input.maxLength = 1000;
            input.required = true;

            const button = createElement("button", "", "Send");
            button.type = "submit";

            form.append(input, button);

            form.addEventListener("submit", async event => {
                event.preventDefault();

                const content = input.value.trim();

                if (!content) return;

                button.disabled = true;

                try {
                    await apiRequest(`/api/posts/${post.id}/comments`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ content })
                    });

                    input.value = "";

                    await loadComments(post.id, section);
                    await loadPosts();
                    await loadNotificationCount();

                } catch (error) {
                    alert(error.message);

                } finally {
                    button.disabled = false;
                }
            });

            section.append(form);

        } else {
            const loginMessage = createElement("p", "comments-login");
            const loginLink = createElement("a", "", "Log in");

            loginLink.href = "login.html";

            loginMessage.append(
                loginLink,
                document.createTextNode(" to join the conversation.")
            );

            section.append(loginMessage);
        }

        return section;
    }

    // --------------------------------------------------
    // LIKE A POST
    // --------------------------------------------------

    async function toggleLike(post, button) {
        if (!currentUser) {
            window.location.href = "login.html";
            return;
        }

        button.disabled = true;

        try {
            await apiRequest(`/api/posts/${post.id}/like`, {
                method: "POST"
            });

            await loadPosts();
            await loadNotificationCount();

        } catch (error) {
            alert(error.message);

        } finally {
            button.disabled = false;
        }
    }

    // --------------------------------------------------
    // SAVE / UNSAVE A POST
    // --------------------------------------------------

    async function toggleBookmark(post, button) {
        if (!currentUser) {
            window.location.href = "login.html";
            return;
        }

        const wasBookmarked = Number(post.bookmarked_by_me) === 1;

        button.disabled = true;

        try {
            const result = await apiRequest(
                `/api/social/bookmarks/${post.id}`,
                {
                    method: wasBookmarked ? "DELETE" : "POST"
                }
            );

            post.bookmarked_by_me = result.bookmarked ? 1 : 0;

            button.textContent = result.bookmarked
                ? "▣ Saved"
                : "▢ Save";

            button.classList.toggle(
                "bookmarked",
                Boolean(result.bookmarked)
            );

        } catch (error) {
            alert(error.message);

        } finally {
            button.disabled = false;
        }
    }

    // --------------------------------------------------
    // DELETE A POST
    // --------------------------------------------------

    async function deletePost(postId, button) {
        if (!confirm("Are you sure you want to delete this post?")) {
            return;
        }

        button.disabled = true;

        try {
            await apiRequest(`/api/posts/${postId}`, {
                method: "DELETE"
            });

            await loadPosts();

        } catch (error) {
            alert(error.message);
            button.disabled = false;
        }
    }

    // --------------------------------------------------
    // CREATE POST CARD
    // --------------------------------------------------

    function createPostCard(post) {
        const card = createElement("article", "post-card");

        const header = createElement("div", "post-header");
        const author = createElement("div", "post-author");

        const avatar = createElement(
            "div",
            "post-avatar",
            (post.full_name || post.username || "U")
                .charAt(0).toUpperCase()
        );

        const authorDetails = createElement("div", "post-author-details");

        const authorLink = createElement(
            "a",
            "post-author-link",
            post.full_name || post.username
        );

        authorLink.href =
            `profile.html?username=${encodeURIComponent(post.username)}`;

        authorDetails.append(
            authorLink,
            createElement(
                "p",
                "",
                `@${post.username} · ${formatDate(post.created_at)}`
            )
        );

        author.append(avatar, authorDetails);
        header.append(author);

        if (
            currentUser &&
            Number(currentUser.id) === Number(post.user_id)
        ) {
            const deleteButton = createElement(
                "button",
                "post-delete-button",
                "Delete"
            );

            deleteButton.type = "button";

            deleteButton.addEventListener("click", () => {
                deletePost(post.id, deleteButton);
            });

            header.append(deleteButton);
        }

        card.append(header);

        if (post.content) {
            card.append(
                createElement("p", "post-content", post.content)
            );
        }

        if (post.image_url) {
            const image = createElement("img", "post-image");

            image.src = post.image_url;
            image.alt = "Post image";
            image.loading = "lazy";

            card.append(image);
        }

        const stats = createElement("div", "post-stats");

        stats.append(
            createElement("span", "like-count", `${post.like_count} likes`),
            createElement("span", "comment-count", `${post.comment_count} comments`)
        );

        card.append(stats);

        const actions = createElement("div", "post-actions");

        const isLiked = Number(post.liked_by_me) === 1;
        const isBookmarked = Number(post.bookmarked_by_me) === 1;

        const likeButton = createElement(
            "button",
            `post-action-button ${isLiked ? "liked" : ""}`,
            isLiked ? "♥ Liked" : "♡ Like"
        );

        likeButton.type = "button";

        likeButton.addEventListener("click", () => {
            toggleLike(post, likeButton);
        });

        const commentButton = createElement(
            "button",
            "post-action-button",
            "Comment"
        );

        commentButton.type = "button";

        const bookmarkButton = createElement(
            "button",
            `post-action-button bookmark-button ${isBookmarked ? "bookmarked" : ""}`,
            isBookmarked ? "▣ Saved" : "▢ Save"
        );

        bookmarkButton.type = "button";

        bookmarkButton.addEventListener("click", () => {
            toggleBookmark(post, bookmarkButton);
        });

        actions.append(likeButton, commentButton, bookmarkButton);
        card.append(actions);

        const commentsSection = createCommentsSection(post);
        commentsSection.hidden = true;

        commentButton.addEventListener("click", async () => {
            commentsSection.hidden = !commentsSection.hidden;

            if (!commentsSection.hidden) {
                await loadComments(post.id, commentsSection);
            }
        });

        card.append(commentsSection);

        return card;
    }

    // --------------------------------------------------
    // RENDER POSTS
    // --------------------------------------------------

    function renderPosts(posts) {
        postsContainer.replaceChildren();

        if (!posts || posts.length === 0) {
            const empty = createElement("div", "feed-empty");

            let heading = "Your feed starts here.";
            let message =
                "Great conversations begin with a first post. Be the first to share something!";

            if (currentFilter === "following") {
                heading = "Your following feed is quiet.";
                message =
                    "Discover people and follow them to see their stories here.";
            }

            empty.append(
                createElement("h3", "empty-heading", heading),
                createElement("p", "", message)
            );

            if (currentFilter === "following") {
                const discoverLink = createElement(
                    "a",
                    "feed-discover-link",
                    "Discover people ↗"
                );

                discoverLink.href = "discover.html";
                empty.append(discoverLink);
            }

            postsContainer.append(empty);
            return;
        }

        posts.forEach(post => {
            postsContainer.append(createPostCard(post));
        });
    }

    // --------------------------------------------------
    // FEED FILTERS
    // --------------------------------------------------

    function updateFilterAppearance() {
        forYouFilter.classList.toggle(
            "active",
            currentFilter === "forYou"
        );

        followingFilter.classList.toggle(
            "active",
            currentFilter === "following"
        );

        latestFilter.classList.toggle(
            "active",
            currentFilter === "latest"
        );
    }

    async function selectFilter(filter) {
        currentFilter = filter;
        updateFilterAppearance();

        await loadPosts();
    }

    forYouFilter.addEventListener("click", () => {
        selectFilter("forYou");
    });

    followingFilter.addEventListener("click", () => {
        selectFilter("following");
    });

    latestFilter.addEventListener("click", () => {
        selectFilter("latest");
    });

    // --------------------------------------------------
    // LOAD FEED
    // --------------------------------------------------

    async function loadPosts() {
        postsContainer.replaceChildren(
            createElement("div", "feed-loading", "Loading the community feed...")
        );

        try {
            if (currentFilter === "following" && !currentUser) {
                showFeedMessage(
                    "Log in to see posts from people you follow.",
                    "feed-empty"
                );
                updateFeedCount(0);
                return;
            }

            const data = await apiRequest(
                `/api/social/feed?feed=${encodeURIComponent(currentFilter)}`
            );

            cachedPosts = data.posts || [];

            updateFeedCount(cachedPosts.length);
            renderPosts(cachedPosts);

        } catch (error) {
            showFeedMessage(error.message);
        }
    }

    // --------------------------------------------------
    // INITIALIZE DASHBOARD
    // --------------------------------------------------

    async function initialize() {
        setCurrentDate();

        await loadCurrentUser();

        updateFilterAppearance();

        await Promise.all([
            loadPosts(),
            loadNotificationCount()
        ]);
    }

    initialize();

});
