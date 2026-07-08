import ExpoModulesCore
import ContactsUI
import Contacts

public class ContactPickerModule: Module {
  // Strong ref — CNContactPickerViewController.delegate is weak.
  private var pickerDelegate: MultiPickerDelegate?

  public func definition() -> ModuleDefinition {
    Name("ContactPicker")

    AsyncFunction("presentMultiContactPicker") { (promise: Promise) in
      DispatchQueue.main.async {
        guard let presenter = Self.topViewController() else {
          promise.resolve([])
          return
        }
        let picker = CNContactPickerViewController()
        // Implementing the ARRAY delegate method is what flips the picker into
        // multi-select mode with checkboxes.
        let delegate = MultiPickerDelegate(promise: promise) { [weak self] in
          self?.pickerDelegate = nil
        }
        self.pickerDelegate = delegate
        picker.delegate = delegate
        presenter.present(picker, animated: true)
      }
    }
  }

  static func topViewController() -> UIViewController? {
    var top = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}

private class MultiPickerDelegate: NSObject, CNContactPickerDelegate {
  private let promise: Promise
  private let onFinish: () -> Void
  private var settled = false

  init(promise: Promise, onFinish: @escaping () -> Void) {
    self.promise = promise
    self.onFinish = onFinish
  }

  // Array variant → multi-select.
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
      [
        "id": c.identifier,
        "name": Self.displayName(c),
        "phone": Self.firstPhone(c),
      ]
    }
    promise.resolve(mapped)
    onFinish()
  }

  private static func displayName(_ c: CNContact) -> String {
    let fullNameKeys = CNContactFormatter.descriptorForRequiredKeys(for: .fullName)
    if c.areKeysAvailable([fullNameKeys]),
       let formatted = CNContactFormatter.string(from: c, style: .fullName),
       !formatted.isEmpty {
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

  private static func firstPhone(_ c: CNContact) -> String {
    guard c.isKeyAvailable(CNContactPhoneNumbersKey) else { return "" }
    return c.phoneNumbers.first?.value.stringValue ?? ""
  }
}
