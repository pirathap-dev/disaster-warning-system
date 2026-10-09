import { GroundReportService } from '../services/groundReportService';
import { GroundReportModel } from '../models/GroundReport';
import { DisasterType, ReportStatus, SeverityLevel } from '../types';

jest.mock('../models/GroundReport');

describe('GroundReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReport and Duplicate Detection', () => {
    const reportData = {
      reporterId: 'user1',
      disasterType: DisasterType.FLOOD,
      description: 'Flood in area',
      severity: SeverityLevel.HIGH,
      location: { latitude: 6.9271, longitude: 79.8612 }
    };

    it('should create a valid report without duplicate flag', async () => {
      // Mock find to return empty for duplicate check
      (GroundReportModel.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([])
      });
      
      const saveMock = jest.fn().mockResolvedValue({ _id: 'report1', ...reportData, status: ReportStatus.SUBMITTED });
      (GroundReportModel as unknown as jest.Mock).mockImplementation(() => ({
        save: saveMock
      }));

      const result = await GroundReportService.createReport(reportData);
      
      expect(result.status).toBe(ReportStatus.SUBMITTED);
      expect(saveMock).toHaveBeenCalled();
      expect(GroundReportModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ disasterType: DisasterType.FLOOD })
      );
    });

    it('should flag as duplicate if similar report exists recently within 1km', async () => {
      const existingReport = {
        _id: 'existing1',
        disasterType: DisasterType.FLOOD,
        location: { latitude: 6.9275, longitude: 79.8615 } // Very close
      };

      (GroundReportModel.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([existingReport])
      });

      const saveMock = jest.fn().mockImplementation(function(this: any) {
        return Promise.resolve(this);
      });
      (GroundReportModel as unknown as jest.Mock).mockImplementation(function(this: any, data: any) {
        Object.assign(this, data);
        this.save = saveMock;
      });

      const result = await GroundReportService.createReport(reportData);
      
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOf).toBe('existing1');
    });

    it('should NOT flag as duplicate if report is far away', async () => {
      const existingReport = {
        _id: 'existing1',
        disasterType: DisasterType.FLOOD,
        location: { latitude: 7.2906, longitude: 80.6337 } // Kandy, far from Colombo
      };

      (GroundReportModel.find as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue([existingReport])
      });

      const saveMock = jest.fn().mockImplementation(function(this: any) {
        return Promise.resolve(this);
      });
      (GroundReportModel as unknown as jest.Mock).mockImplementation(function(this: any, data: any) {
        Object.assign(this, data);
        this.save = saveMock;
      });

      const result = await GroundReportService.createReport(reportData);
      
      expect(result.isDuplicate).toBeFalsy();
    });
  });

  describe('updateStatus', () => {
    it('should allow valid transition from SUBMITTED to UNDER_REVIEW', async () => {
      const report = {
        _id: 'report1',
        status: ReportStatus.SUBMITTED,
        save: jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); })
      };

      (GroundReportModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(report)
      });

      const result = await GroundReportService.updateStatus('report1', ReportStatus.UNDER_REVIEW, 'officer1');
      
      expect(result.status).toBe(ReportStatus.UNDER_REVIEW);
      expect(result.reviewerId).toBe('officer1');
      expect(report.save).toHaveBeenCalled();
    });

    it('should block invalid transition from SUBMITTED to VERIFIED', async () => {
      const report = {
        _id: 'report1',
        status: ReportStatus.SUBMITTED,
        save: jest.fn()
      };

      (GroundReportModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(report)
      });

      await expect(GroundReportService.updateStatus('report1', ReportStatus.VERIFIED, 'officer1'))
        .rejects
        .toEqual(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
      
      expect(report.save).not.toHaveBeenCalled();
    });

    it('should set verification timestamp when verifying', async () => {
      const report = {
        _id: 'report1',
        status: ReportStatus.UNDER_REVIEW,
        save: jest.fn().mockImplementation(function(this: any) { return Promise.resolve(this); })
      };

      (GroundReportModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(report)
      });

      const result = await GroundReportService.updateStatus('report1', ReportStatus.VERIFIED, 'officer1', 'All looks good');
      
      expect(result.status).toBe(ReportStatus.VERIFIED);
      expect(result.verificationRemarks).toBe('All looks good');
      expect(result.verificationTimestamp).toBeDefined();
    });
    
    it('should throw NOT_FOUND for invalid ID', async () => {
      (GroundReportModel.findById as jest.Mock).mockReturnValue({
        exec: jest.fn().mockResolvedValue(null)
      });

      await expect(GroundReportService.updateStatus('invalid', ReportStatus.UNDER_REVIEW, 'officer1'))
        .rejects
        .toEqual(expect.objectContaining({ code: 'NOT_FOUND' }));
    });
  });
});
