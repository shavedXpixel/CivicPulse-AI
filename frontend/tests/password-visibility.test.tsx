import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PasswordInput, PasswordInputProps } from '../src/components/ui/PasswordInput';
import LoginPage from '../src/app/login/page';
import UpdatePasswordPage from '../src/app/update-password/page';

// Mock Next.js Navigation
let currentPathname = '/login';
let currentSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock AuthContext
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    userProfile: null,
    loading: false,
    isConfigured: true,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock('../src/lib/supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

// Test helper for stateful component interaction testing in Node environment
function createInteractivePasswordInput(props: PasswordInputProps) {
  let isVisible = false;
  const setVisible = (updater: any) => {
    isVisible = typeof updater === 'function' ? updater(isVisible) : updater;
  };

  const render = () => {
    (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
      useState: () => [isVisible, setVisible],
    };
    return (PasswordInput as any).render(props, null);
  };

  const getElements = () => {
    const vdom = render();
    // VDOM children: [Lock, input, button]
    const inputElement = vdom.props.children[1];
    const buttonElement = vdom.props.children[2];
    return { inputElement, buttonElement };
  };

  const clickToggle = () => {
    const { buttonElement } = getElements();
    buttonElement.props.onClick();
  };

  return {
    render,
    getElements,
    clickToggle,
    getIsVisible: () => isVisible,
  };
}

describe('Password Visibility Toggle Feature Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = '/login';
    currentSearchParams = new URLSearchParams('');
  });

  // Requirement: password starts hidden
  it('1. Password input starts hidden with type="password" and accessible Show password aria-label', () => {
    const interactive = createInteractivePasswordInput({
      value: 'CivicSecure2026!',
      id: 'test-pass',
      placeholder: '••••••••',
    });

    const { inputElement, buttonElement } = interactive.getElements();

    expect(inputElement.props.type).toBe('password');
    expect(buttonElement.props['aria-label']).toBe('Show password');
    expect(buttonElement.props.title).toBe('Show password');
    expect(buttonElement.props.type).toBe('button');

    // Verify static markup snapshot
    const html = renderToStaticMarkup(
      <PasswordInput value="CivicSecure2026!" id="test-pass" readOnly />
    );
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('title="Show password"');
    expect(html).not.toContain('type="text"');
    expect(html).not.toContain('aria-label="Hide password"');
  });

  // Requirement: clicking eye shows password
  it('2. Clicking eye icon toggles input type from password to text and updates aria-label to Hide password', () => {
    const interactive = createInteractivePasswordInput({
      value: 'SecretPassPhrase#1',
    });

    // Initial state: hidden
    expect(interactive.getElements().inputElement.props.type).toBe('password');

    // Click toggle button
    interactive.clickToggle();

    // After click: visible
    const { inputElement, buttonElement } = interactive.getElements();
    expect(inputElement.props.type).toBe('text');
    expect(buttonElement.props['aria-label']).toBe('Hide password');
    expect(buttonElement.props.title).toBe('Hide password');
  });

  // Requirement: clicking again hides password
  it('3. Clicking eye icon a second time hides password (toggles back to type="password")', () => {
    const interactive = createInteractivePasswordInput({
      value: 'SuperSecretPhrase#2',
    });

    // 1st click -> visible
    interactive.clickToggle();
    expect(interactive.getElements().inputElement.props.type).toBe('text');
    expect(interactive.getElements().buttonElement.props['aria-label']).toBe('Hide password');

    // 2nd click -> hidden again
    interactive.clickToggle();
    expect(interactive.getElements().inputElement.props.type).toBe('password');
    expect(interactive.getElements().buttonElement.props['aria-label']).toBe('Show password');
  });

  // Requirement: entered password value remains unchanged
  it('4. Entered password value remains strictly unchanged across visibility toggles', () => {
    const enteredValue = 'P@ssw0rd!Complex_2026';
    const mockOnChange = vi.fn();
    const interactive = createInteractivePasswordInput({
      value: enteredValue,
      onChange: mockOnChange,
      required: true,
      minLength: 8,
    });

    // Initial check
    expect(interactive.getElements().inputElement.props.value).toBe(enteredValue);
    expect(interactive.getElements().inputElement.props.required).toBe(true);
    expect(interactive.getElements().inputElement.props.minLength).toBe(8);

    // Toggle to visible
    interactive.clickToggle();
    expect(interactive.getElements().inputElement.props.value).toBe(enteredValue);

    // Toggle back to hidden
    interactive.clickToggle();
    expect(interactive.getElements().inputElement.props.value).toBe(enteredValue);

    // Ensure onChange was not unintentionally triggered by toggling
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  // Requirement: multiple password fields toggle independently
  it('5. Multiple password fields on the same form toggle visibility independently without crosstalk', () => {
    const field1 = createInteractivePasswordInput({
      id: 'new-password-field',
      value: 'FirstNewPassword123!',
    });

    const field2 = createInteractivePasswordInput({
      id: 'confirm-password-field',
      value: 'SecondConfirmPassword456!',
    });

    // Both start hidden
    expect(field1.getElements().inputElement.props.type).toBe('password');
    expect(field2.getElements().inputElement.props.type).toBe('password');

    // Toggle Field 1 only
    field1.clickToggle();
    expect(field1.getElements().inputElement.props.type).toBe('text');
    expect(field1.getElements().buttonElement.props['aria-label']).toBe('Hide password');
    // Field 2 MUST remain hidden
    expect(field2.getElements().inputElement.props.type).toBe('password');
    expect(field2.getElements().buttonElement.props['aria-label']).toBe('Show password');

    // Toggle Field 2 now
    field2.clickToggle();
    // Both are now text
    expect(field1.getElements().inputElement.props.type).toBe('text');
    expect(field2.getElements().inputElement.props.type).toBe('text');

    // Toggle Field 1 back to hidden
    field1.clickToggle();
    // Field 1 is now hidden again, Field 2 remains visible
    expect(field1.getElements().inputElement.props.type).toBe('password');
    expect(field2.getElements().inputElement.props.type).toBe('text');

    // Values remain distinct and untouched
    expect(field1.getElements().inputElement.props.value).toBe('FirstNewPassword123!');
    expect(field2.getElements().inputElement.props.value).toBe('SecondConfirmPassword456!');
  });

  // Accessibility and safety requirements
  it('6. Toggle button uses type="button" to prevent unintended form submission', () => {
    const interactive = createInteractivePasswordInput({
      value: 'SubmissionSafetyCheck123',
    });

    const { buttonElement } = interactive.getElements();
    expect(buttonElement.props.type).toBe('button');
  });

  // Integration test: LoginPage
  it('7. LoginPage renders PasswordInput with password visibility toggle button and accessibility attributes', () => {
    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('title="Show password"');
    expect(html).toContain('placeholder="••••••••"');
  });

  // Integration test: UpdatePasswordPage
  it('8. UpdatePasswordPage integrates independent PasswordInput components for both New Password and Confirm Password', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/app/update-password/page.tsx'),
      'utf-8'
    );

    expect(source).toContain('New Password');
    expect(source).toContain('Confirm New Password');
    expect(source).toContain('PasswordInput');
    expect(source).toMatch(/<PasswordInput[^>]*value=\{newPassword\}/);
    expect(source).toMatch(/<PasswordInput[^>]*value=\{confirmPassword\}/);

    // Verify dual PasswordInput rendering produces two independent password inputs and toggles
    const html = renderToStaticMarkup(
      <div>
        <label>New Password</label>
        <PasswordInput value="NewPassword123!" readOnly autoComplete="new-password" />
        <label>Confirm New Password</label>
        <PasswordInput value="NewPassword123!" readOnly autoComplete="new-password" />
      </div>
    );

    const passwordTypeCount = (html.match(/type="password"/g) || []).length;
    const showPasswordLabelCount = (html.match(/aria-label="Show password"/g) || []).length;

    expect(passwordTypeCount).toBe(2);
    expect(showPasswordLabelCount).toBe(2);
  });
});
