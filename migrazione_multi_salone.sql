-- Migrazione multi-salone e sessioni applicative.
--
-- Questo script è intenzionalmente non idempotente: deve essere eseguito una
-- sola volta dopo avere verificato che lo schema corrisponda a quello attuale.
-- Non modifica gli ID esistenti e non rimuove i vincoli già presenti.

BEGIN;

-- ============================================================
-- 1. Precondizioni sui saloni già censiti
-- ============================================================
-- I dati operativi esistenti devono essere assegnati al salone 1.
-- Il controllo evita di eseguire parzialmente la migrazione su un database
-- privo dei saloni attesi.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.saloni
        WHERE id = 1
    ) THEN
        RAISE EXCEPTION 'Manca public.saloni.id = 1 (Salone di prova 1).';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.saloni
        WHERE id = 2
    ) THEN
        RAISE EXCEPTION 'Manca public.saloni.id = 2 (Salone di prova 2).';
    END IF;
END
$$;

-- ============================================================
-- 2. Sessioni server-side
-- ============================================================
-- Il token in chiaro viene generato dal server e resta soltanto nel cookie.
-- Nel database viene memorizzato esclusivamente il suo hash.
-- csrf_token_hash serve per verificare le richieste che modificano dati.
-- La chiave esterna composta garantisce che il salone attivo sia realmente
-- associato all'utente tramite public.utenti_saloni.
CREATE TABLE public.sessioni (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token_hash TEXT NOT NULL,
    utente_id INTEGER NOT NULL
        REFERENCES public.utenti(id),
    salone_id INTEGER NOT NULL
        REFERENCES public.saloni(id),
    creato_il TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scade_il TIMESTAMPTZ NOT NULL,
    revocata_il TIMESTAMPTZ,
    CONSTRAINT sessioni_scadenza_valida
        CHECK (scade_il > creato_il),
    CONSTRAINT sessioni_utente_salone_fk
        FOREIGN KEY (salone_id, utente_id)
        REFERENCES public.utenti_saloni(salone_id, utente_id)
);

CREATE INDEX sessioni_utente_salone_idx
    ON public.sessioni (utente_id, salone_id);

CREATE INDEX sessioni_scadenza_attive_idx
    ON public.sessioni (scade_il)
    WHERE revocata_il IS NULL;

-- ============================================================
-- 3. Aggiunta delle colonne tenant alle tabelle operative
-- ============================================================
-- Le colonne vengono aggiunte nullable solo durante la fase di transizione,
-- così è possibile valorizzare in modo esplicito tutte le righe già presenti.
-- Gli ID esistenti e le colonne già presenti restano invariati.
ALTER TABLE public.prodotti
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.rettifiche_magazzino
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.acquisti
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.righe_acquisto
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.vendite
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.righe_vendita
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.clienti
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.fornitori
    ADD COLUMN salone_id INTEGER;

ALTER TABLE public.servizi
    ADD COLUMN salone_id INTEGER;

-- ============================================================
-- 4. Assegnazione dei dati esistenti al salone 1
-- ============================================================
-- Tutte le righe operative già presenti appartengono al Salone di prova 1.
-- Il salone 2 non riceve righe e rimane quindi vuoto.
UPDATE public.prodotti
SET salone_id = 1;

UPDATE public.rettifiche_magazzino
SET salone_id = 1;

UPDATE public.acquisti
SET salone_id = 1;

UPDATE public.righe_acquisto
SET salone_id = 1;

UPDATE public.vendite
SET salone_id = 1;

UPDATE public.righe_vendita
SET salone_id = 1;

UPDATE public.clienti
SET salone_id = 1;

UPDATE public.fornitori
SET salone_id = 1;

UPDATE public.servizi
SET salone_id = 1;

-- Controllo esplicito: dopo il backfill nessuna tabella operativa può
-- contenere righe assegnate al salone 2 o a un altro salone.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.prodotti WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.rettifiche_magazzino WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.acquisti WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.righe_acquisto WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.vendite WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.righe_vendita WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.clienti WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.fornitori WHERE salone_id IS DISTINCT FROM 1)
       OR EXISTS (SELECT 1 FROM public.servizi WHERE salone_id IS DISTINCT FROM 1)
    THEN
        RAISE EXCEPTION 'Il backfill multi-salone non ha assegnato tutte le righe al salone 1.';
    END IF;
END
$$;

-- ============================================================
-- 5. NOT NULL e riferimenti al catalogo saloni
-- ============================================================
ALTER TABLE public.prodotti
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT prodotti_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.rettifiche_magazzino
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT rettifiche_magazzino_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.acquisti
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT acquisti_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.righe_acquisto
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT righe_acquisto_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.vendite
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT vendite_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.righe_vendita
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT righe_vendita_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.clienti
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT clienti_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.fornitori
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT fornitori_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

ALTER TABLE public.servizi
    ALTER COLUMN salone_id SET NOT NULL,
    ADD CONSTRAINT servizi_salone_fk
        FOREIGN KEY (salone_id) REFERENCES public.saloni(id);

-- ============================================================
-- 6. Chiavi uniche composite per i riferimenti cross-salone
-- ============================================================
-- Le chiavi composte permettono alle chiavi esterne successive di verificare
-- insieme il salone e l'ID della riga referenziata.
-- La PRIMARY KEY id già esistente non viene rimossa.
ALTER TABLE public.prodotti
    ADD CONSTRAINT prodotti_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.rettifiche_magazzino
    ADD CONSTRAINT rettifiche_magazzino_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.acquisti
    ADD CONSTRAINT acquisti_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.righe_acquisto
    ADD CONSTRAINT righe_acquisto_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.vendite
    ADD CONSTRAINT vendite_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.righe_vendita
    ADD CONSTRAINT righe_vendita_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.clienti
    ADD CONSTRAINT clienti_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.fornitori
    ADD CONSTRAINT fornitori_salone_id_key UNIQUE (salone_id, id);

ALTER TABLE public.servizi
    ADD CONSTRAINT servizi_salone_id_key UNIQUE (salone_id, id);

-- ============================================================
-- 7. Vincoli cross-salone sulle relazioni operative
-- ============================================================
-- I vincoli REFERENCES già presenti restano invariati. Questi ulteriori
-- vincoli impediscono che un record di un salone punti a un record omonimo
-- per ID ma appartenente a un altro salone.
ALTER TABLE public.rettifiche_magazzino
    ADD CONSTRAINT rettifiche_magazzino_salone_prodotto_fk
        FOREIGN KEY (salone_id, prodotto_id)
        REFERENCES public.prodotti(salone_id, id);

ALTER TABLE public.acquisti
    ADD CONSTRAINT acquisti_salone_fornitore_fk
        FOREIGN KEY (salone_id, fornitore_id)
        REFERENCES public.fornitori(salone_id, id);

ALTER TABLE public.righe_acquisto
    ADD CONSTRAINT righe_acquisto_salone_acquisto_fk
        FOREIGN KEY (salone_id, acquisto_id)
        REFERENCES public.acquisti(salone_id, id);

ALTER TABLE public.righe_acquisto
    ADD CONSTRAINT righe_acquisto_salone_prodotto_fk
        FOREIGN KEY (salone_id, prodotto_id)
        REFERENCES public.prodotti(salone_id, id);

ALTER TABLE public.vendite
    ADD CONSTRAINT vendite_salone_cliente_fk
        FOREIGN KEY (salone_id, cliente_id)
        REFERENCES public.clienti(salone_id, id);

ALTER TABLE public.righe_vendita
    ADD CONSTRAINT righe_vendita_salone_vendita_fk
        FOREIGN KEY (salone_id, vendita_id)
        REFERENCES public.vendite(salone_id, id);

ALTER TABLE public.righe_vendita
    ADD CONSTRAINT righe_vendita_salone_prodotto_fk
        FOREIGN KEY (salone_id, prodotto_id)
        REFERENCES public.prodotti(salone_id, id);

ALTER TABLE public.righe_vendita
    ADD CONSTRAINT righe_vendita_salone_servizio_fk
        FOREIGN KEY (salone_id, servizio_id)
        REFERENCES public.servizi(salone_id, id);

-- ============================================================
-- 8. Indici per filtri tenant e relazioni operative
-- ============================================================
-- Le UNIQUE (salone_id, id) hanno già creato gli indici necessari per le
-- chiavi referenziate. Questi indici coprono i filtri per salone, gli
-- ordinamenti delle viste e la ricerca delle righe figlie.
CREATE INDEX prodotti_salone_nome_idx
    ON public.prodotti (salone_id, nome);

CREATE INDEX servizi_salone_nome_idx
    ON public.servizi (salone_id, nome);

CREATE INDEX clienti_salone_nome_idx
    ON public.clienti (salone_id, cognome, nome);

CREATE INDEX fornitori_salone_nome_idx
    ON public.fornitori (salone_id, nome);

CREATE INDEX acquisti_salone_data_idx
    ON public.acquisti (salone_id, data_acquisto DESC, id DESC);

CREATE INDEX vendite_salone_data_idx
    ON public.vendite (salone_id, data_vendita DESC, id DESC);

CREATE INDEX rettifiche_salone_data_idx
    ON public.rettifiche_magazzino
        (salone_id, data_movimento DESC, id DESC);

CREATE INDEX righe_acquisto_salone_acquisto_idx
    ON public.righe_acquisto (salone_id, acquisto_id);

CREATE INDEX righe_acquisto_salone_prodotto_idx
    ON public.righe_acquisto (salone_id, prodotto_id);

CREATE INDEX righe_vendita_salone_vendita_idx
    ON public.righe_vendita (salone_id, vendita_id);

CREATE INDEX righe_vendita_salone_prodotto_idx
    ON public.righe_vendita (salone_id, prodotto_id);

CREATE INDEX righe_vendita_salone_servizio_idx
    ON public.righe_vendita (salone_id, servizio_id);

-- ============================================================
-- 9. Chiusura atomica della migrazione
-- ============================================================
-- Se una qualunque istruzione precedente fallisce, PostgreSQL annulla
-- l'intera transazione e nessuna parte della migrazione resta applicata.
COMMIT;
