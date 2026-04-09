import { NextRequest, NextResponse } from 'next/server';
import {
  getDailyEmailReportData,
  getReportTimezone,
  isDryRun,
  resolveReportDate,
  serializeDailyEmailReportForJson,
} from '@/lib/daily-email-report';
import { EMAIL_TREND_CHAT_RATES_CID, EMAIL_TREND_CONVERSION_CID } from '@/lib/email-trend-cids';
import {
  buildDailyEmailSubject,
  renderDailyEmailHtml,
  renderDailyEmailText,
} from '@/lib/daily-email-template';
import {
  getDailyReportRecipients,
  isSmtpConfigured,
  sendSmtpEmail,
} from '@/lib/smtp-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

function splitRecipientsParam(value: string | null): string[] | null {
  if (!value) {
    return null;
  }

  const recipients = value
    .split(',')
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  return recipients.length > 0 ? recipients : null;
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== 'production';
  }

  const authorization = request.headers.get('authorization');
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : authorization;

  if (bearerToken === cronSecret) {
    return true;
  }

  return request.nextUrl.searchParams.get('secret') === cronSecret;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const date = resolveReportDate(searchParams);
    const dryRun = isDryRun(searchParams);
    const recipientsOverride = splitRecipientsParam(searchParams.get('to'));
    const recipients = getDailyReportRecipients(recipientsOverride);
    const origin = process.env.APP_BASE_URL || request.nextUrl.origin;

    const report = await getDailyEmailReportData(date);
    const subject = buildDailyEmailSubject(report);
    const text = renderDailyEmailText(report);
    const htmlDryRun = renderDailyEmailHtml(report, 'dataUrl');
    const htmlForSend = renderDailyEmailHtml(report, 'cid');

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        date,
        timezone: getReportTimezone(),
        recipients,
        origin,
        subject,
        report: serializeDailyEmailReportForJson(report),
        html: htmlDryRun,
        text,
      });
    }

    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'SMTP is not fully configured',
          requiredEnv: [
            'SMTP_HOST',
            'SMTP_PORT',
            'SMTP_USER',
            'SMTP_PASSWORD',
            'SMTP_FROM_EMAIL',
          ],
        },
        { status: 500 }
      );
    }

    const inlineAttachments = [];
    if (report.trendCharts.conversionPng?.length) {
      inlineAttachments.push({
        filename: 'trend-conversions.png',
        content: report.trendCharts.conversionPng,
        cid: EMAIL_TREND_CONVERSION_CID,
      });
    }
    if (report.trendCharts.chatRatesPng?.length) {
      inlineAttachments.push({
        filename: 'trend-chat-rates.png',
        content: report.trendCharts.chatRatesPng,
        cid: EMAIL_TREND_CHAT_RATES_CID,
      });
    }

    const delivery = await sendSmtpEmail({
      to: recipientsOverride || undefined,
      subject,
      html: htmlForSend,
      text,
      inlineAttachments: inlineAttachments.length > 0 ? inlineAttachments : undefined,
    });

    return NextResponse.json({
      success: true,
      dryRun: false,
      date,
      timezone: getReportTimezone(),
      recipients,
      origin,
      subject,
      delivery,
      summary: {
        totalProspects: report.prospects.total,
        totalSales: report.prospects.totalSales,
        totalConversionRate: report.prospects.totalConversionRate,
        frustrationPercent: report.chatAnalysis.frustrationPercent,
        averageResponseTime: report.chatAnalysis.averageResponseTime,
      },
    });
  } catch (error) {
    console.error('[Daily Email Cron] Failed to generate or send report:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
