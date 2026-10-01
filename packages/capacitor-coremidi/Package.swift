// swift-tools-version: 5.9
import PackageDescription

// Shape and dependency pinning copied from @capacitor/share, which `cap sync`
// already resolves in this project — the conventions are not guesswork.
let package = Package(
    name: "MusicalSymmetryCoreMidi",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "MusicalSymmetryCoreMidi",
            targets: ["CoreMidiPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CoreMidiPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CoreMidiPlugin")
    ]
)
