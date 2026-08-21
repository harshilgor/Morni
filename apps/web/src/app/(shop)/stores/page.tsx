import { HomeStores } from "@/components/home-stores";
import { getCachedActiveStores } from "@/lib/catalog";

export default async function StoresPage() {
  const stores = await getCachedActiveStores();
  return <HomeStores stores={stores} layout="grid" />;
}
