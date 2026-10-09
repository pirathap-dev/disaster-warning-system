import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/authService';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ success: true, data: await AuthService.register(req.body) });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await AuthService.login(req.body.email, req.body.password) });
  } catch (error) {
    next(error);
  }
};

export const me = (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: req.user });
};

export const testLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await AuthService.testLogin(req.body.role) });
  } catch (error) {
    next(error);
  }
};