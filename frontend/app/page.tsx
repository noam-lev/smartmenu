import MenuItemCard from "../components/MenuItemCard";
import mockMenu from "../data/mockMenu.json";

export default function Home() {
  const startersCategory = mockMenu.menu.categories.find(
    (category) => category.name === "Starters",
  );

  const items = startersCategory?.items ?? [];

  return (
    <div className="min-h-screen bg-zinc-50 py-4">
      <main className="mx-auto flex max-w-md flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {mockMenu.restaurant.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">Starters</h1>
        </header>

        <section className="max-h-[calc(100vh-7rem)] overflow-y-auto">
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </section>
      </main>
    </div>
  );
}
