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

        // Attempt perspective correction — skip silently if no rectangle found
        var baseImage: CIImage = ciImage
        let request = VNDetectRectanglesRequest()
        request.minimumConfidence = 0.6
        request.minimumAspectRatio = 0.2
        request.maximumObservations = 1
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        if (try? handler.perform([request])) != nil,
           let observation = request.results?.first {
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

        // Enhance to white paper + dark text scan look
        let enhanced = baseImage.applyingFilter("CIDocumentEnhancer")

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
  }
}
