#!/usr/bin/env python3
"""Explicit, resumable live evaluation through Ideaboard's real native transport.

Uses only fictional prepared requests. Reads the configured credential inside the
compiled native process; it is never printed, persisted, or placed in arguments.
No board operations are applied. Requires the installed Mac app's configuration.
"""
from pathlib import Path
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
import platform
import plistlib
import re
import subprocess
import sys
import tempfile


def canonical_bytes(value):
    """Sorted object keys, compact JSON, literal Unicode, UTF-8, no final newline.

    Hash payload strings as supplied; do not parse or normalise their input JSON.
    """
    return json.dumps(value, sort_keys=True, separators=(',', ':'),
                      ensure_ascii=False, allow_nan=False).encode('utf-8')


def json_hash(value):
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def request_hashes(records):
    if not isinstance(records, list):
        raise ValueError('Prepared requests must be a JSON array')
    hashes, seen = {}, set()
    for item in records:
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id']:
            raise ValueError('Prepared request has no valid case ID')
        if item['id'] in seen:
            raise ValueError(f"Repeated prepared case ID: {item['id']}")
        seen.add(item['id'])
        if isinstance(item.get('request'), dict) and item.get('preparationError') is None:
            hashes[item['id']] = json_hash(item['request'])
    return hashes


def snapshot_manifest(model, native_sources, hashes):
    # native_sources maps repository-relative POSIX paths to SHA-256(raw bytes).
    native_hash = json_hash(native_sources)
    snapshot = {'schemaVersion': 1, 'model': model,
                'nativeSourceHash': native_hash, 'requestHashes': hashes}
    return {**snapshot, 'hashAlgorithm': 'sha256',
            'canonicalization': 'sorted-keys-compact-json-utf8-v1',
            'nativeSources': native_sources, 'snapshotHash': json_hash(snapshot)}


def read_jsonl(path):
    if not path.exists():
        return []
    data = path.read_bytes()
    if data and not data.endswith(b'\n'):
        raise ValueError(f'{path.name} has an incomplete final record; preserve it and inspect before resuming')
    records, ids = [], set()
    for number, line in enumerate(data.splitlines(), 1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except (ValueError, UnicodeDecodeError) as error:
            raise ValueError(f'{path.name}:{number} is not a complete JSON record') from error
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id']:
            raise ValueError(f'{path.name}:{number} has no valid case ID')
        if item['id'] in ids:
            raise ValueError(f"Repeated case ID in {path.name}: {item['id']}")
        ids.add(item['id'])
        records.append(item)
    return records


def validate_saved_records(results, started, manifest):
    legacy = manifest.get('legacyAdoption') or {}
    legacy_ids = set(legacy.get('ids', []))
    completed_ids = {row['id'] for row in results}
    if not legacy_ids <= completed_ids:
        raise ValueError('Adopted legacy results are missing; do not truncate the saved results')
    for row in results + started:
        case_id = row['id']
        expected = manifest['requestHashes'].get(case_id)
        if expected is None:
            raise ValueError(f'Saved case {case_id} is absent from the current request snapshot')
        legacy_row = row in results and case_id in legacy_ids and 'requestHash' not in row and 'snapshotHash' not in row
        if legacy_row:
            if row.get('model') != manifest['model'] and row.get('status') != 'native-request-rejected':
                raise ValueError(f'Legacy result {case_id} has a different or unknown model')
        elif (row.get('requestHash') != expected or row.get('snapshotHash') != manifest['snapshotHash']
              or row.get('model') != manifest['model']):
            raise ValueError(f'Saved provenance does not match the current snapshot for {case_id}')
    for row in started:
        if row.get('schemaVersion') != 1 or row.get('status') != 'started':
            raise ValueError(f"Invalid started journal record: {row['id']}")
    started_ids = {row['id'] for row in started}
    for row in results:
        if row['id'] not in legacy_ids and row.get('status') != 'native-request-rejected' and row['id'] not in started_ids:
            raise ValueError(f"Result {row['id']} has no durable started record")
    return started_ids - completed_ids


def guard_manifest(path, results_path, journal_path, current, adopt_existing):
    results, started = read_jsonl(results_path), read_jsonl(journal_path)
    if path.exists():
        manifest = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(manifest, dict) or any(manifest.get(key) != value for key, value in current.items()):
            raise ValueError('Saved manifest differs from the actual payload/native-source/model snapshot. Use a new output file; existing results were kept.')
    else:
        if started:
            raise ValueError('Started journal exists without its manifest; inspect it before resuming')
        if results and not adopt_existing:
            raise ValueError('Existing results have no provenance manifest. After verifying the run snapshot stayed unchanged, explicitly use --adopt-existing-results, or use a new output file.')
        manifest = {**current, 'legacyAdoption': None}
        if results:
            warning = ('Legacy results predate fingerprinting. Adoption associates them with the current '
                       'snapshot but cannot independently establish their original payload or native-source provenance.')
            print('PROVENANCE LIMITATION: ' + warning, file=sys.stderr, flush=True)
            manifest['legacyAdoption'] = {'ids': sorted(row['id'] for row in results),
                                          'adoptedAt': datetime.now(timezone.utc).isoformat(),
                                          'provenance': 'unverified-before-adoption', 'warning': warning}
    unresolved = validate_saved_records(results, started, manifest)
    return manifest, unresolved


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def create_manifest(path, manifest):
    # Exclusive creation never overwrites an earlier manifest or result log.
    with path.open('x', encoding='utf-8') as file:
        file.write(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
        file.flush()
        os.fsync(file.fileno())
    sync_directory(path.parent)


harness = r'''
extension IdeaboardAIService {
    static func evaluationContent(_ instruction: String, _ input: String) -> Any {
        providerContent(instruction: instruction, input: input, images: [])
    }
}
let arguments = CommandLine.arguments
if arguments.count == 3 && arguments[1] == "--model" {
    guard let model = UserDefaults(suiteName: arguments[2])?.string(forKey: "Ideaboard.AI.OpenAIModel"), !model.isEmpty else {
        fputs("Configured model unavailable; no requests sent.\n", stderr)
        exit(2)
    }
    print(model)
    exit(0)
}
let requestsURL = URL(fileURLWithPath: arguments[1])
let resultsURL = URL(fileURLWithPath: arguments[2])
let maximum = Int(arguments[3])!
let concurrency = Int(arguments[4])!
let defaults = UserDefaults(suiteName: arguments[5])!
let manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: arguments[6]))) as! [String: Any]
let hashes = manifest["requestHashes"] as! [String: String]
let snapshotHash = manifest["snapshotHash"] as! String
let journalURL = URL(fileURLWithPath: arguments[7])
guard defaults.string(forKey: "Ideaboard.AI.OpenAIModel") == manifest["model"] as? String else {
    fputs("Configured model changed after snapshot validation. No requests sent.\n", stderr)
    exit(2)
}
guard defaults.bool(forKey: "Ideaboard.AI.CloudConsent"),
      let model = defaults.string(forKey: "Ideaboard.AI.OpenAIModel"), !model.isEmpty,
      let credential = AIKeychainStore().read(), !credential.isEmpty else {
    fputs("Configured provider credential/model unavailable to the native evaluation runner. No requests sent.\n", stderr)
    exit(2)
}
let records = try JSONSerialization.jsonObject(with: Data(contentsOf: requestsURL)) as! [[String: Any]]
func recordedIDs(_ url: URL) throws -> Set<String> {
    guard FileManager.default.fileExists(atPath: url.path) else { return [] }
    let existing = try String(contentsOf: url, encoding: .utf8)
    var ids = Set<String>()
    for line in existing.split(separator: "\n") where !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        let value = try JSONSerialization.jsonObject(with: Data(line.utf8)) as! [String: Any]
        ids.insert(value["id"] as! String)
    }
    return ids
}
let completedIDs = try recordedIDs(resultsURL)
let startedIDs = try recordedIDs(journalURL)
let queue = records.filter { $0["request"] is [String: Any] && $0["preparationError"] is NSNull && !completedIDs.contains($0["id"] as! String) && !startedIDs.contains($0["id"] as! String) }
let selected = Array(queue.prefix(maximum))
print("Live evaluation: \(selected.count) new cases; model \(model); concurrency \(concurrency). Completed IDs and \(startedIDs.subtracting(completedIDs).count) unresolved starts are skipped. No board writes.")
fflush(stdout)
if !FileManager.default.fileExists(atPath: resultsURL.path) { FileManager.default.createFile(atPath: resultsURL.path, contents: nil) }
let file = try FileHandle(forWritingTo: resultsURL)
try file.seekToEnd()
let journal = try FileHandle(forWritingTo: journalURL)
try journal.seekToEnd()
var next = 0, finishedCount = 0, active = 0, consecutiveTransportFailures = 0
private var transports: [String: AIHTTPSRequest] = [:]
var stopped = false
func save(_ record: [String: Any]) {
    var data = try! JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])
    data.append(10)
    try! file.write(contentsOf: data)
    try! file.synchronize()
    finishedCount += 1
    print("\(finishedCount)/\(selected.count) \(record["id"]!) \(record["status"]!)")
    fflush(stdout)
}
func provenance(_ id: String) -> [String: Any] {
    ["id": id, "model": model, "requestHash": hashes[id]!, "snapshotHash": snapshotHash]
}
func recordStarted(_ id: String) {
    var record = provenance(id)
    record["schemaVersion"] = 1
    record["status"] = "started"
    record["startedAt"] = ISO8601DateFormatter().string(from: Date())
    var data = try! JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])
    data.append(10)
    try! journal.write(contentsOf: data)
    try! journal.synchronize()
}
func startMore() {
    while !stopped && active < concurrency && next < selected.count {
        let item = selected[next]; next += 1
        let id = item["id"] as! String
        let payload = item["request"] as! [String: Any]
        guard let context = IdeaboardAIService.validGenerationContext(payload),
              let operation = context["command"] as? String else {
            var row = provenance(id)
            row["status"] = "native-request-rejected"
            row["error"] = "Production native preflight rejected the frontend request. No provider call."
            save(row)
            continue
        }
        let body: [String: Any] = [
            "model": model, "store": false, "max_output_tokens": 8192,
            "instructions": IdeaboardAIService.providerInstructions(operation: operation),
            "input": [["role": "user", "content": IdeaboardAIService.evaluationContent(payload["instruction"] as! String, payload["input"] as! String)]],
            "text": ["format": ["type": "json_schema", "name": operation == "design-framework" ? "ideaboard_framework_design" : operation == "board-command" ? "ideaboard_board_command" : "ideaboard_draft", "strict": true, "schema": IdeaboardAIService.outputSchema(operation: operation, context: context)]],
            "stream": true
        ]
        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/responses")!)
        request.httpMethod = "POST"
        request.setValue("Bearer " + credential, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try! JSONSerialization.data(withJSONObject: body)
        let began = Date()
        let transport = AIHTTPSRequest(request: request, streaming: true) { result in
            var row = provenance(id)
            row["operation"] = operation
            row["elapsedSeconds"] = Date().timeIntervalSince(began)
            row["completedAt"] = ISO8601DateFormatter().string(from: Date())
            switch result {
            case .success(let data):
                consecutiveTransportFailures = 0
                let reply = IdeaboardAIService.decodeProvider(data, id: id, model: model, operation: operation, context: context)
                row["reply"] = try! JSONSerialization.jsonObject(with: JSONEncoder().encode(reply))
                row["status"] = reply.ok ? "native-valid" : "native-response-rejected"
                if let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    row["usage"] = response["usage"]
                    let output = response["output"] as? [[String: Any]] ?? []
                    let parts = output.flatMap { $0["content"] as? [[String: Any]] ?? [] }.filter { $0["type"] as? String == "output_text" }.compactMap { $0["text"] as? String }
                    let text = parts.joined()
                    if let draft = try? JSONSerialization.jsonObject(with: Data(text.utf8)) { row["rawDraft"] = draft }
                    else { row["rawText"] = String(text.prefix(120000)) }
                }
            case .failure(let error):
                consecutiveTransportFailures += 1
                row["status"] = "transport-error"
                row["error"] = error.message
                row["errorCode"] = error.code
                if ["authentication_failed", "rate_limited"].contains(error.code) || consecutiveTransportFailures >= 5 { stopped = true }
            }
            save(row)
            transports.removeValue(forKey: id)
            active -= 1
            startMore()
        }
        transports[id] = transport
        active += 1
        // Persist before sending: interrupted starts remain uncertain and are never retried automatically.
        recordStarted(id)
        transport.start()
    }
}
startMore()
while active > 0 { RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1)) }
try file.close()
try journal.close()
print("Live evaluation finished: \(finishedCount) recorded. Stopped on provider failure: \(stopped).")
exit(stopped ? 3 : 0)
'''


def run(args):
    root = Path(__file__).resolve().parents[1]
    paths = ['macOS/IdeaboardMac/Sources/AppDelegate.swift',
             'macOS/IdeaboardMac/Sources/LocalWebServer.swift']
    source_bytes = {path: (root / path).read_bytes() for path in paths}
    native_sources = {path: hashlib.sha256(data).hexdigest() for path, data in source_bytes.items()}
    source = source_bytes[paths[0]].decode('utf-8')
    if source.count('@main\n') != 1:
        raise RuntimeError('Expected the production native entry point once')
    source = source.replace('@main\n', '', 1)
    environment = dict(os.environ)
    environment.setdefault('DEVELOPER_DIR', '/Applications/Xcode.app/Contents/Developer')
    with tempfile.TemporaryDirectory(prefix='ideaboard-live-eval-') as directory:
        temporary = Path(directory)
        main, web_server = temporary / 'main.swift', temporary / 'LocalWebServer.swift'
        main.write_text(source + '\n' + harness, encoding='utf-8')
        web_server.write_bytes(source_bytes[paths[1]])
        executable = temporary / 'ideaboard-evaluation'
        subprocess.run(['xcrun', 'swiftc', '-target', f'{platform.machine()}-apple-macos13.0',
                        str(main), str(web_server), '-o', str(executable)], env=environment, check=True)
        if args.compile_only:
            print('Native harness compiled. No credentials read, manifests changed, or provider requests sent.')
            return 0

        app = Path.home() / 'Applications/Ideaboard.app'
        with (app / 'Contents/Info.plist').open('rb') as file:
            bundle_id = plistlib.load(file)['CFBundleIdentifier']
        # This mode reads only the configured model through Foundation; no Keychain access.
        model = subprocess.run([str(executable), '--model', bundle_id], env=environment,
                               capture_output=True, text=True, check=True).stdout.rstrip('\n')
        records_bytes = (root / args.requests).resolve().read_bytes()
        hashes = request_hashes(json.loads(records_bytes))
        current = snapshot_manifest(model, native_sources, hashes)
        results_path = (root / args.output).resolve()
        manifest_path = Path(str(results_path) + '.manifest.json')
        journal_path = Path(str(results_path) + '.started.jsonl')
        results_path.parent.mkdir(parents=True, exist_ok=True)
        with Path(str(results_path) + '.lock').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise RuntimeError('Another live runner holds this output lock; no requests sent') from error
            manifest, unresolved = guard_manifest(manifest_path, results_path, journal_path,
                                                  current, args.adopt_existing_results)
            if unresolved:
                print(f'Skipping {len(unresolved)} unresolved started IDs to avoid duplicate paid calls: '
                      + ', '.join(sorted(unresolved)), file=sys.stderr, flush=True)
            signature = subprocess.run(['codesign', '-dvv', str(app)], capture_output=True, text=True, check=True)
            authority = re.search(r'^Authority=(Apple Development: .+)$', signature.stderr, re.MULTILINE)
            if not authority:
                raise RuntimeError('Expected the installed app development signature; no requests sent')
            subprocess.run(['codesign', '--force', '--sign', authority.group(1), '--identifier', bundle_id,
                            str(executable)], check=True, capture_output=True)
            if not manifest_path.exists():
                create_manifest(manifest_path, manifest)
            # Make the journal's directory entry durable before the native process appends/fsyncs starts.
            if not journal_path.exists():
                with journal_path.open('xb') as file:
                    file.flush()
                    os.fsync(file.fileno())
                sync_directory(journal_path.parent)
            # Execute exactly the bytes fingerprinted above, not a file that could change during compilation.
            request_snapshot = temporary / 'requests.json'
            request_snapshot.write_bytes(records_bytes)
            # Keep the lock in an orphaned native child too if the Python launcher is interrupted.
            result = subprocess.run([str(executable), str(request_snapshot), str(results_path), str(args.limit),
                                     str(args.concurrency), bundle_id, str(manifest_path), str(journal_path)],
                                    env=environment, pass_fds=(lock.fileno(),))
            return result.returncode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--requests', default='output/assistant-generation/requests.json')
    parser.add_argument('--output', default='output/assistant-generation/live-results.jsonl')
    parser.add_argument('--limit', type=int, default=300, help='Maximum new paid requests in this invocation')
    parser.add_argument('--concurrency', type=int, choices=[1, 2], default=2)
    parser.add_argument('--adopt-existing-results', action='store_true',
                        help='Explicitly associate legacy results with the current snapshot; original provenance cannot be verified')
    parser.add_argument('--compile-only', action='store_true',
                        help='Compile the native harness and exit without credentials, manifests, journals, or provider calls')
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 300:
        parser.error('--limit must be between 1 and 300')
    try:
        return run(args)
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Live evaluation stopped: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
