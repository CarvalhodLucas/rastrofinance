import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type UserSessionPayload } from '../services/authService.js';

export interface AuthenticatedRequest extends Request {
  user?: UserSessionPayload;
}

/**
 * Middleware para exigir autenticação com Bearer Token JWT.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Acesso não autorizado. Faça login para continuar.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Token ausente.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor, faça login novamente.' });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Middleware opcional para extrair o usuário autenticado caso o token exista.
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }
  }
  next();
}
