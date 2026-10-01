// swift-tools-version: 5.9
import PackageDescription

// ⚠️ The package and product name are NOT free choices. `cap sync` DERIVES them
// from the npm package name and writes that into the app's generated
// Package.swift: "@musical-symmetry/capacitor-coremidi" becomes
// "MusicalSymmetryCapacitorCoremidi" — each hyphen-separated segment capitalised,
// nothing capitalised within a segment ("Coremidi", not "CoreMidi").
//
// Get it wrong and SPM fails at resolution, not compile:
//   product 'MusicalSymmetryCapacitorCoremidi' required by package 'capapp-spm'
//   target 'CapApp-SPM' not found in package 'MusicalSymmetryCapacitorCoremidi'
//
// The official plugins satisfy this by construction (@capacitor/share declares
// "CapacitorShare"), so the rule is invisible in every example you would copy.
let package = Package(
    name: "MusicalSymmetryCapacitorCoremidi",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "MusicalSymmetryCapacitorCoremidi",
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
