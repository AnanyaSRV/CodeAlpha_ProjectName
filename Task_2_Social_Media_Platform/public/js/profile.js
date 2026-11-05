
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const username = params.get("username");

    const profileName = document.getElementById("profileName");
    const profileUsername = document.getElementById("profileUsername");
    const profileBio = document.getElementById("profileBio");
    const profileJoined = document.getElementById("profileJoined");
    const profileAvatar = document.getElementById("profileAvatar");
    const profileActions = document.getElementById("profileActions");
    const profilePosts = document.getElementById("profilePosts");

    const followersButton = document.getElementById("followersButton");
    const followingButton = document.getElementById("followingButton");
    const peopleModal = document.getElementById("peopleModal");
    const peopleModalTitle = document.getElementById("peopleModalTitle");
    const peopleList = document.getElementById("peopleList");
    const closePeopleModal = document.getElementById("closePeopleModal");

    let currentUser = null;
    let profileData = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);

        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;

        return node;
    }

    async function api(url, options = {}) {
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
        const date = new Date(value.replace(" ", "T") + "Z");

        if (Number.isNaN(date.getTime())) return "Recently";

        return date.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric"
        });
    }

    async function loadCurrentUser() {
        try {
            const data = await api("/api/auth/me");
            currentUser = data.user;

            const nav = document.getElementById("navActions");
            nav.replaceChildren();

            const homeLink = element("a", "login-button", "Home");
            homeLink.href = "/";

            const ownProfileLink = element("a", "login-button", "My profile");
            ownProfileLink.href =
                `profile.html?username=${encodeURIComponent(currentUser.username)}`;

            const logoutButton = element("button", "login-button", "Log out");

            logoutButton.addEventListener("click", async () => {
                try {
                    await api("/api/auth/logout", { method: "POST" });
                    window.location.href = "/";
                } catch (error) {
                    alert(error.message);
                }
            });

            nav.append(homeLink, ownProfileLink, logoutButton);

        } catch (error) {
            currentUser = null;
        }
    }

    function renderProfile(profile, posts) {
        profileData = profile;

        document.title = `${profile.full_name} (@${profile.username}) — Folio`;

        profileName.textContent = profile.full_name;
        profileUsername.textContent = `@${profile.username}`;
        profileBio.textContent = profile.bio || "A new member of the Folio community.";
        profileAvatar.textContent = profile.full_name.charAt(0).toUpperCase();
        profileJoined.textContent = `Joined ${formatDate(profile.created_at)}`;

        document.getElementById("profilePostsCount").textContent =
            profile.posts_count;

        document.getElementById("profileFollowersCount").textContent =
            profile.followers_count;

        document.getElementById("profileFollowingCount").textContent =
            profile.following_count;

        profileActions.replaceChildren();

        if (profile.is_own_profile) {
            const editButton = element(
                "button",
                "edit-profile-button",
                "Edit profile"
            );

            editButton.addEventListener("click", editProfile);
            profileActions.append(editButton);

        } else if (currentUser) {
            const followButton = element(
                "button",
                `follow-button ${profile.is_following ? "following" : ""}`,
                profile.is_following ? "Following" : "Follow"
            );

            followButton.addEventListener("click", async () => {
                followButton.disabled = true;

                try {
                    const result = await api(
                        `/api/users/${profile.id}/follow`,
                        { method: "POST" }
                    );

                    profile.is_following = result.following;
                    profile.followers_count = result.followersCount;

                    renderProfile(profile, posts);

                } catch (error) {
                    alert(error.message);
                } finally {
                    followButton.disabled = false;
                }
            });

            profileActions.append(followButton);

        } else {
            const loginLink = element(
                "a",
                "follow-button",
                "Log in to follow"
            );

            loginLink.href = "login.html";
            profileActions.append(loginLink);
        }

        renderPosts(posts);
    }

    function renderPosts(posts) {
        profilePosts.replaceChildren();

        if (!posts.length) {
            profilePosts.append(
                element(
                    "div",
                    "feed-empty",
                    "This member hasn't published any posts yet."
                )
            );
            return;
        }

        posts.forEach(post => {
            const card = element("article", "post-card");

            const heading = element("div", "post-header");
            const author = element("div", "post-author");
            const avatar = element(
                "div",
                "post-avatar",
                post.full_name.charAt(0).toUpperCase()
            );

            const details = element("div", "post-author-details");
            details.append(
                element("h3", "", post.full_name),
                element("p", "", `@${post.username} · ${formatDate(post.created_at)}`)
            );

            author.append(avatar, details);
            heading.append(author);
            card.append(heading);

            if (post.content) {
                card.append(element("p", "post-content", post.content));
            }

            if (post.image_url) {
                const image = element("img", "post-image");
                image.src = post.image_url;
                image.alt = "Post image";
                image.loading = "lazy";
                card.append(image);
            }

            const stats = element("div", "post-stats");
            stats.append(
                element("span", "", `${post.like_count} likes`),
                element("span", "", `${post.comment_count} comments`)
            );

            card.append(stats);

            const actions = element("div", "post-actions");
            const likeButton = element(
                "button",
                `post-action-button ${post.liked_by_me ? "liked" : ""}`,
                post.liked_by_me ? "♥ Liked" : "♡ Like"
            );

            likeButton.addEventListener("click", async () => {
                if (!currentUser) {
                    window.location.href = "login.html";
                    return;
                }

                likeButton.disabled = true;

                try {
                    await api(`/api/posts/${post.id}/like`, {
                        method: "POST"
                    });

                    await loadProfile();
                } catch (error) {
                    alert(error.message);
                } finally {
                    likeButton.disabled = false;
                }
            });

            actions.append(likeButton);
            card.append(actions);
            profilePosts.append(card);
        });
    }

    async function editProfile() {
        const newName = prompt("Enter your full name:", profileData.full_name);
        if (newName === null) return;

        const newBio = prompt("Write a short bio:", profileData.bio || "");
        if (newBio === null) return;

        try {
            await api("/api/users/profile/update", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fullName: newName,
                    bio: newBio
                })
            });

            await loadProfile();

        } catch (error) {
            alert(error.message);
        }
    }

    async function showPeople(type) {
        peopleModal.hidden = false;
        peopleList.replaceChildren(
            element("p", "feed-loading", "Loading...")
        );

        peopleModalTitle.textContent =
            type === "followers" ? "Followers" : "Following";

        try {
            const data = await api(
                `/api/users/${encodeURIComponent(username)}/${type}`
            );

            peopleList.replaceChildren();

            if (!data[type].length) {
                peopleList.append(
                    element("p", "feed-loading", "No members to show yet.")
                );
                return;
            }

            data[type].forEach(person => {
                const item = element("div", "person-item");
                const details = element("div", "person-details");

                const avatar = element(
                    "div",
                    "person-avatar",
                    person.full_name.charAt(0).toUpperCase()
                );

                const text = element("div");
                text.append(
                    element("h3", "", person.full_name),
                    element("p", "", `@${person.username}`)
                );

                details.append(avatar, text);

                const link = element("a", "person-profile-link", "View profile");
                link.href =
                    `profile.html?username=${encodeURIComponent(person.username)}`;

                item.append(details, link);
                peopleList.append(item);
            });

        } catch (error) {
            peopleList.replaceChildren(
                element("p", "feed-error", error.message)
            );
        }
    }

    async function loadProfile() {
        if (!username) {
            profileName.textContent = "Profile not found";
            profilePosts.replaceChildren(
                element("div", "feed-error", "No username was provided.")
            );
            return;
        }

        try {
            const data = await api(
                `/api/users/${encodeURIComponent(username)}`
            );

            renderProfile(data.profile, data.posts);

        } catch (error) {
            profileName.textContent = "Profile unavailable";
            profilePosts.replaceChildren(
                element("div", "feed-error", error.message)
            );
        }
    }

    followersButton.addEventListener("click", () => showPeople("followers"));
    followingButton.addEventListener("click", () => showPeople("following"));

    closePeopleModal.addEventListener("click", () => {
        peopleModal.hidden = true;
    });

    peopleModal.addEventListener("click", event => {
        if (event.target === peopleModal) {
            peopleModal.hidden = true;
        }
    });

    async function initialize() {
        await loadCurrentUser();
        await loadProfile();
    }

    initialize();
});
