import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), callVisionProvider: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/bulk-vision", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/bulk-vision")>()),
  callVisionProvider: mocks.callVisionProvider,
}));

const image = { id: "photo-1", name: "camera.jpg", data: "data:image/jpeg;base64,AAAA" };
function request(body: unknown) {
  return new Request("http://localhost/api/portal/products/bulk-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function query(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function signedIn(user: { id: string } | null = { id: "seller-1" }) {
  const from = vi.fn((table: string) => table === "store_members"
    ? query({ store_id: "store-1" })
    : query({ role: "seller" }));
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
  });
  return { from };
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.callVisionProvider.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_API_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("bulk analysis route", () => {
  it("turns one uploaded photo into one reviewable product group", async () => {
    signedIn();
    mocks.callVisionProvider.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ groups: [{
        imageIds: ["img_001"],
        title: "Blue Embroidered Kurta Set",
        description: "A blue kurta set with visible floral embroidery and a matching dupatta.",
        confidence: 0.9,
        needsReview: false,
      }] }),
      latencyMs: 10,
      attempts: 1,
    });

    const response = await POST(request({ storeId: "store-1", images: [image] }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0]).toMatchObject({ imageIds: ["photo-1"], title: "Blue Embroidered Kurta Set", aiGenerated: true });
    expect(mocks.callVisionProvider).toHaveBeenCalledOnce();
  });

  it("requires sign-in before sending any photo to the AI provider", async () => {
    signedIn(null);
    const response = await POST(request({ storeId: "store-1", images: [image] }));
    expect(response.status).toBe(401);
    expect(mocks.callVisionProvider).not.toHaveBeenCalled();
  });

  it("rejects malformed image data before the provider call", async () => {
    signedIn();
    const response = await POST(request({ storeId: "store-1", images: [{ ...image, data: "data:," }] }));
    expect(response.status).toBe(400);
    expect(mocks.callVisionProvider).not.toHaveBeenCalled();
  });

  it("keeps a single photo available for manual review when AI fails", async () => {
    signedIn();
    mocks.callVisionProvider.mockResolvedValue({
      ok: false,
      kind: "provider_timeout",
      message: "timed out",
      latencyMs: 45_000,
      attempts: 2,
    });
    const response = await POST(request({ storeId: "store-1", images: [image] }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.groups).toMatchObject([{ imageIds: ["photo-1"], title: "", generationStatus: "failed" }]);
  });
});
