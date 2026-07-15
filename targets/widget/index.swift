import WidgetKit
import ActivityKit
import SwiftUI

// ─── Theme ───────────────────────────────────────────────────────────────────

enum DiviTheme {
  static let bg = Color(red: 0.086, green: 0.086, blue: 0.098)     // #161619
  static let card = Color(red: 0.137, green: 0.137, blue: 0.161)   // #232329
  static let accent = Color(red: 0.243, green: 0.847, blue: 0.541) // #3ED88A
  static let dim = Color(red: 0.671, green: 0.671, blue: 0.706)    // #ABABB4
  static let newSplitURL = URL(string: "billsplitter://receipt-upload?source=camera")
  // Live Activity tap → the HOST's live-session page (Activity tab), NOT the
  // claimant join link (split/{id} is "enter your name as another person").
  static func sessionURL(_ id: String) -> URL? {
    URL(string: "billsplitter://activity?tab=live")
  }

  static func money(_ amount: Double, _ code: String) -> String {
    let f = NumberFormatter()
    f.numberStyle = .currency
    f.currencyCode = code
    f.maximumFractionDigits = 2
    return f.string(from: NSNumber(value: amount)) ?? String(format: "%.2f", amount)
  }
}

// ─── Shared Live Activity attributes ─────────────────────────────────────────
// MUST stay identical to modules/live-activity/ios/LiveActivityModule.swift.

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

private func progressFraction(_ s: DiviSessionAttributes.ContentState) -> Double {
  s.totalAmount > 0 ? min(1, max(0, s.claimedAmount / s.totalAmount)) : 0
}

// ─── Quick-action widget ─────────────────────────────────────────────────────

struct SimpleEntry: TimelineEntry { let date: Date }

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SimpleEntry { SimpleEntry(date: Date()) }
  func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
    completion(SimpleEntry(date: Date()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
    completion(Timeline(entries: [SimpleEntry(date: Date())], policy: .never))
  }
}

struct DiviWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: Provider.Entry

  var body: some View {
    switch family {
    // ── Lock screen: circular "+" tap target ──
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        Image(systemName: "plus.viewfinder").font(.system(size: 20, weight: .semibold))
      }
      .widgetURL(DiviTheme.newSplitURL)

    // ── Lock screen: wide "Divi · New Split" row ──
    case .accessoryRectangular:
      HStack(spacing: 8) {
        Image(systemName: "plus.viewfinder").font(.system(size: 22, weight: .semibold))
        VStack(alignment: .leading, spacing: 1) {
          Text("Divi").font(.system(size: 15, weight: .bold))
          Text("New Split").font(.system(size: 13, weight: .medium))
        }
        Spacer(minLength: 0)
      }
      .widgetURL(DiviTheme.newSplitURL)

    // ── Lock screen: inline (above the clock) ──
    case .accessoryInline:
      Label("New Split", systemImage: "plus.viewfinder")
        .widgetURL(DiviTheme.newSplitURL)

    // ── Home screen ──
    default:
      VStack(alignment: .leading, spacing: 0) {
        Text("Divi")
          .font(.system(size: 22, weight: .heavy, design: .rounded))
          .foregroundColor(.white)
        Spacer(minLength: 8)
        HStack(spacing: 6) {
          Image(systemName: "plus").font(.system(size: 14, weight: .bold))
          Text("New Split").font(.system(size: 15, weight: .bold))
        }
        .foregroundColor(DiviTheme.bg)
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background(Capsule().fill(DiviTheme.accent))
      }
      .padding(16)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .widgetURL(DiviTheme.newSplitURL)
    }
  }
}

struct DiviWidget: Widget {
  let kind = "DiviWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      // Padding lives per-family inside the view (accessory widgets must not be
      // over-padded); containerBackground stays here for iOS 17 compliance.
      if #available(iOS 17.0, *) {
        DiviWidgetEntryView(entry: entry).containerBackground(DiviTheme.bg, for: .widget)
      } else {
        DiviWidgetEntryView(entry: entry).background(DiviTheme.bg)
      }
    }
    .configurationDisplayName("New Split")
    .description("Start a new bill split.")
    .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

// ─── Live Activity ───────────────────────────────────────────────────────────

struct LockScreenLiveActivityView: View {
  let context: ActivityViewContext<DiviSessionAttributes>
  var body: some View {
    let s = context.state
    VStack(alignment: .leading, spacing: 7) {
      HStack {
        Text(context.attributes.merchantName)
          .font(.system(size: 15, weight: .bold)).foregroundColor(.white)
          .lineLimit(1)
        Spacer()
        Text("\(s.claimantCount) claimed")
          .font(.system(size: 12, weight: .semibold)).foregroundColor(DiviTheme.dim)
      }
      ProgressView(value: progressFraction(s))
        .tint(DiviTheme.accent)
        .scaleEffect(x: 1, y: 0.7, anchor: .center)
      HStack(alignment: .firstTextBaseline, spacing: 5) {
        Text(DiviTheme.money(s.claimedAmount, s.currencyCode))
          .font(.system(size: 17, weight: .heavy)).foregroundColor(DiviTheme.accent)
        Text("of \(DiviTheme.money(s.totalAmount, s.currencyCode))")
          .font(.system(size: 12, weight: .medium)).foregroundColor(DiviTheme.dim)
        Spacer()
      }
    }
  }
}

struct DiviSessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: DiviSessionAttributes.self) { context in
      LockScreenLiveActivityView(context: context)
        .padding(.horizontal, 15)
        .padding(.vertical, 11)
        .activityBackgroundTint(DiviTheme.bg)
        .activitySystemActionForegroundColor(.white)
        .widgetURL(DiviTheme.sessionURL(context.attributes.sessionId))
    } dynamicIsland: { context in
      let s = context.state
      let pct = Int(progressFraction(s) * 100)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "fork.knife").foregroundColor(DiviTheme.accent)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text("\(s.claimantCount) claimed").font(.system(size: 13, weight: .semibold)).foregroundColor(DiviTheme.dim)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.merchantName).font(.system(size: 14, weight: .bold)).foregroundColor(.white).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            ProgressView(value: progressFraction(s)).tint(DiviTheme.accent)
            HStack {
              Text(DiviTheme.money(s.claimedAmount, s.currencyCode)).font(.system(size: 15, weight: .heavy)).foregroundColor(DiviTheme.accent)
              Text("of \(DiviTheme.money(s.totalAmount, s.currencyCode))").font(.system(size: 12)).foregroundColor(DiviTheme.dim)
              Spacer()
            }
          }
        }
      } compactLeading: {
        Image(systemName: "fork.knife").foregroundColor(DiviTheme.accent)
      } compactTrailing: {
        Text("\(pct)%").foregroundColor(DiviTheme.accent)
      } minimal: {
        Text("\(pct)%").foregroundColor(DiviTheme.accent)
      }
      .widgetURL(DiviTheme.sessionURL(context.attributes.sessionId))
    }
  }
}

// ─── Bundle ──────────────────────────────────────────────────────────────────

@main
struct DiviWidgets: WidgetBundle {
  var body: some Widget {
    DiviWidget()
    DiviSessionLiveActivity()
  }
}
