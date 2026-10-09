import { Request, Response, NextFunction } from 'express';
import { GroundReportService } from '../services/groundReportService';
import { UserRole } from '../types';

const isDmc = (role?: UserRole) => role === UserRole.DMC_DUTY_OFFICER || role === UserRole.DMC_OFFICER;

export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await GroundReportService.createReport({ ...req.body, reporterId: req.user!.id });
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const getReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (!isDmc(req.user?.role)) filters.reporterId = req.user!.id;

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
    if (!isDmc(req.user?.role) && report.reporterId !== req.user?.id) {
      res.status(403).json({ success: false, error: { message: 'You can only view your own reports', code: 'FORBIDDEN' } });
      return;
    }
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const editReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reporterId: _ignored, ...updates } = req.body;
    const report = await GroundReportService.editReport(req.params.id, req.user!.id, updates);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const deleteReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // reporterId comes from query param or body (no auth middleware yet)
    await GroundReportService.deleteReport(req.params.id, req.user!.id);
    res.status(200).json({ success: true, message: 'Report deleted' });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, remarks } = req.body;
    const report = await GroundReportService.updateStatus(req.params.id, status, req.user!.id, remarks);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};
