import Foundation
import Supabase
import Observation

@MainActor
@Observable
final class AppModel {
    let client = SupabaseClient(
        supabaseURL: AppConfig.supabaseURL,
        supabaseKey: AppConfig.supabaseAnonKey
    )

    var sessionEmail: String?
    var stores: [Store] = []
    var cart: [CartItem] = []
    var orders: [Order] = []
    var selectedEmirate: UaeEmirate? = nil
    var isLoading = false
    var errorMessage: String?

    var cartCount: Int { cart.reduce(0) { $0 + $1.quantity } }
    var cartSubtotal: Double { cart.reduce(0) { $0 + $1.priceAed * Double($1.quantity) } }

    func bootstrap() async {
        await refreshSession()
        await loadStores()
    }

    func refreshSession() async {
        do {
            let session = try await client.auth.session
            sessionEmail = session.user.email
        } catch {
            sessionEmail = nil
        }
    }

    func loadStores() async {
        isLoading = true
        defer { isLoading = false }
        do {
            var query = client.from("stores").select().eq("is_active", value: true).order("name")
            if let selectedEmirate {
                query = query.eq("emirate", value: selectedEmirate.rawValue)
            }
            stores = try await query.execute().value
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func products(for storeId: UUID) async -> [Product] {
        do {
            return try await client
                .from("products")
                .select()
                .eq("store_id", value: storeId.uuidString)
                .eq("is_available", value: true)
                .order("created_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = error.localizedDescription
            return []
        }
    }

    func addToCart(product: Product, storeName: String) {
        if let other = cart.first(where: { $0.storeId != product.store_id }) {
            _ = other
            cart = []
        }
        if let idx = cart.firstIndex(where: { $0.productId == product.id }) {
            cart[idx].quantity += 1
        } else {
            cart.append(
                CartItem(
                    productId: product.id,
                    storeId: product.store_id,
                    storeName: storeName,
                    title: product.title,
                    priceAed: product.price_aed,
                    imageUrl: product.image_urls.first,
                    quantity: 1
                )
            )
        }
    }

    func signIn(email: String, password: String) async -> Bool {
        do {
            try await client.auth.signIn(email: email, password: password)
            await refreshSession()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func signUp(email: String, password: String, fullName: String) async -> Bool {
        do {
            try await client.auth.signUp(
                email: email,
                password: password,
                data: ["full_name": .string(fullName), "role": .string("shopper")]
            )
            await refreshSession()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func signOut() async {
        try? await client.auth.signOut()
        sessionEmail = nil
    }

    func loadOrders() async {
        do {
            let session = try await client.auth.session
            orders = try await client
                .from("orders")
                .select()
                .eq("shopper_id", value: session.user.id.uuidString)
                .order("placed_at", ascending: false)
                .execute()
                .value
        } catch {
            orders = []
        }
    }

    func placeOrder(
        emirate: UaeEmirate,
        area: String,
        street: String,
        building: String,
        apartment: String,
        notes: String
    ) async -> UUID? {
        guard let first = cart.first else { return nil }
        do {
            let session = try await client.auth.session
            struct OrderInsert: Encodable {
                let shopper_id: UUID
                let store_id: UUID
                let status: String
                let payment_method: String
                let payment_status: String
                let subtotal_aed: Double
                let delivery_fee_aed: Double
                let total_aed: Double
                let delivery_emirate: String
                let delivery_area: String
                let delivery_street: String
                let delivery_building: String?
                let delivery_apartment: String?
                let delivery_notes: String?
                let delivery_eta_minutes: Int
            }
            struct OrderRow: Decodable { let id: UUID }

            let store: Store = try await client
                .from("stores")
                .select()
                .eq("id", value: first.storeId.uuidString)
                .single()
                .execute()
                .value

            let subtotal = cartSubtotal
            let inserted: OrderRow = try await client
                .from("orders")
                .insert(
                    OrderInsert(
                        shopper_id: session.user.id,
                        store_id: first.storeId,
                        status: "placed",
                        payment_method: "cod",
                        payment_status: "pending",
                        subtotal_aed: subtotal,
                        delivery_fee_aed: 0,
                        total_aed: subtotal,
                        delivery_emirate: emirate.rawValue,
                        delivery_area: area,
                        delivery_street: street,
                        delivery_building: building.isEmpty ? nil : building,
                        delivery_apartment: apartment.isEmpty ? nil : apartment,
                        delivery_notes: notes.isEmpty ? nil : notes,
                        delivery_eta_minutes: store.delivery_eta_minutes
                    )
                )
                .select("id")
                .single()
                .execute()
                .value

            struct ItemInsert: Encodable {
                let order_id: UUID
                let product_id: UUID
                let title: String
                let unit_price_aed: Double
                let quantity: Int
                let line_total_aed: Double
            }

            let items = cart.map {
                ItemInsert(
                    order_id: inserted.id,
                    product_id: $0.productId,
                    title: $0.title,
                    unit_price_aed: $0.priceAed,
                    quantity: $0.quantity,
                    line_total_aed: $0.priceAed * Double($0.quantity)
                )
            }
            try await client.from("order_items").insert(items).execute()
            cart = []
            return inserted.id
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}
