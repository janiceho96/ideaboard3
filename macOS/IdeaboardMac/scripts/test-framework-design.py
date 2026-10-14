#!/usr/bin/env python3
"""Run the actual native bridge validators/decoder, without opening the app or making requests."""
from pathlib import Path
import os
import platform
import subprocess
import tempfile

project = Path(__file__).resolve().parents[1]
source = (project / "Sources/AppDelegate.swift").read_text()
assert source.count("@main\n") == 1, "Expected one application entry point"
source = source.replace("@main\n", "", 1)

harness = r'''
var checks = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else { fatalError(message) }
    checks += 1
}
func payload(_ context: [String: Any], images: Any = []) -> [String: Any] {
    ["instruction": "Design a useful thinking framework.",
     "input": String(data: try! JSONSerialization.data(withJSONObject: context), encoding: .utf8)!,
     "images": images]
}
func provider(_ draft: Any, status: String = "completed", type: String = "output_text") -> Data {
    let text = String(data: try! JSONSerialization.data(withJSONObject: draft), encoding: .utf8)!
    return try! JSONSerialization.data(withJSONObject: [
        "status": status, "output": [["type": "message", "content": [["type": type, "text": text]]]],
        "usage": ["input_tokens": 12, "output_tokens": 34, "total_tokens": 46]
    ])
}
func section() -> [String: Any] { ["label": "Evidence", "guidance": "What do we know and what remains uncertain?"] }
func design(_ count: Int = 2) -> [String: Any] {
    ["label": "Decision Compass", "purpose": "Compare alternatives using evidence.",
     "layout": "grid", "sections": (0..<count).map { _ in section() }]
}
let context: [String: Any] = [
    "command": "design-framework", "goal": "Design a decision framework", "boardId": "board-1",
    "sources": [["id": "card-1", "title": "Project context", "body": "We need to compare options."]],
    "frameworks": []
]
check(IdeaboardAIService.validGenerationContext(payload(context)) != nil, "Selected-text design request rejected")
var empty = context; empty["sources"] = []
check(IdeaboardAIService.validGenerationContext(payload(empty)) != nil, "Goal-only design request rejected")
let invalidContexts: [[String: Any]] = [
    ["command": "unknown"], ["boardId": "bad/id"], ["goal": " "], ["goal": String(repeating: "a", count: 3001)],
    ["frameworks": [["type": "swot"]]], ["sources": [["id": "bad/id", "title": "a", "body": "b"]]],
    ["sources": [["id": "a", "title": "a", "body": 9]]],
    ["sources": [["id": "a", "title": "a", "body": "b", "type": "image"]]],
    ["sources": [["id": "a", "title": "a", "body": "b"], ["id": "a", "title": "c", "body": "d"]]],
    ["sources": (0..<13).map { ["id": "source-\($0)", "title": "a", "body": "b"] }],
    ["sources": [["id": "a", "title": "a", "body": String(repeating: "b", count: 24_000)]]],
    ["targetCard": ["id": "a"]]
]
for change in invalidContexts {
    var invalid = context; invalid.merge(change) { _, new in new }
    check(IdeaboardAIService.validGenerationContext(payload(invalid)) == nil, "Invalid design context accepted: \(change.keys)")
}
check(IdeaboardAIService.validGenerationContext(payload(context, images: [["sourceId": "card-1"]])) == nil, "Design image accepted")
check(IdeaboardAIService.validGenerationContext(payload(context, images: "invalid")) == nil, "Invalid image list accepted")
var missingID = context; missingID.removeValue(forKey: "boardId")
check(IdeaboardAIService.validGenerationContext(payload(missingID)) == nil, "Missing board accepted")
var maxSources = empty
maxSources["sources"] = (0..<12).map { ["id": "source-\($0)", "title": "a", "body": "b"] }
check(IdeaboardAIService.validGenerationContext(payload(maxSources)) != nil, "Twelve sources rejected")
var unicode = empty; unicode["goal"] = String(repeating: "想", count: 3000)
check(IdeaboardAIService.validGenerationContext(payload(unicode)) != nil, "Bounded Unicode goal rejected")
unicode["goal"] = String(repeating: "🧭", count: 1501)
check(IdeaboardAIService.validGenerationContext(payload(unicode)) == nil, "UTF-16 goal bound exceeded")
let schema = IdeaboardAIService.outputSchema(operation: "design-framework")
let properties = schema["properties"] as! [String: Any]
let sectionsSchema = properties["sections"] as! [String: Any]
check(Set(properties.keys) == ["label", "purpose", "layout", "sections"], "Wrong design schema")
check(sectionsSchema["minItems"] as? Int == 2 && sectionsSchema["maxItems"] as? Int == 8, "Missing schema section bounds")
check(schema["additionalProperties"] as? Bool == false, "Non-strict design schema")
check(Set((properties["layout"] as! [String: Any])["enum"] as! [String]) == ["grid", "flow", "matrix", "cycle"], "Missing chosen layout schema values")
check(IdeaboardAIService.providerInstructions(operation: "design-framework").contains("exactly 4 sections"), "Missing matrix section rule")
check(IdeaboardAIService.providerInstructions(operation: "design-framework").contains("Honor the layout chosen"), "Missing user layout preference instruction")
check((IdeaboardAIService.outputSchema(operation: "build")["properties"] as! [String: Any])["revisions"] != nil, "Board schema changed")
check(!IdeaboardAIService.providerInstructions(operation: "design-framework").contains("supplied section IDs"), "Design told to use fixed section IDs")
check(IdeaboardAIService.providerInstructions(operation: "fill").contains("supplied section IDs"), "Board section instruction lost")
for count in [2, 8] {
    for layout in ["grid", "flow", "cycle"] {
        var value = design(count); value["layout"] = layout
        let reply = IdeaboardAIService.decodeProvider(provider(value), id: "test", model: "mock", operation: "design-framework")
        check(reply.ok, "Valid framework rejected")
        if case .object(let result)? = reply.result {
            check(result["sections"] != nil && result["_native"] != nil, "Design or usage metadata missing")
        } else { fatalError("Missing framework reply") }
    }
}
var matrix = design(4); matrix["layout"] = "matrix"
check(IdeaboardAIService.decodeProvider(provider(matrix), id: "test", model: "mock", operation: "design-framework").ok, "Four-quadrant matrix rejected")
for count in [2, 3, 5, 8] {
    var invalidMatrix = design(count); invalidMatrix["layout"] = "matrix"
    check(!IdeaboardAIService.decodeProvider(provider(invalidMatrix), id: "test", model: "mock", operation: "design-framework").ok, "Matrix with wrong quadrant count accepted")
}
var boundary = design()
boundary["label"] = String(repeating: "名", count: 80)
boundary["purpose"] = String(repeating: "a", count: 600)
boundary["sections"] = (0..<2).map { _ in ["label": String(repeating: "a", count: 70), "guidance": String(repeating: "a", count: 300)] }
check(IdeaboardAIService.decodeProvider(provider(boundary), id: "test", model: "mock", operation: "design-framework").ok, "Valid field boundaries rejected")
var malformed: [[String: Any]] = [design(0), design(1), design(9)]
for change: [String: Any] in [
    ["layout": "canvas"], ["label": " "], ["label": String(repeating: "a", count: 81)],
    ["purpose": String(repeating: "a", count: 601)], ["extra": "unexpected"],
    ["sections": [["label": "a", "guidance": "b"], ["label": "c"]]],
    ["sections": [["label": "a", "guidance": "b", "id": "model-id"], section()]],
    ["sections": [["label": String(repeating: "a", count: 71), "guidance": "b"], section()]],
    ["sections": [["label": "a", "guidance": String(repeating: "a", count: 301)], section()]],
    ["sections": [["label": "a", "guidance": " "], section()]],
    ["label": String(repeating: "🧭", count: 41)]
] {
    var invalid = design(); invalid.merge(change) { _, new in new }; malformed.append(invalid)
}
for value in malformed {
    let reply = IdeaboardAIService.decodeProvider(provider(value), id: "test", model: "mock", operation: "design-framework")
    check(!reply.ok && reply.error?.code == "invalid_response", "Malformed design accepted")
}
check(!IdeaboardAIService.decodeProvider(provider(design(), status: "incomplete"), id: "test", model: "mock", operation: "design-framework").ok, "Incomplete response accepted")
check(!IdeaboardAIService.decodeProvider(provider(design(), type: "refusal"), id: "test", model: "mock", operation: "design-framework").ok, "Refusal accepted")
let boardDraft: [String: Any] = [
    "explanation": "SWOT separates internal factors from external opportunities and threats.", "assumptions": [],
    "frameworkRecommendation": ["type": "swot", "rationale": "SWOT helps compare what is known with open questions before choosing an action."],
    "frames": [["type": "swot", "name": "Decision context", "sections":
        ["strengths", "weaknesses", "opportunities", "threats"].map {
            ["id": $0, "text": "Open question: What evidence informs \($0)?", "sourceIds": []] as [String: Any]
        }]],
    "sections": [], "cards": [], "revisions": []
]
private let canonicalBoard = IdeaboardAIService.decodeProvider(provider(boardDraft), id: "native-board-fixture", model: "mock", operation: "build")
check(canonicalBoard.ok, "Complete board build rejected")
if case .object(let result)? = canonicalBoard.result,
   case .object(let recommendation)? = result["frameworkRecommendation"] {
    if case .string(let type)? = recommendation["type"] {
        check(type == "swot", "Recommendation type changed during native canonical encoding")
    } else { fatalError("Canonical recommendation type missing") }
    if case .string(let rationale)? = recommendation["rationale"] {
        check(rationale == (boardDraft["frameworkRecommendation"] as! [String: String])["rationale"], "Recommendation rationale changed during encoding")
    } else { fatalError("Canonical recommendation rationale missing") }
} else { fatalError("Native decoder stripped the framework recommendation") }
let boardSchema = IdeaboardAIService.outputSchema(operation: "build")
check((boardSchema["required"] as! [String]).contains("frameworkRecommendation"), "Recommendation missing from required board schema")
let recommendationSchema = (boardSchema["properties"] as! [String: Any])["frameworkRecommendation"] as! [String: Any]
let recommendationOptions = recommendationSchema["anyOf"] as! [[String: Any]]
check(recommendationOptions.count == 2 && recommendationOptions.contains { $0["type"] as? String == "null" }, "Recommendation schema must allow explicit null")
let recommendationObject = recommendationOptions.first { $0["type"] as? String == "object" }!
check(Set(recommendationObject["required"] as! [String]) == ["type", "rationale"] && recommendationObject["additionalProperties"] as? Bool == false, "Recommendation schema fields are not strict")
let recommendationFields = recommendationObject["properties"] as! [String: Any]
check((recommendationFields["rationale"] as! [String: Any])["maxLength"] as? Int == 1000, "Recommendation rationale bound differs from frontend")
check(IdeaboardAIService.providerInstructions(operation: "build").contains("frameworkRecommendation"), "Provider not told to include recommendation")
check(IdeaboardAIService.providerInstructions(operation: "fill").contains("frameworkRecommendation as null"), "Editing instructions omit null recommendation")
var missingRecommendation = boardDraft; missingRecommendation.removeValue(forKey: "frameworkRecommendation")
private let missingReply = IdeaboardAIService.decodeProvider(provider(missingRecommendation), id: "test", model: "mock")
check(!missingReply.ok && missingReply.error?.message.contains("Try again") == true, "Missing recommendation did not give an actionable error")
for value: Any in [NSNull(), ["type": "swot"], ["type": "swot", "rationale": " "],
                   ["type": "swot", "rationale": String(repeating: "a", count: 1001)],
                   ["type": "swot", "rationale": String(repeating: "🧭", count: 501)],
                   ["type": "other", "rationale": "Mismatch"], ["type": "bad/id", "rationale": "Invalid ID"], "swot"] {
    var invalid = boardDraft; invalid["frameworkRecommendation"] = value
    check(!IdeaboardAIService.decodeProvider(provider(invalid), id: "test", model: "mock").ok, "Invalid recommendation accepted")
}
var boundaryRecommendation = boardDraft
boundaryRecommendation["frameworkRecommendation"] = ["type": "swot", "rationale": String(repeating: "🧭", count: 500)]
check(IdeaboardAIService.decodeProvider(provider(boundaryRecommendation), id: "test", model: "mock").ok, "Bounded UTF-16 recommendation rejected")
for operation in ["build", "fill", "expand", "revise"] {
    var board = context; board["command"] = operation
    check(IdeaboardAIService.validGenerationContext(payload(board)) != nil, "Existing board request rejected")
    var draft = boardDraft
    if operation != "build" {
        draft["frameworkRecommendation"] = NSNull(); draft["frames"] = []
        check(!IdeaboardAIService.decodeProvider(provider(boardDraft), id: "test", model: "mock", operation: operation).ok, "Editing reply with recommendation accepted")
    }
    let reply = IdeaboardAIService.decodeProvider(provider(draft), id: "test", model: "mock", operation: operation)
    check(reply.ok, "Existing board reply rejected")
    if operation != "build" {
        if case .object(let result)? = reply.result, case .null? = result["frameworkRecommendation"] {
            check(true, "Editing null retained")
        } else { fatalError("Native canonical encoding omitted required null recommendation") }
    }
}
check(!IdeaboardAIService.decodeProvider(provider(boardDraft), id: "test", model: "mock", operation: "design-framework").ok, "Board reply accepted as design")
check(!IdeaboardAIService.decodeProvider(provider(design()), id: "test", model: "mock").ok, "Design reply accepted as board")
let origin = URL(string: "http://127.0.0.1:5192")!
check(IdeaboardAIService.isAppOrigin(origin, expected: origin), "App origin rejected")
check(!IdeaboardAIService.isAppOrigin(URL(string: "http://localhost:5192"), expected: origin), "Different origin trusted")
if let path = ProcessInfo.processInfo.environment["IDEABOARD_DESIGN_REQUEST_FIXTURE"] {
    let data = try Data(contentsOf: URL(fileURLWithPath: path))
    let browserPayload = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    check(IdeaboardAIService.validGenerationContext(browserPayload) != nil, "Actual browser-generated design request rejected by native bridge")
}
if let path = ProcessInfo.processInfo.environment["IDEABOARD_NATIVE_BOARD_FIXTURE"] {
    // Persist the real native decoder's bridge reply for frontend contract validation.
    try JSONEncoder().encode(canonicalBoard).write(to: URL(fileURLWithPath: path))
    print("Actual native board reply fixture written to \(path)")
}

let commandContext: [String: Any] = ["command": "board-command", "boardId": "qa-board", "goal": "Highlight a key point", "intent": "emphasis", "today": "2026-10-14", "conversation": [], "notes": [], "sources": [], "frameworks": [["id": "qa-frame", "name": "Workflow", "type": "ooda", "sections": [["id": "observe", "label": "Observe", "text": "The agent imports articles."]]]], "examples": []]
check(IdeaboardAIService.validGenerationContext(payload(commandContext)) != nil, "Native bridge rejected a bounded board command")
let commandDraft: [String: Any] = ["response": "Highlighted the workflow.", "operations": [["type": "highlight_section", "frameId": "qa-frame", "sectionId": "observe", "exactQuote": "imports articles", "color": "yellow", "mode": "add"]]]
check(IdeaboardAIService.decodeProvider(provider(commandDraft), id: "command", model: "test", operation: "board-command").ok, "Native bridge rejected a valid highlight command result")
var badContext = commandContext; badContext["boardId"] = "../another-board"
check(IdeaboardAIService.validGenerationContext(payload(badContext)) == nil, "Native command accepted an invalid board ID")
var badDraft = commandDraft; badDraft["operations"] = [["type": "execute_code", "code": "bad"]]
check(!IdeaboardAIService.decodeProvider(provider(badDraft), id: "bad-command", model: "test", operation: "board-command").ok, "Native bridge accepted an unsupported operation")

let fakeHighlight: [String: Any] = ["response": "Highlighted.", "operations": [["type": "answer", "text": "Highlighted.", "sourceIds": []]]]
check(!IdeaboardAIService.decodeProvider(provider(fakeHighlight), id: "fake-highlight", model: "test", operation: "board-command", context: commandContext).ok, "A highlight request accepted an answer without a mark")
var findContext = commandContext; findContext["intent"] = "find"; findContext["goal"] = "Find the selected writing"
let wrongFind: [String: Any] = ["response": "Found.", "operations": [["type": "arrange_notes", "cardIds": ["qa-note"], "layout": "row"]]]
check(!IdeaboardAIService.decodeProvider(provider(wrongFind), id: "wrong-find", model: "test", operation: "board-command", context: findContext).ok, "A find request accepted card movement")
var noteContext = commandContext; noteContext["intent"] = "canvas"; noteContext["goal"] = "Lock both selected notes"; noteContext["frameworks"] = []
noteContext["notes"] = ["qa-note-a", "qa-note-b"].map { ["id": $0, "board_id": "qa-board", "title": "A note", "body": "Keep this writing", "locked": false] as [String: Any] }
let lockDraft: [String: Any] = ["response": "Locking proposed.", "operations": [["type": "lock_notes", "cardIds": ["qa-note-a", "qa-note-b"], "locked": true]]]
check(IdeaboardAIService.decodeProvider(provider(lockDraft), id: "lock", model: "test", operation: "board-command", context: noteContext).ok, "A valid lock request was rejected")
let wrongLock: [String: Any] = ["response": "Locked.", "operations": [["type": "lock_notes", "cardIds": ["qa-note-a", "qa-note-b"], "locked": false]]]
check(!IdeaboardAIService.decodeProvider(provider(wrongLock), id: "wrong-lock", model: "test", operation: "board-command", context: noteContext).ok, "A lock request accepted unlocking")

if let path = ProcessInfo.processInfo.environment["IDEABOARD_NATIVE_COMMAND_FIXTURE"] {
    try JSONEncoder().encode(IdeaboardAIService.decodeProvider(provider(commandDraft), id: "command", model: "test", operation: "board-command")).write(to: URL(fileURLWithPath: path))
}

print("Native framework design regression: \(checks) checks passed; no provider calls or app launches.")
'''

environment = dict(os.environ)
environment.setdefault("DEVELOPER_DIR", "/Applications/Xcode.app/Contents/Developer")
with tempfile.TemporaryDirectory(prefix="ideaboard-framework-native-") as directory:
    temporary = Path(directory)
    main = temporary / "main.swift"
    main.write_text(source + "\n" + harness)
    executable = temporary / "native-framework-tests"
    subprocess.run([
        "xcrun", "swiftc", "-target", f"{platform.machine()}-apple-macos13.0",
        str(main), str(project / "Sources/LocalWebServer.swift"), "-o", str(executable),
    ], env=environment, check=True)
    subprocess.run([str(executable)], env=environment, check=True)
