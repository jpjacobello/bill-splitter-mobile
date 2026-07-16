import ExpoModulesCore
import ContactsUI
import Contacts
import SwiftUI

public class ContactPickerModule: Module {
  // Strong ref — CNContactPickerViewController.delegate is weak.
  private var pickerDelegate: MultiPickerDelegate?

  public func definition() -> ModuleDefinition {
    Name("ContactPicker")

    // Presents a searchable, multi-select SwiftUI contacts sheet when we have
    // (or can get) contacts access. Falls back to the out-of-process system
    // picker (no permission needed, but no search) when access is denied.
    AsyncFunction("presentMultiContactPicker") { (promise: Promise) in
      DispatchQueue.main.async {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        if status == .denied || status == .restricted {
          self.presentSystemPicker(promise)
        } else if status == .notDetermined {
          CNContactStore().requestAccess(for: .contacts) { granted, _ in
            DispatchQueue.main.async {
              if granted { Self.presentSearchable(promise) }
              else { self.presentSystemPicker(promise) }
            }
          }
        } else {
          // .authorized (or iOS 18 .limited) — we can read contacts directly.
          Self.presentSearchable(promise)
        }
      }
    }
  }

  // ── Custom searchable SwiftUI picker ────────────────────────────────────────
  private static func presentSearchable(_ promise: Promise) {
    let contacts = fetchContacts()
    guard !contacts.isEmpty, let presenter = topViewController() else {
      promise.resolve([])
      return
    }
    var settled = false
    let finish: ([PickedContact]) -> Void = { picked in
      guard !settled else { return }
      settled = true
      presenter.dismiss(animated: true)
      promise.resolve(picked.map { ["id": $0.id, "name": $0.name, "phone": $0.phone] })
    }
    let view = ContactsSearchView(
      contacts: contacts,
      onDone: { finish($0) },
      onCancel: { finish([]) }
    )
    let host = UIHostingController(rootView: view)
    presenter.present(host, animated: true)
  }

  private static func fetchContacts() -> [PickedContact] {
    let store = CNContactStore()
    let keys: [CNKeyDescriptor] = [
      CNContactGivenNameKey as CNKeyDescriptor,
      CNContactFamilyNameKey as CNKeyDescriptor,
      CNContactOrganizationNameKey as CNKeyDescriptor,
      CNContactPhoneNumbersKey as CNKeyDescriptor,
      CNContactFormatter.descriptorForRequiredKeys(for: .fullName),
    ]
    let req = CNContactFetchRequest(keysToFetch: keys)
    var out: [PickedContact] = []
    do {
      try store.enumerateContacts(with: req) { c, _ in
        out.append(PickedContact(id: c.identifier, name: displayName(c), phone: firstPhone(c)))
      }
    } catch {
      return []
    }
    return out.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
  }

  // ── System picker fallback (no permission required, no search) ──────────────
  private func presentSystemPicker(_ promise: Promise) {
    guard let presenter = Self.topViewController() else {
      promise.resolve([])
      return
    }
    let picker = CNContactPickerViewController()
    let delegate = MultiPickerDelegate(promise: promise) { [weak self] in
      self?.pickerDelegate = nil
    }
    self.pickerDelegate = delegate
    picker.delegate = delegate
    presenter.present(picker, animated: true)
  }

  static func topViewController() -> UIViewController? {
    var top = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?.rootViewController
    // Skip a modal that's animating away (e.g. a just-dismissed ActionSheet).
    while let presented = top?.presentedViewController, !presented.isBeingDismissed {
      top = presented
    }
    return top
  }

  static func displayName(_ c: CNContact) -> String {
    let fullNameDesc = CNContactFormatter.descriptorForRequiredKeys(for: .fullName)
    if c.areKeysAvailable([fullNameDesc]),
       let formatted = CNContactFormatter.string(from: c, style: .fullName), !formatted.isEmpty {
      return formatted
    }
    let given = c.isKeyAvailable(CNContactGivenNameKey) ? c.givenName : ""
    let family = c.isKeyAvailable(CNContactFamilyNameKey) ? c.familyName : ""
    let combined = [given, family].filter { !$0.isEmpty }.joined(separator: " ")
    if !combined.isEmpty { return combined }
    if c.isKeyAvailable(CNContactOrganizationNameKey), !c.organizationName.isEmpty {
      return c.organizationName
    }
    return "Unknown"
  }

  static func firstPhone(_ c: CNContact) -> String {
    guard c.isKeyAvailable(CNContactPhoneNumbersKey) else { return "" }
    return c.phoneNumbers.first?.value.stringValue ?? ""
  }
}

// ── Shared model ──────────────────────────────────────────────────────────────
struct PickedContact: Identifiable, Hashable {
  let id: String
  let name: String
  let phone: String
}

// ── Searchable multi-select list ────────────────────────────────────────────
struct ContactsSearchView: View {
  let contacts: [PickedContact]
  let onDone: ([PickedContact]) -> Void
  let onCancel: () -> Void

  @State private var query = ""
  @State private var selected: Set<String> = []

  private var filtered: [PickedContact] {
    query.isEmpty
      ? contacts
      : contacts.filter { $0.name.localizedCaseInsensitiveContains(query) }
  }

  var body: some View {
    NavigationView {
      List(filtered) { c in
        Button {
          if selected.contains(c.id) { selected.remove(c.id) } else { selected.insert(c.id) }
        } label: {
          HStack {
            Text(c.name).foregroundColor(.primary)
            Spacer()
            Image(systemName: selected.contains(c.id) ? "checkmark.circle.fill" : "circle")
              .foregroundColor(selected.contains(c.id) ? .accentColor : Color(.tertiaryLabel))
          }
        }
      }
      .listStyle(.plain)
      .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search contacts")
      .navigationTitle("Add People")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { onCancel() }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button(selected.isEmpty ? "Add" : "Add (\(selected.count))") {
            onDone(contacts.filter { selected.contains($0.id) })
          }
          .disabled(selected.isEmpty)
        }
      }
    }
    .navigationViewStyle(.stack)
  }
}

// ── System-picker delegate (multi-select via the array variant) ─────────────
private class MultiPickerDelegate: NSObject, CNContactPickerDelegate {
  private let promise: Promise
  private let onFinish: () -> Void
  private var settled = false

  init(promise: Promise, onFinish: @escaping () -> Void) {
    self.promise = promise
    self.onFinish = onFinish
  }

  func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
    settle(contacts)
  }

  func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
    settle([])
  }

  private func settle(_ contacts: [CNContact]) {
    guard !settled else { return }
    settled = true
    let mapped: [[String: Any]] = contacts.map { c in
      ["id": c.identifier, "name": ContactPickerModule.displayName(c), "phone": ContactPickerModule.firstPhone(c)]
    }
    promise.resolve(mapped)
    onFinish()
  }
}
