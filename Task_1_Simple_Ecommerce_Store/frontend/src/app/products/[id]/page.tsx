
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "../../../context/CartContext";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  stock: number;
  imageUrl: string | null;
  vendor?: { storeName: string };
};

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

function ProductDetailsContent() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const controller = new AbortController();

    async function loadProduct() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/products/${encodeURIComponent(productId)}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "This product could not be found."
              : "Unable to load this product. Please try again.",
          );
        }

        const data: Product = await response.json();
        setProduct(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load product.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProduct();
    return () => controller.abort();
  }, [productId]);

  if (loading) {
    return <main className="detail-page"><p className="detail-status">Loading product...</p></main>;
  }

  if (error || !product) {
    return (
      <main className="detail-page">
        <Link href="/" className="back-link">← Back to MarketHub</Link>
        <p className="detail-error">{error || "This product could not be found."}</p>
      </main>
    );
  }

  const price = Number(product.price);

  return (
    <main className="detail-page">
      <header className="detail-header">
        <Link href="/" className="detail-brand">MarketHub</Link>
        <nav style={{ display: "flex", gap: 16 }}>
          <Link href="/" className="back-link">Continue shopping</Link>
          <Link href="/cart" className="back-link">View cart</Link>
        </nav>
      </header>

      <section className="detail-grid">
        <div className="detail-image-wrap">
          <div className="detail-image-fallback">MarketHub</div>
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="detail-image"
              src={product.imageUrl}
              alt={product.name}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>

        <div className="detail-info">
          <p className="detail-eyebrow">
            {product.vendor?.storeName || "MarketHub Store"}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-price">
            ₹{Number.isFinite(price) ? price.toFixed(2) : "—"}
          </p>
          <p className="detail-description">
            {product.description || "No description is available for this product yet."}
          </p>
          <p className="detail-stock">
            {product.stock > 0 ? `${product.stock} available` : "Currently out of stock"}
          </p>

          <button
            className="detail-button"
            type="button"
            disabled={product.stock <= 0}
            onClick={() => {
              addToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                stock: product.stock,
                imageUrl: product.imageUrl,
                vendor: product.vendor,
              });
              setAdded(true);
            }}
          >
            {product.stock > 0 ? "Add to cart" : "Out of stock"}
          </button>

          {added && (
            <p role="status" style={{ marginTop: 12, color: "#166534" }}>
              Added to cart! <Link href="/cart">View your cart →</Link>
            </p>
          )}

          <p className="detail-note">
            Final price and stock are verified when you place your order.
          </p>
        </div>
      </section>

      <footer className="detail-footer">
        <span>MarketHub</span>
        <span>Discover something you love.</span>
      </footer>
    </main>
  );
}

function ProductDetailsFallback() {
  return <main className="detail-page"><p className="detail-status">Preparing product details...</p></main>;
}

export default function ProductDetailsPage() {
  return (
    <Suspense fallback={<ProductDetailsFallback />}>
      <ProductDetailsContent />
    </Suspense>
  );
}
