
document.addEventListener("DOMContentLoaded", () => {

    const container = document.getElementById("savedPostsContainer");
    const savedCount = document.getElementById("savedCount");
    const currentDate = document.getElementById("currentDate");

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

    function formatDate(value) {
        if (!value) return "Recently";

        const normalizedDate = value.includes("T")
            ? value
            : value.replace(" ", "T") + "Z";

        const date = new Date(normalizedDate);

        if (Number.isNaN(date.getTime())) {
            return "Recently";
        }

        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function updateDate() {
        currentDate.textContent = new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    function showEmptyState() {
        const empty = createElement("div", "saved-empty");

        empty.append(
            createElement("h3", "", "Nothing saved just yet."),
            createElement(
                "p",
                "",
                "When you find something inspiring in the feed, save it here and revisit it anytime."
            )
        );

        const link = createElement("a", "", "Discover the feed ↗");
        link.href = "/";

        empty.append(link);
        container.replaceChildren(empty);
    }

    function createPostCard(post) {
        const card = createElement("article", "saved-post-card");

        // Author information.
        const header = createElement("div", "saved-post-header");

        const avatar = createElement(
            "div",
            "saved-post-avatar",
            (post.full_name || post.username || "U")
                .charAt(0).toUpperCase()
        );

        const author = createElement("div", "saved-post-author");

        const authorLink = createElement(
            "a",
            "",
            post.full_name || post.username
        );

        authorLink.href =
            `profile.html?username=${encodeURIComponent(post.username)}`;

        const username = createElement(
            "p",
            "",
            `@${post.username} · ${formatDate(post.created_at)}`
        );

        author.append(authorLink, username);
        header.append(avatar, author);
        card.append(header);

        // Post text.
        if (post.content) {
            card.append(
                createElement("p", "saved-post-content", post.content)
            );
        }

        // Post image.
        if (post.image_url) {
            const image = createElement("img", "saved-post-image");

            image.src = post.image_url;
            image.alt = "Saved post image";
            image.loading = "lazy";

            card.append(image);
        }

        // Post statistics.
        const stats = createElement("div", "saved-post-stats");

        stats.append(
            createElement("span", "", `${post.like_count} likes`),
            createElement("span", "", `${post.comment_count} comments`)
        );

        card.append(stats);

        // Actions.
        const actions = createElement("div", "saved-post-actions");

        const viewButton = createElement(
            "button",
            "",
            "View profile ↗"
        );

        viewButton.type = "button";

        viewButton.addEventListener("click", () => {
            window.location.href =
                `profile.html?username=${encodeURIComponent(post.username)}`;
        });

        const removeButton = createElement(
            "button",
            "remove-saved-button",
            "Remove saved"
        );

        removeButton.type = "button";

        removeButton.addEventListener("click", async () => {
            const confirmed = confirm(
                "Remove this post from your saved collection?"
            );

            if (!confirmed) return;

            removeButton.disabled = true;
            removeButton.textContent = "Removing...";

            try {
                await apiRequest(`/api/social/bookmarks/${post.id}`, {
                    method: "DELETE"
                });

                await loadSavedPosts();

            } catch (error) {
                alert(error.message);
                removeButton.disabled = false;
                removeButton.textContent = "Remove saved";
            }
        });

        actions.append(viewButton, removeButton);
        card.append(actions);

        return card;
    }

    async function loadSavedPosts() {
        container.replaceChildren(
            createElement("div", "feed-loading", "Loading your saved posts...")
        );

        try {
            const data = await apiRequest("/api/social/bookmarks");

            const posts = data.posts || [];

            savedCount.textContent = posts.length;

            if (posts.length === 0) {
                showEmptyState();
                return;
            }

            container.replaceChildren();

            posts.forEach(post => {
                container.append(createPostCard(post));
            });

        } catch (error) {
            savedCount.textContent = "0";

            container.replaceChildren(
                createElement("div", "saved-error", error.message)
            );

            if (
                error.message.toLowerCase().includes("log in") ||
                error.message.toLowerCase().includes("login")
            ) {
                const loginLink = createElement("a", "", "Log in to continue");
                loginLink.href = "login.html";
                container.append(loginLink);
            }
        }
    }

    async function initialize() {
        updateDate();

        try {
            await apiRequest("/api/auth/me");
            await loadSavedPosts();

        } catch (error) {
            savedCount.textContent = "0";

            const message = createElement(
                "div",
                "saved-empty"
            );

            message.append(
                createElement("h3", "", "Your collection awaits."),
                createElement(
                    "p",
                    "",
                    "Log in to see the posts you have saved."
                )
            );

            const link = createElement("a", "", "Log in ↗");
            link.href = "login.html";

            message.append(link);
            container.replaceChildren(message);
        }
    }

    initialize();

});
