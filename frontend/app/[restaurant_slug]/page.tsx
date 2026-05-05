import { TenantDinerPage } from "../tenant-diner-page";

type DinerSlugPageProps = {
  params: Promise<{
    restaurant_slug: string;
  }>;
};

export default async function DinerSlugPage({ params }: DinerSlugPageProps) {
  const { restaurant_slug } = await params;
  return <TenantDinerPage restaurantSlug={restaurant_slug} />;
}
