// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ChrometriaCore",
    products: [.library(name: "ChrometriaCore", targets: ["ChrometriaCore"])],
    targets: [
        .target(name: "ChrometriaCore"),
        .testTarget(name: "ChrometriaCoreTests", dependencies: ["ChrometriaCore"]),
    ]
)
