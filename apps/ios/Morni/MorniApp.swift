import SwiftUI

@main
struct MorniApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task { await model.bootstrap() }
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            NavigationStack {
                DiscoverView()
            }
            .tabItem { Label("Discover", systemImage: "sparkles") }

            NavigationStack {
                CartView()
            }
            .tabItem { Label("Bag", systemImage: "bag") }

            NavigationStack {
                OrdersView()
            }
            .tabItem { Label("Orders", systemImage: "shippingbox") }

            NavigationStack {
                AccountView()
            }
            .tabItem { Label("Account", systemImage: "person") }
        }
        .tint(Color(red: 0.77, green: 0.36, blue: 0.48))
    }
}
