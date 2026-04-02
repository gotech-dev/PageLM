---
name: Flutter UI/UX Expert
description: Expert guidelines for building beautiful, smooth, and native-feeling Flutter applications.
---

# Flutter Skill

## Core Philosophy
- **Native Polish**: Flutter apps must feel native, not cross-platform. This means perfect gestures, platform-specific transitions, and adaptive widgets.
- **60/120 FPS**: Jank is unacceptable. Use `RepaintBoundary` and isolate complex logic.
- **Widget Composition**: Build small, reusable widgets. Avoid massive 500-line build methods.
- **State Management**: Use **Bloc/Cubit** or **Riverpod**. Avoid plain `setState` for complex flows.

## Protocol

### 1. Setup & Dependencies
- **Routing**: Use **GoRouter** for strict, declarative routing with deep linking.
- **Assets**: Use `flutter_gen` for type-safe assets (`Assets.images.logo`).
- **Styling**: Define a strict `ThemeData` (extensions for custom tokens).

### 2. Architecture
- **Features Folder**: Group by feature (`lib/features/auth`, `lib/features/home`).
- **Extract Widgets**: Logic separation. `MainScreen` -> `MainView` -> `Components`.
- **Constants**: Use `const` constructors aggressively.
- **Layouts**: Prefer `Column`/`Row` with `Expanded`/`Flexible`. Avoid hardcoded heights.

### 3. Aesthetics
- **Shimmers**: Use `shimmer` package for placeholders. Never show raw empty screens while loading.
- **Transitions**: Use `PageTransitionsTheme` to enforce `CupertinoPageTransitionsBuilder` on iOS and `ZoomPageTransitionsBuilder` on Android.
- **Typography**: Integrate `GoogleFonts`. Ensure correct line-heights.

## Visual Reproduction Guidelines (Image-to-Code)
- **Shadows**: Don't just use `elevation`. Use `BoxShadow` for exact control.
    - *Soft Shadow*: `BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 20, offset: Offset(0, 10))`
- **Gradients**: Match direction exactly (`begin: Alignment.topLeft`, `end: Alignment.bottomRight`).
- **Border Radius**: If it looks round, it's likely 8px, 12px, or 16px. Circle is 100px.
- **Spacing**: Use `Gap(16)` (from `gap` package) or `SizedBox(height: 16)` instead of padding everything.

## Accessibility Guidelines
- **Semantics**: Wrap custom touchable widgets in `Semantics(button: true, label: "Action", child: ...)`.
- **Text Scaling**: Ensure UI doesn't break when user increases font size (Wrap text in Flexible, handle overflows).
- **Contrast**: Check color contrast of text against background.

## Localization (l10n)
- Use `flutter_localizations`.
- ARB files for translations (`app_en.arb`, `app_vi.arb`).
- Don't hardcode strings. Use `AppLocalizations.of(context)!.stringName`.

## Performance & Optimization
- **Build Method**: Keep `build` method pure and fast. Move expensive computations to `Isolate` or `provider`.
- **RepaintBoundary**: Wrap complex static widgets (like Charts/Images) in `RepaintBoundary`.
- **List Optimization**: Use `ListView.builder` with `itemExtent` or `prototypeItem` for huge lists.

## Security Best Practices
- **Secure Storage**: Use `flutter_secure_storage` for storing JWT tokens (Keychain/Keystore).
- **Network**: Pin certificates using `dio` if high security is needed.

## Specific: Platform Adaptation
Use `flutter_platform_widgets` or manual checks:
```dart
if (Platform.isIOS) {
  return CupertinoButton(...);
} else {
  return ElevatedButton(...);
}
```

## Testing & Quality Assurance
- **Unit**: Test BLoCs/Providers.
- **Widget**: Test UI rendering (`pumpWidget`) and interactions (`tap`, `enterText`).
- **Integration**: `integration_test` package for full flows.
- **Golden Tests**: Verify pixel perfection across updates.

## Common Pitfalls
- **Build Method Logic**: Doing heavy computation in `build()`. Move to `initState` or BLoC.
- **Unbounded Height**: Placing a `ListView` inside a `Column` without `Expanded` or shrinkWrap.
- **Ignoring SafeArea**: Content clipped by notches on modern phones.

## Code Snippets

### 1. Glassmorphic Card (Custom Painter)
```dart
import 'dart:ui';
import 'package:flutter/material.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final double blur;
  final double opacity;

  const GlassCard({
    super.key,
    required this.child,
    this.blur = 10.0,
    this.opacity = 0.1,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(opacity),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 16,
                spreadRadius: 4,
              )
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}
```

### 2. Async Loading with Error Handling (Riverpod/FutureBuilder Pattern)
```dart
import 'package:flutter/material.dart';

class AsyncWidget<T> extends StatelessWidget {
  final AsyncSnapshot<T> snapshot;
  final Widget Function(T data) builder;
  final VoidCallback onRetry;

  const AsyncWidget({
    super.key,
    required this.snapshot,
    required this.builder,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    if (snapshot.connectionState == ConnectionState.waiting) {
       return const Center(child: CircularProgressIndicator.adaptive());
    }

    if (snapshot.hasError) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 48),
            const SizedBox(height: 16),
            Text('Something went wrong', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            )
          ],
        ),
      );
    }

    return builder(snapshot.data as T);
  }
}
```
