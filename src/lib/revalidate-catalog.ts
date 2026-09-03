"use server";

import { revalidateTag } from "next/cache";

/** Bust public catalog caches after owner catalog mutations. */
export async function revalidatePublicCatalog(tags: string[] = ["catalog"]) {
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}
