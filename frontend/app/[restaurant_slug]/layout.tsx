"use client";

import { Suspense, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { TenantLocaleProvider } from "../../context/TenantLocaleContext";

function TenantLocaleLayoutInner({ children }: { children: ReactNode }) {
  const params = useParams();
  const restaurantSlug = String(params.restaurant_slug ?? "");

  return (
    <TenantLocaleProvider restaurantSlug={restaurantSlug}>
      {children}
    </TenantLocaleProvider>
  );
}

export default function RestaurantSlugLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-white" />}>
      <TenantLocaleLayoutInner>{children}</TenantLocaleLayoutInner>
    </Suspense>
  );
}
