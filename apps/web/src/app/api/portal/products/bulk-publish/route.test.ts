import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePublicCatalog: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/revalidate-catalog", () => ({ revalidatePublicCatalog: mocks.revalidatePublicCatalog }));

const validItem = {
  title: "Blue Embroidered Kurta Set",
  productTag: "",
  description: "A blue embroidered kurta set.",
  fabric: null,
  categorySlug: "kurtis",
  occasion: "diwali",
  priceAed: 150,
  stock: 1,
  sizes: ["S"],
  sizeStock: { S: 1 },
  images: ["https://example.com/photo.jpg"],
};

function request(items: unknown[] = [validItem]) {
  return new Request("http://localhost/api/portal/products/bulk-publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId: "store-1", items }),
  });
}

function setupAdmin(published: unknown = [{ item_id: "row-1", product_id: "product-1", ok: true, error_message: null }]) {
  const importItemsInsert = vi.fn((rows: Array<{ title: string }>) => ({
    select: vi.fn().mockResolvedValue({
      data: rows.map((row, index) => ({ id: `row-${index + 1}`, title: row.title })),
      error: null,
    }),
  }));
  const tables: Record<string, unknown> = {
    store_members: {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { store_id: "store-1" }, error: null }),
    },
    profiles: {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { role: "seller" }, error: null }),
    },
    categories: {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [{ slug: "kurtis" }], error: null }),
    },
    bulk_imports: {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "import-1" }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    },
    bulk_import_items: { insert: importItemsInsert },
  };
  const rpc = vi.fn().mockResolvedValue({ data: published, error: null });
  const from = vi.fn((name: string) => tables[name]);
  mocks.createAdminClient.mockReturnValue({ from, rpc });
  return { from, rpc, importItemsInsert };
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.revalidatePublicCatalog.mockReset().mockResolvedValue(undefined);
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "seller-1" } }, error: null }) },
  });
});

describe("bulk publishing route", () => {
  it("publishes one product with one photo and reports its persisted product ID", async () => {
    const admin = setupAdmin();
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      importId: "import-1", created: 1, failed: 0,
      results: [{ title: validItem.title, index: 0, ok: true, id: "product-1" }],
    });
    expect(admin.importItemsInsert).toHaveBeenCalledWith([
      expect.objectContaining({ occasion: "diwali", image_urls: validItem.images, stock: 1 }),
    ]);
    expect(admin.rpc).toHaveBeenCalledWith("publish_bulk_import", { p_import_id: "import-1" });
    expect(mocks.revalidatePublicCatalog).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing occasion", { ...validItem, occasion: undefined }, "Best occasion"],
    ["too many photos", { ...validItem, images: Array(11).fill(validItem.images[0]) }, "maximum of 10 photos"],
  ])("rejects %s before any database writes", async (_name, item, message) => {
    const response = await POST(request([item]));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(message);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects zero stock before creating an import or publishing products", async () => {
    const admin = setupAdmin();
    const response = await POST(request([{ ...validItem, stock: 0, sizeStock: { S: 0 } }]));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("stock");
    expect(admin.importItemsInsert).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("reports an individual database failure instead of claiming success", async () => {
    setupAdmin([{ item_id: "row-1", product_id: null, ok: false, error_message: "Stock constraint failed" }]);
    const response = await POST(request());
    const body = await response.json();
    expect(body).toMatchObject({
      created: 0, failed: 1,
      results: [{ index: 0, ok: false, error: "Stock constraint failed" }],
    });
    expect(mocks.revalidatePublicCatalog).not.toHaveBeenCalled();
  });

  it("rejects incomplete database results so the UI cannot show a false success", async () => {
    setupAdmin([]);
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("incomplete result");
    expect(mocks.revalidatePublicCatalog).not.toHaveBeenCalled();
  });
});
