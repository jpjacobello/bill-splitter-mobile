import WidgetKit
import ActivityKit
import SwiftUI

// ─── Theme ───────────────────────────────────────────────────────────────────

enum DiviTheme {
  static let bg = Color(red: 0.086, green: 0.086, blue: 0.098)     // #161619
  static let card = Color(red: 0.137, green: 0.137, blue: 0.161)   // #232329
  static let accent = Color(red: 0.937, green: 0.725, blue: 0.290)     // #EFB94A — gold (in-progress)
  static let accentDeep = Color(red: 0.851, green: 0.604, blue: 0.169) // #D99A2B — gold gradient base
  static let accentDone = Color(red: 0.243, green: 0.898, blue: 0.549) // #3EE58C — green, once fully paid
  static let accentDoneDeep = Color(red: 0.086, green: 0.851, blue: 0.463) // #16D976
  static let dim = Color(red: 0.671, green: 0.671, blue: 0.706)    // #ABABB4
  static let laBg = Color(red: 0.035, green: 0.035, blue: 0.043)   // #09090B — deeper black for the Live Activity
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
    let pct = progressFraction(s)
    let done = pct >= 0.999
    // Gold while collecting → green once fully paid (before the host closes it).
    let fill = done ? DiviTheme.accentDone : DiviTheme.accent
    let fillDeep = done ? DiviTheme.accentDoneDeep : DiviTheme.accentDeep
    VStack(alignment: .leading, spacing: 7) {
      // Real Divi wordmark (splash asset), tinted white — small, top-left.
      HStack {
        Image("DiviWordmark")
          .renderingMode(.template)
          .resizable().scaledToFit()
          .frame(height: 12)
          .foregroundColor(.white.opacity(0.9))
        Spacer()
        Text("\(s.claimantCount) claimed")
          .font(.system(size: 11, weight: .semibold)).foregroundColor(DiviTheme.dim)
      }
      Text(context.attributes.merchantName)
        .font(.system(size: 13, weight: .semibold)).foregroundColor(.white)
        .lineLimit(1)
      // Sleek thin bar, flat gradient (no glow).
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.13))
          Capsule()
            .fill(LinearGradient(colors: [fillDeep, fill], startPoint: .leading, endPoint: .trailing))
            .frame(width: max(4, geo.size.width * pct))
        }
      }
      .frame(height: 4)
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text(DiviTheme.money(s.claimedAmount, s.currencyCode))
          .font(.system(size: 15, weight: .heavy)).foregroundColor(fill)
        Text("of \(DiviTheme.money(s.totalAmount, s.currencyCode))")
          .font(.system(size: 11, weight: .medium)).foregroundColor(DiviTheme.dim)
        Spacer()
      }
    }
  }
}

struct DiviSessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: DiviSessionAttributes.self) { context in
      LockScreenLiveActivityView(context: context)
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .activityBackgroundTint(DiviTheme.laBg)
        .activitySystemActionForegroundColor(.white)
        .widgetURL(DiviTheme.sessionURL(context.attributes.sessionId))
    } dynamicIsland: { context in
      let s = context.state
      let pct = Int(progressFraction(s) * 100)
      // Gold in progress → green once fully paid, matching the lock screen.
      let diFill = progressFraction(s) >= 0.999 ? DiviTheme.accentDone : DiviTheme.accent
      return DynamicIsland {
        // Everything lives in .bottom — content in the narrow leading/trailing
        // slots beside the sensor gets clipped ("0 claimed" ran off-screen), and
        // a separate .center row wasted a tall band of empty island.
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "fork.knife").foregroundColor(diFill)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 6) {
            HStack {
              Text(context.attributes.merchantName)
                .font(.system(size: 14, weight: .bold)).foregroundColor(.white)
                .lineLimit(1)
              Spacer()
              Text("\(s.claimantCount) claimed")
                .font(.system(size: 12, weight: .semibold)).foregroundColor(DiviTheme.dim)
                .lineLimit(1)
            }
            ProgressView(value: progressFraction(s))
              .tint(diFill)
              .scaleEffect(x: 1, y: 0.7, anchor: .center)
            HStack(spacing: 5) {
              Text(DiviTheme.money(s.claimedAmount, s.currencyCode)).font(.system(size: 15, weight: .heavy)).foregroundColor(diFill)
              Text("of \(DiviTheme.money(s.totalAmount, s.currencyCode))").font(.system(size: 12)).foregroundColor(DiviTheme.dim)
              Spacer()
            }
          }
        }
      } compactLeading: {
        Image(systemName: "fork.knife").foregroundColor(diFill)
      } compactTrailing: {
        Text("\(pct)%").foregroundColor(diFill)
      } minimal: {
        Text("\(pct)%").foregroundColor(diFill)
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
