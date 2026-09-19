import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OfficerCompatibilityRedirect from '../src/app/officer/page';
import AdminDepartmentsPage from '../src/app/admin/departments/page';
import AdminUsersPage from '../src/app/admin/users/page';
import DepartmentOfficerPage from '../src/app/department-officer/page';
import FieldOfficerPage from '../src/app/field-officer/page';
import { UserRole, UserStatus } from '@civicpulse/shared';

// Mock Next.js Navigation
let currentPathname = '/';
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
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

// Mock MapContainer
vi.mock('../src/components/domain/MapContainer', () => ({
  MapContainer: () => <div data-testid="mock-map">Map Container</div>,
}));

// Mock AuthContext
let mockAuthState = {
  user: { id: 'usr_mock_1', email: 'officer@bmc.gov.in' } as any,
  userProfile: {
    id: 'usr_mock_1',
    display_name: 'Test Officer',
    email: 'officer@bmc.gov.in',
    role: UserRole.DEPARTMENT_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
  } as any,
  isDemoMode: false,
  isConfigured: true,
  loading: false,
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Mock apiClient
vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/departments')) {
        return {
          data: [
            { id: 'WATCO', name: 'Water Corporation of Odisha', short_name: 'WATCO', status: 'ACTIVE' },
            { id: 'DRAINAGE', name: 'BMC Drainage Division', short_name: 'DRAIN', status: 'ACTIVE' }
          ]
        };
      }
      if (url.includes('/api/v1/admin/users')) {
        return { data: { users: [] } };
      }
      if (url.includes('/api/v1/assignments')) {
        return { data: [] };
      }
      if (url.includes('/api/v1/problems')) {
        return { data: [] };
      }
      return { data: {} };
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} })
  },
}));

describe('Phase 15B.5.3.17 — Role Workspaces & Dedicated Pages Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders OfficerCompatibilityRedirect and calls router.replace to /field-officer', () => {
    const html = renderToStaticMarkup(<OfficerCompatibilityRedirect />);
    expect(html).toContain('Redirecting to /field-officer...');
  });

  it('renders AdminDepartmentsPage with DepartmentManager hierarchy', () => {
    mockAuthState.userProfile.role = UserRole.ADMIN;
    const html = renderToStaticMarkup(<AdminDepartmentsPage />);
    expect(html).toContain('Department Registry');
    expect(html).toContain('Add Department');
  });

  it('renders AdminUsersPage with UserDirectory hierarchy', () => {
    mockAuthState.userProfile.role = UserRole.ADMIN;
    const html = renderToStaticMarkup(<AdminUsersPage />);
    expect(html).toContain('Users &amp; Access Directory');
    expect(html).toContain('Search by name or email...');
  });

  it('renders DepartmentOfficerPage scoped to department jurisdiction', () => {
    mockAuthState.userProfile.role = UserRole.DEPARTMENT_OFFICER;
    mockAuthState.userProfile.department_id = 'WATCO';
    const html = renderToStaticMarkup(<DepartmentOfficerPage />);
    expect(html).toContain('WATCO');
    expect(html).toContain('WATCO SCOPE');
    expect(html).toContain('Department Problems');
  });

  it('renders FieldOfficerPage scoped to officer assignments', () => {
    mockAuthState.userProfile.role = UserRole.FIELD_OFFICER;
    const html = renderToStaticMarkup(<FieldOfficerPage />);
    expect(html).toContain('Field Operations Queue');
    expect(html).toContain('assigned_to === user.id');
  });
});
