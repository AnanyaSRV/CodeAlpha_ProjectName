
document.addEventListener("DOMContentLoaded", () => {
    const searchForm = document.getElementById("searchForm");
    const searchInput = document.getElementById("searchInput");
    const searchMessage = document.getElementById("searchMessage");
    const peopleGrid = document.getElementById("peopleGrid");

    let currentUser = null;

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

    async function loadCurrentUser() {
        try {
            const data = await api("/api/auth/me");
            currentUser = data.user;

            const nav = document.querySelector(".nav-actions");
            nav.replaceChildren();

            const welcome = element(
                "span",
                "nav-welcome",
                `Hi, ${currentUser.username}`
            );

            const profileLink = element("a", "login-button", "My profile");
            profileLink.href =
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

            nav.append(welcome, profileLink, logoutButton);

        } catch (error) {
            currentUser = null;
        }
    }

    function renderUsers(users) {
        peopleGrid.replaceChildren();

        if (!users.length) {
            searchMessage.textContent = "No members found. Try another search.";
            return;
        }

        searchMessage.textContent =
            `Found ${users.length} ${users.length === 1 ? "member" : "members"}.`;

        users.forEach(user => {
            const card = element("article", "person-card");
            const top = element("div", "person-card-top");

            const avatar = element(
                "div",
                "person-card-avatar",
                user.full_name.charAt(0).toUpperCase()
            );

            const identity = element("div");

            identity.append(
                element("h3", "", user.full_name),
                element("p", "person-card-username", `@${user.username}`)
            );

            top.append(avatar, identity);

            const bio = element(
                "p",
                "person-card-bio",
                user.bio || "A member of the Folio community."
            );

            const stats = element(
                "p",
                "person-card-stats",
                `${user.followers_count} followers · ${user.following_count} following`
            );

            const actions = element("div", "person-card-actions");

            const profileButton = element(
                "a",
                "person-profile-button",
                "View profile"
            );

            profileButton.href =
                `profile.html?username=${encodeURIComponent(user.username)}`;

            actions.append(profileButton);

            if (currentUser && currentUser.id !== user.id) {
                const followButton = element(
                    "button",
                    `person-follow-button ${user.followed_by_me ? "following" : ""}`,
                    user.followed_by_me ? "Following" : "Follow"
                );

                followButton.addEventListener("click", async () => {
                    followButton.disabled = true;

                    try {
                        const result = await api(
                            `/api/users/${user.id}/follow`,
                            { method: "POST" }
                        );

                        user.followed_by_me = result.following;
                        user.followers_count = result.followersCount;

                        renderUsers(users);

                    } catch (error) {
                        alert(error.message);
                    } finally {
                        followButton.disabled = false;
                    }
                });

                actions.append(followButton);
            }

            card.append(top, bio, stats, actions);
            peopleGrid.append(card);
        });
    }

    async function searchUsers(query) {
        const cleanQuery = query.trim();

        if (!cleanQuery) {
            searchMessage.textContent = "Enter a name or username to search.";
            peopleGrid.replaceChildren();
            return;
        }

        searchMessage.textContent = "Searching...";
        peopleGrid.replaceChildren();

        try {
            const data = await api(
                `/api/users/search?q=${encodeURIComponent(cleanQuery)}`
            );

            renderUsers(data.users);

        } catch (error) {
            searchMessage.textContent = error.message;
        }
    }

    searchForm.addEventListener("submit", event => {
        event.preventDefault();
        searchUsers(searchInput.value);
    });

    async function initialize() {
        await loadCurrentUser();
        await searchUsers("folio");
    }

    initialize();
});
