import { Request, Response, NextFunction } from 'express';
import { GroundReportService } from '../services/groundReportService';

export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await GroundReportService.createReport(req.body);
    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

export const getReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reporterId } = req.query;
    const filters: any = {};
    if (status) filters.status = status;
    if (reporterId) filters.reporterId = reporterId;

    const reports = await GroundReportService.getReports(filters);
    res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

export const getReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await GroundReportService.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({
        success: false,
        error: { message: 'Report not found', code: 'NOT_FOUND' }
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reviewerId, remarks } = req.body;
    const report = await GroundReportService.updateStatus(req.params.id, status, reviewerId, remarks);
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};
