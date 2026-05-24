import { createClient } from "../../utils/supabase/server";
import { TenantDinerPage } from "../tenant-diner-page";

type DinerSlugPageProps = {
  params: Promise<{
    restaurant_slug: string;
  }>;
};

export default async function DinerSlugPage({ params }: DinerSlugPageProps) {
  const { restaurant_slug } = await params;

  let initialUserId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    initialUserId = user?.id ?? null;
  } catch {
    // Auth unavailable — render as logged-out
  }

  return (
    <TenantDinerPage
      restaurantSlug={restaurant_slug}
      initialUserId={initialUserId}
    />
  );
}
