-- Rende facoltativo il fornitore degli acquisti.
--
-- Questa migrazione è solo documentativa e non è stata eseguita da Codex.
-- Eseguirla manualmente dopo avere verificato il database corretto e avere
-- pianificato il relativo backup. Non modifica gli ID né le associazioni
-- esistenti: il vincolo esterno continuerà a validare i valori non NULL.

BEGIN;

ALTER TABLE public.acquisti
    DROP CONSTRAINT acquisti_fornitore_id_not_null,
    ALTER COLUMN fornitore_id DROP NOT NULL;

COMMIT;
