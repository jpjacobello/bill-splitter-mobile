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

        // Find the receipt quad, then perspective-correct. Skip silently if none.
        //
        // Primary: VNDetectDocumentSegmentation (iOS 15+) — purpose-built for
        // documents, robust on angled / partially-occluded / edge-cropped receipts
        // where generic rectangle detection just gives up and returns nothing.
        //
        // Fallback: VNDetectRectangles, picking the LARGEST candidate by area (not
        // highest confidence) — a QR code is a strong high-confidence square but a
        // small area, so area-selection rejects it and keeps the receipt outline.
        var baseImage: CIImage = ciImage
        var quad: (tl: CGPoint, tr: CGPoint, bl: CGPoint, br: CGPoint)? = nil

        if #available(iOS 15.0, *) {
          let docRequest = VNDetectDocumentSegmentationRequest()
          let docHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
          if (try? docHandler.perform([docRequest])) != nil,
             let doc = docRequest.results?.first {
            quad = (doc.topLeft, doc.topRight, doc.bottomLeft, doc.bottomRight)
          }
        }

        if quad == nil {
          let request = VNDetectRectanglesRequest()
          request.minimumConfidence = 0.5
          request.minimumAspectRatio = 0.15   // allow tall/narrow receipts
          request.minimumSize = 0.2           // ignore small rects (QR, logos)
          request.maximumObservations = 12
          let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
          if (try? handler.perform([request])) != nil,
             let observation = request.results?
               .max(by: { $0.boundingBox.width * $0.boundingBox.height
                        < $1.boundingBox.width * $1.boundingBox.height }),
             observation.boundingBox.width * observation.boundingBox.height > 0.2 {
            quad = (observation.topLeft, observation.topRight, observation.bottomLeft, observation.bottomRight)
          }
        }

        if let q = quad {
          let w = CGFloat(cgImage.width)
          let h = CGFloat(cgImage.height)
          func pt(_ p: CGPoint) -> CIVector { CIVector(x: p.x * w, y: p.y * h) }
          baseImage = ciImage.applyingFilter("CIPerspectiveCorrection", parameters: [
            "inputTopLeft":     pt(q.tl),
            "inputTopRight":    pt(q.tr),
            "inputBottomLeft":  pt(q.bl),
            "inputBottomRight": pt(q.br),
          ])
        }

        // Crop only — perspective-correct to the receipt quad and output the
        // ORIGINAL pixels untouched. No tonal filters: altering the image risks
        // crushing dim/low-light photos to black and breaking the parser.
        guard let outCG = context.createCGImage(baseImage, from: baseImage.extent),
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
    // Camera path: VisionKit's document scanner already crops + cleans the image,
    // so there's nothing to do — return it untouched (no tonal filtering).
    AsyncFunction("enhanceDocument") { (imageUri: String, promise: Promise) in
      promise.resolve(imageUri)
    }
  }
}
