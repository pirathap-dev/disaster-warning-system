import { Request, Response, NextFunction } from 'express';
import { WarningService } from '../services/warningService';
import { WarningStatus } from '../types';

export class WarningController {
  /**
   * GET /api/warnings/hazards
   */
  static async getVerifiedHazards(req: Request, res: Response, next: NextFunction) {
    try {
      const hazards = await WarningService.getVerifiedHazards();
      res.status(200).json({
        success: true,
        data: hazards,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/warnings
   */
  static async createWarning(req: Request, res: Response, next: NextFunction) {
    try {
      const userRole = req.user?.role;
      const warning = await WarningService.createWarning({
        ...req.body,
        createdBy: req.user?.name,
        userRole,
      });
      res.status(201).json({
        success: true,
        data: warning,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/warnings
   */
  static async getWarnings(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, warningLevel, hazardId } = req.query;
      let warnings = await WarningService.getWarnings({
        status: status as string,
        warningLevel: warningLevel as string,
        hazardId: hazardId as string,
      });
      if (req.user?.role === 'CITIZEN' || req.user?.role === 'VOLUNTEER') {
        warnings = warnings.filter((warning) =>
          [WarningStatus.PUBLISHED, WarningStatus.ACTIVE, WarningStatus.UPDATED].includes(warning.status) &&
          (!req.user?.district || warning.affectedArea.toLowerCase().includes(req.user.district.toLowerCase()))
        );
      }
      res.status(200).json({
        success: true,
        data: warnings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/warnings/:id
   */
  static async getWarningById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const warning = await WarningService.getWarningById(id);
      res.status(200).json({
        success: true,
        data: warning,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/warnings/:id
   */
  static async updateWarning(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userRole = req.user?.role;
      const updated = await WarningService.updateWarning(id, req.body, userRole);
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/warnings/:id/status
   */
  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, cancellationReason } = req.body;
      const userRole = req.user?.role;
      const updated = await WarningService.updateStatus(id, status, {
        cancellationReason,
        userRole,
      });
      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/warnings/:id/notifications
   */
  static async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const notifications = await WarningService.getWarningNotifications(id);
      res.status(200).json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/warnings/:id/notifications/simulate
   */
  static async simulateNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await WarningService.simulateDeliveryProgression(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
