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

/** How to address multiple recipients so everyone can see who got the report (not BCC). */
function recipientAddressingMode(): 'to_all' | 'to_and_cc' {
  const raw = (process.env.DAILY_REPORT_ADDRESSING || 'to_all').toLowerCase().trim();
  if (raw === 'to_and_cc' || raw === 'cc') {
    return 'to_and_cc';
  }
  return 'to_all';
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

  const mode = recipientAddressingMode();
  let mailTo: string | string[];
  let mailCc: string | undefined;

  if (recipients.length <= 1) {
    mailTo = recipients[0] || DEFAULT_RECIPIENT;
  } else if (mode === 'to_and_cc') {
    mailTo = recipients[0];
    mailCc = recipients.slice(1).join(', ');
  } else {
    // Default: every address in To — all clients show the full list (transparent, not BCC)
    mailTo = recipients;
  }

  const info = await transporter.sendMail({
    from,
    to: mailTo,
    cc: mailCc,
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
