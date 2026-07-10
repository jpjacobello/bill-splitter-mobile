import ExpoModulesCore
import Vision
import CoreImage
import UIKit

extension UIImage {
  func orientationNormalized() -> UIImage {
    guard imageOrientation != .up else { return self }
    UIGraphicsBeginImageContextWithOptions(size, false, scale)
    draw(in: CGRect(origin: .zero, size: size))
    let result = UIGraphicsGetImageFromCurrentImageContext() ?? self
    UIGraphicsEndImageContext()
    return result
  }
}

public class DocumentFlattenerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DocumentFlattener")

    AsyncFunction("flattenDocument") { (imageUri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        let path = imageUri.hasPrefix("file://") ? String(imageUri.dropFirst(7)) : imageUri

        guard let raw = UIImage(contentsOfFile: path) else {
          promise.resolve(imageUri)
          return
        }

        let image = raw.orientationNormalized()
        guard let cgImage = image.cgImage else {
          promise.resolve(imageUri)
          return
        }

        let ciImage = CIImage(cgImage: cgImage)
        let context = CIContext()

        // Attempt perspective correction — skip silently if no good rectangle found.
        // Detect several candidates and pick the LARGEST by area, not the highest
        // confidence: a QR code is a strong high-confidence square but a small area,
        // so area-selection rejects it and keeps the receipt outline.
        var baseImage: CIImage = ciImage
        let request = VNDetectRectanglesRequest()
        request.minimumConfidence = 0.4
        request.minimumAspectRatio = 0.15   // allow tall/narrow receipts
        request.minimumSize = 0.2           // ignore small rects (QR, logos)
        request.maximumObservations = 12
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        if (try? handler.perform([request])) != nil,
           let observation = request.results?
             .max(by: { $0.boundingBox.width * $0.boundingBox.height
                      < $1.boundingBox.width * $1.boundingBox.height }),
           observation.boundingBox.width * observation.boundingBox.height > 0.2 {
          let w = CGFloat(cgImage.width)
          let h = CGFloat(cgImage.height)
          func pt(_ p: CGPoint) -> CIVector { CIVector(x: p.x * w, y: p.y * h) }
          baseImage = ciImage.applyingFilter("CIPerspectiveCorrection", parameters: [
            "inputTopLeft":     pt(observation.topLeft),
            "inputTopRight":    pt(observation.topRight),
            "inputBottomLeft":  pt(observation.bottomLeft),
            "inputBottomRight": pt(observation.bottomRight),
          ])
        }

        // Whiten: paper -> white, text -> black. CIDocumentEnhancer for the base
        // scan look, then desaturate + push contrast/brightness so the cream paper
        // and desk tint blow out to white and text darkens.
        let enhanced = baseImage
          .applyingFilter("CIDocumentEnhancer", parameters: ["inputAmount": 1.0])
          .applyingFilter("CIColorControls", parameters: [
            kCIInputSaturationKey: 0.0,
            kCIInputContrastKey:   1.35,
            kCIInputBrightnessKey: 0.08,
          ])

        guard let outCG = context.createCGImage(enhanced, from: enhanced.extent),
              let data = UIImage(cgImage: outCG).jpegData(compressionQuality: 0.9) else {
          promise.resolve(imageUri)
          return
        }

        let fileURL = FileManager.default.temporaryDirectory
          .appendingPathComponent("flattened_\(UUID().uuidString).jpg")
        do {
          try data.write(to: fileURL)
          promise.resolve(fileURL.absoluteString)
        } catch {
          promise.resolve(imageUri)
        }
      }
    }

    // Whiten ONLY — no rectangle detection / perspective. For images already
    // cropped by VisionKit (camera path); re-detecting there latches onto the QR.
    AsyncFunction("enhanceDocument") { (imageUri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        let path = imageUri.hasPrefix("file://") ? String(imageUri.dropFirst(7)) : imageUri
        guard let raw = UIImage(contentsOfFile: path),
              let cgImage = raw.orientationNormalized().cgImage else {
          promise.resolve(imageUri)
          return
        }
        let context = CIContext()
        let enhanced = CIImage(cgImage: cgImage)
          .applyingFilter("CIDocumentEnhancer", parameters: ["inputAmount": 1.0])
          .applyingFilter("CIColorControls", parameters: [
            kCIInputSaturationKey: 0.0,
            kCIInputContrastKey:   1.35,
            kCIInputBrightnessKey: 0.08,
          ])
        guard let outCG = context.createCGImage(enhanced, from: enhanced.extent),
              let data = UIImage(cgImage: outCG).jpegData(compressionQuality: 0.9) else {
          promise.resolve(imageUri)
          return
        }
        let fileURL = FileManager.default.temporaryDirectory
          .appendingPathComponent("enhanced_\(UUID().uuidString).jpg")
        do {
          try data.write(to: fileURL)
          promise.resolve(fileURL.absoluteString)
        } catch {
          promise.resolve(imageUri)
        }
      }
    }
  }
}
