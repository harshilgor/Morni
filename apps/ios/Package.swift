// swift-tools-version: 5.9
import PackageDescription

// Reference package for dependencies. Prefer creating an Xcode iOS App target
// and adding supabase-swift there (see README.md).
let package = Package(
    name: "MorniIOS",
    platforms: [.iOS(.v17)],
    products: [],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0")
    ],
    targets: [
        .target(
            name: "MorniSources",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift")
            ],
            path: "Morni"
        )
    ]
)
