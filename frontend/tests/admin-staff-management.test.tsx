import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminPage from '../src/app/admin/page';
import { AdminView } from '../src/components/admin/AdminView';
import UpdatePasswordPage from '../src/app/update-password/page';
import AuthCallbackPage from '../src/app/auth/callback/page';
import { UserRole, UserStatus, UserProfile } from '@civicpulse/shared';

// 1. Mock Next.js Navigation & Links
let currentPathname = '/admin';
let currentSearchParams = new URLSearchParams('');
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
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

// 2. Mock AuthContext
let mockAuthState = {
  user: null as any,
  userProfile: null as any,
  isDemoMode: false,
  isConfigured: true,
  loading: false,
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('mock-admin-token'),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// 3. Mock API Client
let mockUsersList: UserProfile[] = [];
let mockDepartmentsList: any[] = [];

vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/admin/users')) {
        return { data: { users: mockUsersList } };
      }
      if (url.includes('/api/v1/departments')) {
        return { data: mockDepartmentsList };
      }
      return { data: null };
    }),
    post: vi.fn().mockImplementation(async (url: string, body: any) => {
      if (url.includes('/api/v1/admin/users/government')) {
        return {
          data: {
            user: {
              id: 'usr_new_officer',
              email: body.email,
              display_name: body.full_name,
              role: body.role,
              department_id: body.department_id,
              status: UserStatus.INVITED,
              created_at: new Date().toISOString(),
            },
            notice: 'Official government invitation dispatched to officer via Supabase Auth.',
          },
        };
      }
      if (url.includes('/api/v1/admin/users/') && url.includes('/resend-invite')) {
        return { data: { message: 'Official invitation resent successfully.' } };
      }
      if (url.includes('/api/v1/admin/users/') && url.includes('/disable')) {
        return { data: { message: 'Staff account disabled successfully.' } };
      }
      if (url.includes('/api/v1/admin/users/') && url.includes('/enable')) {
        return { data: { message: 'Staff account enabled successfully.' } };
      }
      if (url.includes('/api/v1/auth/activate-staff')) {
        return {
          data: {
            user: {
              id: 'usr_mock_worker',
              status: UserStatus.ACTIVE,
            },
          },
        };
      }
      return { data: {} };
    }),
  },
}));

// 4. Mock Supabase Client
const mockUpdateUser = vi.fn().mockResolvedValue({ data: { user: { id: 'usr-123' } }, error: null });
const mockGetSession = vi.fn().mockResolvedValue({
  data: {
    session: {
      user: {
        id: 'usr_invited_worker',
        email: 'invited_worker@bmc.gov.in',
        user_metadata: { role: UserRole.DEPARTMENT_OFFICER },
      },
    },
  },
  error: null,
});

vi.mock('../src/lib/supabase-client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
      getSession: mockGetSession,
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

describe('Phase 15B.5.3.16 — Admin Government Staff Provisioning & Management UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = { id: 'admin_1', email: 'admin@civicpulse.gov.in' };
    mockAuthState.userProfile = {
      id: 'admin_1',
      email: 'admin@civicpulse.gov.in',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };
    mockDepartmentsList = [
      { id: 'dept_roads', name: 'BMC Roads Division' },
      { id: 'dept_watco', name: 'Water Corporation Division' },
    ];
    mockUsersList = [];
    currentPathname = '/admin';
    currentSearchParams = new URLSearchParams('');
  });

  describe('1. Admin Government Staff Section & Provisioning', () => {
    it('renders the clearly separated GOVERNMENT STAFF section heading and + Create Staff Account button', () => {
      const html = renderToStaticMarkup(<AdminPage />);
      expect(html).toContain('GOVERNMENT STAFF');
      expect(html).toContain('+ Create Staff Account');
    });

    it('renders empty state when no staff accounts exist', () => {
      const html = renderToStaticMarkup(<AdminView initialUsers={[]} />);
      expect(html).toContain('No government staff accounts have been provisioned.');
    });

    it('renders the Staff Table with all required columns when staff accounts exist', () => {
      const sampleStaff: UserProfile[] = [
        {
          id: 'usr_sample',
          email: 'sample@bmc.gov.in',
          display_name: 'Sample Officer',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads',
          status: UserStatus.ACTIVE,
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ];
      const html = renderToStaticMarkup(<AdminView initialUsers={sampleStaff} />);
      expect(html).toContain('Name');
      expect(html).toContain('Email');
      expect(html).toContain('Role');
      expect(html).toContain('Department');
      expect(html).toContain('Status');
      expect(html).toContain('Created');
      expect(html).toContain('Actions');
    });

    it('displays staff members distinguishing INVITED, ACTIVE, INACTIVE, and SUSPENDED statuses', () => {
      const staffList: UserProfile[] = [
        {
          id: 'usr_1',
          email: 'officer.invited@bmc.gov.in',
          display_name: 'Invited Officer',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads',
          status: UserStatus.INVITED,
          created_at: '2026-09-10T10:00:00Z',
          updated_at: '2026-09-10T10:00:00Z',
        },
        {
          id: 'usr_2',
          email: 'officer.active@bmc.gov.in',
          display_name: 'Active Officer',
          role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads',
          status: UserStatus.ACTIVE,
          created_at: '2026-09-08T10:00:00Z',
          updated_at: '2026-09-08T10:00:00Z',
        },
        {
          id: 'usr_3',
          email: 'officer.inactive@bmc.gov.in',
          display_name: 'Inactive Officer',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads',
          status: UserStatus.INACTIVE,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'usr_4',
          email: 'officer.suspended@bmc.gov.in',
          display_name: 'Suspended Officer',
          role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads',
          status: UserStatus.SUSPENDED,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
      ];

      const html = renderToStaticMarkup(
        <AdminView initialUsers={staffList} initialDepartments={mockDepartmentsList} />
      );
      expect(html).toContain('Invited Officer');
      expect(html).toContain('INVITED');
      expect(html).toContain('Resend Invitation');

      expect(html).toContain('Active Officer');
      expect(html).toContain('ACTIVE');
      expect(html).toContain('Disable');

      expect(html).toContain('Inactive Officer');
      expect(html).toContain('INACTIVE');
      expect(html).toContain('Re-enable');

      expect(html).toContain('Suspended Officer');
      expect(html).toContain('SUSPENDED');
    });

    it('enforces RBAC gate on /admin for non-administrative roles', () => {
      mockAuthState.userProfile = {
        id: 'citizen_1',
        email: 'citizen@example.com',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
      };

      const html = renderToStaticMarkup(<AdminPage />);
      expect(html).toContain('Restricted Administration Console (HTTP 403)');
      expect(html).toContain('strictly restricted to verified Municipal Administrators');
    });
  });

  describe('2. Distinction between PASSWORD_RECOVERY and GOVERNMENT INVITE flows', () => {
    it('renders password recovery view when type is recovery or omitted on /update-password', () => {
      currentPathname = '/update-password';
      currentSearchParams = new URLSearchParams('type=recovery');

      const html = renderToStaticMarkup(<UpdatePasswordPage />);
      expect(html).toContain('Set New Password');
      expect(html).toContain('Account Security &amp; Access');
      expect(html).not.toContain('Government Staff Onboarding');
    });

    it('renders government onboarding setup view when type=invite on /update-password', () => {
      currentPathname = '/update-password';
      currentSearchParams = new URLSearchParams('type=invite');

      const html = renderToStaticMarkup(<UpdatePasswordPage />);
      expect(html).toContain('Government Staff Onboarding');
      expect(html).toContain('Complete Staff Account Setup');
      expect(html).toContain('Establish your municipal officer password to activate your CivicPulse government account.');
    });

    it('callback handles session verification with clear status messages', () => {
      currentPathname = '/auth/callback';
      currentSearchParams = new URLSearchParams('type=invite');

      const html = renderToStaticMarkup(<AuthCallbackPage />);
      expect(html).toBeDefined();
      expect(html).toContain('Confirming Identity');
      expect(html).toContain('Verifying your email confirmation credentials...');
    });
  });
});
