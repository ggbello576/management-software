-- Aggiunge il nome utente per l'accesso al gestionale.
--
-- Lo schema attuale non contiene ancora account, quindi la nuova colonna
-- NOT NULL può essere aggiunta direttamente senza backfill.
-- Questo script va eseguito una sola volta dopo aver verificato lo schema.

BEGIN;

ALTER TABLE public.utenti
    ADD COLUMN nome_utente TEXT NOT NULL;

CREATE UNIQUE INDEX utenti_nome_utente_minuscole_uq
    ON public.utenti (lower(nome_utente));

COMMIT;
