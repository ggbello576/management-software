-- Aggiunge il costo indicativo di riferimento dei prodotti.
--
-- Il valore resta NULL quando non esiste un costo noto. In questo modo il
-- riepilogo del magazzino può distinguere i prodotti da escludere dalla stima.
-- La colonna esistente ultimo_prezzo_acquisto non viene riutilizzata: è un
-- dato storico con semantica diversa e non rappresenta il riferimento
-- indicativo richiesto per i prodotti senza acquisti reali.
-- Eseguire manualmente dopo aver verificato il database e prima di usare il
-- campo nella pagina Conteggio iniziale o nella sezione Prodotti.

BEGIN;

ALTER TABLE public.prodotti
    ADD COLUMN costo_unitario_indicativo NUMERIC(10, 2),
    ADD CONSTRAINT prodotti_costo_unitario_indicativo_ck
        CHECK (
            costo_unitario_indicativo IS NULL
            OR costo_unitario_indicativo >= 0
        );

COMMIT;
