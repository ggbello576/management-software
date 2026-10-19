//backend
require("dotenv").config();//carica la libreria dotenv, .config()cerca e legge .env
const http = require("node:http"); // prende il modulo http da node
const fs = require("node:fs"); //fs modulo per lavorare con i file
const pool = require("./db");//esportiamo l'oggetto pool ,il suo file
const LOCK_NAMESPACE_VENDITE = 1;

class ErroreRichiesta extends Error {
    constructor(messaggio, stato = 400) {
        super(messaggio);
        this.stato = stato;
    }
}

function rispondiJson(response, stato, dati) {
    response.writeHead(stato, {
        "Content-Type": "application/json; charset=utf-8"
    });

    response.end(JSON.stringify(dati));
}

function idInteroValido(valore) {
    return Number.isSafeInteger(valore) &&
        valore > 0 &&
        valore <= 2147483647;
}

function validaPayloadVendita(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    const clienteId = dati.clienteId === undefined
        ? null
        : dati.clienteId;

    if (clienteId !== null && !idInteroValido(clienteId)) {
        throw new ErroreRichiesta("clienteId deve essere null oppure un ID numerico valido.");
    }

    if (
        dati.note !== undefined &&
        dati.note !== null &&
        typeof dati.note !== "string"
    ) {
        throw new ErroreRichiesta("note deve essere un testo facoltativo.");
    }

    if (!Array.isArray(dati.righe) || dati.righe.length === 0) {
        throw new ErroreRichiesta("La vendita deve contenere almeno una riga.");
    }

    const righe = dati.righe.map((riga) => {
        if (!riga || typeof riga !== "object" || Array.isArray(riga)) {
            throw new ErroreRichiesta("Ogni riga della vendita deve essere un oggetto.");
        }

        if (riga.tipo !== "prodotto" && riga.tipo !== "servizio") {
            throw new ErroreRichiesta("Il tipo della riga deve essere prodotto oppure servizio.");
        }

        if (!idInteroValido(riga.elementoId)) {
            throw new ErroreRichiesta("Ogni elemento della vendita deve avere un ID numerico valido.");
        }

        if (
            !Number.isSafeInteger(riga.quantita) ||
            riga.quantita < 1 ||
            riga.quantita > 2147483647
        ) {
            throw new ErroreRichiesta("Ogni quantità deve essere un numero intero positivo.");
        }

        return {
            tipo: riga.tipo,
            elementoId: riga.elementoId,
            quantita: riga.quantita
        };
    });

    return {
        clienteId,
        note: typeof dati.note === "string" ? dati.note.trim() || null : null,
        righe
    };
}

async function leggiJson(request) {
    let corpo = "";

    for await (const pezzo of request) {
        corpo += pezzo;
    }

    return JSON.parse(corpo);
}

function prezzoValido(valore) {
    if (
        typeof valore !== "number" ||
        !Number.isFinite(valore) ||
        valore < 0 ||
        valore > 99999999.99
    ) {
        return false;
    }

    return Math.abs(valore * 100 - Math.round(valore * 100)) < 1e-8;
}

function validaPayloadProdotto(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    const nome = typeof dati.nome === "string" ? dati.nome.trim() : "";
    const marca = dati.marca === undefined || dati.marca === null
        ? null
        : typeof dati.marca === "string"
            ? dati.marca.trim() || null
            : undefined;

    if (nome === "") {
        throw new ErroreRichiesta("Il nome del prodotto è obbligatorio.");
    }

    if (marca === undefined) {
        throw new ErroreRichiesta("La marca deve essere un testo facoltativo.");
    }

    if (!prezzoValido(dati.prezzoVendita)) {
        throw new ErroreRichiesta("Il prezzo di vendita deve essere un numero non negativo con massimo due decimali.");
    }

    if (
        !Number.isSafeInteger(dati.sogliaRiordino) ||
        dati.sogliaRiordino < 0 ||
        dati.sogliaRiordino > 2147483647
    ) {
        throw new ErroreRichiesta("La soglia di riordino deve essere un numero intero non negativo.");
    }

    return {
        nome,
        marca,
        prezzoVendita: dati.prezzoVendita,
        sogliaRiordino: dati.sogliaRiordino
    };
}

function validaPayloadServizio(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    const nome = typeof dati.nome === "string" ? dati.nome.trim() : "";

    if (nome === "") {
        throw new ErroreRichiesta("Il nome del servizio è obbligatorio.");
    }

    if (!prezzoValido(dati.prezzo)) {
        throw new ErroreRichiesta("Il prezzo deve essere un numero non negativo con massimo due decimali.");
    }

    return {
        nome,
        prezzo: dati.prezzo
    };
}

function testoFacoltativo(dati, campo) {
    if (dati[campo] === undefined || dati[campo] === null) {
        return null;
    }

    if (typeof dati[campo] !== "string") {
        throw new ErroreRichiesta(`${campo} deve essere un testo facoltativo.`);
    }

    return dati[campo].trim() || null;
}

function validaPayloadFornitore(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    const nome = typeof dati.nome === "string" ? dati.nome.trim() : "";

    if (nome === "") {
        throw new ErroreRichiesta("Il nome del fornitore è obbligatorio.");
    }

    return {
        nome,
        telefono: testoFacoltativo(dati, "telefono"),
        email: testoFacoltativo(dati, "email"),
        note: testoFacoltativo(dati, "note")
    };
}

function dataAcquistoValida(valore) {
    if (valore === undefined || valore === null || valore === "") {
        return null;
    }

    if (typeof valore !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valore)) {
        throw new ErroreRichiesta("La data dell'acquisto deve essere nel formato AAAA-MM-GG.");
    }

    const data = new Date(`${valore}T00:00:00Z`);

    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valore) {
        throw new ErroreRichiesta("La data dell'acquisto non è valida.");
    }

    return valore;
}

function validaPayloadAcquisto(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    if (!idInteroValido(dati.fornitoreId)) {
        throw new ErroreRichiesta("fornitoreId deve essere un ID numerico valido.");
    }

    if (!Array.isArray(dati.righe) || dati.righe.length === 0) {
        throw new ErroreRichiesta("L'acquisto deve contenere almeno una riga.");
    }

    const righe = dati.righe.map((riga) => {
        if (!riga || typeof riga !== "object" || Array.isArray(riga)) {
            throw new ErroreRichiesta("Ogni riga dell'acquisto deve essere un oggetto.");
        }

        if (!idInteroValido(riga.prodottoId)) {
            throw new ErroreRichiesta("Ogni riga deve avere un prodotto valido.");
        }

        if (
            !Number.isSafeInteger(riga.quantita) ||
            riga.quantita < 1 ||
            riga.quantita > 2147483647
        ) {
            throw new ErroreRichiesta("Ogni quantità deve essere un numero intero positivo.");
        }

        if (!prezzoValido(riga.costoUnitario)) {
            throw new ErroreRichiesta("Ogni costo unitario deve essere un numero non negativo con massimo due decimali.");
        }

        return {
            prodottoId: riga.prodottoId,
            quantita: riga.quantita,
            costoUnitario: riga.costoUnitario
        };
    });

    return {
        fornitoreId: dati.fornitoreId,
        dataAcquisto: dataAcquistoValida(dati.dataAcquisto),
        note: testoFacoltativo(dati, "note"),
        righe
    };
}

function totaleAcquistoInCentesimi(righe) {
    return righe.reduce((totale, riga) => {
        const costoInCentesimi = BigInt(Math.round(riga.costoUnitario * 100));
        return totale + costoInCentesimi * BigInt(riga.quantita);
    }, 0n);
}

function euroDaCentesimi(centesimi) {
    const euro = centesimi / 100n;
    const resto = (centesimi % 100n).toString().padStart(2, "0");
    return `${euro}.${resto}`;
}

function messaggioErroreDatabase(errore, messaggioGenerico) {
    if (errore.code === "42501") {
        return "Il ruolo del database non ha i permessi necessari per questa operazione.";
    }

    return messaggioGenerico;
}

const server = http.createServer(async (request, response) => {//async cosi possiamo usare await ricordi?
    console.log("Metodo:", request.method);
    console.log("Percorso:", request.url);

    if (request.method === "GET" && request.url === "/") {//metodo get e solito percorso
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); //dici che colleghi un html, intestazione risposta
    response.end(fs.readFileSync("index.html", "utf8"));//colleghi il file html alla richiesta del browser, cosi il server manda al browser quella pagina

    } else if (request.method === "GET" && request.url === "/style.css") {
        response.writeHead(200, {
        "Content-Type": "text/css; charset=utf-8"});
        response.end(fs.readFileSync("style.css", "utf8"));

        }     
        else if (
            request.method === "GET" &&
            request.url === "/app.js"
        ) {
            response.writeHead(200, {
                "Content-Type": "text/javascript; charset=utf-8"
            });

            response.end(fs.readFileSync("app.js", "utf8"));

        }   else if (
            request.method === "GET" &&
            request.url === "/magazzino"
            ) {
                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8"
                });

                response.end(fs.readFileSync("magazzino.html", "utf8"));

                }   else if (
            request.method === "GET" &&
            request.url === "/prodotti"
            ) {
                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8"
                });

                response.end(fs.readFileSync("prodotti.html", "utf8"));

                }   else if (
            request.method === "GET" &&
            request.url === "/servizi"
            ) {
                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8"
                });

                response.end(fs.readFileSync("servizi.html", "utf8"));

                }   else if (
            request.method === "GET" &&
            request.url === "/fornitori"
            ) {
                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8"
                });

                response.end(fs.readFileSync("fornitori.html", "utf8"));

                }   else if (
                request.method === "GET" &&//se il metodo è get
                request.url === "/api/magazzino"//e il percorso è /api/magazzino
                ) {//try in caso di qualsiasi errore
                try {//mandi la query sql e dai await cosi aspetti che sql risponda
                    const risultato = await pool.query(`
                    WITH movimenti_magazzino AS (
                        SELECT
                            prodotto_id,
                            quantita_variazione AS variazione
                        FROM rettifiche_magazzino

                        UNION ALL

                        SELECT
                            prodotto_id,
                            quantita AS variazione
                        FROM righe_acquisto

                        UNION ALL

                        SELECT
                            prodotto_id,
                            -quantita AS variazione
                        FROM righe_vendita
                        WHERE prodotto_id IS NOT NULL
                    )
                    SELECT
                        prodotti.id,
                        prodotti.nome,
                        prodotti.marca,
                        COALESCE(SUM(movimenti_magazzino.variazione), 0)::integer AS giacenza,
                        prodotti.soglia_riordino,
                        prodotti.prezzo_vendita
                    FROM prodotti
                    LEFT JOIN movimenti_magazzino
                        ON movimenti_magazzino.prodotto_id = prodotti.id
                    GROUP BY
                        prodotti.id,
                        prodotti.nome,
                        prodotti.marca,
                        prodotti.soglia_riordino,
                        prodotti.prezzo_vendita
                    ORDER BY prodotti.nome;
                `);

                response.writeHead(200, {//invia codice http 200, che indica il codice della risposta che il server invia per indicare che la richiesta è riuscita.
                    "Content-Type": "application/json; charset=utf-8"
                });

                response.end(JSON.stringify(risultato.rows));//ris.rows contiene le righe restituite da PostgreSQL e le trasforma in json, foramto che il browser puo ricevere.invia il contenuto e chiude la risposta HTTP.
            } catch (errore) {
                console.error("Errore nel caricamento del magazzino:", errore);

                response.writeHead(500, {//500 http = errore interno nel server
                    "Content-Type": "application/json; charset=utf-8"
                });

                response.end(JSON.stringify({
                    errore: "Errore interno del server"
                }));

            }

            } else if (
        request.method === "GET" &&
        request.url === "/api/movimenti-recenti"
    ) {
        try {
            const risultato = await pool.query(
                `
                    SELECT *
                    FROM (
                        SELECT
                            vendite.id AS riferimento,
                            vendite.data_vendita AS data_movimento,
                            'Vendita' AS operazione,
                            COALESCE(
                                clienti.nome || ' ' || clienti.cognome,
                                'Vendita senza cliente'
                            ) AS soggetto,
                            COALESCE(
                                SUM(righe_vendita.quantita * righe_vendita.prezzo_unitario),
                                0
                            ) AS importo
                        FROM public.vendite AS vendite
                        LEFT JOIN public.clienti AS clienti
                            ON clienti.id = vendite.cliente_id
                        LEFT JOIN public.righe_vendita AS righe_vendita
                            ON righe_vendita.vendita_id = vendite.id
                        GROUP BY
                            vendite.id,
                            vendite.data_vendita,
                            clienti.nome,
                            clienti.cognome

                        UNION ALL

                        SELECT
                            acquisti.id AS riferimento,
                            acquisti.data_acquisto AS data_movimento,
                            'Acquisto' AS operazione,
                            fornitori.nome AS soggetto,
                            COALESCE(
                                SUM(righe_acquisto.quantita * righe_acquisto.costo_unitario),
                                0
                            ) AS importo
                        FROM public.acquisti AS acquisti
                        JOIN public.fornitori AS fornitori
                            ON fornitori.id = acquisti.fornitore_id
                        LEFT JOIN public.righe_acquisto AS righe_acquisto
                            ON righe_acquisto.acquisto_id = acquisti.id
                        GROUP BY
                            acquisti.id,
                            acquisti.data_acquisto,
                            fornitori.nome

                        UNION ALL

                        SELECT
                            rettifiche_magazzino.id AS riferimento,
                            rettifiche_magazzino.data_movimento,
                            'Rettifica magazzino' AS operazione,
                            prodotti.nome || ' — ' || rettifiche_magazzino.motivo AS soggetto,
                            NULL::numeric AS importo
                        FROM public.rettifiche_magazzino AS rettifiche_magazzino
                        JOIN public.prodotti AS prodotti
                            ON prodotti.id = rettifiche_magazzino.prodotto_id

                        UNION ALL

                        SELECT
                            clienti.id AS riferimento,
                            clienti.creata_il AS data_movimento,
                            'Registrazione cliente' AS operazione,
                            clienti.nome || ' ' || clienti.cognome AS soggetto,
                            NULL::numeric AS importo
                        FROM public.clienti AS clienti

                        UNION ALL

                        SELECT
                            fornitori.id AS riferimento,
                            fornitori.creata_il AS data_movimento,
                            'Registrazione fornitore' AS operazione,
                            fornitori.nome AS soggetto,
                            NULL::numeric AS importo
                        FROM public.fornitori AS fornitori
                    ) AS movimenti
                    ORDER BY data_movimento DESC, riferimento DESC
                    LIMIT $1;
                `,
                [20]
            );

            rispondiJson(response, 200, risultato.rows);
        } catch (errore) {
            console.error("Errore nel caricamento dei movimenti recenti:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile caricare gli ultimi movimenti."
                )
            });
        }
            } else if (
        request.method === "GET" &&
        request.url === "/api/dashboard"
    ) {
        try {
            const risultato = await pool.query(`
                WITH movimenti_magazzino AS (
                    SELECT
                        prodotto_id,
                        quantita_variazione AS variazione
                    FROM public.rettifiche_magazzino

                    UNION ALL

                    SELECT
                        prodotto_id,
                        quantita AS variazione
                    FROM public.righe_acquisto

                    UNION ALL

                    SELECT
                        prodotto_id,
                        -quantita AS variazione
                    FROM public.righe_vendita
                    WHERE prodotto_id IS NOT NULL
                ),
                prodotti_con_giacenza AS (
                    SELECT
                        prodotti.id,
                        prodotti.soglia_riordino,
                        COALESCE(SUM(movimenti_magazzino.variazione), 0)::integer AS giacenza
                    FROM public.prodotti AS prodotti
                    LEFT JOIN movimenti_magazzino
                        ON movimenti_magazzino.prodotto_id = prodotti.id
                    GROUP BY prodotti.id, prodotti.soglia_riordino
                ),
                vendite_mese AS (
                    SELECT COALESCE(
                        SUM(righe_vendita.quantita * righe_vendita.prezzo_unitario),
                        0
                    ) AS totale
                    FROM public.vendite AS vendite
                    LEFT JOIN public.righe_vendita AS righe_vendita
                        ON righe_vendita.vendita_id = vendite.id
                    WHERE vendite.data_vendita >= date_trunc('month', CURRENT_TIMESTAMP)
                ),
                acquisti_mese AS (
                    SELECT COALESCE(
                        SUM(righe_acquisto.quantita * righe_acquisto.costo_unitario),
                        0
                    ) AS totale
                    FROM public.acquisti AS acquisti
                    LEFT JOIN public.righe_acquisto AS righe_acquisto
                        ON righe_acquisto.acquisto_id = acquisti.id
                    WHERE acquisti.data_acquisto >= date_trunc('month', CURRENT_TIMESTAMP)
                )
                SELECT
                    (SELECT totale FROM vendite_mese) AS vendite_mese,
                    (SELECT totale FROM acquisti_mese) AS acquisti_mese,
                    (SELECT COUNT(*)::integer FROM public.clienti) AS clienti_totali,
                    (
                        SELECT COUNT(*)::integer
                        FROM prodotti_con_giacenza
                        WHERE giacenza <= soglia_riordino
                    ) AS prodotti_da_riordinare;
            `);

            rispondiJson(response, 200, risultato.rows[0]);
        } catch (errore) {
            console.error("Errore nel caricamento del riepilogo:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile caricare il riepilogo della panoramica."
                )
            });
        }
            } else if (
        request.method === "GET" &&
        request.url === "/api/prodotti"
    ) {
        try {
            const risultato = await pool.query(`
                WITH movimenti_magazzino AS (
                    SELECT
                        prodotto_id,
                        quantita_variazione AS variazione
                    FROM public.rettifiche_magazzino

                    UNION ALL

                    SELECT
                        prodotto_id,
                        quantita AS variazione
                    FROM public.righe_acquisto

                    UNION ALL

                    SELECT
                        prodotto_id,
                        -quantita AS variazione
                    FROM public.righe_vendita
                    WHERE prodotto_id IS NOT NULL
                )
                SELECT
                    prodotti.id,
                    prodotti.nome,
                    prodotti.marca,
                    prodotti.prezzo_vendita,
                    prodotti.soglia_riordino,
                    COALESCE(SUM(movimenti_magazzino.variazione), 0)::integer AS giacenza
                FROM public.prodotti AS prodotti
                LEFT JOIN movimenti_magazzino
                    ON movimenti_magazzino.prodotto_id = prodotti.id
                GROUP BY
                    prodotti.id,
                    prodotti.nome,
                    prodotti.marca,
                    prodotti.prezzo_vendita,
                    prodotti.soglia_riordino
                ORDER BY prodotti.nome;
            `);

            rispondiJson(response, 200, risultato.rows);
        } catch (errore) {
            console.error("Errore nel caricamento dei prodotti:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile caricare i prodotti."
                )
            });
        }
    } else if (
        request.method === "POST" &&
        request.url === "/api/prodotti"
    ) {
        let dati;

        try {
            dati = validaPayloadProdotto(await leggiJson(request));
        } catch (errore) {
            const messaggio = errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido.";

            rispondiJson(response, 400, { errore: messaggio });
            return;
        }

        try {
            const risultato = await pool.query(
                `
                    INSERT INTO public.prodotti
                        (nome, marca, prezzo_vendita, soglia_riordino)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, nome, marca, prezzo_vendita, soglia_riordino;
                `,
                [
                    dati.nome,
                    dati.marca,
                    dati.prezzoVendita,
                    dati.sogliaRiordino
                ]
            );

            rispondiJson(response, 201, risultato.rows[0]);
        } catch (errore) {
            console.error("Errore nel salvataggio del prodotto:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile salvare il prodotto."
                )
            });
        }
    } else if (
        request.method === "GET" &&
        request.url === "/api/servizi-gestione"
    ) {
        try {
            const risultato = await pool.query(`
                SELECT id, nome, prezzo, attivo
                FROM public.servizi
                ORDER BY nome;
            `);

            rispondiJson(response, 200, risultato.rows);
        } catch (errore) {
            console.error("Errore nel caricamento dei servizi:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile caricare i servizi."
                )
            });
        }
    } else if (
        request.method === "POST" &&
        request.url === "/api/servizi-gestione"
    ) {
        let dati;

        try {
            dati = validaPayloadServizio(await leggiJson(request));
        } catch (errore) {
            const messaggio = errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido.";

            rispondiJson(response, 400, { errore: messaggio });
            return;
        }

        try {
            const risultato = await pool.query(
                `
                    INSERT INTO public.servizi (nome, prezzo)
                    VALUES ($1, $2)
                    RETURNING id, nome, prezzo, attivo;
                `,
                [dati.nome, dati.prezzo]
            );

            rispondiJson(response, 201, risultato.rows[0]);
        } catch (errore) {
            console.error("Errore nel salvataggio del servizio:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile salvare il servizio."
                )
            });
        }
    } else if (
        request.method === "GET" &&
        request.url === "/api/fornitori"
    ) {
        try {
            const risultato = await pool.query(`
                SELECT id, nome, telefono, email, note, creata_il
                FROM public.fornitori
                ORDER BY nome, id;
            `);

            rispondiJson(response, 200, risultato.rows);
        } catch (errore) {
            console.error("Errore nel caricamento dei fornitori:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile caricare i fornitori."
                )
            });
        }
    } else if (
        request.method === "POST" &&
        request.url === "/api/fornitori"
    ) {
        let dati;

        try {
            dati = validaPayloadFornitore(await leggiJson(request));
        } catch (errore) {
            const messaggio = errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido.";

            rispondiJson(response, 400, { errore: messaggio });
            return;
        }

        try {
            const risultato = await pool.query(
                `
                    INSERT INTO public.fornitori (nome, telefono, email, note)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, nome, telefono, email, note, creata_il;
                `,
                [dati.nome, dati.telefono, dati.email, dati.note]
            );

            rispondiJson(response, 201, risultato.rows[0]);
        } catch (errore) {
            console.error("Errore nel salvataggio del fornitore:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile salvare il fornitore."
                )
            });
        }
    } else if (
        request.method === "GET" &&
        request.url === "/api/acquisti"
    ) {
        try {
            const risultato = await pool.query(`
                SELECT
                    acquisti.id,
                    acquisti.data_acquisto,
                    fornitori.nome AS fornitore,
                    COALESCE(
                        SUM(righe_acquisto.quantita * righe_acquisto.costo_unitario),
                        0
                    ) AS totale
                FROM public.acquisti AS acquisti
                JOIN public.fornitori AS fornitori
                    ON fornitori.id = acquisti.fornitore_id
                LEFT JOIN public.righe_acquisto AS righe_acquisto
                    ON righe_acquisto.acquisto_id = acquisti.id
                GROUP BY
                    acquisti.id,
                    acquisti.data_acquisto,
                    fornitori.nome
                ORDER BY acquisti.data_acquisto DESC, acquisti.id DESC;
            `);

            rispondiJson(response, 200, risultato.rows);
        } catch (errore) {
            console.error("Errore nel caricamento degli acquisti:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile caricare gli acquisti."
                )
            });
        }
    } else if (
        request.method === "POST" &&
        request.url === "/api/acquisti"
    ) {
        let dati;

        try {
            dati = validaPayloadAcquisto(await leggiJson(request));
        } catch (errore) {
            const messaggio = errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido.";

            rispondiJson(response, 400, { errore: messaggio });
            return;
        }

        const totaleCentesimi = totaleAcquistoInCentesimi(dati.righe);

        let client;
        let transazioneAvviata = false;

        try {
            client = await pool.connect();
            await client.query("BEGIN");
            transazioneAvviata = true;

            const fornitore = await client.query(
                `
                    SELECT id
                    FROM public.fornitori
                    WHERE id = $1;
                `,
                [dati.fornitoreId]
            );

            if (fornitore.rowCount === 0) {
                throw new ErroreRichiesta("Il fornitore selezionato non esiste.", 404);
            }

            const prodottiIds = [...new Set(dati.righe.map((riga) => riga.prodottoId))];
            const prodotti = await client.query(
                `
                    SELECT id
                    FROM public.prodotti
                    WHERE id = ANY($1::integer[]);
                `,
                [prodottiIds]
            );
            const prodottiPresenti = new Set(prodotti.rows.map((prodotto) => prodotto.id));

            for (const prodottoId of prodottiIds) {
                if (!prodottiPresenti.has(prodottoId)) {
                    throw new ErroreRichiesta("Uno dei prodotti selezionati non esiste.", 404);
                }
            }

            const acquisto = dati.dataAcquisto === null
                ? await client.query(
                    `
                        INSERT INTO public.acquisti (fornitore_id, note)
                        VALUES ($1, $2)
                        RETURNING id;
                    `,
                    [dati.fornitoreId, dati.note]
                )
                : await client.query(
                    `
                        INSERT INTO public.acquisti (fornitore_id, data_acquisto, note)
                        VALUES ($1, $2::date, $3)
                        RETURNING id;
                    `,
                    [dati.fornitoreId, dati.dataAcquisto, dati.note]
                );

            const acquistoId = acquisto.rows[0].id;

            for (const riga of dati.righe) {
                await client.query(
                    `
                        INSERT INTO public.righe_acquisto
                            (acquisto_id, prodotto_id, quantita, costo_unitario)
                        VALUES ($1, $2, $3, $4);
                    `,
                    [acquistoId, riga.prodottoId, riga.quantita, riga.costoUnitario]
                );
            }

            await client.query("COMMIT");
            transazioneAvviata = false;

            rispondiJson(response, 201, {
                id: acquistoId,
                totale: euroDaCentesimi(totaleCentesimi)
            });
        } catch (errore) {
            if (client && transazioneAvviata) {
                try {
                    await client.query("ROLLBACK");
                } catch (erroreRollback) {
                    console.error("Errore nel rollback dell'acquisto:", erroreRollback);
                }
            }

            if (errore instanceof ErroreRichiesta) {
                rispondiJson(response, errore.stato, { errore: errore.message });
            } else {
                console.error("Errore nel salvataggio dell'acquisto:", errore);
                rispondiJson(response, 500, {
                    errore: messaggioErroreDatabase(
                        errore,
                        "Impossibile salvare l'acquisto."
                    )
                });
            }
        } finally {
            if (client) {
                client.release();
            }
        }
    } else if (
        request.method === "GET" &&
        request.url === "/acquisti"
    ) {
        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        response.end(fs.readFileSync("sezioneacquisti.html", "utf8"));

    } else if (
        request.method === "GET" &&
        request.url === "/vendite"
    ) {
        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        response.end(fs.readFileSync("sezionevendite.html", "utf8"));

        }    else if (
        request.method === "GET" &&
        request.url === "/api/servizi"
    ) {
        try {
            const risultato = await pool.query(`
                SELECT id, nome, prezzo
                FROM public.servizi
                WHERE attivo = TRUE
                ORDER BY nome;
            `);

            response.writeHead(200, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify(risultato.rows));
        } catch (errore) {
            console.error("Errore nel caricamento dei servizi:", errore);

            response.writeHead(500, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify({
                errore: "Errore interno del server."
            }));
        }
    }   else if (
        request.method === "GET" &&
        /^\/api\/clienti\/\d+$/.test(request.url)
    ) {
        const clienteId = Number(request.url.split("/").pop());

        if (!idInteroValido(clienteId)) {
            rispondiJson(response, 400, {
                errore: "L'ID della cliente non è valido."
            });
            return;
        }

        try {
            const cliente = await pool.query(
                `
                    SELECT id, nome, cognome, note, telefono, creata_il
                    FROM public.clienti
                    WHERE id = $1;
                `,
                [clienteId]
            );

            if (cliente.rowCount === 0) {
                rispondiJson(response, 404, {
                    errore: "La cliente richiesta non esiste."
                });
                return;
            }

            const vendite = await pool.query(
                `
                    SELECT
                        vendite.id,
                        vendite.data_vendita,
                        vendite.note,
                        COALESCE(
                            SUM(righe_vendita.quantita * righe_vendita.prezzo_unitario),
                            0
                        ) AS totale
                    FROM public.vendite AS vendite
                    LEFT JOIN public.righe_vendita AS righe_vendita
                        ON righe_vendita.vendita_id = vendite.id
                    WHERE vendite.cliente_id = $1
                    GROUP BY vendite.id, vendite.data_vendita, vendite.note
                    ORDER BY vendite.data_vendita DESC, vendite.id DESC;
                `,
                [clienteId]
            );

            const righe = vendite.rowCount === 0
                ? { rows: [] }
                : await pool.query(
                    `
                        SELECT
                            righe_vendita.vendita_id,
                            COALESCE(prodotti.nome, servizi.nome) AS elemento,
                            righe_vendita.quantita,
                            righe_vendita.prezzo_unitario
                        FROM public.righe_vendita AS righe_vendita
                        LEFT JOIN public.prodotti AS prodotti
                            ON prodotti.id = righe_vendita.prodotto_id
                        LEFT JOIN public.servizi AS servizi
                            ON servizi.id = righe_vendita.servizio_id
                        WHERE righe_vendita.vendita_id = ANY($1::integer[])
                        ORDER BY righe_vendita.vendita_id DESC, righe_vendita.id;
                    `,
                    [vendite.rows.map((vendita) => vendita.id)]
                );

            const righePerVendita = new Map();

            for (const riga of righe.rows) {
                const righeVendita = righePerVendita.get(riga.vendita_id) || [];
                righeVendita.push(riga);
                righePerVendita.set(riga.vendita_id, righeVendita);
            }

            rispondiJson(response, 200, {
                cliente: cliente.rows[0],
                vendite: vendite.rows.map((vendita) => ({
                    ...vendita,
                    righe: righePerVendita.get(vendita.id) || []
                }))
            });
        } catch (errore) {
            console.error("Errore nel caricamento del dettaglio cliente:", errore);
            rispondiJson(response, 500, {
                errore: messaggioErroreDatabase(
                    errore,
                    "Impossibile caricare il dettaglio della cliente."
                )
            });
        }
        } else if (
        request.method === "GET" &&
        request.url === "/api/clienti"
    ) {
        try {
            const risultato = await pool.query(`
                SELECT id, nome, cognome, note, telefono, creata_il
                FROM public.clienti
                ORDER BY cognome, nome;
            `);

            response.writeHead(200, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify(risultato.rows));
        } catch (errore) {
            console.error("Errore nel caricamento delle clienti:", errore);

            response.writeHead(500, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify({
                errore: "Errore interno del server"
            }));
        }
        } else if (
        request.method === "POST" &&
        request.url === "/api/clienti"
    ) {
        let dati;

        // Legge il corpo della richiesta inviato dal browser
        try {
            let corpo = "";

            for await (const pezzo of request) {
                corpo += pezzo;
            }

            dati = JSON.parse(corpo);
        } catch (errore) {
            response.writeHead(400, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify({
                errore: "Il contenuto inviato non è un JSON valido."
            }));
            return;
        }

        // Controlla che i dati obbligatori siano presenti
        const nome =
            typeof dati.nome === "string" ? dati.nome.trim() : "";

        const cognome =
            typeof dati.cognome === "string" ? dati.cognome.trim() : "";

        const note =
            typeof dati.note === "string" ? dati.note.trim() : "";

        const telefono =
            dati.telefono === undefined || dati.telefono === null
                ? null
                : typeof dati.telefono === "string"
                    ? dati.telefono.trim() || null
                    : undefined;

        if (telefono === undefined) {
            response.writeHead(400, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify({
                errore: "Il telefono deve essere un testo facoltativo."
            }));
            return;
        }

        if (nome === "" || cognome === "") {
            response.writeHead(400, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify({
                errore: "Nome e cognome sono obbligatori."
            }));
            return;
        }

        // Inserisce la cliente nel database
        try {
            const risultato = await pool.query(
                `
                    INSERT INTO public.clienti (nome, cognome, note, telefono)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, nome, cognome, note, telefono, creata_il;
                `,
                [nome, cognome, note || null, telefono]
            );

            response.writeHead(201, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify(risultato.rows[0]));
        } catch (errore) {
            console.error("Errore nel salvataggio della cliente:", errore);

            response.writeHead(500, {
                "Content-Type": "application/json; charset=utf-8"
            });

            response.end(JSON.stringify({
                errore: "Errore interno del server."
            }));
        }
    } else if (
        request.method === "POST" &&
        request.url === "/api/vendite"
    ) {
        let dati;

        try {
            let corpo = "";

            for await (const pezzo of request) {
                corpo += pezzo;
            }

            dati = validaPayloadVendita(JSON.parse(corpo));
        } catch (errore) {
            const stato = errore instanceof ErroreRichiesta ? errore.stato : 400;
            const messaggio = errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido.";

            rispondiJson(response, stato, { errore: messaggio });
            return;
        }

        let client;
        let transazioneAvviata = false;

        try {
            client = await pool.connect();
            await client.query("BEGIN");
            transazioneAvviata = true;

            if (dati.clienteId !== null) {
                const cliente = await client.query(
                    `
                        SELECT id
                        FROM public.clienti
                        WHERE id = $1;
                    `,
                    [dati.clienteId]
                );

                if (cliente.rowCount === 0) {
                    throw new ErroreRichiesta("La cliente selezionata non esiste.", 404);
                }
            }

            const richiesteProdotti = new Map();
            const prodottiDaCaricare = new Set();
            const serviziDaCaricare = new Set();

            for (const riga of dati.righe) {
                if (riga.tipo === "prodotto") {
                    prodottiDaCaricare.add(riga.elementoId);

                    const quantitaPrecedente = richiesteProdotti.get(riga.elementoId) || 0;
                    const quantitaTotale = quantitaPrecedente + riga.quantita;

                    if (!Number.isSafeInteger(quantitaTotale)) {
                        throw new ErroreRichiesta("La quantità complessiva del prodotto non è valida.");
                    }

                    richiesteProdotti.set(riga.elementoId, quantitaTotale);
                } else {
                    serviziDaCaricare.add(riga.elementoId);
                }
            }

            const catalogoProdotti = new Map();

            for (const prodottoId of [...prodottiDaCaricare].sort((a, b) => a - b)) {
                await client.query(
                    `
                        SELECT pg_advisory_xact_lock($1::integer, $2::integer);
                    `,
                    [LOCK_NAMESPACE_VENDITE, prodottoId]
                );

                const prodotto = await client.query(
                    `
                        SELECT id, nome, prezzo_vendita
                        FROM public.prodotti
                        WHERE id = $1;
                    `,
                    [prodottoId]
                );

                if (prodotto.rowCount === 0) {
                    throw new ErroreRichiesta("Il prodotto selezionato non esiste.", 404);
                }

                const giacenza = await client.query(
                    `
                        WITH movimenti_magazzino AS (
                            SELECT
                                prodotto_id,
                                quantita_variazione AS variazione
                            FROM rettifiche_magazzino

                            UNION ALL

                            SELECT
                                prodotto_id,
                                quantita AS variazione
                            FROM righe_acquisto

                            UNION ALL

                            SELECT
                                prodotto_id,
                                -quantita AS variazione
                            FROM righe_vendita
                            WHERE prodotto_id IS NOT NULL
                        )
                        SELECT
                            COALESCE(SUM(movimenti_magazzino.variazione), 0)::bigint AS giacenza
                        FROM prodotti
                        LEFT JOIN movimenti_magazzino
                            ON movimenti_magazzino.prodotto_id = prodotti.id
                        WHERE prodotti.id = $1
                        GROUP BY prodotti.id;
                    `,
                    [prodottoId]
                );

                catalogoProdotti.set(prodottoId, {
                    nome: prodotto.rows[0].nome,
                    prezzo: prodotto.rows[0].prezzo_vendita,
                    giacenza: Number(giacenza.rows[0].giacenza)
                });
            }

            for (const [prodottoId, quantitaRichiesta] of richiesteProdotti) {
                const prodotto = catalogoProdotti.get(prodottoId);

                if (quantitaRichiesta > prodotto.giacenza) {
                    throw new ErroreRichiesta(
                        `Giacenza insufficiente per il prodotto ${prodotto.nome}. Disponibili: ${prodotto.giacenza}.`
                    );
                }
            }

            const catalogoServizi = new Map();

            for (const servizioId of [...serviziDaCaricare].sort((a, b) => a - b)) {
                const servizio = await client.query(
                    `
                        SELECT id, prezzo
                        FROM public.servizi
                        WHERE id = $1
                          AND attivo = TRUE;
                    `,
                    [servizioId]
                );

                if (servizio.rowCount === 0) {
                    throw new ErroreRichiesta(
                        "Il servizio selezionato non esiste o non è attivo.",
                        400
                    );
                }

                catalogoServizi.set(servizioId, {
                    prezzo: servizio.rows[0].prezzo
                });
            }

            const vendita = await client.query(
                `
                    INSERT INTO public.vendite (cliente_id, note)
                    VALUES ($1, $2)
                    RETURNING id;
                `,
                [dati.clienteId, dati.note]
            );

            const venditaId = vendita.rows[0].id;

            for (const riga of dati.righe) {
                if (riga.tipo === "prodotto") {
                    const prodotto = catalogoProdotti.get(riga.elementoId);

                    await client.query(
                        `
                            INSERT INTO public.righe_vendita
                                (vendita_id, prodotto_id, servizio_id, quantita, prezzo_unitario)
                            VALUES ($1, $2, NULL, $3, $4);
                        `,
                        [venditaId, riga.elementoId, riga.quantita, prodotto.prezzo]
                    );
                } else {
                    const servizio = catalogoServizi.get(riga.elementoId);

                    await client.query(
                        `
                            INSERT INTO public.righe_vendita
                                (vendita_id, prodotto_id, servizio_id, quantita, prezzo_unitario)
                            VALUES ($1, NULL, $2, $3, $4);
                        `,
                        [venditaId, riga.elementoId, riga.quantita, servizio.prezzo]
                    );
                }
            }

            await client.query("COMMIT");
            transazioneAvviata = false;

            rispondiJson(response, 201, { id: venditaId });
        } catch (errore) {
            if (client && transazioneAvviata) {
                try {
                    await client.query("ROLLBACK");
                } catch (erroreRollback) {
                    console.error("Errore nel rollback della vendita:", erroreRollback);
                }
            }

            if (errore instanceof ErroreRichiesta) {
                rispondiJson(response, errore.stato, { errore: errore.message });
            } else {
                console.error("Errore nel salvataggio della vendita:", errore);
                rispondiJson(response, 500, {
                    errore: "Errore interno del server."
                });
            }
        } finally {
            if (client) {
                client.release();
            }
        }
    } else if (
        request.method === "GET" &&
        /^\/clienti\/\d+$/.test(request.url)
    ) {
        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        response.end(fs.readFileSync("cliente.html", "utf8"));

    } else if (
        request.method === "GET" &&
        request.url === "/clienti"
    ) {
        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        response.end(fs.readFileSync("clienti.html", "utf8"));

    } else {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });//404 è il codice per "risorsa non trovata"     
    response.end("Pagina non trovata");
    }
});

server.listen(3000, () => { //resta in ascolto sulla porta 3000
    console.log("Server in ascolto su http://localhost:3000");
});
