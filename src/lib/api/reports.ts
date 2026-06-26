import { call } from './client';
import type {
    DailyReport,
    DailyReportDetail,
    DailyReportExpenseInput,
    DailyReportPreview,
} from '@/types';

export const getDailyReportPreview = (reportDate: string, restaurantId: string) =>
    call<DailyReportPreview>('get_daily_report_preview', { reportDate, restaurantId });

export const closeDailyReport = (
    reportDate: string,
    restaurantId: string,
    actorUserId: string,
    cashierName: string | undefined,
    notes: string | undefined,
    expenses: DailyReportExpenseInput[],
) =>
    call<DailyReportDetail>('close_daily_report', {
        reportDate,
        restaurantId,
        actorUserId,
        cashierName,
        notes,
        expenses,
    });

export const getDailyReports = (
    restaurantId: string,
    startDate?: string,
    endDate?: string,
    status?: string,
) =>
    call<DailyReport[]>('get_daily_reports', {
        restaurantId,
        startDate,
        endDate,
        status,
    });

export const getDailyReportDetail = (reportId: string, restaurantId: string) =>
    call<DailyReportDetail>('get_daily_report_detail', { reportId, restaurantId });

export const reopenDailyReport = (reportId: string, restaurantId: string, actorUserId: string) =>
    call<DailyReport>('reopen_daily_report', { reportId, restaurantId, actorUserId });
