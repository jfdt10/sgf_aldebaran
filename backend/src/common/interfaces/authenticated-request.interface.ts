import { Request } from 'express';

export interface AuthenticatedUser {
  userId: number;
  id?: number;
  email: string;
  tipo: string;
  perfil?: string;
  iniciais?: string;
  filial_id?: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
