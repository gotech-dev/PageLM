---
name: Android Native UI/UX Expert (Jetpack Compose)
description: Expert guidelines for building modern Android interfaces using Jetpack Compose and Material 3.
---

# Android Native Skill

## Core Philosophy
- **Declarative First**: Abandon XML completely. Use Jetpack Compose for everything.
- **Material 3**: All new UI must follow Material 3 (M3) guidelines by default unless specified otherwise.
- **Single Activity**: Use Navigation Compose for screen transitions. One Activity, zero Fragments.
- **Unidirectional Data Flow**: State goes down, events go up. ViewModels hold state.

## Protocol

### 1. Setup & Dependencies
- **BOM**: Always use the Jetpack Compose Bill of Materials (BOM) to manage versions.
- **Image Loading**: Use **Coil** for async images (lightweight, Kotlin-first).
- **Icons**: Use `material-icons-extended` only if necessary; prefer exporting SVGs to keep size down.

### 2. UI Components
- **Scaffold**: Always start screens with `Scaffold`.
- **Modifiers**: Order matters. `padding` before `background` adds margin. `background` before `padding` adds padding.
- **Theming**: Use `MaterialTheme.colorScheme` and `MaterialTheme.typography`. Never hardcode colors/fonts.

### 3. Animation
- **Visibility**: `AnimatedVisibility(visible = ...)` is the easiest way to add polish.
- **State Changes**: `animate*AsState` (Float, Color, Dp).
- **Shared Elements**: Use standard shared element transitions for master-detail flows.

## Visual Reproduction Guidelines (Image-to-Code)
- **Elevation**: M3 uses tonal elevation (color overlay), not just shadow. Use `Surface(tonalElevation = ...)` to match designs.
- **Shadows**: Use `Modifier.shadow(elevation = 8.dp, spotColor = Color(0x33000000))` for exact shadow colors.
- **Ripples**: Ensure ripples are bounded (`MaterialTheme.shapes.medium`).

## Accessibility Guidelines
- **Content Description**: `contentDescription` is mandatory for icons/images (or `null` if decorative).
- **Touch Targets**: Minimum 48x48dp.
- **TalkBack**: Test with TalkBack enabled.
- **State Description**: Use `Modifier.semantics { stateDescription = ... }` for custom controls.

## Performance & Optimization
- **Lazy Loading**: Always use `LazyColumn` for lists. Avoid `Column` with `verticalScroll` for large datasets.
- **Image Optimization**: Use Coil with `crossfade(true)` and proper memory caching.
- **Composition Counts**: Use Layout Inspector to check ensuring recompositions are minimal.

## Security Best Practices
- **Input Validation**: Validate all form inputs before sending to ViewModel.
- **Secure Data**: Never log PII. Use `EncryptedSharedPreferences` for token storage.

## Specific: Type-Safe Navigation
Use `kotlinx.serialization` for Compose Navigation:
```kotlin
@Serializable
object DataScreen
// navigate
navController.navigate(DataScreen)
```

## Testing & Quality Assurance
- **Unit**: JUnit 5 + Mockk.
- **UI Test**: Compose Test Rule (`composeTestRule.onNodeWithText(...)`).
- **Screenshot Testing**: Paparazzi or Roborazzi.

## Common Pitfalls
- **Excessive Recomposition**: Avoid creating objects inside `Composable` functions without `remember`.
- **Hardcoded Sizes**: Avoid `size(100.dp)` without considering screen density or text scale.
- **Context Usage**: Don't pass `Context` into Composables. Bubble up events to lambdas.

## Code Snippets

### 1. Animated Interactive Card
```kotlin
@Composable
fun AnimatedCard(
    title: String,
    description: String,
    onClick: () -> Unit
) {
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.95f else 1f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy)
    )

    Surface(
        onClick = { onClick() },
        modifier = Modifier
            .fillMaxWidth()
            .scale(scale)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        pressed = true
                        tryAwaitRelease()
                        pressed = false
                    }
                )
            },
        shape = RoundedCornerShape(24.dp),
        tonalElevation = 4.dp,
        shadowElevation = 6.dp
    ) {
        Column(
            modifier = Modifier.padding(24.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
```

### 2. Error & Loading State Handling
```kotlin
@Composable
fun <T> AsyncContent(
    state: UiState<T>, // Sealed class: Loading, Success, Error
    onRetry: () -> Unit,
    content: @Composable (T) -> Unit
) {
    when (state) {
        is UiState.Loading -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        is UiState.Error -> {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    text = state.message,
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(16.dp))
                Button(onClick = onRetry) {
                    Text("Retry")
                }
            }
        }
        is UiState.Success -> {
            content(state.data)
        }
    }
}
```
