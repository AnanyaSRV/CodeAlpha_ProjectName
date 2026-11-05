
document.addEventListener("DOMContentLoaded", () => {

    const notificationsContainer =
        document.getElementById("notificationsContainer");

    const notificationTotal =
        document.getElementById("notificationTotal");

    const unreadSummary =
        document.getElementById("unreadSummary");

    const markAllReadButton =
        document.getElementById("markAllReadButton");

    const filterButtons =
        document.querySelectorAll(".notification-filter");

    let notifications = [];
    let currentFilter = "all";
    let unreadCount = 0;

    // ---------------------------------------------
    // API HELPER
    // ---------------------------------------------

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

    // ---------------------------------------------
    // ELEMENT HELPER
    // ---------------------------------------------

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

    // ---------------------------------------------
    // DATE FORMATTER
    // ---------------------------------------------

    function formatDate(value) {
        if (!value) {
            return "Recently";
        }

        const normalizedDate = value.includes("T")
            ? value
            : value.replace(" ", "T") + "Z";

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

    // ---------------------------------------------
    // NOTIFICATION INFORMATION
    // ---------------------------------------------

    function getNotificationDetails(notification) {
        switch (notification.type) {

            case "like":
                return {
                    icon: "♥",
                    message: "liked your post."
                };

            case "comment":
                return {
                    icon: "✎",
                    message: "commented on your post."
                };

            case "follow":
                return {
                    icon: "＋",
                    message: "started following you."
                };

            default:
                return {
                    icon: "✳",
                    message: "interacted with you."
                };
        }
    }

    // ---------------------------------------------
    // UPDATE SUMMARY
    // ---------------------------------------------

    function updateSummary() {
        notificationTotal.textContent =
            `${notifications.length} ${
                notifications.length === 1
                    ? "notification"
                    : "notifications"
            }`;

        unreadSummary.textContent =
            `${unreadCount} unread`;

        markAllReadButton.disabled = unreadCount === 0;
    }

    // ---------------------------------------------
    // EMPTY STATE
    // ---------------------------------------------

    function renderEmptyState() {
        const empty = createElement(
            "div",
            "notifications-empty"
        );

        const isUnreadFilter = currentFilter === "unread";

        empty.append(
            createElement(
                "span",
                "notifications-empty-symbol",
                "✳"
            ),
            createElement(
                "h3",
                "",
                isUnreadFilter
                    ? "You're all caught up."
                    : "It's quiet around here."
            ),
            createElement(
                "p",
                "",
                isUnreadFilter
                    ? "You have no unread notifications. You're up to date!"
                    : "When someone likes your posts, leaves a comment or follows you, you'll see it here."
            )
        );

        const homeLink = createElement(
            "a",
            "",
            "Back to your feed ↗"
        );

        homeLink.href = "/";

        empty.append(homeLink);

        notificationsContainer.replaceChildren(empty);
    }

    // ---------------------------------------------
    // MARK ONE NOTIFICATION AS READ
    // ---------------------------------------------

    async function markAsRead(notificationId, button) {
        if (button) {
            button.disabled = true;
            button.textContent = "Updating...";
        }

        try {
            await apiRequest(
                `/api/social/notifications/${notificationId}/read`,
                {
                    method: "PATCH"
                }
            );

            const notification = notifications.find(
                item => Number(item.id) === Number(notificationId)
            );

            if (notification && Number(notification.is_read) === 0) {
                notification.is_read = 1;
                unreadCount = Math.max(0, unreadCount - 1);
            }

            updateSummary();
            renderNotifications();

        } catch (error) {
            alert(error.message);

            if (button) {
                button.disabled = false;
                button.textContent = "Mark read";
            }
        }
    }

    // ---------------------------------------------
    // MARK ALL NOTIFICATIONS AS READ
    // ---------------------------------------------

    async function markAllAsRead() {
        if (unreadCount === 0) {
            return;
        }

        markAllReadButton.disabled = true;
        markAllReadButton.textContent = "Updating...";

        try {
            await apiRequest(
                "/api/social/notifications/read-all",
                {
                    method: "PATCH"
                }
            );

            notifications.forEach(notification => {
                notification.is_read = 1;
            });

            unreadCount = 0;

            updateSummary();
            renderNotifications();

        } catch (error) {
            alert(error.message);

        } finally {
            markAllReadButton.textContent = "Mark all as read";
            markAllReadButton.disabled = unreadCount === 0;
        }
    }

    markAllReadButton.addEventListener(
        "click",
        markAllAsRead
    );

    // ---------------------------------------------
    // CREATE NOTIFICATION CARD
    // ---------------------------------------------

    function createNotificationCard(notification) {
        const isUnread = Number(notification.is_read) === 0;

        const details = getNotificationDetails(notification);

        const card = createElement(
            "article",
            `notification-item ${isUnread ? "unread" : ""}`
        );

        const icon = createElement(
            "div",
            "notification-icon",
            details.icon
        );

        const body = createElement(
            "div",
            "notification-body"
        );

        const message = createElement(
            "p",
            "notification-message"
        );

        const actorLink = createElement(
            "a",
            "notification-actor",
            notification.actor_name || notification.actor_username || "Someone"
        );

        actorLink.href =
            `profile.html?username=${encodeURIComponent(notification.actor_username)}`;

        message.append(
            actorLink,
            document.createTextNode(` ${details.message}`)
        );

        body.append(message);

        if (
            notification.post_content &&
            (notification.type === "like" ||
             notification.type === "comment")
        ) {
            const preview = createElement(
                "span",
                "notification-post-preview",
                `Your post: "${notification.post_content}"`
            );

            body.append(preview);
        }

        body.append(
            createElement(
                "span",
                "notification-time",
                formatDate(notification.created_at)
            )
        );

        card.append(icon, body);

        if (isUnread) {
            const actions = createElement(
                "div",
                "notification-actions"
            );

            const readButton = createElement(
                "button",
                "notification-read-button",
                "Mark read"
            );

            readButton.type = "button";

            readButton.addEventListener("click", () => {
                markAsRead(notification.id, readButton);
            });

            const unreadDot = createElement(
                "span",
                "notification-unread-dot"
            );

            unreadDot.title = "Unread notification";

            actions.append(readButton, unreadDot);
            card.append(actions);
        }

        return card;
    }

    // ---------------------------------------------
    // RENDER NOTIFICATIONS
    // ---------------------------------------------

    function renderNotifications() {
        notificationsContainer.replaceChildren();

        const filteredNotifications = currentFilter === "unread"
            ? notifications.filter(
                notification => Number(notification.is_read) === 0
            )
            : notifications;

        if (filteredNotifications.length === 0) {
            renderEmptyState();
            return;
        }

        filteredNotifications.forEach(notification => {
            notificationsContainer.append(
                createNotificationCard(notification)
            );
        });
    }

    // ---------------------------------------------
    // FILTERS
    // ---------------------------------------------

    function selectFilter(filter) {
        currentFilter = filter;

        filterButtons.forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.filter === filter
            );
        });

        renderNotifications();
    }

    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            selectFilter(button.dataset.filter);
        });
    });

    // ---------------------------------------------
    // LOAD NOTIFICATIONS
    // ---------------------------------------------

    async function loadNotifications() {
        notificationsContainer.replaceChildren(
            createElement(
                "p",
                "notifications-loading",
                "Loading your notifications..."
            )
        );

        try {
            const data = await apiRequest(
                "/api/social/notifications"
            );

            notifications = data.notifications || [];
            unreadCount = Number(data.unreadCount || 0);

            updateSummary();
            renderNotifications();

        } catch (error) {
            if (
                error.message.toLowerCase().includes("log in") ||
                error.message.toLowerCase().includes("logged")
            ) {
                window.location.href = "login.html";
                return;
            }

            notificationsContainer.replaceChildren(
                createElement(
                    "p",
                    "notifications-error",
                    error.message
                )
            );
        }
    }

    // ---------------------------------------------
    // INITIALIZE
    // ---------------------------------------------

    async function initialize() {
        try {
            await apiRequest("/api/auth/me");
            await loadNotifications();

        } catch (error) {
            window.location.href = "login.html";
        }
    }

    initialize();

});
