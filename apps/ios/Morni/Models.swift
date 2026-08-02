import Foundation

enum UaeEmirate: String, Codable, CaseIterable, Identifiable {
    case dubai, abu_dhabi, sharjah, ajman, uaq, rak, fujairah
    var id: String { rawValue }
    var label: String {
        switch self {
        case .dubai: return "Dubai"
        case .abu_dhabi: return "Abu Dhabi"
        case .sharjah: return "Sharjah"
        case .ajman: return "Ajman"
        case .uaq: return "Umm Al Quwain"
        case .rak: return "Ras Al Khaimah"
        case .fujairah: return "Fujairah"
        }
    }
}

enum OrderStatus: String, Codable {
    case placed, accepted, picking, out_for_delivery, delivered, cancelled
    var label: String {
        switch self {
        case .placed: return "Placed"
        case .accepted: return "Accepted"
        case .picking: return "Being prepared"
        case .out_for_delivery: return "Out for delivery"
        case .delivered: return "Delivered"
        case .cancelled: return "Cancelled"
        }
    }
}

struct Store: Identifiable, Codable, Hashable {
    let id: UUID
    let name: String
    let slug: String
    let description: String?
    let emirate: UaeEmirate
    let area: String
    let address: String
    let logo_url: String?
    let cover_url: String?
    let is_active: Bool
    let delivery_eta_minutes: Int
}

struct Product: Identifiable, Codable, Hashable {
    let id: UUID
    let store_id: UUID
    let title: String
    let description: String?
    let price_aed: Double
    let compare_at_price_aed: Double?
    let image_urls: [String]
    let stock: Int
    let is_available: Bool
}

struct Order: Identifiable, Codable, Hashable {
    let id: UUID
    let order_number: String
    let shopper_id: UUID
    let store_id: UUID
    let status: OrderStatus
    let payment_method: String
    let payment_status: String
    let subtotal_aed: Double
    let delivery_fee_aed: Double
    let total_aed: Double
    let delivery_emirate: UaeEmirate
    let delivery_area: String
    let delivery_street: String
    let delivery_building: String?
    let delivery_apartment: String?
    let delivery_notes: String?
    let delivery_eta_minutes: Int
    let placed_at: String
}

struct OrderItem: Identifiable, Codable, Hashable {
    let id: UUID
    let order_id: UUID
    let product_id: UUID?
    let title: String
    let unit_price_aed: Double
    let quantity: Int
    let line_total_aed: Double
}

struct CartItem: Identifiable, Hashable {
    var id: UUID { productId }
    let productId: UUID
    let storeId: UUID
    let storeName: String
    let title: String
    let priceAed: Double
    let imageUrl: String?
    var quantity: Int
}

enum Formatters {
    static func aed(_ value: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "AED"
        f.locale = Locale(identifier: "en_AE")
        return f.string(from: NSNumber(value: value)) ?? "AED \(value)"
    }

    static func deliveryPromise(_ minutes: Int = 60) -> String {
        minutes <= 60 ? "Delivery within 1 hour" : "Delivery in about \(minutes) minutes"
    }
}
