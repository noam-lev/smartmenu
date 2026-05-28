import QrCodesPage from "../../../../components/admin/qr/QrCodesPage";

type AdminQrCodesPageProps = {
  params: Promise<{
    restaurant_slug: string;
  }>;
};

export default async function AdminQrCodesRoute({ params }: AdminQrCodesPageProps) {
  const { restaurant_slug } = await params;
  return <QrCodesPage restaurantSlug={restaurant_slug} />;
}
