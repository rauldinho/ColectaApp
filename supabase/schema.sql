-- ============================================================
-- COLECTA — Schema de Base de Datos v2 (sin auth obligatorio)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- ⚠️  RESET — SOLO DESARROLLO (eliminar antes de producción)
-- ============================================================
DROP TABLE IF EXISTS public.payment_info CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.participants CASCADE;
DROP TABLE IF EXISTS public.event_items CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT UNIQUE NOT NULL,
  code          TEXT UNIQUE NOT NULL,
  admin_token   TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,  -- token interno (no expuesto)
  admin_pin     TEXT NOT NULL,                                          -- PIN del organizador (para acceso admin)
  name          TEXT NOT NULL,
  description   TEXT,
  event_date    DATE,                                                    -- opcional; si es NULL se usa created_at
  total_amount      NUMERIC(12, 2),
  amount_per_person NUMERIC(12, 2),                                       -- si se define, cada participante paga este monto fijo
  currency          TEXT NOT NULL DEFAULT 'CLP',
  organizer_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,     -- opcional (si tiene cuenta)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: event_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: participants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.participants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  email        TEXT,
  amount_owed  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id  UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status          TEXT NOT NULL DEFAULT 'confirmed',  -- 'pending' | 'confirmed' | 'rejected'
  receipt_url     TEXT,                               -- URL del comprobante subido por el participante
  confirmed_at    TIMESTAMPTZ,                        -- NULL si está pendiente
  confirmed_by    TEXT,                               -- admin_token del organizador
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: payment_info
-- Datos de transferencia del organizador para el QR
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_info (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id         UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  bank_name        TEXT,
  account_holder   TEXT,
  account_number   TEXT,
  account_type     TEXT,
  rut              TEXT,
  email            TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_events_updated
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_payment_info_updated
  BEFORE UPDATE ON public.payment_info
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_info ENABLE ROW LEVEL SECURITY;

-- EVENTS: cualquiera puede leer eventos activos y crear nuevos
CREATE POLICY "Leer eventos activos" ON public.events
  FOR SELECT USING (is_active = true);

CREATE POLICY "Cualquiera puede crear eventos" ON public.events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Actualizar con admin_token" ON public.events
  FOR UPDATE USING (true);

-- EVENT ITEMS: lectura pública, escritura libre (app controla)
CREATE POLICY "Leer items de eventos" ON public.event_items
  FOR SELECT USING (true);

CREATE POLICY "Insertar items" ON public.event_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Eliminar items" ON public.event_items
  FOR DELETE USING (true);

-- PARTICIPANTS: lectura y escritura pública
CREATE POLICY "Leer participantes" ON public.participants
  FOR SELECT USING (true);

CREATE POLICY "Insertar participantes" ON public.participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Actualizar participantes" ON public.participants
  FOR UPDATE USING (true);

-- PAYMENTS: lectura y escritura pública
CREATE POLICY "Leer pagos" ON public.payments
  FOR SELECT USING (true);

CREATE POLICY "Insertar pagos" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Actualizar pagos" ON public.payments
  FOR UPDATE USING (true);

-- PAYMENT INFO: lectura y escritura pública
CREATE POLICY "Leer info de pago" ON public.payment_info
  FOR SELECT USING (true);

CREATE POLICY "Insertar info de pago" ON public.payment_info
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Actualizar info de pago" ON public.payment_info
  FOR UPDATE USING (true);

-- ============================================================
-- STORAGE: bucket receipts (crear manualmente en Supabase UI)
-- Policies para permitir subida y lectura pública
-- ============================================================
-- Nota: el bucket "receipts" debe crearse como Public en Supabase → Storage
-- Las policies de storage se configuran desde la UI o con el Supabase CLI.

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);
CREATE INDEX IF NOT EXISTS idx_events_code ON public.events(code);
CREATE INDEX IF NOT EXISTS idx_events_admin_token ON public.events(admin_token);
CREATE INDEX IF NOT EXISTS idx_participants_event ON public.participants(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_participant ON public.payments(participant_id);

-- ============================================================
-- SUPABASE REALTIME
-- Necesario para que los cambios se transmitan en tiempo real.
-- REPLICA IDENTITY FULL es requerido para suscripciones con filtro (filter: event_id=eq.X).
-- ============================================================
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
