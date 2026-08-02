# Morni iOS (SwiftUI)

Native shopper app. Requires **macOS + Xcode 15+**.

## Setup

1. Open Xcode → **File → New → Project → App**
   - Product Name: `Morni`
   - Interface: SwiftUI
   - Language: Swift
   - Bundle ID: e.g. `com.morni.app`

2. Delete the template source files, then add everything under `apps/ios/Morni/`.

3. Add the Supabase Swift package:
   - **File → Add Package Dependencies**
   - URL: `https://github.com/supabase/supabase-swift`
   - Add products: `Supabase`

4. Confirm `Config.swift` matches your Supabase URL + anon key (same as `apps/web/.env.local`).

5. Run on a simulator or device.

## Features

- Discover stores by UAE emirate
- Store / product browsing
- Bag (single-store cart for 1-hour delivery)
- COD checkout with payment_method/payment_status fields ready for a gateway
- Orders + account auth against the same Supabase backend as web
