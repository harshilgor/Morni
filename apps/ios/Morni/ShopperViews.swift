import SwiftUI

struct CartView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if model.cart.isEmpty {
                ContentUnavailableView("Your bag is empty", systemImage: "bag", description: Text("Browse stores to add items."))
            } else {
                List {
                    Section {
                        ForEach(model.cart) { item in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(item.title)
                                    Text(Formatters.aed(item.priceAed)).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Stepper("\(item.quantity)", value: binding(for: item), in: 1...20)
                                    .labelsHidden()
                                Text("\(item.quantity)").font(.caption)
                            }
                        }
                        .onDelete { indexSet in
                            model.cart.remove(atOffsets: indexSet)
                        }
                    } header: {
                        Text(model.cart.first?.storeName ?? "Bag")
                    } footer: {
                        Text("One store per order for 1-hour delivery routing.")
                    }

                    Section {
                        LabeledContent("Subtotal", value: Formatters.aed(model.cartSubtotal))
                        LabeledContent("Delivery", value: "AED 0 · within 1 hour")
                        NavigationLink("Checkout · Pay on delivery") {
                            CheckoutView()
                        }
                    }
                }
            }
        }
        .navigationTitle("Bag")
        .background(Color(red: 1.0, green: 0.97, blue: 0.96))
    }

    private func binding(for item: CartItem) -> Binding<Int> {
        Binding(
            get: { model.cart.first(where: { $0.productId == item.productId })?.quantity ?? 1 },
            set: { newValue in
                if let idx = model.cart.firstIndex(where: { $0.productId == item.productId }) {
                    model.cart[idx].quantity = newValue
                }
            }
        )
    }
}

struct CheckoutView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var emirate: UaeEmirate = .dubai
    @State private var area = ""
    @State private var street = ""
    @State private var building = ""
    @State private var apartment = ""
    @State private var notes = ""
    @State private var placing = false

    var body: some View {
        Form {
            Section("Delivery address") {
                Picker("Emirate", selection: $emirate) {
                    ForEach(UaeEmirate.allCases) { Text($0.label).tag($0) }
                }
                TextField("Area / neighbourhood", text: $area)
                TextField("Street", text: $street)
                TextField("Building", text: $building)
                TextField("Apartment / villa", text: $apartment)
                TextField("Notes", text: $notes)
            }
            Section("Payment") {
                Text("Cash / card on delivery")
                Text("payment_method = cod · payment_status = pending")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Section {
                Button(placing ? "Placing…" : "Place order · \(Formatters.aed(model.cartSubtotal))") {
                    Task {
                        placing = true
                        let id = await model.placeOrder(
                            emirate: emirate,
                            area: area,
                            street: street,
                            building: building,
                            apartment: apartment,
                            notes: notes
                        )
                        placing = false
                        if id != nil { dismiss() }
                    }
                }
                .disabled(placing || area.isEmpty || street.isEmpty || model.sessionEmail == nil)
            }
            if model.sessionEmail == nil {
                Section {
                    Text("Sign in from the Account tab before placing an order.")
                        .foregroundStyle(.secondary)
                }
            }
            if let error = model.errorMessage {
                Section { Text(error).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Checkout")
    }
}

struct OrdersView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Group {
            if model.sessionEmail == nil {
                ContentUnavailableView("Sign in to see orders", systemImage: "person.crop.circle")
            } else if model.orders.isEmpty {
                ContentUnavailableView("No orders yet", systemImage: "shippingbox")
            } else {
                List(model.orders) { order in
                    NavigationLink {
                        OrderDetailView(order: order)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(order.order_number).font(.headline)
                            Text("\(order.status.label) · \(Formatters.aed(order.total_aed))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(Formatters.deliveryPromise(order.delivery_eta_minutes))
                                .font(.caption2)
                        }
                    }
                }
            }
        }
        .navigationTitle("Orders")
        .task { await model.loadOrders() }
        .refreshable { await model.loadOrders() }
    }
}

struct OrderDetailView: View {
    let order: Order

    var body: some View {
        List {
            Section("Status") {
                Text(order.status.label)
                Text(Formatters.deliveryPromise(order.delivery_eta_minutes))
            }
            Section("Payment") {
                LabeledContent("Method", value: order.payment_method.uppercased())
                LabeledContent("Status", value: order.payment_status)
                LabeledContent("Total", value: Formatters.aed(order.total_aed))
            }
            Section("Delivery") {
                Text(order.delivery_street)
                Text("\(order.delivery_area), \(order.delivery_emirate.label)")
            }
        }
        .navigationTitle(order.order_number)
    }
}

struct AccountView: View {
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var isSignUp = false

    var body: some View {
        Form {
            if let sessionEmail = model.sessionEmail {
                Section("Signed in") {
                    Text(sessionEmail)
                    Button("Sign out", role: .destructive) {
                        Task { await model.signOut() }
                    }
                }
            } else {
                Section(isSignUp ? "Create account" : "Sign in") {
                    if isSignUp {
                        TextField("Full name", text: $fullName)
                    }
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                }
                Section {
                    Button(isSignUp ? "Create account" : "Sign in") {
                        Task {
                            if isSignUp {
                                _ = await model.signUp(email: email, password: password, fullName: fullName)
                            } else {
                                _ = await model.signIn(email: email, password: password)
                            }
                        }
                    }
                    Button(isSignUp ? "Have an account? Sign in" : "Need an account? Sign up") {
                        isSignUp.toggle()
                    }
                }
            }
            if let error = model.errorMessage {
                Section { Text(error).foregroundStyle(.red) }
            }
            Section("About") {
                Text("Morni delivers local UAE retail within 1 hour.")
                Text("Payments gateway will be added after infrastructure.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Account")
    }
}
