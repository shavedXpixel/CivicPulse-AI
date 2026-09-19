import net from 'net';
import tls from 'tls';
import { IEmailProvider, GovernmentInvitationEmailParams } from './email.interface';
import { renderInvitationEmail } from './invitation-template';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES } from '@civicpulse/shared';

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from: string;
}

export class SmtpEmailProvider implements IEmailProvider {
  private config: SmtpConfig;

  constructor(customConfig?: Partial<SmtpConfig>) {
    this.config = {
      host: customConfig?.host || env.SMTP_HOST || 'localhost',
      port: customConfig?.port || env.SMTP_PORT || 587,
      secure: customConfig?.secure ?? (env.SMTP_SECURE || false),
      user: customConfig?.user || env.SMTP_USER || '',
      password: customConfig?.password || env.SMTP_PASSWORD || '',
      from: customConfig?.from || env.EMAIL_FROM || 'CivicPulse Authority <notifications@civicpulse.gov.in>'
    };
  }

  async sendGovernmentInvitation(params: GovernmentInvitationEmailParams): Promise<void> {
    const { subject, text, html } = renderInvitationEmail(params);
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Build RFC 2822 MIME message
    const mimeMessage = [
      `From: ${this.config.from}`,
      `To: ${params.to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      text,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      html,
      ``,
      `--${boundary}--`,
      ``
    ].join('\r\n');

    await this.sendMailViaSmtp(params.to, mimeMessage);
    console.info(`[SmtpEmailProvider] Official invitation email delivered via SMTP to ${params.to}`);
  }

  private sendMailViaSmtp(to: string, messageData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let socket: net.Socket | tls.TLSSocket;
      let buffer = '';
      let currentStage: 'INIT' | 'EHLO' | 'STARTTLS' | 'AUTH_LOGIN' | 'AUTH_USER' | 'AUTH_PASS' | 'MAIL_FROM' | 'RCPT_TO' | 'DATA' | 'MESSAGE' | 'QUIT' = 'INIT';

      const cleanup = () => {
        try {
          socket.removeAllListeners();
          socket.end();
          socket.destroy();
        } catch {
          // ignore socket destruction errors
        }
      };

      const fail = (errMsg: string) => {
        cleanup();
        reject(
          new AppError({
            statusCode: 502,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: `SMTP email dispatch failed: ${errMsg}`
          })
        );
      };

      const sendCommand = (cmd: string) => {
        socket.write(cmd + '\r\n');
      };

      const connectSocket = () => {
        if (this.config.secure || this.config.port === 465) {
          return tls.connect({ host: this.config.host, port: this.config.port, rejectUnauthorized: false });
        }
        return net.connect({ host: this.config.host, port: this.config.port });
      };

      try {
        socket = connectSocket();
      } catch (err: any) {
        return fail(`Connection error: ${err.message}`);
      }

      socket.setTimeout(15000);
      socket.setEncoding('utf8');

      socket.on('timeout', () => fail('SMTP connection timed out'));
      socket.on('error', (err) => fail(`Socket error: ${err.message}`));

      socket.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line) continue;
          const code = parseInt(line.substring(0, 3), 10);
          const isMultiline = line.charAt(3) === '-';
          if (isMultiline) continue;

          switch (currentStage) {
            case 'INIT':
              if (code === 220) {
                currentStage = 'EHLO';
                sendCommand('EHLO civicpulse.gov.in');
              } else {
                fail(`Unexpected greeting response: ${code}`);
              }
              break;

            case 'EHLO':
              if (code === 250) {
                if (this.config.user && this.config.password) {
                  currentStage = 'AUTH_LOGIN';
                  sendCommand('AUTH LOGIN');
                } else {
                  currentStage = 'MAIL_FROM';
                  const fromMatch = this.config.from.match(/<([^>]+)>/);
                  const sender = fromMatch ? fromMatch[1] : this.config.from;
                  sendCommand(`MAIL FROM:<${sender}>`);
                }
              } else {
                fail(`EHLO failed with code ${code}`);
              }
              break;

            case 'AUTH_LOGIN':
              if (code === 334) {
                currentStage = 'AUTH_USER';
                sendCommand(Buffer.from(this.config.user || '').toString('base64'));
              } else {
                fail(`AUTH LOGIN failed with code ${code}`);
              }
              break;

            case 'AUTH_USER':
              if (code === 334) {
                currentStage = 'AUTH_PASS';
                sendCommand(Buffer.from(this.config.password || '').toString('base64'));
              } else {
                fail(`SMTP User authentication failed with code ${code}`);
              }
              break;

            case 'AUTH_PASS':
              if (code === 235) {
                currentStage = 'MAIL_FROM';
                const fromMatch = this.config.from.match(/<([^>]+)>/);
                const sender = fromMatch ? fromMatch[1] : this.config.from;
                sendCommand(`MAIL FROM:<${sender}>`);
              } else {
                fail(`SMTP Password authentication rejected (code ${code})`);
              }
              break;

            case 'MAIL_FROM':
              if (code === 250) {
                currentStage = 'RCPT_TO';
                sendCommand(`RCPT TO:<${to}>`);
              } else {
                fail(`MAIL FROM rejected with code ${code}`);
              }
              break;

            case 'RCPT_TO':
              if (code === 250 || code === 251) {
                currentStage = 'DATA';
                sendCommand('DATA');
              } else {
                fail(`RCPT TO rejected with code ${code}`);
              }
              break;

            case 'DATA':
              if (code === 354) {
                currentStage = 'MESSAGE';
                socket.write(messageData + '\r\n.\r\n');
              } else {
                fail(`DATA command rejected with code ${code}`);
              }
              break;

            case 'MESSAGE':
              if (code === 250) {
                currentStage = 'QUIT';
                sendCommand('QUIT');
                cleanup();
                resolve();
              } else {
                fail(`Message delivery rejected with code ${code}`);
              }
              break;

            case 'QUIT':
              cleanup();
              resolve();
              break;
          }
        }
      });
    });
  }
}
