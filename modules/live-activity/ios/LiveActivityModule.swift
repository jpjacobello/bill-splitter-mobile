import ExpoModulesCore
import ActivityKit

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: this type must stay byte-for-byte identical (name + shape) to the
// copy in targets/widget/index.swift. ActivityKit matches the running activity
// to the widget's ActivityConfiguration by this attributes type — if the two
// drift, the activity starts but renders nothing.
// ─────────────────────────────────────────────────────────────────────────────
struct DiviSessionAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var claimedAmount: Double
    var totalAmount: Double
    var claimantCount: Int
    var currencyCode: String
  }
  var merchantName: String
  var sessionId: String
}

public class LiveActivityModule: Module {
  // Stored as Any so the property itself needs no @available annotation.
  private var activity: Any?

  // The in-memory handle is lost when the app is killed. Recover the running
  // activity from ActivityKit so a relaunched app can still update/end it.
  @available(iOS 16.2, *)
  private func currentActivity() -> Activity<DiviSessionAttributes>? {
    if let held = activity as? Activity<DiviSessionAttributes> { return held }
    let recovered = Activity<DiviSessionAttributes>.activities.first
    activity = recovered
    return recovered
  }

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("start") { (merchant: String, sessionId: String, total: Double, claimed: Double, count: Int, currency: String, promise: Promise) in
      guard #available(iOS 16.2, *) else { promise.resolve(nil); return }
      // Only one host activity at a time — end any leftover first (including one
      // recovered from a previous launch).
      if let existing = self.currentActivity() {
        Task { await existing.end(nil, dismissalPolicy: .immediate) }
        self.activity = nil
      }
      let attributes = DiviSessionAttributes(merchantName: merchant, sessionId: sessionId)
      let state = DiviSessionAttributes.ContentState(
        claimedAmount: claimed, totalAmount: total, claimantCount: count, currencyCode: currency
      )
      do {
        let act = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil))
        self.activity = act
        promise.resolve(act.id)
      } catch {
        promise.reject("ERR_LIVE_ACTIVITY_START", error.localizedDescription)
      }
    }

    AsyncFunction("update") { (total: Double, claimed: Double, count: Int, currency: String, promise: Promise) in
      guard #available(iOS 16.2, *), let act = self.currentActivity() else {
        promise.resolve(nil); return
      }
      let state = DiviSessionAttributes.ContentState(
        claimedAmount: claimed, totalAmount: total, claimantCount: count, currencyCode: currency
      )
      Task {
        await act.update(ActivityContent(state: state, staleDate: nil))
        promise.resolve(nil)
      }
    }

    AsyncFunction("end") { (promise: Promise) in
      guard #available(iOS 16.2, *), let act = self.currentActivity() else {
        promise.resolve(nil); return
      }
      Task {
        await act.end(nil, dismissalPolicy: .immediate)
        self.activity = nil
        promise.resolve(nil)
      }
    }
  }
}
