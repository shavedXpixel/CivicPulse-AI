import { GovernmentInvitationEmailParams } from './email.interface';

export function renderInvitationEmail(params: GovernmentInvitationEmailParams): { subject: string; text: string; html: string } {
  const subject = `[CivicPulse AI] Government Staff Account Invitation — Action Required`;

  const text = `
CivicPulse AI — Municipal Government Operations
Government Staff Account Invitation

Dear ${params.fullName},

You have been provisioned as an authorized municipal staff member on the CivicPulse AI Public Problem Intelligence Layer.

Officer Details:
- Full Name: ${params.fullName}
- Designated Role: ${params.role}
- Assigned Department: ${params.departmentName}
- Status: INVITED (Pending Activation)

Complete your CivicPulse account setup by visiting the official invitation link below:
${params.actionLink}

Zero-Knowledge Password Policy:
Administrators never supply, store, or view your credentials. Follow the link above to establish your personal municipal credentials securely.

If you did not expect this invitation, please notify your municipal department administrator immediately.

CivicPulse AI — Public Action Intelligence Platform
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CivicPulse AI Staff Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9fa; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { border-bottom: 2px solid #6b21a8; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 13px; font-weight: 800; font-family: monospace; letter-spacing: 0.1em; color: #6b21a8; text-transform: uppercase; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 6px; margin-bottom: 0; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; font-family: monospace; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; margin-top: 8px; }
    .intro { font-size: 14px; line-height: 1.6; color: #334155; margin-top: 16px; }
    .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #edf2f7; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; font-weight: 500; }
    .detail-value { font-weight: 600; color: #0f172a; font-family: monospace; }
    .cta-container { text-align: center; margin: 32px 0; }
    .cta-heading { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .cta-button { display: inline-block; background-color: #6b21a8; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; font-family: monospace; }
    .cta-button:hover { background-color: #581c87; }
    .footer { font-size: 11px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px; }
    .footer strong { color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">CivicPulse AI — Government Operations Authority</div>
      <h1 class="title">Government Staff Account Invitation</h1>
      <span class="badge">ACTION REQUIRED</span>
    </div>

    <p class="intro">
      Dear <strong>${params.fullName}</strong>,<br><br>
      You have been provisioned as an authorized municipal officer on the <strong>CivicPulse AI Public Problem Intelligence Layer</strong>.
    </p>

    <div class="details-box">
      <div class="detail-row">
        <span class="detail-label">Officer Name</span>
        <span class="detail-value">${params.fullName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Designated Role</span>
        <span class="detail-value">${params.role}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Assigned Department</span>
        <span class="detail-value">${params.departmentName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Lifecycle Status</span>
        <span class="detail-value" style="color: #b45309;">INVITED (Pending Activation)</span>
      </div>
    </div>

    <div class="cta-container">
      <div class="cta-heading">Complete your CivicPulse account setup</div>
      <a href="${params.actionLink}" class="cta-button" target="_blank" rel="noopener noreferrer">Complete Account Setup</a>
    </div>

    <div class="footer">
      <strong>Zero-Knowledge Security Policy:</strong> CivicPulse administrators never supply, view, or store officer passwords. Clicking the button above establishes your confidential credentials securely directly with the authoritative identity layer.<br><br>
      If you were not expecting this official invitation, please contact your municipal department administrator immediately.<br><br>
      &copy; 2026 CivicPulse AI. All rights reserved.
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}
