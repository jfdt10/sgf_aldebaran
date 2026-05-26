import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

export interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  lida: boolean;
  rota: string;
  icon: string;
  iconClass: string;
  criadoEm: string;
  usuario_id?: number | null;
  cliente_id?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private socket: Socket;
  private notificationsSubject = new BehaviorSubject<Notificacao[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  constructor(
    private api: ApiService,
    private ngZone: NgZone
  ) {
    this.socket = io(environment.apiUrl);

    this.socket.on('connect', () => {
      this.ngZone.run(() => {
        if (!environment.production) console.log('Conectado ao WebSocket de notificações');
      });
    });

    this.socket.on('nova_notificacao', (notificacao: Notificacao) => {
      this.ngZone.run(() => {
        if (!environment.production) console.log('Nova notificação recebida:', notificacao);

        let shouldKeep = true;

        if (this.isClientSession()) {
          const currentClientId = localStorage.getItem('usuario_id') || '';
          if (!notificacao.cliente_id || String(notificacao.cliente_id) !== String(currentClientId)) {
            shouldKeep = false;
          }
        } else {
          // Usuários do sistema (operadores, supervisores, admins)
          if (notificacao.cliente_id) {
            // Notificações direcionadas a clientes não devem ir para usuários do sistema
            shouldKeep = false;
          } else if (notificacao.usuario_id) {
            // Se for direcionada a um usuário do sistema específico, verifica se é este
            const userStr = localStorage.getItem('usuario_sgf');
            if (userStr) {
              try {
                const user = JSON.parse(userStr);
                if (Number(user.id) !== Number(notificacao.usuario_id)) {
                  shouldKeep = false;
                }
              } catch {
                shouldKeep = false;
              }
            } else {
              shouldKeep = false;
            }
          }
        }

        if (!shouldKeep) {
          if (!environment.production) console.log('Notificação descartada: não pertence ao usuário/cliente ativo.', notificacao);
          return;
        }

        const current = this.notificationsSubject.value;
        this.notificationsSubject.next([notificacao, ...current]);
      });
    });
  }

  private isClientSession(): boolean {
    // 1. Check current URL/path (extremely reliable since only clients are in /client or /mobile routes)
    if (typeof window !== 'undefined' && window.location && window.location.pathname) {
      const path = window.location.pathname;
      if (path.includes('/client') || path.includes('/mobile')) {
        return true;
      }
    }

    // 2. Check explicit client indicators in localStorage
    if (localStorage.getItem('client_user') || localStorage.getItem('client_token')) {
      return true;
    }

    // 3. Check parsed user profile/type
    const userStr = localStorage.getItem('usuario_sgf');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const role = String(user.perfil || user.tipo || '').toUpperCase();
        if (role === 'CLIENTE' || role === 'CLIENT') {
          return true;
        }
      } catch { }
    }

    // 4. Check if stored ID is a UUID (UUIDs are non-numeric strings, internal users have integer IDs)
    const usuarioIdStr = localStorage.getItem('usuario_id');
    if (usuarioIdStr && isNaN(Number(usuarioIdStr))) {
      return true;
    }

    return false;
  }

  fetchNotifications(usuario_id?: number | string) {
    let resolvedId = usuario_id;
    if (!resolvedId && this.isClientSession()) {
      resolvedId = localStorage.getItem('usuario_id') || '';
    }
    const params = this.buildDestinatarioParams(resolvedId);
    this.api.get<Notificacao[]>('/notificacoes', params).subscribe({
      next: (notifications) => {
        const filtered = notifications.filter(notificacao => {
          if (this.isClientSession()) {
            const currentClientId = localStorage.getItem('usuario_id') || '';
            return notificacao.cliente_id && String(notificacao.cliente_id) === String(currentClientId);
          } else {
            if (notificacao.cliente_id) {
              return false;
            }
            if (notificacao.usuario_id) {
              const userStr = localStorage.getItem('usuario_sgf');
              if (userStr) {
                try {
                  const user = JSON.parse(userStr);
                  return Number(user.id) === Number(notificacao.usuario_id);
                } catch {
                  return false;
                }
              }
              return false;
            }
            return true;
          }
        });
        this.notificationsSubject.next(filtered);
      },
      error: (err) => {
        console.error('Erro ao buscar notificações:', err);
      }
    });
  }

  markAsRead(id: number) {
    // Atualização otimista
    const current = this.notificationsSubject.value;
    const updated = current.map(n => n.id === id ? { ...n, lida: true } : n);
    this.notificationsSubject.next(updated);

    this.api.post(`/notificacoes/${id}/lida`, {}).subscribe({
      error: (err) => {
        console.error('Erro ao marcar como lida:', err);
        this.notificationsSubject.next(current);
      }
    });
  }

  markAllAsRead(usuario_id?: number | string) {
    // Atualização otimista no frontend
    const current = this.notificationsSubject.value;
    const updated = current.map(n => ({ ...n, lida: true }));
    this.notificationsSubject.next(updated);

    let resolvedId = usuario_id;
    if (!resolvedId && this.isClientSession()) {
      resolvedId = localStorage.getItem('usuario_id') || '';
    }

    this.api.post('/notificacoes/todas-lidas', this.buildDestinatarioParams(resolvedId)).subscribe({
      error: (err) => {
        console.error('Erro ao marcar todas como lidas:', err);
        // Rollback opcional se necessário
        this.notificationsSubject.next(current);
      }
    });
  }

  private buildDestinatarioParams(usuario_id?: number | string): Record<string, number | string> {
    const value = String(usuario_id || '').trim();
    if (!value) return {};

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return { usuario_id: numeric };
    }

    return { cliente_id: value };
  }
}
