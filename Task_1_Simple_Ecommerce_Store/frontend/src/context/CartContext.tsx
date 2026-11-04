
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartProduct = {
  id: string;
  name: string;
  price: number | string;
  stock: number;
  imageUrl: string | null;
  vendor?: { storeName: string };
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  ready: boolean;
  itemCount: number;
  subtotal: number;
  addToCart: (product: CartProduct, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);
const STORAGE_KEY = "markethub-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(
              (item): item is CartItem =>
                item &&
                typeof item.product?.id === "string" &&
                typeof item.quantity === "number" &&
                item.quantity > 0
            )
          );
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (ready) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, ready]);

  const addToCart = useCallback(
    (product: CartProduct, quantity = 1) => {
      if (product.stock <= 0 || quantity <= 0) return;

      setItems((current) => {
        const existing = current.find(
          (item) => item.product.id === product.id
        );

        if (!existing) {
          return [
            ...current,
            {
              product,
              quantity: Math.min(quantity, product.stock),
            },
          ];
        }

        return current.map((item) =>
          item.product.id === product.id
            ? {
                product,
                quantity: Math.min(
                  item.quantity + quantity,
                  product.stock
                ),
              }
            : item
        );
      });
    },
    []
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      setItems((current) =>
        current
          .map((item) =>
            item.product.id === productId
              ? {
                  ...item,
                  quantity: Math.min(
                    Math.max(0, Math.floor(quantity)),
                    Math.max(0, item.product.stock)
                  ),
                }
              : item
          )
          .filter((item) => item.quantity > 0)
      );
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setItems((current) =>
      current.filter((item) => item.product.id !== productId)
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextType>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );

    return {
      items,
      ready,
      itemCount,
      subtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
    };
  }, [
    items,
    ready,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  ]);

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider.");
  }

  return context;
}
