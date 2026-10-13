import Foundation
import Network

final class LocalWebServer {
    private let queue = DispatchQueue(label: "com.janiceho.ideaboard.web-server")
    private let portDefaultsKey = "Ideaboard.LocalWebServerPort"
    private var listener: NWListener?
    private let webRoot: URL
    private(set) var port: UInt16?

    init() {
        webRoot = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true)
            ?? URL(fileURLWithPath: "/")
    }

    func start(completion: @escaping (Result<URL, Error>) -> Void) {
        let homePage = webRoot.appendingPathComponent("ideaboard.html")
        guard FileManager.default.fileExists(atPath: homePage.path) else {
            completion(.failure(ServerError.missingWebAssets))
            return
        }

        if let savedPort = UserDefaults.standard.object(forKey: portDefaultsKey) as? Int,
           (1...65535).contains(savedPort) {
            listen(on: [UInt16(savedPort)], completion: completion)
        } else {
            listen(on: Array(5180...5195).map(UInt16.init), completion: completion)
        }
    }

    private func listen(on candidates: [UInt16], completion: @escaping (Result<URL, Error>) -> Void) {
        guard let candidatePort = candidates.first else {
            completion(.failure(ServerError.noAvailablePort))
            return
        }

        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(
                host: NWEndpoint.Host("127.0.0.1"),
                port: NWEndpoint.Port(rawValue: candidatePort)!
            )
            let candidate = try NWListener(using: parameters)
            listener = candidate
            var didComplete = false
            var waitingError: NWError?
            // A listener can remain .waiting forever when the loopback address
            // disappears. Finish startup once so AppDelegate can show an error.
            let startupDeadline = DispatchWorkItem { [weak self, weak candidate] in
                guard let self, let candidate, !didComplete else { return }
                didComplete = true
                candidate.stateUpdateHandler = nil
                candidate.cancel()
                self.listener = nil
                let detail: String
                if case .posix(.EADDRNOTAVAIL)? = waitingError {
                    detail = "The Mac's standard local address (127.0.0.1) is unavailable. Restore that loopback address, then reopen Ideaboard."
                } else {
                    detail = waitingError?.localizedDescription ?? "The local server did not become ready within 5 seconds."
                }
                completion(.failure(ServerError.startupTimedOut(candidatePort, detail)))
            }
            candidate.stateUpdateHandler = { [weak self] state in
                guard let self, !didComplete else { return }
                switch state {
                case .ready:
                    didComplete = true
                    startupDeadline.cancel()
                    self.port = candidatePort
                    UserDefaults.standard.set(Int(candidatePort), forKey: self.portDefaultsKey)
                    completion(.success(URL(string: "http://127.0.0.1:\(candidatePort)/ideaboard.html")!))
                case .failed(let error):
                    didComplete = true
                    startupDeadline.cancel()
                    candidate.stateUpdateHandler = nil
                    candidate.cancel()
                    self.listener = nil
                    if candidates.count > 1 {
                        self.listen(on: Array(candidates.dropFirst()), completion: completion)
                    } else {
                        completion(.failure(ServerError.portUnavailable(candidatePort, error.localizedDescription)))
                    }
                case .waiting(let error):
                    waitingError = error
                default:
                    break
                }
            }
            candidate.newConnectionHandler = { [weak self] connection in
                self?.serve(connection)
            }
            candidate.start(queue: queue)
            queue.asyncAfter(deadline: .now() + 5, execute: startupDeadline)
        } catch {
            if candidates.count > 1 {
                listen(on: Array(candidates.dropFirst()), completion: completion)
            } else {
                completion(.failure(ServerError.portUnavailable(candidatePort, error.localizedDescription)))
            }
        }
    }

    private func serve(_ connection: NWConnection) {
        connection.start(queue: queue)
        receiveRequest(from: connection, data: Data())
    }

    private func receiveRequest(from connection: NWConnection, data: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] chunk, _, isComplete, error in
            guard let self, error == nil else {
                connection.cancel()
                return
            }
            var requestData = data
            if let chunk { requestData.append(chunk) }

            let delimiter = Data("\r\n\r\n".utf8)
            if requestData.range(of: delimiter) != nil {
                self.respond(to: requestData, on: connection)
            } else if requestData.count > 32_768 || isComplete {
                self.send(status: 400, reason: "Bad Request", mime: "text/plain; charset=utf-8", body: Data("Bad Request".utf8), headOnly: false, on: connection)
            } else {
                self.receiveRequest(from: connection, data: requestData)
            }
        }
    }

    private func respond(to requestData: Data, on connection: NWConnection) {
        guard let headerEnd = requestData.range(of: Data("\r\n".utf8))?.lowerBound,
              let requestLine = String(data: requestData[..<headerEnd], encoding: .utf8) else {
            send(status: 400, reason: "Bad Request", mime: "text/plain; charset=utf-8", body: Data("Bad Request".utf8), headOnly: false, on: connection)
            return
        }
        let components = requestLine.split(separator: " ")
        guard components.count >= 2 else {
            send(status: 400, reason: "Bad Request", mime: "text/plain; charset=utf-8", body: Data("Bad Request".utf8), headOnly: false, on: connection)
            return
        }
        let method = String(components[0])
        let headOnly = method == "HEAD"
        guard method == "GET" || headOnly else {
            send(status: 405, reason: "Method Not Allowed", mime: "text/plain; charset=utf-8", body: Data("Method Not Allowed".utf8), headOnly: false, on: connection)
            return
        }

        let rawPath = String(components[1]).split(separator: "?", maxSplits: 1).first.map(String.init) ?? "/"
        guard let decodedPath = rawPath.removingPercentEncoding,
              !decodedPath.contains("\\"),
              !decodedPath.split(separator: "/").contains("..") else {
            send(status: 400, reason: "Bad Request", mime: "text/plain; charset=utf-8", body: Data("Bad Request".utf8), headOnly: headOnly, on: connection)
            return
        }

        let relativePath = decodedPath == "/" ? "ideaboard.html" : String(decodedPath.drop(while: { $0 == "/" }))
        let fileURL = webRoot.appendingPathComponent(relativePath).standardizedFileURL
        guard fileURL.path.hasPrefix(webRoot.standardizedFileURL.path + "/"),
              let body = try? Data(contentsOf: fileURL) else {
            send(status: 404, reason: "Not Found", mime: "text/plain; charset=utf-8", body: Data("Not Found".utf8), headOnly: headOnly, on: connection)
            return
        }
        send(status: 200, reason: "OK", mime: mimeType(for: fileURL.pathExtension), body: body, headOnly: headOnly, on: connection)
    }

    private func send(status: Int, reason: String, mime: String, body: Data, headOnly: Bool, on connection: NWConnection) {
        let headers = Data("HTTP/1.1 \(status) \(reason)\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n".utf8)
        var response = headers
        if !headOnly { response.append(body) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }

    private func mimeType(for extensionName: String) -> String {
        switch extensionName.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "json", "map": "application/json"
        case "svg": "image/svg+xml"
        case "png": "image/png"
        case "jpg", "jpeg": "image/jpeg"
        case "webp": "image/webp"
        case "woff": "font/woff"
        case "woff2": "font/woff2"
        case "ttf": "font/ttf"
        case "ico": "image/x-icon"
        case "wasm": "application/wasm"
        default: "application/octet-stream"
        }
    }

    private enum ServerError: LocalizedError {
        case missingWebAssets
        case noAvailablePort
        case portUnavailable(UInt16, String)
        case startupTimedOut(UInt16, String)

        var errorDescription: String? {
            switch self {
            case .missingWebAssets:
                "The app is missing its bundled Ideaboard files. Run the Mac installer again from the project folder."
            case .noAvailablePort:
                "Ideaboard could not find a free local port. Close another app using ports 5180 through 5195, then reopen Ideaboard."
            case .portUnavailable(let port, let detail):
                "Ideaboard's saved local port (\(port)) is unavailable. Close the app using it and reopen Ideaboard.\n\n\(detail)"
            case .startupTimedOut(let port, let detail):
                "Ideaboard could not start its local page at 127.0.0.1:\(port). Your saved workspace address has not been changed.\n\n\(detail)"
            }
        }
    }
}
