
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type UserRole = "CUSTOMER" | "VENDOR" | "DELIVERY" | "ADMIN";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  active: boolean;
  createdAt?: string;
  vendor?: {
    storeName?: string;
  };
};

type VendorOrderItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  fulfillmentStatus: FulfillmentStatus;
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
  };
};

type VendorOrder = {
  id: string;
  createdAt: string;
  items: VendorOrderItem[];
  vendorSubtotal: number;
};

type FulfillmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

type ApiResponse = {
  message?: string | string[];
  products?: Product[];
};

type ProductsResponse = ApiResponse | Product[];

const STATUS_LABELS: Record<FulfillmentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const NEXT_STATUSES: Record<
  FulfillmentStatus,
  FulfillmentStatus[]
> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "#fff",
  color: "#111827",
};

function getErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

function extractProducts(data: ProductsResponse): Product[] {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data.products) ? data.products : [];
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function formatCurrency(amount: number): string {
  return `₹${Number(amount).toFixed(2)}`;
}

function formatDate(date: string): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusColor(status: FulfillmentStatus): {
  background: string;
  color: string;
} {
  switch (status) {
    case "PENDING":
      return { background: "#fef3c7", color: "#92400e" };
    case "PROCESSING":
      return { background: "#dbeafe", color: "#1d4ed8" };
    case "SHIPPED":
      return { background: "#ede9fe", color: "#6d28d9" };
    case "OUT_FOR_DELIVERY":
      return { background: "#ffedd5", color: "#9a3412" };
    case "DELIVERED":
      return { background: "#dcfce7", color: "#166534" };
    case "CANCELLED":
      return { background: "#fee2e2", color: "#991b1b" };
  }
}

export default function VendorPage() {
  const router = useRouter();

  const [user, setUser] = useState<StoredUser | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [imageUrl, setImageUrl] = useState("");

  const getToken = useCallback(() => {
    const token = localStorage.getItem("markethub-access-token");

    if (!token) {
      router.replace("/account?next=%2Fvendor");
      return null;
    }

    return token;
  }, [router]);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("markethub-access-token");
    localStorage.removeItem("markethub-user");
    router.replace("/account?next=%2Fvendor");
  }, [router]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/products/mine`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = (await readResponse(response)) as ProductsResponse;

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (response.status === 403) {
        throw new Error(
          "Your account does not have vendor access. Please check your vendor account."
        );
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Could not load your products.")
        );
      }

      setProducts(extractProducts(result));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading products."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, handleUnauthorized]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/orders/vendor`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await readResponse(response);

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (response.status === 403) {
        throw new Error(
          "Your account does not have permission to view vendor orders."
        );
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Could not load your orders.")
        );
      }

      if (!Array.isArray(result)) {
        throw new Error("The server returned an unexpected orders response.");
      }

      setOrders(result as VendorOrder[]);
    } catch (err) {
      setOrdersError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading orders."
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [getToken, handleUnauthorized]);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("markethub-user");

      if (!storedUser) {
        router.replace("/account?next=%2Fvendor");
        return;
      }

      const parsedUser = JSON.parse(storedUser) as StoredUser;

      if (parsedUser.role !== "VENDOR") {
        router.replace("/account?next=%2Fvendor");
        return;
      }

      setUser(parsedUser);
      void loadProducts();
      void loadOrders();
    } catch {
      localStorage.removeItem("markethub-user");
      router.replace("/account?next=%2Fvendor");
    }
  }, [router, loadProducts, loadOrders]);

  async function handleCreateProduct(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (
      !name.trim() ||
      name.trim().length < 2 ||
      name.trim().length > 150
    ) {
      setFormError("Product name must be between 2 and 150 characters.");
      return;
    }

    if (
      description.trim().length < 2 ||
      description.trim().length > 5000
    ) {
      setFormError("Description must be between 2 and 5000 characters.");
      return;
    }

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice < 0.01 ||
      !/^\d+(\.\d{1,2})?$/.test(price.trim())
    ) {
      setFormError(
        "Enter a price greater than zero with up to 2 decimal places."
      );
      return;
    }

    if (
      !Number.isInteger(numericStock) ||
      numericStock < 0 ||
      stock.trim() === ""
    ) {
      setFormError("Stock must be a whole number of zero or more.");
      return;
    }

    if (imageUrl.trim()) {
      try {
        const parsedUrl = new URL(imageUrl.trim());

        if (
          !["http:", "https:"].includes(parsedUrl.protocol) ||
          imageUrl.trim().length > 2048
        ) {
          throw new Error("Invalid URL");
        }
      } catch {
        setFormError(
          "Enter a valid image URL starting with https:// or http://."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const token = getToken();

      if (!token) {
        return;
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        stock: numericStock,
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      };

      const response = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await readResponse(response);

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Could not create the product.")
        );
      }

      setName("");
      setDescription("");
      setPrice("");
      setStock("0");
      setImageUrl("");
      setShowCreateForm(false);

      await loadProducts();
      setSuccessMessage("Product created successfully.");
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating the product."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusUpdate(
    itemId: string,
    status: FulfillmentStatus
  ) {
    const currentItem = orders
      .flatMap((order) => order.items)
      .find((item) => item.id === itemId);

    if (!currentItem) {
      setOrdersError("Could not find this order item. Refresh and try again.");
      return;
    }

    const confirmation =
      status === "CANCELLED"
        ? "Cancel this item? This action cannot be reversed."
        : `Change this item's status to "${STATUS_LABELS[status]}"?`;

    if (!window.confirm(confirmation)) {
      return;
    }

    setUpdatingItemId(itemId);
    setOrdersError("");
    setOrderMessage("");

    try {
      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_URL}/orders/vendor/items/${encodeURIComponent(itemId)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      const result = await readResponse(response);

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Could not update the fulfillment status.")
        );
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) => ({
          ...order,
          items: order.items.map((item) =>
            item.id === itemId
              ? { ...item, fulfillmentStatus: status }
              : item
          ),
        }))
      );

      setOrderMessage(
        `Item status updated to ${STATUS_LABELS[status]}.`
      );
    } catch (err) {
      setOrdersError(
        err instanceof Error
          ? err.message
          : "Something went wrong while updating the order."
      );
    } finally {
      setUpdatingItemId(null);
    }
  }

  const activeProducts = products.filter(
    (product) => product.active
  ).length;

  const inactiveProducts = products.length - activeProducts;

  const totalOrderItems = orders.reduce(
    (sum, order) => sum + order.items.length,
    0
  );

  const pendingItems = orders.reduce(
    (sum, order) =>
      sum +
      order.items.filter((item) => item.fulfillmentStatus === "PENDING")
        .length,
    0
  );

  const deliveredItems = orders.reduce(
    (sum, order) =>
      sum +
      order.items.filter((item) => item.fulfillmentStatus === "DELIVERED")
        .length,
    0
  );

  return (
    <main className="detail-page">
      <header className="detail-header">
        <Link href="/" className="detail-brand">
          MarketHub
        </Link>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/" className="back-link">
            View storefront
          </Link>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              localStorage.removeItem("markethub-access-token");
              localStorage.removeItem("markethub-user");
              router.replace("/account");
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: 24,
        }}
      >
        <p className="detail-eyebrow">SELLER WORKSPACE</p>

        <h1 style={{ fontSize: 34, margin: "10px 0" }}>
          Vendor dashboard
        </h1>

        <p style={{ color: "#64748b", marginBottom: 28 }}>
          {user
            ? `Welcome, ${user.name}. Manage your products and fulfill your orders here.`
            : "Loading your vendor account..."}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 36,
          }}
        >
          <div style={statCardStyle}>
            <p style={mutedStyle}>Total listings</p>
            <h2 style={statNumberStyle}>{products.length}</h2>
          </div>

          <div style={statCardStyle}>
            <p style={mutedStyle}>Active products</p>
            <h2 style={statNumberStyle}>{activeProducts}</h2>
          </div>

          <div style={statCardStyle}>
            <p style={mutedStyle}>Inactive products</p>
            <h2 style={statNumberStyle}>{inactiveProducts}</h2>
          </div>

          <div style={statCardStyle}>
            <p style={mutedStyle}>Order items</p>
            <h2 style={statNumberStyle}>
              {ordersLoading ? "…" : totalOrderItems}
            </h2>
          </div>

          <div style={statCardStyle}>
            <p style={mutedStyle}>Awaiting processing</p>
            <h2 style={statNumberStyle}>
              {ordersLoading ? "…" : pendingItems}
            </h2>
          </div>

          <div style={statCardStyle}>
            <p style={mutedStyle}>Delivered items</p>
            <h2 style={statNumberStyle}>
              {ordersLoading ? "…" : deliveredItems}
            </h2>
          </div>
        </div>

        <section
          style={{
            marginBottom: 48,
            scrollMarginTop: 24,
          }}
          aria-labelledby="orders-heading"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                id="orders-heading"
                style={{ fontSize: 24, fontWeight: 700 }}
              >
                Your orders
              </h2>

              <p style={{ color: "#64748b", marginTop: 6 }}>
                Track and update fulfillment for products sold by your store.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadOrders()}
              disabled={ordersLoading || updatingItemId !== null}
            >
              {ordersLoading ? "Refreshing..." : "Refresh orders"}
            </button>
          </div>

          <p
            style={{
              fontSize: 13,
              color: "#64748b",
              marginBottom: 16,
            }}
          >
            Status changes apply only to the selected item in your store.
          </p>

          {orderMessage && (
            <p
              role="status"
              style={{
                padding: 12,
                borderRadius: 10,
                background: "#f0fdf4",
                color: "#166534",
                marginBottom: 18,
              }}
            >
              {orderMessage}
            </p>
          )}

          {ordersError && (
            <p
              role="alert"
              style={{
                padding: 12,
                borderRadius: 10,
                background: "#fef2f2",
                color: "#b91c1c",
                marginBottom: 18,
              }}
            >
              {ordersError}
            </p>
          )}

          {ordersLoading ? (
            <p style={{ color: "#64748b" }}>Loading your orders...</p>
          ) : orders.length === 0 ? (
            <div style={emptyStateStyle}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>
                No orders yet
              </h3>
              <p style={{ color: "#64748b", marginTop: 8 }}>
                Orders containing your products will appear here.
              </p>
              <button
                type="button"
                className="secondary-button"
                style={{ marginTop: 16 }}
                onClick={() => void loadOrders()}
              >
                Check again
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {orders.map((order) => (
                <article
                  key={order.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 20,
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                      borderBottom: "1px solid #e5e7eb",
                      paddingBottom: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <p style={mutedStyle}>Order ID</p>
                      <p
                        style={{
                          fontWeight: 700,
                          overflowWrap: "anywhere",
                          marginTop: 4,
                        }}
                      >
                        {order.id}
                      </p>
                      <p
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                          marginTop: 6,
                        }}
                      >
                        Placed {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <p style={mutedStyle}>Your subtotal</p>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: 20,
                          marginTop: 4,
                        }}
                      >
                        {formatCurrency(order.vendorSubtotal)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 16 }}>
                    {order.items.map((item) => {
                      const nextStatuses =
                        NEXT_STATUSES[item.fulfillmentStatus];

                      const colors = statusColor(item.fulfillmentStatus);

                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 16,
                            padding: 14,
                            border: "1px solid #f1f5f9",
                            borderRadius: 12,
                            background: "#fafafa",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 14,
                              flex: "1 1 260px",
                              minWidth: 0,
                            }}
                          >
                            {item.product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                width={76}
                                height={76}
                                style={{
                                  width: 76,
                                  height: 76,
                                  objectFit: "cover",
                                  borderRadius: 10,
                                  background: "#f1f5f9",
                                  flexShrink: 0,
                                }}
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                style={{
                                  width: 76,
                                  height: 76,
                                  display: "grid",
                                  placeItems: "center",
                                  background: "#f1f5f9",
                                  borderRadius: 10,
                                  flexShrink: 0,
                                }}
                              >
                                <span style={{ fontSize: 24 }}>📦</span>
                              </div>
                            )}

                            <div style={{ minWidth: 0 }}>
                              <h3
                                style={{
                                  fontWeight: 700,
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {item.product.name}
                              </h3>

                              <p
                                style={{
                                  color: "#64748b",
                                  fontSize: 13,
                                  marginTop: 5,
                                }}
                              >
                                Quantity: {item.quantity}
                              </p>

                              <p
                                style={{
                                  fontSize: 13,
                                  color: "#64748b",
                                  marginTop: 3,
                                }}
                              >
                                Item ID: {item.id}
                              </p>

                              <p style={{ fontWeight: 600, marginTop: 6 }}>
                                {formatCurrency(item.unitPrice)} each
                              </p>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              justifyItems: "start",
                              gap: 10,
                              minWidth: 180,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: colors.background,
                                color: colors.color,
                                fontSize: 13,
                                fontWeight: 600,
                              }}
                            >
                              {STATUS_LABELS[item.fulfillmentStatus]}
                            </span>

                            {nextStatuses.length > 0 ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
                                {nextStatuses.map((nextStatus) => (
                                  <button
                                    key={nextStatus}
                                    type="button"
                                    className={
                                      nextStatus === "CANCELLED"
                                        ? "secondary-button"
                                        : "cart-primary-button"
                                    }
                                    style={{
                                      fontSize: 12,
                                      padding: "9px 12px",
                                      ...(nextStatus === "CANCELLED"
                                        ? {
                                            color: "#b91c1c",
                                            borderColor: "#fecaca",
                                          }
                                        : {}),
                                    }}
                                    disabled={
                                      updatingItemId !== null ||
                                      ordersLoading
                                    }
                                    onClick={() =>
                                      void handleStatusUpdate(
                                        item.id,
                                        nextStatus
                                      )
                                    }
                                  >
                                    {updatingItemId === item.id
                                      ? "Updating..."
                                      : nextStatus === "CANCELLED"
                                        ? "Cancel item"
                                        : `Mark ${STATUS_LABELS[nextStatus]}`}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p
                                style={{
                                  fontSize: 12,
                                  color: "#64748b",
                                }}
                              >
                                No further status changes
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="products-heading">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <h2
              id="products-heading"
              style={{ fontSize: 24, fontWeight: 700 }}
            >
              Your products
            </h2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadProducts()}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh products"}
              </button>

              <button
                type="button"
                className="cart-primary-button"
                onClick={() => {
                  setShowCreateForm((current) => !current);
                  setFormError("");
                  setSuccessMessage("");
                }}
              >
                {showCreateForm ? "Cancel" : "+ Add product"}
              </button>
            </div>
          </div>

          {successMessage && (
            <p
              role="status"
              style={{
                padding: 12,
                borderRadius: 10,
                background: "#f0fdf4",
                color: "#166534",
                marginBottom: 18,
              }}
            >
              {successMessage}
            </p>
          )}

          {showCreateForm && (
            <section
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 24,
                marginBottom: 28,
                background: "#fff",
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                Add a new product
              </h2>

              <p style={{ color: "#64748b", marginBottom: 20 }}>
                Enter the product details below. The product will be created
                for your vendor store.
              </p>

              <form
                onSubmit={handleCreateProduct}
                style={{ display: "grid", gap: 16 }}
              >
                <label style={{ display: "grid", gap: 6 }}>
                  Product name *
                  <input
                    style={inputStyle}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    minLength={2}
                    maxLength={150}
                    required
                    placeholder="e.g. Handmade Canvas Tote"
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  Description *
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: 120,
                      resize: "vertical",
                    }}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    minLength={2}
                    maxLength={5000}
                    required
                    placeholder="Describe the product, materials, size, and features."
                  />
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 16,
                  }}
                >
                  <label style={{ display: "grid", gap: 6 }}>
                    Price (₹) *
                    <input
                      style={inputStyle}
                      type="number"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="349.00"
                    />
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    Stock quantity *
                    <input
                      style={inputStyle}
                      type="number"
                      value={stock}
                      onChange={(event) => setStock(event.target.value)}
                      min="0"
                      step="1"
                      required
                    />
                  </label>
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  Image URL (optional)
                  <input
                    style={inputStyle}
                    type="url"
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                    maxLength={2048}
                    placeholder="https://example.com/product-image.jpg"
                  />

                  <small style={{ color: "#64748b" }}>
                    Use a publicly accessible image URL beginning with
                    http:// or https://.
                  </small>
                </label>

                {formError && (
                  <p role="alert" style={{ color: "#b91c1c" }}>
                    {formError}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="submit"
                    className="cart-primary-button"
                    disabled={saving}
                  >
                    {saving ? "Creating product..." : "Create product"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          {error && (
            <p
              role="alert"
              style={{ color: "#b91c1c", marginBottom: 20 }}
            >
              {error}
            </p>
          )}

          {loading ? (
            <p style={{ color: "#64748b" }}>Loading your products...</p>
          ) : products.length === 0 ? (
            <div style={emptyStateStyle}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>
                No products yet
              </h3>

              <p style={{ color: "#64748b", margin: "8px 0 16px" }}>
                Add your first product to start building your store.
              </p>

              <button
                type="button"
                className="cart-primary-button"
                onClick={() => setShowCreateForm(true)}
              >
                Add your first product
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {products.map((product) => (
                <article
                  key={product.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 18,
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 20,
                    background: "#fff",
                  }}
                >
                  <div style={{ flex: "1 1 250px" }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                      {product.name}
                    </h3>

                    <p
                      style={{
                        color: "#64748b",
                        marginTop: 5,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {product.description}
                    </p>

                    <p style={{ marginTop: 10 }}>
                      <strong>{formatCurrency(product.price)}</strong>

                      <span style={{ color: "#64748b" }}>
                        {" "}· {product.stock} in stock
                      </span>
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: product.active ? "#dcfce7" : "#f3f4f6",
                        color: product.active ? "#166534" : "#4b5563",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {product.active ? "Active" : "Inactive"}
                    </span>

                    {product.imageUrl && (
                      <a
                        href={product.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="back-link"
                      >
                        View image
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer className="detail-footer">
        <span>MarketHub</span>
        <span>Good finds start here.</span>
      </footer>
    </main>
  );
}

const statCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 20,
  background: "#fff",
};

const mutedStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
};

const statNumberStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 700,
  marginTop: 8,
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 32,
  textAlign: "center",
  background: "#fff",
};
