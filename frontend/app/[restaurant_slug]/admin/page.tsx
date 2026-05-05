import { TenantAdminPage } from "../../tenant-admin-page";

type AdminSlugPageProps = {
  params: Promise<{
    restaurant_slug: string;
  }>;
};

export default async function AdminSlugPage({ params }: AdminSlugPageProps) {
  const { restaurant_slug } = await params;
  return <TenantAdminPage restaurantSlug={restaurant_slug} />;
}
