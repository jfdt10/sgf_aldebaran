import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface TicketCallPayload {
  ticketId: string;
  category: string;
  guicheOrDoca: string;
  calledAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificacaoGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;

    if (token && token !== process.env.WS_SECRET_TOKEN) {
      console.warn(`[Security] WS: Token inválido de ${client.id}`);
      client.disconnect(true);
      return;
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

  enviarParaTodos(evento: string, data: any) {
    if (this.server) {
      this.server.emit(evento, data);
    }
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
