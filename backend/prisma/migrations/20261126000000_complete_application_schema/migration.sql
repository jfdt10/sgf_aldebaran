BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "atendimento"
    ADD COLUMN IF NOT EXISTS "operadorOrigemId" INTEGER,
    ADD COLUMN IF NOT EXISTS "transferidoEm" TIMESTAMP(6);
ALTER TABLE "caminhao" ADD COLUMN IF NOT EXISTS "filial_id" INTEGER;
ALTER TABLE "motorista" ADD COLUMN IF NOT EXISTS "filial_id" INTEGER;
ALTER TABLE "senha"
    ADD COLUMN IF NOT EXISTS "cliente_id" UUID,
    ADD COLUMN IF NOT EXISTS "documentoCliente" VARCHAR,
    ADD COLUMN IF NOT EXISTS "nomeCliente" VARCHAR;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Priority' AND typnamespace = to_regnamespace(current_schema())) THEN
        CREATE TYPE "Priority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"atendimento"'::regclass AND conname = 'atendimento_operadorOrigemId_fkey') THEN
        ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_operadorOrigemId_fkey"
            FOREIGN KEY ("operadorOrigemId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"caminhao"'::regclass AND conname = 'caminhao_filial_id_fkey') THEN
        ALTER TABLE "caminhao" ADD CONSTRAINT "caminhao_filial_id_fkey"
            FOREIGN KEY ("filial_id") REFERENCES "filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"motorista"'::regclass AND conname = 'motorista_filial_id_fkey') THEN
        ALTER TABLE "motorista" ADD CONSTRAINT "motorista_filial_id_fkey"
            FOREIGN KEY ("filial_id") REFERENCES "filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"senha"'::regclass AND conname = 'senha_cliente_id_fkey') THEN
        ALTER TABLE "senha" ADD CONSTRAINT "senha_cliente_id_fkey"
            FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "operador_sessao" (
    "id" SERIAL PRIMARY KEY,
    "operador_id" INTEGER NOT NULL REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "guiche_id" INTEGER NOT NULL REFERENCES "guiche"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "loginEm" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutEm" TIMESTAMP(6),
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "status_items" (
    "id" SERIAL PRIMARY KEY,
    "nome" VARCHAR(50) NOT NULL,
    "cor" VARCHAR(20),
    "icon" VARCHAR(50),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "task_items" (
    "id" SERIAL PRIMARY KEY,
    "titulo" VARCHAR(200) NOT NULL,
    "descricao" VARCHAR(1000),
    "prioridade" "Priority" NOT NULL DEFAULT 'MEDIA',
    "status_id" INTEGER NOT NULL REFERENCES "status_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "criadoPor_id" INTEGER NOT NULL REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "responsavel_id" INTEGER REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "dataEntrega" TIMESTAMP(6),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_operador_sessao_operador" ON "operador_sessao"("operador_id");
CREATE INDEX IF NOT EXISTS "IDX_operador_sessao_guiche" ON "operador_sessao"("guiche_id");
CREATE INDEX IF NOT EXISTS "IDX_operador_sessao_ativo" ON "operador_sessao"("ativo");
CREATE UNIQUE INDEX IF NOT EXISTS "guiche_filial_id_numero_key" ON "guiche"("filial_id", "numero");

COMMIT;
