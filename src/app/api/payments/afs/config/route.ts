import { NextResponse } from "next/server";
import {
  AfsError,
  getAfsConfig,
  getAfsPaymentBrands,
  isAfsPaymentsEnabled,
} from "@/lib/afs/client";

export async function GET() {
  try {
    const enabled = isAfsPaymentsEnabled();
    if (!enabled) {
      return NextResponse.json({ enabled: false, brands: getAfsPaymentBrands() });
    }
    // Validates credentials are present when enabled.
    getAfsConfig();
    return NextResponse.json({
      enabled: true,
      brands: getAfsPaymentBrands(),
    });
  } catch (error) {
    if (error instanceof AfsError) {
      return NextResponse.json(
        { enabled: false, brands: getAfsPaymentBrands(), error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ enabled: false, brands: getAfsPaymentBrands() });
  }
}
