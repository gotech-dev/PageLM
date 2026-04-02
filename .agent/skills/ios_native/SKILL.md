---
name: iOS Native UI/UX Expert (SwiftUI)
description: Expert guidelines for building premium iOS interfaces using SwiftUI and UIKit.
---

# iOS Native Skill

## Core Philosophy
- **Human Interface Guidelines (HIG)**: Strict adherence to Apple's design language.
- **Declarative SwiftUI**: Use SwiftUI for all new features. Fallback to UIKit `UIViewRepresentable` only if necessary.
- **Smoothness**: 120Hz ProMotion readiness. No dropped frames.
- **Premium Feel**: Use haptics, blurs, and physics-based animations.

## Protocol

### 1. Setup & Project Structure
- **MVVM**: Model-View-ViewModel is the standard pattern.
- **Coordinator**: Use the Coordinator pattern (or `NavigationStack` with paths) for navigation logic.
- **SPM**: Swift Package Manager for all dependencies.

### 2. UI Components
- **Modifiers**: Create custom ViewModifiers for reusable styles.
- **Preview**: Always provide `#Preview` with mock data.
- **Colors**: Use semantic colors (`.primary`, `.secondary`, `.systemBackground`) for automatic Dark Mode support.

### 3. Haptics
- Trigger `UIImpactFeedbackGenerator` on significant actions (Success, Error, Selection).
- `.sensoryFeedback(.selection, trigger: selection)` in SwiftUI.

## Visual Reproduction Guidelines (Image-to-Code)
- **Shadows**: `Color.black.opacity(0.1)` is usually plenty. Don't go darker unless explicitly needed.
- **Blur**: Use `.background(.ultraThinMaterial)` for that native iOS blur look.
- **Shapes**: `RoundedRectangle(cornerRadius: 16)` is the standard "Apple-like" card.
- **Gradients**: `MeshGradient` (iOS 18) or `AngularGradient` for backgrounds.

## Accessibility Guidelines
- **Dynamic Type**: Test UI with largest font sizes (`cmd+opt+plus` in Simulator). Use `.font(.body)` styles, avoid hardcoded sizes.
- **VoiceOver**: Add `.accessibilityLabel()` and `.accessibilityHint()`.
- **Contrast**: Ensure buttons and text meet contrast ratios, especially on translucent backgrounds.

## Performance & Optimization
- **List Performance**: Use `LazyVStack` for lists, but be careful with nested scrolling.
- **Memory Management**: Watch out for Retain Cycles in closures. Use `[weak self]`.
- **Instruments**: Profile with Time Profiler to find main thread blocking work.

## Security Best Practices
- **Keychain**: Always store sensitive data in Keychain, never `UserDefaults`.
- **App Transport Security**: Ensure `NSAppTransportSecurity` excludes arbitrary loads.

## Specific: Swift Concurrency
Prefer `async/await` over completion handlers:
```swift
func fetchData() async throws -> Data {
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}
```

## Testing & Quality Assurance
- **Unit Costs**: XCTest.
- **UI Tests**: **XCUITest** to simulate user taps and flows.
- **Snapshot Testing**: Use `PointFree`'s SnapshotTesting library to prevent visual regressions.

## Common Pitfalls
- **Blocking Main Thread**: Perform heavy data processing in `.task` or background actors.
- **Complex Body**: SwiftUI `body` should be simple. Extract subviews or builders if it gets too nested.
- **Ignoring Safe Area**: Content hidden behind dynamic island or home indicator.

## Code Snippets

### 1. Premium Card (SwiftUI)
```swift
import SwiftUI

struct PremiumCard: View {
    var title: String
    var subtitle: String
    var icon: String
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 24))
                .foregroundStyle(.white)
                .frame(width: 50, height: 50)
                .background(
                    Circle()
                        .fill(LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                )
                .shadow(color: .blue.opacity(0.3), radius: 5, x: 0, y: 3)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundStyle(.primary)
                
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(20)
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(.white.opacity(0.2), lineWidth: 0.5)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }
}

#Preview {
    ZStack {
        Color.gray.ignoresSafeArea()
        PremiumCard(title: "Achievement Unlocked", subtitle: "You completed 5 tasks", icon: "trophy.fill")
            .padding()
    }
}
```

### 2. Loading State with Error Handling
```swift
import SwiftUI

enum ViewState<T> {
    case loading
    case success(T)
    case error(String)
}

struct AsyncContentView<T, Content: View>: View {
    let state: ViewState<T>
    let content: (T) -> Content
    let retryAction: () -> Void
    
    var body: some View {
        switch state {
        case .loading:
            ProgressView()
                .controlSize(.large)
        case .success(let data):
            content(data)
        case .error(let message):
            ContentUnavailableView {
                Label("Something went wrong", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Try Again", action: retryAction)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}
```
