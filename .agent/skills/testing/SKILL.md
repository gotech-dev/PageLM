---
name: Testing & Quality Assurance Expert
description: Expert guidelines for automated Unit, Widget, and Integration testing across stacks.
---

# Testing & Quality Assurance Skill

## Core Philosophy
- **Testing Pyramid**: 70% Unit, 20% Integration, 10% E2E.
- **Fail Fast**: Tests should catch bugs locally, not in CI/CD.
- **First Class Citizens**: Test code must be as clean as production code.

## Protocol by Tech Stack

### 1. Flutter Testing
- **Unit (Business Logic)**
    - Use `bloc_test` for BLoC testing.
    - Mock dependencies using `mocktail`.
- **Widget (UI Components)**
    - Use `pumpWidget` to render isolated components.
    - Verify finding widgets by Key: `find.byKey(Key('login_btn'))`.
- **Integration (Full App)**
    - Use `integration_test` package.
    - Run on real devices or emulators.

### 2. Next.js / React Testing
- **Unit/Component**
    - Use **Vitest** (faster than Jest) + **React Testing Library**.
    - Test user interactions: `fireEvent.click()`.
- **E2E**
    - Use **Playwright**.
    - Test critical user flows (Login, Checkout).

### 3. Laravel / API Testing
- **Feature Tests**
    - Use **Pest** or PHPUnit.
    - Test API endpoints: `$response->assertStatus(200)`.
    - Seed database with factory data for predictable states.

## Test-Driven Development (TDD) Workflow
1.  **Red**: Write a failing test for the new requirement.
    - *Example*: `expect(calculator.add(2, 2)).toBe(4)` -> Fails because method doesn't exist.
2.  **Green**: Write the **minimum** code to make it pass.
    - *Example*: `return 4;` (Yes, really. Then iterate).
3.  **Refactor**: Clean up the code while keeping tests green.

## Code Snippets

### 1. Flutter BLoC Test
```dart
blocTest<CounterBloc, int>(
  'emits [1] when Increment is added',
  build: () => CounterBloc(),
  act: (bloc) => bloc.add(Increment()),
  expect: () => [1],
);
```

### 2. Laravel Pest Test
```php
test('user can view profile', function () {
    $user = User::factory()->create();
 
    $response = this->actingAs($user)
                     ->get('/profile');
 
    $response->assertStatus(200);
});
```
