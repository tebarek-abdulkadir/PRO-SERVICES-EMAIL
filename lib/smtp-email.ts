import nodemailer from 'nodemailer';

const DEFAULT_RECIPIENT = 'sahar.sabbagh@maids.cc';

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function smtpHost(): string {
  return process.env.SMTP_HOST || process.env.SMTP_SERVER || '';
}

function smtpUser(): string {
  return process.env.SMTP_USER || process.env.SMTP_EMAIL || '';
}

function smtpFrom(): string {
  return process.env.SMTP_FROM_EMAIL || process.env.SMTP_EMAIL || smtpUser();
}

function splitRecipients(value: string): string[] {
  return value
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

export interface SendSmtpEmailInput {
  to?: string[];
  subject: string;
  html: string;
  text: string;
}

export interface SmtpSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export function getDailyReportRecipients(overrideRecipients?: string[] | null): string[] {
  if (overrideRecipients && overrideRecipients.length > 0) {
    return overrideRecipients;
  }

  const configuredRecipients = process.env.DAILY_REPORT_RECIPIENTS;

  if (!configuredRecipients) {
    return [DEFAULT_RECIPIENT];
  }

  const recipients = splitRecipients(configuredRecipients);
  return recipients.length > 0 ? recipients : [DEFAULT_RECIPIENT];
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    smtpHost() &&
      process.env.SMTP_PORT &&
      smtpUser() &&
      process.env.SMTP_PASSWORD &&
      smtpFrom()
  );
}

export async function sendSmtpEmail({
  to,
  subject,
  html,
  text,
}: SendSmtpEmailInput): Promise<SmtpSendResult> {
  const host = smtpHost();
  if (!host) {
    throw new Error('Missing SMTP host: set SMTP_HOST or SMTP_SERVER');
  }
  const port = Number(requireEnv('SMTP_PORT'));
  const user = smtpUser();
  if (!user) {
    throw new Error('Missing SMTP user: set SMTP_USER or SMTP_EMAIL');
  }
  const password = requireEnv('SMTP_PASSWORD');
  const from = smtpFrom() || user;
  const useTls = parseBoolean(process.env.SMTP_USE_TLS, true);
  const recipients = getDailyReportRecipients(to);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: useTls && port !== 465,
    auth: {
      user,
      pass: password,
    },
  });

  const info = await transporter.sendMail({
    from,
    to: recipients.join(', '),
    subject,
    html,
    text,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
  };
}
