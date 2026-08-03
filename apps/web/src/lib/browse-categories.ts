export type BrowseCategory = {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  badge: string | null;
  search_terms: string[];
  sort_order: number;
  is_featured: boolean;
};
