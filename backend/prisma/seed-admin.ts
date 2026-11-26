import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const login = process.env.ADMIN_LOGIN?.trim() || 'admin';
  const email = process.env.ADMIN_EMAIL?.trim() || undefined;
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Configure ADMIN_PASSWORD com pelo menos 12 caracteres e at? 72 bytes.');
  }

  const prisma = new PrismaService();
  try {
    const existing = await prisma.usuario.findFirst({
      where: { OR: [{ login }, ...(email ? [{ email }] : [])] },
      select: { login: true, perfil: true },
    });
    if (existing) {
      if (existing.login === login && existing.perfil === 'ADMIN') {
        console.log('O administrador j? existe.');
        return;
      }
      throw new Error('Login ou e-mail j? est? em uso.');
    }

    await prisma.usuario.create({
      data: { login, email, senha: await bcrypt.hash(password, 12), nome: 'Administrador', perfil: 'ADMIN' },
    });
    console.log('Administrador criado.');
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch(() => {
  console.error('Falha ao criar administrador. Verifique a configura??o e a disponibilidade do banco.');
  process.exitCode = 1;
});
