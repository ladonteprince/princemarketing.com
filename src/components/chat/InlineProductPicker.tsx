"use client";

import { useState } from "react";
import { Check, ExternalLink, ShoppingBag, Loader2 } from "lucide-react";

// WHY: Inline product picker that renders inside the chat message stream.
// When the AI runs a product search ("find me a Rolex Submariner"), the
// results stream back as a grid of cards the user can tap to add as a
// reference image — no modal, no context switch. Chat-first philosophy.

export type Product = {
  imageUrl: string;
  title: string;
  sourceUrl: string;
  sourceDomain: string;
  price?: string;
};

type InlineProductPickerProps = {
  query: string;
  label: string;
  products: Product[];
  onSelect: (product: Product, label: string) => Promise<void> | void;
};

export default function InlineProductPicker({
  query,
  label,
  products,
  onSelect,
}: InlineProductPickerProps) {
  // WHY: imageUrl doubles as the unique key — product search APIs rarely
  // return stable IDs, but image URLs are unique per result.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // WHY: Empty state. Search may return zero results (rare brand, blocked
  // sources, etc.) — we still need to acknowledge the search ran.
  if (!products || products.length === 0) {
    return (
      <div className="ml-11 mt-2">
        <div className="flex items-center gap-2 text-xs text-ash/70">
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>
            Product search: <span className="text-cloud">{query}</span>
          </span>
          <span className="text-ash/50">— No products found</span>
        </div>
      </div>
    );
  }

  const handleSelect = async (product: Product) => {
    // WHY: Guard against double-clicks and clicks while another card is
    // being added — prevents duplicate reference image uploads.
    if (adding || selectedId) return;
    setSelectedId(product.imageUrl);
    setAdding(true);
    try {
      await onSelect(product, label);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="ml-11 mt-2">
      {/* Header row: icon + query + count */}
      <div className="mb-2 flex items-center gap-2">
        <ShoppingBag className="h-3.5 w-3.5 text-ash" />
        <span className="text-xs text-cloud">
          Product search: <span className="font-medium">{query}</span>
        </span>
        <span className="text-[10px] text-ash/60">
          {products.length} result{products.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Responsive grid: 2 cols mobile → 3 tablet → 5 desktop */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((product) => {
          const isSelected = selectedId === product.imageUrl;
          const isDisabled = selectedId !== null && !isSelected;
          const isAddingThis = isSelected && adding;
          const isAddedThis = isSelected && !adding;

          return (
            <div
              key={product.imageUrl}
              className={[
                "group relative flex flex-col gap-1.5 rounded-xl border bg-graphite p-2 transition-all",
                isSelected
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-smoke hover:border-royal hover:bg-royal/10",
                isDisabled ? "opacity-40" : "",
              ].join(" ")}
            >
              {/* Image — primary click target for selection */}
              <button
                type="button"
                onClick={() => handleSelect(product)}
                disabled={isDisabled || adding || isAddedThis}
                className="relative block aspect-square w-full overflow-hidden rounded-xl bg-smoke disabled:cursor-not-allowed"
                aria-label={`Add ${product.title} as reference`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />

                {/* Loading overlay while awaiting onSelect */}
                {isAddingThis && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 text-[10px] text-cloud">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Adding...
                    </div>
                  </div>
                )}

                {/* Success badge after onSelect resolves */}
                {isAddedThis && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Check className="h-3 w-3" />
                      Added
                    </div>
                  </div>
                )}
              </button>

              {/* Title — 2 line clamp via webkit-line-clamp */}
              <div
                className="text-xs leading-snug text-cloud"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                title={product.title}
              >
                {product.title}
              </div>

              {/* Price (optional) */}
              {product.price && (
                <div className="text-[10px] font-medium text-emerald-400">
                  {product.price}
                </div>
              )}

              {/* Source link — separate click target, opens in new tab */}
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[10px] text-ash/60 hover:text-ash"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                <span className="truncate">{product.sourceDomain}</span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
