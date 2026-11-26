import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { allowApplicationOrigin } from '../common/cors';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/jwt.strategy';

export interface TicketCallPayload {
  ticketId: string;
  category: string;
  guicheOrDoca: string;
  calledAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: allowApplicationOrigin,
  },
})
export class NotificacaoGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly jwt: JwtService, private readonly strategy: JwtStrategy) {}

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (token && token !== process.env.WS_SECRET_TOKEN) {
      try {
        const payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
        const user = await this.strategy.validate(payload);
        if (typeof user.userId === 'string') {
          await client.join('notification:client:' + user.userId);
        } else if (['ADMIN', 'SUPERVISOR', 'OPERADOR'].includes(user.perfil)) {
          await client.join(['notification:staff', 'notification:user:' + user.userId]);
        }
        const remaining = Number(payload.exp) * 1000 - Date.now();
        const expiry = setTimeout(() => client.disconnect(true), Math.max(0, Math.min(remaining, 2_147_483_647)));
        client.once('disconnect', () => clearTimeout(expiry));
        return;
      } catch {
        client.disconnect(true);
        return;
      }
    }

    const panelType = client.handshake.query?.panelType as string;

    if (panelType === 'DOCA') {
      client.join('room_docas');
    } else if (panelType === 'SAGUAO') {
      client.join('room_saguao');
    } else {
      client.join('room_general');
    }

    console.log(
      `[WS] Terminal conectado: ${client.id} -> Sala: ${panelType || 'GERAL'}`,
    );
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Terminal desconectado: ${client.id}`);
  }

  public broadcastTicket(payload: TicketCallPayload) {
    const normalizedCategory = (payload.category || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();

    const isHeavyLoad =
      normalizedCategory.includes('CAMINHA') ||
      normalizedCategory.includes('RETIRADA') ||
      normalizedCategory.includes('CARGA') ||
      normalizedCategory.includes('DOCA') ||
      normalizedCategory.includes('BAIA');

    const targetRoom = isHeavyLoad ? 'room_docas' : 'room_saguao';

    if (this.server) {
      this.server.to(targetRoom).emit('ticket_called', payload);
      this.server.to('room_general').emit('ticket_called', payload);
    }
  }

  enviarNotificacao(data: { usuario_id: number | null; cliente_id: string | null; servico_id?: number }) {
    const rooms: string[] = [];
    if (data.cliente_id) rooms.push('notification:client:' + data.cliente_id);
    if (data.usuario_id) rooms.push('notification:user:' + data.usuario_id);
    if (!rooms.length) rooms.push('notification:staff');
    this.server?.to(rooms).emit('nova_notificacao', data);
  }

  avisarFilaZerada(filialId: number | null) {
    this.server?.emit('fila_zerada', { filialId });
  }

  public broadcastRefresh() {
    if (this.server) {
      this.server.to('room_general').emit('ticket_called', null);
      this.server.to('room_docas').emit('ticket_called', null);
      this.server.to('room_saguao').emit('ticket_called', null);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, data: any) {
    return { event: 'pong', data };
  }
}
