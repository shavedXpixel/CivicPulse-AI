import { UserRole } from '@civicpulse/shared';

export interface GovernmentInvitationEmailParams {
  to: string;
  fullName: string;
  role: UserRole;
  departmentName: string;
  actionLink: string;
}

export interface IEmailProvider {
  sendGovernmentInvitation(params: GovernmentInvitationEmailParams): Promise<void>;
}
