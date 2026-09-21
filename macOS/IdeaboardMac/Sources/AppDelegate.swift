import AppKit
import Foundation

@main
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let port = 5174
    private let appPath = "/ideaboard.html"
    private var serverProcess: Process?

    private var logURL: URL {
        FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Logs/Ideaboard/launcher.log")
    }

    private enum LauncherError: LocalizedError {
        case npmNotFound

        var errorDescription: String? {
            switch self {
            case .npmNotFound:
                return "npm was not found in /opt/homebrew/bin, /usr/local/bin, or /usr/bin."
            }
        }
    }

    static func main() {
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        application.setActivationPolicy(.accessory)
        application.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        log("Launching Ideaboard")
        Task { @MainActor in
            await launchIdeaboard()
        }
    }

    private var ideaboardURL: URL {
        URL(string: "http://127.0.0.1:\(port)\(appPath)")!
    }

    private var projectRoot: URL? {
        guard let path = Bundle.main.object(forInfoDictionaryKey: "IDEABOARD_PROJECT_ROOT") as? String,
              !path.isEmpty else {
            return nil
        }

        return URL(fileURLWithPath: path).standardizedFileURL
    }

    private func launchIdeaboard() async {
        guard let projectRoot else {
            log("Project root is missing from the app bundle")
            showError(
                title: "Ideaboard could not start",
                message: "The app could not find the Ideaboard project folder. Re-run the Mac installer from the project folder."
            )
            return
        }

        log("Project root: \(projectRoot.path)")

        if await waitForServer(for: 1.5) {
            log("Found an existing server")
            openIdeaboard()
            return
        }

        do {
            try startServer(in: projectRoot)
        } catch {
            log("Could not start server: \(error.localizedDescription)")
            showError(
                title: "Ideaboard could not start",
                message: "Node.js and npm are required. Install the Node.js LTS version, then run the Mac installer again.\n\n\(error.localizedDescription)"
            )
            return
        }

        if await waitForServer(for: 15) {
            log("Server became ready")
            openIdeaboard()
        } else {
            log("Server did not become ready within 15 seconds")
            showError(
                title: "Ideaboard is taking too long to start",
                message: "Open the project folder in Terminal and run `npm run dev -- --port 5174` to see the startup message."
            )
        }
    }

    private func startServer(in projectRoot: URL) throws {
        let npmPaths = [
            "/opt/homebrew/bin/npm",
            "/usr/local/bin/npm",
            "/usr/bin/npm",
        ]
        guard let npmPath = npmPaths.first(where: FileManager.default.isExecutableFile(atPath:)) else {
            throw LauncherError.npmNotFound
        }

        log("Starting npm at \(npmPath)")

        let process = Process()
        process.executableURL = URL(fileURLWithPath: npmPath)
        process.arguments = [
            "run",
            "dev",
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            "\(port)",
        ]
        process.currentDirectoryURL = projectRoot

        var environment = ProcessInfo.processInfo.environment
        let fallbackPath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
        environment["PATH"] = [fallbackPath, environment["PATH"] ?? ""].filter { !$0.isEmpty }.joined(separator: ":")
        process.environment = environment

        let logDirectory = logURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: logURL.path, contents: nil)
        let outputLog = FileHandle(forWritingAtPath: logURL.path)
        let errorLog = FileHandle(forWritingAtPath: logURL.path)
        outputLog?.seekToEndOfFile()
        errorLog?.seekToEndOfFile()
        process.standardOutput = outputLog
        process.standardError = errorLog
        process.terminationHandler = { [weak self] process in
            self?.log("npm terminated with status \(process.terminationStatus)")
        }
        try process.run()
        log("npm process started with pid \(process.processIdentifier)")
        serverProcess = process
    }

    private func waitForServer(for timeout: TimeInterval) async -> Bool {
        let deadline = Date().addingTimeInterval(timeout)

        while Date() < deadline {
            if await serverIsReady() {
                return true
            }

            try? await Task.sleep(nanoseconds: 250_000_000)
        }

        return false
    }

    private func serverIsReady() async -> Bool {
        var request = URLRequest(url: ideaboardURL)
        request.httpMethod = "GET"
        request.timeoutInterval = 1

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    private func openIdeaboard() {
        NSWorkspace.shared.open(ideaboardURL)
        NSApp.terminate(nil)
    }

    private func showError(title: String, message: String) {
        log("Showing error: \(title) - \(message)")
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.runModal()
        NSApp.terminate(nil)
    }

    private func log(_ message: String) {
        let logDirectory = logURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        let line = "\(ISO8601DateFormatter().string(from: Date())) \(message)\n"
        if !FileManager.default.fileExists(atPath: logURL.path) {
            FileManager.default.createFile(atPath: logURL.path, contents: nil)
        }
        guard let handle = FileHandle(forWritingAtPath: logURL.path) else { return }
        handle.seekToEndOfFile()
        handle.write(Data(line.utf8))
        try? handle.close()
    }
}
