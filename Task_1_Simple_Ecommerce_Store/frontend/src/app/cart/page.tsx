
"use client";

import Link from "next/link";
import { useCart } from "../../context/CartContext";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

export default function CartPage() {
  const {
    items,
    ready,
    itemCount,
    subtotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  if (!ready) {
    return <main className="cart-page"><p>Loading your cart...</p></main>;
  }

  return (
    <main className="cart-page">
      <header className="cart-page-header">
        <Link href="/" className="detail-brand">MarketHub</Link>
        <Link href="/" className="back-link">← Continue shopping</Link>
      </header>

      <section className="cart-main">
        <div className="cart-title-row">
          <div>
            <p className="detail-eyebrow">YOUR MARKETPLACE PICKS</p>
            <h1>Your shopping cart</h1>
            <p>{itemCount} {itemCount === 1 ? "item" : "items"} in your cart</p>
          </div>

          {items.length > 0 && (
            <button
              className="cart-text-button"
              type="button"
              onClick={clearCart}
            >
              Clear cart
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty-icon">M.</div>
            <h2>Your cart is waiting for a good find.</h2>
            <p>Explore MarketHub and add something you love.</p>
            <Link href="/" className="cart-primary-button">
              Explore products
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              {items.map(({ product, quantity }) => (
                <article className="cart-item" key={product.id}>
                  <div className="cart-item-image">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span>M.</span>
                    )}
                  </div>

                  <div className="cart-item-info">
                    <p className="cart-item-vendor">
                      {product.vendor?.storeName || "MarketHub Store"}
                    </p>
                    <h2>{product.name}</h2>
                    <p className="cart-item-price">
                      {formatPrice(Number(product.price))}
                    </p>

                    <div className="cart-item-actions">
                      <label>
                        Qty{" "}
                        <select
                          value={quantity}
                          onChange={(event) =>
                            updateQuantity(product.id, Number(event.target.value))
                          }
                        >
                          {Array.from(
                            { length: Math.max(1, product.stock) },
                            (_, index) => index + 1,
                          ).map((number) => (
                            <option key={number} value={number}>
                              {number}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        className="cart-text-button"
                        onClick={() => removeFromCart(product.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <p className="cart-line-total">
                    {formatPrice(Number(product.price) * quantity)}
                  </p>
                </article>
              ))}
            </div>

            <aside className="cart-summary">
              <h2>Order summary</h2>
              <div className="cart-summary-line">
                <span>Items ({itemCount})</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="cart-summary-line">
                <span>Shipping</span>
                <span>Not included</span>
              </div>
              <div className="cart-summary-total">
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>

              <Link
                href="/checkout"
                className="cart-primary-button cart-checkout-button"
              >
                Proceed to checkout
              </Link>

              <p className="cart-summary-note">
                The server checks current prices and available stock when you
                place your order.
              </p>
            </aside>
          </div>
        )}
      </section>

      <footer className="detail-footer">
        <span>MarketHub</span>
        <span>Good finds start here.</span>
      </footer>
    </main>
  );
}
