import SwiftUI

struct DiscoverView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("UAE · Local boutiques")
                        .font(.caption)
                        .tracking(2)
                        .foregroundStyle(Color(red: 0.56, green: 0.24, blue: 0.35))
                    Text("Morni")
                        .font(.system(size: 48, weight: .medium, design: .serif))
                    Text("Browse nearby retail offerings and get delivery within 1 hour.")
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        FilterChip(title: "All", selected: model.selectedEmirate == nil) {
                            model.selectedEmirate = nil
                            Task { await model.loadStores() }
                        }
                        ForEach(UaeEmirate.allCases.prefix(4)) { emirate in
                            FilterChip(title: emirate.label, selected: model.selectedEmirate == emirate) {
                                model.selectedEmirate = emirate
                                Task { await model.loadStores() }
                            }
                        }
                    }
                    .padding(.horizontal)
                }

                LazyVStack(spacing: 16) {
                    ForEach(model.stores) { store in
                        NavigationLink(value: store) {
                            StoreRow(store: store)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .background(Color(red: 1.0, green: 0.97, blue: 0.96))
        .navigationDestination(for: Store.self) { store in
            StoreDetailView(store: store)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct FilterChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(selected ? Color(red: 0.11, green: 0.08, blue: 0.09) : .white)
                .foregroundStyle(selected ? .white : .secondary)
                .clipShape(Capsule())
        }
    }
}

struct StoreRow: View {
    let store: Store

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            RoundedRectangle(cornerRadius: 18)
                .fill(Color(red: 0.95, green: 0.89, blue: 0.86))
                .frame(height: 140)
                .overlay {
                    if let cover = store.cover_url, let url = URL(string: cover) {
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Color.clear
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                    }
                }
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(store.name).font(.headline)
                    Text("\(store.area), \(store.emirate.label)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(Formatters.deliveryPromise(store.delivery_eta_minutes))
                    .font(.caption2)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color(red: 1.0, green: 0.94, blue: 0.96))
                    .clipShape(Capsule())
            }
        }
        .padding(14)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

struct StoreDetailView: View {
    @Environment(AppModel.self) private var model
    let store: Store
    @State private var products: [Product] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(Formatters.deliveryPromise(store.delivery_eta_minutes))
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.56, green: 0.24, blue: 0.35))
                Text(store.name)
                    .font(.system(size: 34, weight: .medium, design: .serif))
                Text("\(store.area), \(store.emirate.label)")
                    .foregroundStyle(.secondary)
                if let description = store.description {
                    Text(description)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    ForEach(products) { product in
                        NavigationLink {
                            ProductDetailView(store: store, product: product)
                        } label: {
                            ProductCard(product: product)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 8)
            }
            .padding()
        }
        .background(Color(red: 1.0, green: 0.97, blue: 0.96))
        .task {
            products = await model.products(for: store.id)
        }
    }
}

struct ProductCard: View {
    let product: Product

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(red: 0.95, green: 0.89, blue: 0.86))
                .aspectRatio(4 / 5, contentMode: .fit)
                .overlay {
                    if let first = product.image_urls.first, let url = URL(string: first) {
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: { Color.clear }
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
            Text(product.title).font(.subheadline).lineLimit(2)
            Text(Formatters.aed(product.price_aed)).font(.footnote)
        }
    }
}

struct ProductDetailView: View {
    @Environment(AppModel.self) private var model
    let store: Store
    let product: Product
    @State private var added = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                RoundedRectangle(cornerRadius: 24)
                    .fill(Color(red: 0.95, green: 0.89, blue: 0.86))
                    .aspectRatio(4 / 5, contentMode: .fit)
                    .overlay {
                        if let first = product.image_urls.first, let url = URL(string: first) {
                            AsyncImage(url: url) { image in
                                image.resizable().scaledToFill()
                            } placeholder: { Color.clear }
                            .clipShape(RoundedRectangle(cornerRadius: 24))
                        }
                    }

                Text("\(store.name) · \(Formatters.deliveryPromise(store.delivery_eta_minutes))")
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.56, green: 0.24, blue: 0.35))
                Text(product.title)
                    .font(.system(size: 32, weight: .medium, design: .serif))
                Text(Formatters.aed(product.price_aed)).font(.title3)
                if let description = product.description {
                    Text(description).foregroundStyle(.secondary)
                }
                Button(added ? "Added to bag" : "Add to bag") {
                    model.addToCart(product: product, storeName: store.name)
                    added = true
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.11, green: 0.08, blue: 0.09))
            }
            .padding()
        }
        .background(Color(red: 1.0, green: 0.97, blue: 0.96))
    }
}
