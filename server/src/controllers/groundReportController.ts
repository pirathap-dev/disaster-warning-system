import { Request, Response, NextFunction } from 'express';
import { GroundReportService } from '../services/groundReportService';

export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await GroundReportService.createReport(req.body);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const getReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reporterId } = req.query;
    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (reporterId) filters.reporterId = reporterId;

    const reports = await GroundReportService.getReports(filters);
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
};

export const getReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await GroundReportService.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: { message: 'Report not found', code: 'NOT_FOUND' } });
      return;
    }
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const editReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reporterId, ...updates } = req.body;
    const report = await GroundReportService.editReport(req.params.id, reporterId, updates);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const deleteReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // reporterId comes from query param or body (no auth middleware yet)
    const reporterId = (req.query.reporterId as string) || req.body.reporterId;
    await GroundReportService.deleteReport(req.params.id, reporterId);
    res.status(200).json({ success: true, message: 'Report deleted' });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reviewerId, remarks } = req.body;
    const report = await GroundReportService.updateStatus(req.params.id, status, reviewerId, remarks);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};
