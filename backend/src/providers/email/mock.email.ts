import { IEmailProvider, GovernmentInvitationEmailParams } from './email.interface';

export class MockEmailProvider implements IEmailProvider {
  private sentInvitations: GovernmentInvitationEmailParams[] = [];

  async sendGovernmentInvitation(params: GovernmentInvitationEmailParams): Promise<void> {
    // In mock mode, record safe metadata in memory for verification
    this.sentInvitations.push({ ...params });
    console.info(
      `[MockEmailProvider] Government staff invitation email dispatched to ${params.to} (${params.role}, ${params.departmentName})`
    );
  }

  getSentInvitations(): GovernmentInvitationEmailParams[] {
    return [...this.sentInvitations];
  }

  clearSentInvitations(): void {
    this.sentInvitations = [];
  }
}
