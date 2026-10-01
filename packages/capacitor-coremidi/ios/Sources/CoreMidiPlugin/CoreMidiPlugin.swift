import Foundation
import Capacitor
import CoreMIDI

/**
 * CoreMIDI bridge for iOS.
 *
 * WHY THIS EXISTS. WebKit refuses the Web MIDI *JavaScript API* on fingerprinting
 * grounds; every iOS browser is WebKit, and Capacitor's WKWebView inherits that.
 * CoreMIDI itself works fully — USB, Lightning/USB-C and Bluetooth LE controllers
 * all deliver events natively. Only the JS doorway is missing, so this supplies one.
 *
 * It is shaped to be driven by the Web MIDI shim in
 * packages/ui/src/utils/webmidi-shim.ts and by nothing else. The method names and
 * payloads mirror what `MIDIAccess`, `MIDIInput` and `MIDIOutput` need, rather than
 * presenting a general-purpose MIDI API. That is deliberate: a generic plugin was
 * evaluated (@eugabrielsilva/capacitor-midi-device, MIT — a useful reference for
 * the CoreMIDI calls below) and rejected because it exposes only *source*
 * enumeration to JS and carries no port id on incoming messages. Web MIDI is a
 * multi-port model; a single-active-device API cannot back it without the shim
 * fighting the plugin.
 *
 * SCOPE, matching exactly what the four consuming files use: enumerate, open and
 * close inputs, send to an output, and report connect/disconnect. No SysEx, no
 * virtual endpoints, no MIDI 2.0/UMP, no timestamps.
 */
@objc(CoreMidiPlugin)
public class CoreMidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CoreMidiPlugin"
    public let jsName = "CoreMidi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enumerate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openInput", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeInput", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise)
    ]

    private var client = MIDIClientRef()
    private var inputPort = MIDIPortRef()
    private var outputPort = MIDIPortRef()
    /// Sources we have connected, keyed by the endpoint id the JS side knows them by.
    private var connectedSources: [UInt32: MIDIEndpointRef] = [:]

    // MARK: - Setup

    /// Creates the MIDI client, input port and output port once, lazily.
    ///
    /// Returns false if CoreMIDI refuses — on the Simulator, for instance, where
    /// there is no MIDI server. The shim treats that as "no devices", which is the
    /// honest answer rather than a crash.
    private func ensureStarted() -> Bool {
        if client != 0 { return true }

        // MIDIClientCreateWithBlock gives us setup-change notifications without a
        // C callback and a context pointer.
        let clientStatus = MIDIClientCreateWithBlock("Chrometria" as CFString, &client) { [weak self] notification in
            let messageID = notification.pointee.messageID
            guard messageID == .msgObjectAdded || messageID == .msgObjectRemoved || messageID == .msgSetupChanged else { return }
            // Notifications arrive on the CoreMIDI thread. Everything that touches
            // the bridge hops to main first.
            DispatchQueue.main.async { self?.notifyListeners("statechange", data: [:]) }
        }
        guard clientStatus == noErr else { return false }

        // MIDI 1.0 protocol on purpose: the four consuming files parse raw status
        // bytes (0x90/0x80 and a channel nibble). Asking for 2.0/UMP would hand
        // them packets they do not understand.
        let inStatus = MIDIInputPortCreateWithProtocol(client, "Chrometria In" as CFString, ._1_0, &inputPort) { [weak self] eventList, srcConnRefCon in
            // srcConnRefCon is whatever we passed to MIDIPortConnectSource — the
            // endpoint id. Without it an incoming message cannot be attributed to
            // a port, which is precisely the limitation that made the off-the-shelf
            // plugin unusable for a multi-port API.
            let sourceId = UInt32(UInt(bitPattern: srcConnRefCon))
            self?.handle(eventList: eventList, sourceId: sourceId)
        }
        guard inStatus == noErr else { return false }

        let outStatus = MIDIOutputPortCreate(client, "Chrometria Out" as CFString, &outputPort)
        guard outStatus == noErr else { return false }

        return true
    }

    // MARK: - Receiving

    /// Called on CoreMIDI's real-time thread. Must not block, allocate heavily, or
    /// touch the web view — hence: copy the bytes out, then hop to main.
    private func handle(eventList: UnsafePointer<MIDIEventList>, sourceId: UInt32) {
        var collected: [[UInt8]] = []
        let list = eventList.pointee
        var packet = list.packet
        for _ in 0..<list.numPackets {
            // Each word is 4 bytes of a Universal MIDI Packet. For MIDI 1.0 channel
            // voice messages the useful bytes are in the low 3 of word 0.
            withUnsafeBytes(of: packet.words) { raw in
                let word = raw.load(as: UInt32.self).bigEndian
                let bytes = [UInt8((word >> 16) & 0xFF), UInt8((word >> 8) & 0xFF), UInt8(word & 0xFF)]
                collected.append(bytes)
            }
            packet = MIDIEventPacketNext(&packet).pointee
        }

        guard !collected.isEmpty else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            for bytes in collected {
                self.notifyListeners("midimessage", data: [
                    "inputId": String(sourceId),
                    "data": bytes.map { Int($0) }
                ])
            }
        }
    }

    // MARK: - Methods

    @objc func enumerate(_ call: CAPPluginCall) {
        guard ensureStarted() else {
            // No MIDI server (Simulator) is not an error — it is an empty device list.
            call.resolve(["inputs": [], "outputs": []])
            return
        }

        var inputs: [[String: Any]] = []
        for index in 0..<MIDIGetNumberOfSources() {
            let endpoint = MIDIGetSource(index)
            guard endpoint != 0 else { continue }
            inputs.append(["id": String(endpointId(endpoint)), "name": displayName(endpoint)])
        }

        var outputs: [[String: Any]] = []
        for index in 0..<MIDIGetNumberOfDestinations() {
            let endpoint = MIDIGetDestination(index)
            guard endpoint != 0 else { continue }
            outputs.append(["id": String(endpointId(endpoint)), "name": displayName(endpoint)])
        }

        call.resolve(["inputs": inputs, "outputs": outputs])
    }

    @objc func openInput(_ call: CAPPluginCall) {
        guard let idString = call.getString("id"), let wanted = UInt32(idString) else {
            call.reject("openInput needs an id")
            return
        }
        guard ensureStarted() else {
            call.reject("CoreMIDI is unavailable on this device")
            return
        }
        guard let endpoint = source(withId: wanted) else {
            call.reject("No MIDI input with id \(idString)")
            return
        }
        if connectedSources[wanted] != nil {
            call.resolve()
            return
        }
        // Pass the endpoint id as the refCon so the receive block can attribute
        // each message to the port it arrived on.
        let refCon = UnsafeMutableRawPointer(bitPattern: UInt(wanted))
        let status = MIDIPortConnectSource(inputPort, endpoint, refCon)
        guard status == noErr else {
            call.reject("Could not connect to that MIDI input (OSStatus \(status))")
            return
        }
        connectedSources[wanted] = endpoint
        call.resolve()
    }

    @objc func closeInput(_ call: CAPPluginCall) {
        guard let idString = call.getString("id"), let wanted = UInt32(idString),
              let endpoint = connectedSources[wanted] else {
            call.resolve()
            return
        }
        MIDIPortDisconnectSource(inputPort, endpoint)
        connectedSources.removeValue(forKey: wanted)
        call.resolve()
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let idString = call.getString("outputId"), let wanted = UInt32(idString) else {
            call.reject("send needs an outputId")
            return
        }
        guard let raw = call.getArray("data") as? [Int], !raw.isEmpty else {
            call.reject("send needs a non-empty data array")
            return
        }
        guard ensureStarted() else {
            call.reject("CoreMIDI is unavailable on this device")
            return
        }
        guard let endpoint = destination(withId: wanted) else {
            call.reject("No MIDI output with id \(idString)")
            return
        }

        let bytes = raw.map { UInt8(truncatingIfNeeded: $0) }
        var builder = MIDIEventList()
        var packet = MIDIEventListInit(&builder, ._1_0)
        // One UMP word holds a MIDI 1.0 channel voice message: 0x2 group nibble,
        // then status and up to two data bytes.
        let status = UInt32(bytes[0])
        let d1 = bytes.count > 1 ? UInt32(bytes[1]) : 0
        let d2 = bytes.count > 2 ? UInt32(bytes[2]) : 0
        let word: UInt32 = (0x2 << 28) | (status << 16) | (d1 << 8) | d2
        packet = MIDIEventListAdd(&builder, MemoryLayout<MIDIEventList>.size, packet, 0, 1, [word])

        let result = MIDISendEventList(outputPort, endpoint, &builder)
        guard result == noErr else {
            call.reject("MIDISendEventList failed (OSStatus \(result))")
            return
        }
        call.resolve()
    }

    // MARK: - Endpoint helpers

    /// A stable per-session identifier. kMIDIPropertyUniqueID survives reconnects,
    /// which matters because Web MIDI consumers hold onto port ids across a
    /// statechange — MidiIOPage looks an output back up by id after the list reloads.
    private func endpointId(_ endpoint: MIDIEndpointRef) -> UInt32 {
        var unique: Int32 = 0
        if MIDIObjectGetIntegerProperty(endpoint, kMIDIPropertyUniqueID, &unique) == noErr {
            return UInt32(bitPattern: unique)
        }
        return endpoint
    }

    private func displayName(_ endpoint: MIDIEndpointRef) -> String {
        var name: Unmanaged<CFString>?
        if MIDIObjectGetStringProperty(endpoint, kMIDIPropertyDisplayName, &name) == noErr,
           let value = name?.takeRetainedValue() {
            return value as String
        }
        return "MIDI Device"
    }

    private func source(withId id: UInt32) -> MIDIEndpointRef? {
        for index in 0..<MIDIGetNumberOfSources() {
            let endpoint = MIDIGetSource(index)
            if endpoint != 0 && endpointId(endpoint) == id { return endpoint }
        }
        return nil
    }

    private func destination(withId id: UInt32) -> MIDIEndpointRef? {
        for index in 0..<MIDIGetNumberOfDestinations() {
            let endpoint = MIDIGetDestination(index)
            if endpoint != 0 && endpointId(endpoint) == id { return endpoint }
        }
        return nil
    }
}
