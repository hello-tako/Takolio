#!/usr/bin/env swift
import Foundation
import Vision
import CryptoKit

struct Prepared: Decodable { let datasetId: String; let classification: String; let cases: [ImageCase] }
struct ImageCase: Decodable {
    let name: String; let variant: String; let file: String; let sha256: String; let locale: String
    enum CodingKeys: String, CodingKey { case name = "case", variant, file, sha256, locale }
}
struct Observation: Encodable {
    let text: String; let x: Double; let y: Double; let width: Double; let height: Double; let confidence: Double
}
struct Run: Encodable {
    let name: String; let variant: String; let imageSha256: String; let latencyMs: Double
    let status: String; let recognitionLanguages: [String]; let requestRevision: Int; let observations: [Observation]
    enum CodingKeys: String, CodingKey { case name = "case", variant, imageSha256, latencyMs, status, recognitionLanguages, requestRevision, observations }
}
struct Result: Encodable {
    let version = 1; let classification = "TEST_ONLY"
    let engine = "Apple Vision VNRecognizeTextRequest"
    let semanticFridgeRecognitionMeasured = false
    let hostOS = ProcessInfo.processInfo.operatingSystemVersionString
    let datasetId: String; let preparedSha256: String; let runs: [Run]
}
func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
let input = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".artifacts/scan-synthetic-v3/prepared.json")
let output = URL(fileURLWithPath: CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : ".artifacts/scan-synthetic-v3/apple-vision.raw.json")
let preparedBytes = try Data(contentsOf: input)
let prepared = try JSONDecoder().decode(Prepared.self, from: preparedBytes)
guard prepared.classification == "TEST_ONLY" else { fatalError("SYNTHETIC_CLASSIFICATION_REQUIRED") }
var runs: [Run] = []
var seen = Set<String>()
for image in prepared.cases {
    guard seen.insert(image.name).inserted && URL(fileURLWithPath: image.file).lastPathComponent == image.file else {
        fatalError("SYNTHETIC_MATRIX_INVALID")
    }
    let imageURL = input.deletingLastPathComponent().appendingPathComponent(image.file)
    let bytes = try Data(contentsOf: imageURL)
    guard digest(bytes) == image.sha256 else { fatalError("SYNTHETIC_IMAGE_HASH_MISMATCH") }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = image.locale == "ja" ? ["ja-JP", "en-US"] : image.locale == "vi" ? ["vi-VT", "en-US"] : ["en-US"]
    let started = DispatchTime.now().uptimeNanoseconds
    var status = "output"
    do { try VNImageRequestHandler(url: imageURL).perform([request]) }
    catch { status = "decode_or_recognition_error" }
    let elapsed = Double(DispatchTime.now().uptimeNanoseconds - started) / 1_000_000
    let observations = (request.results ?? []).compactMap { item -> Observation? in
        guard let text = item.topCandidates(1).first else { return nil }
        return Observation(text: text.string, x: Double(item.boundingBox.minX), y: Double(item.boundingBox.minY),
            width: Double(item.boundingBox.width), height: Double(item.boundingBox.height), confidence: Double(text.confidence))
    }
    runs.append(Run(name: image.name, variant: image.variant, imageSha256: image.sha256,
                    latencyMs: elapsed, status: status, recognitionLanguages: request.recognitionLanguages, requestRevision: request.revision, observations: observations))
}
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(Result(datasetId: prepared.datasetId, preparedSha256: digest(preparedBytes), runs: runs)).write(to: output, options: .atomic)
print("Apple Vision processed \(runs.count) actual synthetic files, including decode failures.")
