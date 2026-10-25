//backend
require("dotenv").config();//carica la libreria dotenv, .config()cerca e legge .env
const http = require("node:http"); // prende il modulo http da node
const fs = require("node:fs"); //fs modulo per lavorare con i file
const pool = require("./db");//esportiamo l'oggetto pool ,il suo file
const {
    SESSION_DURATION_SECONDS,
    authCookies,
    authEnabled,
    autenticaRichiesta,
    clearAuthCookies,
    csrfCookie,
    csrfHeaderMatchesCookie,
    csrfIsValid,
    hashToken,
    originIsAllowed,
    randomToken,
    verificaPassword
} = require("./auth");
const LOCK_NAMESPACE_VENDITE = 1;
const LOCK_NAMESPACE_PRODOTTI = 2;
const MOTIVO_GIACENZA_INIZIALE = "Giacenza iniziale";

const PAGINE_PROTETTE = new Set([
    "/",
    "/magazzino",
    "/conteggio-iniziale",
    "/prodotti",
    "/servizi",
    "/fornitori",
    "/acquisti",
    "/vendite",
    "/clienti"
]);

const API_PROTETTE = new Set([
    "/api/magazzino",
    "/api/rettifiche-magazzino",
    "/api/movimenti-recenti",
    "/api/dashboard",
    "/api/prodotti",
    "/api/giacenze-iniziali",
    "/api/servizi-gestione",
    "/api/fornitori",
    "/api/acquisti",
    "/api/vendite",
    "/api/servizi",
    "/api/clienti"
]);

const RUOLO_AMMINISTRATORE = "amministratore";
const RUOLO_OPERATORE = "operatore";
const LIMITE_PAGINA_MASSIMO = 10;
const LIMITE_RICERCA_MASSIMO = 100;

function percorsoPaginaProtetto(percorso) {
    return PAGINE_PROTETTE.has(percorso) || /^\/clienti\/\d+$/.test(percorso);
}

function percorsoApiProtetto(percorso) {
    return API_PROTETTE.has(percorso) ||
        /^\/api\/clienti\/\d+$/.test(percorso) ||
        /^\/api\/(vendite|acquisti|righe-vendita|righe-acquisto|prodotti|servizi|clienti|fornitori|rettifiche-magazzino)\/\d+$/.test(percorso);
}

function richiestaProtetta(percorso) {
    return percorsoPaginaProtetto(percorso) || percorsoApiProtetto(percorso);
}

function ruoloRichiesto(method, percorso) {
    if (percorsoPaginaProtetto(percorso) && [
        "/conteggio-iniziale",
        "/prodotti",
        "/servizi",
        "/fornitori"
    ].includes(percorso)) {
        return RUOLO_AMMINISTRATORE;
    }

    if (method === "DELETE") {
        return RUOLO_AMMINISTRATORE;
    }

    if (method === "POST" && [
        "/api/prodotti",
        "/api/giacenze-iniziali",
        "/api/servizi-gestione",
        "/api/fornitori"
    ].includes(percorso)) {
        return RUOLO_AMMINISTRATORE;
    }

    if (method === "GET" && percorso === "/api/fornitori") {
        return RUOLO_AMMINISTRATORE;
    }

    if (percorso === "/api/servizi-gestione") {
        return RUOLO_AMMINISTRATORE;
    }

    return null;
}

class ErroreRichiesta extends Error {
    constructor(messaggio, stato = 400) {
        super(messaggio);
        this.stato = stato;
    }
}

function rispondiJson(response, stato, dati, intestazioni = {}) {
    response.writeHead(stato, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        ...intestazioni
    });

    response.end(JSON.stringify(dati));
}

function leggiPaginazione(url) {
    const paginaParametro = url.searchParams.get("page") || "1";
    const limiteParametro = url.searchParams.get("limit") || String(LIMITE_PAGINA_MASSIMO);
    const ricerca = url.searchParams.get("search") || "";
    const pagina = Number(paginaParametro);
    const limite = Number(limiteParametro);

    if (!/^\d+$/.test(paginaParametro) || !Number.isSafeInteger(pagina) || pagina < 1) {
        throw new ErroreRichiesta("Il parametro page deve essere un intero positivo.");
    }

    if (!/^\d+$/.test(limiteParametro) || !Number.isSafeInteger(limite) || limite < 1 || limite > LIMITE_PAGINA_MASSIMO) {
        throw new ErroreRichiesta(`Il parametro limit deve essere compreso tra 1 e ${LIMITE_PAGINA_MASSIMO}.`);
    }

    if (ricerca.length > LIMITE_RICERCA_MASSIMO) {
        throw new ErroreRichiesta(`La ricerca può contenere al massimo ${LIMITE_RICERCA_MASSIMO} caratteri.`);
    }

    const offset = (pagina - 1) * limite;

    if (!Number.isSafeInteger(offset)) {
        throw new ErroreRichiesta("Il parametro page è troppo grande.");
    }

    return {
        pagina,
        limite,
        offset,
        ricerca: ricerca.trim()
    };
}

function rispondiPagina(response, risultato, paginazione) {
    const totale = risultato.rows.length > 0
        ? Number(risultato.rows[0].totale_risultati)
        : 0;
    const elementi = risultato.rows.map(({ totale_risultati, ...riga }) => riga);

    rispondiJson(response, 200, {
        elementi,
        paginazione: {
            pagina: paginazione.pagina,
            limite: paginazione.limite,
            totale,
            pagine: Math.ceil(totale / paginazione.limite)
        }
    });
}

function rispondiErrorePaginazione(response, errore, messaggio) {
    if (errore instanceof ErroreRichiesta) {
        rispondiJson(response, errore.stato, { errore: errore.message });
        return;
    }

    rispondiErroreOperazione(response, errore, messaggio);
}

function rispondiPaginaNonDisponibile(response) {
    response.writeHead(503, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(
        "<h1>Autenticazione non ancora disponibile</h1>" +
        "<p>La migrazione multi-salone deve essere applicata prima di usare l'applicazione.</p>"
    );
}

function payloadLoginValido(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    const nomeUtente = typeof dati.nomeUtente === "string"
        ? dati.nomeUtente.trim().toLowerCase()
        : "";
    const password = typeof dati.password === "string" ? dati.password : "";

    if (nomeUtente === "" || nomeUtente.length > 100) {
        throw new ErroreRichiesta("Inserisci un nome utente valido.");
    }

    if (password.length < 8 || password.length > 1024) {
        throw new ErroreRichiesta("La password non è valida.");
    }

    return { nomeUtente, password };
}

function payloadSaloneValido(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    if (!idInteroValido(dati.saloneId)) {
        throw new ErroreRichiesta("saloneId deve essere un ID numerico valido.");
    }

    return dati.saloneId;
}

async function leggiMembership(poolClient, utenteId) {
    const risultato = await poolClient.query(
        `
            SELECT
                saloni.id,
                saloni.nome,
                utenti_saloni.ruolo
            FROM public.utenti_saloni AS utenti_saloni
            JOIN public.saloni AS saloni
                ON saloni.id = utenti_saloni.salone_id
            WHERE utenti_saloni.utente_id = $1
            ORDER BY saloni.id;
        `,
        [utenteId]
    );

    return risultato.rows;
}

async function autorizzaRichiesta(request, response, percorso) {
    if (!authEnabled()) {
        console.error(
            "Autenticazione disabilitata: AUTH_ENABLED=false; richiesta protetta rifiutata.",
            { metodo: request.method, percorso }
        );

        if (percorso.startsWith("/api/")) {
            rispondiJson(response, 503, {
                errore: "Autenticazione non disponibile: applicare prima la migrazione multi-salone."
            });
        } else {
            rispondiPaginaNonDisponibile(response);
        }

        return null;
    }

    let sessione;

    try {
        sessione = await autenticaRichiesta(pool, request);
    } catch (errore) {
        console.error("Verifica della sessione fallita:", {
            codice: errore.code || "NO_CODE",
            messaggio: errore.message || "Errore PostgreSQL non specificato"
        });
        rispondiJson(response, 503, {
            errore: "Autenticazione non disponibile: verificare la migrazione multi-salone."
        });
        return null;
    }

    if (!sessione) {
        if (percorso.startsWith("/api/")) {
            rispondiJson(response, 401, { errore: "Sessione non valida o scaduta." });
        } else {
            const ritorno = encodeURIComponent(`${request.url}`);
            response.writeHead(302, { Location: `/login?ritorno=${ritorno}` });
            response.end();
        }

        return null;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
        if (!originIsAllowed(request)) {
            rispondiJson(response, 403, { errore: "Origine della richiesta non autorizzata." });
            return null;
        }

        if (!csrfIsValid(request, sessione.csrf_token_hash)) {
            rispondiJson(response, 403, { errore: "Token CSRF mancante o non valido." });
            return null;
        }
    }

    const ruolo = ruoloRichiesto(request.method, percorso);

    if (ruolo && sessione.ruolo !== ruolo) {
        rispondiJson(response, 403, {
            errore: "Il ruolo dell'utente non consente questa operazione."
        });
        return null;
    }

    request.auth = sessione;
    return sessione;
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

    const dataVendita = dataVenditaValida(dati.dataVendita);

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
        dataVendita,
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

function chiaveProdotto(nome, marca) {
    return `${nome.trim().toLowerCase()}\u0000${(marca || "").trim().toLowerCase()}`;
}

function validaQuantitaIntera(valore, messaggio, { minimo, massimo }) {
    if (
        !Number.isSafeInteger(valore) ||
        valore < minimo ||
        valore > massimo
    ) {
        throw new ErroreRichiesta(messaggio);
    }

    return valore;
}

function validaPayloadConteggioIniziale(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    if (!Array.isArray(dati.righe) || dati.righe.length === 0) {
        throw new ErroreRichiesta("Il conteggio deve contenere almeno un prodotto.");
    }

    if (dati.righe.length > 200) {
        throw new ErroreRichiesta("Un conteggio può contenere al massimo 200 prodotti.");
    }

    const chiavi = new Set();
    const righe = dati.righe.map((riga) => {
        if (!riga || typeof riga !== "object" || Array.isArray(riga)) {
            throw new ErroreRichiesta("Ogni riga del conteggio deve essere un oggetto.");
        }

        const prodotto = validaPayloadProdotto(riga);
        const chiave = chiaveProdotto(prodotto.nome, prodotto.marca);

        if (chiavi.has(chiave)) {
            throw new ErroreRichiesta(
                `Il prodotto "${prodotto.nome}" con la stessa marca è ripetuto nel conteggio.`
            );
        }

        chiavi.add(chiave);

        return {
            ...prodotto,
            quantitaContata: validaQuantitaIntera(
                riga.quantitaContata,
                "La quantità contata deve essere un numero intero positivo.",
                { minimo: 1, massimo: 2147483647 }
            )
        };
    });

    return { righe };
}

function validaPayloadRettificaMagazzino(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    if (!idInteroValido(dati.prodottoId)) {
        throw new ErroreRichiesta("prodottoId deve essere un ID numerico valido.");
    }

    const quantitaVariazione = validaQuantitaIntera(
        dati.quantitaVariazione,
        "La quantità della rettifica deve essere un intero diverso da zero.",
        { minimo: -2147483648, massimo: 2147483647 }
    );

    if (quantitaVariazione === 0) {
        throw new ErroreRichiesta("La quantità della rettifica non può essere zero.");
    }

    const motivo = typeof dati.motivo === "string" ? dati.motivo.trim() : "";

    if (motivo === "") {
        throw new ErroreRichiesta("Il motivo della rettifica è obbligatorio.");
    }

    if (motivo.length > 1000) {
        throw new ErroreRichiesta("Il motivo della rettifica è troppo lungo.");
    }

    if (motivo.toLowerCase() === MOTIVO_GIACENZA_INIZIALE.toLowerCase()) {
        throw new ErroreRichiesta(
            "La giacenza iniziale si registra solo dalla pagina Conteggio iniziale."
        );
    }

    return {
        prodottoId: dati.prodottoId,
        quantitaVariazione,
        motivo
    };
}

async function verificaProdottoDuplicato(client, dati, saloneId) {
    const risultato = await client.query(
        `
            SELECT id
            FROM public.prodotti
            WHERE salone_id = $1
              AND lower(btrim(nome)) = lower($2)
              AND lower(btrim(COALESCE(marca, ''))) = lower($3)
            LIMIT 1;
        `,
        [saloneId, dati.nome, dati.marca || ""]
    );

    if (risultato.rowCount > 0) {
        throw new ErroreRichiesta(
            `Esiste già un prodotto con nome "${dati.nome}" e la stessa marca.`,
            409
        );
    }
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

function dataVenditaValida(valore) {
    if (typeof valore !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valore)) {
        throw new ErroreRichiesta("La data della vendita deve essere nel formato AAAA-MM-GG.");
    }

    const data = new Date(`${valore}T00:00:00Z`);

    if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valore) {
        throw new ErroreRichiesta("La data della vendita non è valida.");
    }

    return valore;
}

function validaPayloadAcquisto(dati) {
    if (!dati || typeof dati !== "object" || Array.isArray(dati)) {
        throw new ErroreRichiesta("Il contenuto inviato deve essere un oggetto JSON.");
    }

    const fornitoreId = dati.fornitoreId === undefined || dati.fornitoreId === null || dati.fornitoreId === ""
        ? null
        : dati.fornitoreId;

    if (fornitoreId !== null && !idInteroValido(fornitoreId)) {
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
        fornitoreId,
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

    if (errore.code === "23503") {
        return "Non è possibile cancellare questo record perché è collegato a operazioni esistenti.";
    }

    return messaggioGenerico;
}

async function eseguiTransazione(callback) {
    const client = await pool.connect();
    let transazioneAvviata = false;

    try {
        await client.query("BEGIN");
        transazioneAvviata = true;

        const risultato = await callback(client);

        await client.query("COMMIT");
        transazioneAvviata = false;

        return risultato;
    } catch (errore) {
        if (transazioneAvviata) {
            try {
                await client.query("ROLLBACK");
            } catch (erroreRollback) {
                console.error("Errore nel rollback:", erroreRollback);
            }
        }

        throw errore;
    } finally {
        client.release();
    }
}

function rispondiErroreOperazione(response, errore, messaggioGenerico) {
    if (errore instanceof ErroreRichiesta) {
        rispondiJson(response, errore.stato, { errore: errore.message });
        return;
    }

    console.error(messaggioGenerico, errore);
    rispondiJson(response, 500, {
        errore: messaggioErroreDatabase(errore, messaggioGenerico)
    });
}

async function gestisciLogin(request, response) {
    if (!authEnabled()) {
        rispondiJson(response, 503, {
            errore: "Il login sarà disponibile dopo l'applicazione della migrazione multi-salone."
        });
        return;
    }

    let dati;

    try {
        dati = payloadLoginValido(await leggiJson(request));
    } catch (errore) {
        rispondiJson(response, errore instanceof ErroreRichiesta ? errore.stato : 400, {
            errore: errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido."
        });
        return;
    }

    if (!originIsAllowed(request) || !csrfHeaderMatchesCookie(request)) {
        rispondiJson(response, 403, { errore: "Origine della richiesta non autorizzata." });
        return;
    }

    try {
        const utente = await pool.query(
            `
                SELECT id, nome, email, password_hash
                FROM public.utenti
                WHERE lower(nome_utente) = $1
                LIMIT 1;
            `,
            [dati.nomeUtente]
        );

        if (utente.rowCount === 0) {
            rispondiJson(response, 401, { errore: "Nome utente o password non validi." });
            return;
        }

        let passwordValida = false;

        try {
            passwordValida = await verificaPassword(
                dati.password,
                utente.rows[0].password_hash
            );
        } catch {
            passwordValida = false;
        }

        if (!passwordValida) {
            rispondiJson(response, 401, { errore: "Nome utente o password non validi." });
            return;
        }

        const memberships = await leggiMembership(pool, utente.rows[0].id);

        if (memberships.length === 0) {
            rispondiJson(response, 403, {
                errore: "L'utente non è associato ad alcun salone."
            });
            return;
        }

        const sessionToken = randomToken();
        const csrfToken = randomToken();
        const saloneAttivo = memberships[0];

        await pool.query(
            `
                INSERT INTO public.sessioni
                    (token_hash, csrf_token_hash, utente_id, salone_id, scade_il)
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    CURRENT_TIMESTAMP + ($5::integer * INTERVAL '1 second')
                );
            `,
            [
                hashToken(sessionToken),
                hashToken(csrfToken),
                utente.rows[0].id,
                saloneAttivo.id,
                SESSION_DURATION_SECONDS
            ]
        );

        rispondiJson(
            response,
            200,
            {
                utente: {
                    id: utente.rows[0].id,
                    nome: utente.rows[0].nome,
                    email: utente.rows[0].email
                },
                saloneAttivo: {
                    id: saloneAttivo.id,
                    nome: saloneAttivo.nome,
                    ruolo: saloneAttivo.ruolo
                },
                saloni: memberships.map((salone) => ({
                    id: salone.id,
                    nome: salone.nome,
                    ruolo: salone.ruolo
                }))
            },
            { "Set-Cookie": authCookies(sessionToken, csrfToken) }
        );
    } catch (errore) {
        console.error("Errore nel login:", errore);
        rispondiJson(response, 503, {
            errore: "Impossibile completare il login. Verificare la migrazione e la configurazione del database."
        });
    }
}

async function gestisciSessione(request, response, sessione) {
    try {
        const memberships = await leggiMembership(pool, sessione.utente_id);

        rispondiJson(response, 200, {
            utente: {
                id: sessione.utente_id,
                nome: sessione.utente_nome,
                email: sessione.utente_email
            },
            saloneAttivo: {
                id: sessione.salone_id,
                nome: memberships.find((salone) => salone.id === sessione.salone_id)?.nome || "",
                ruolo: sessione.ruolo
            },
            saloni: memberships.map((salone) => ({
                id: salone.id,
                nome: salone.nome,
                ruolo: salone.ruolo
            }))
        });
    } catch (errore) {
        console.error("Errore nel caricamento della sessione:", errore);
        rispondiJson(response, 503, {
            errore: "Impossibile caricare la sessione."
        });
    }
}

async function gestisciCambioSalone(request, response, sessione) {
    let saloneId;

    try {
        saloneId = payloadSaloneValido(await leggiJson(request));
    } catch (errore) {
        rispondiJson(response, errore instanceof ErroreRichiesta ? errore.stato : 400, {
            errore: errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido."
        });
        return;
    }

    try {
        await eseguiTransazione(async (client) => {
            const membership = await client.query(
                `
                    SELECT 1
                    FROM public.utenti_saloni
                    WHERE utente_id = $1
                      AND salone_id = $2;
                `,
                [sessione.utente_id, saloneId]
            );

            if (membership.rowCount === 0) {
                throw new ErroreRichiesta("Il salone richiesto non è autorizzato.", 403);
            }

            const aggiornata = await client.query(
                `
                    UPDATE public.sessioni
                    SET salone_id = $1
                    WHERE id = $2
                      AND utente_id = $3
                      AND revocata_il IS NULL
                      AND scade_il > CURRENT_TIMESTAMP
                    RETURNING id;
                `,
                [saloneId, sessione.session_id, sessione.utente_id]
            );

            if (aggiornata.rowCount === 0) {
                throw new ErroreRichiesta("La sessione non è più valida.", 401);
            }
        });

        rispondiJson(response, 200, { saloneId });
    } catch (errore) {
        rispondiErroreOperazione(response, errore, "Impossibile cambiare salone attivo.");
    }
}

async function gestisciLogout(response, sessione) {
    try {
        await pool.query(
            `
                UPDATE public.sessioni
                SET revocata_il = CURRENT_TIMESTAMP
                WHERE id = $1;
            `,
            [sessione.session_id]
        );

        response.writeHead(204, {
            "Set-Cookie": clearAuthCookies(),
            "Cache-Control": "no-store"
        });
        response.end();
    } catch (errore) {
        console.error("Errore nel logout:", errore);
        rispondiJson(response, 503, { errore: "Impossibile terminare la sessione." });
    }
}

const server = http.createServer(async (request, response) => {//async cosi possiamo usare await ricordi?
    console.log("Metodo:", request.method);
    console.log("Percorso:", request.url);

    const url = new URL(request.url, `http://${request.headers.host || "localhost:3000"}`);
    const percorso = url.pathname;

    if (request.method === "GET" && percorso === "/login") {
        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Set-Cookie": csrfCookie(randomToken())
        });
        response.end(fs.readFileSync("login.html", "utf8"));
        return;
    }

    if (request.method === "POST" && percorso === "/api/login") {
        await gestisciLogin(request, response);
        return;
    }

    if (percorso === "/api/sessione" && request.method === "GET") {
        const sessione = await autorizzaRichiesta(request, response, percorso);

        if (sessione) {
            await gestisciSessione(request, response, sessione);
        }

        return;
    }

    if (percorso === "/api/sessione/salone" && request.method === "POST") {
        const sessione = await autorizzaRichiesta(request, response, percorso);

        if (sessione) {
            await gestisciCambioSalone(request, response, sessione);
        }

        return;
    }

    if (percorso === "/api/logout" && request.method === "POST") {
        const sessione = await autorizzaRichiesta(request, response, percorso);

        if (sessione) {
            await gestisciLogout(response, sessione);
        }

        return;
    }

    if (richiestaProtetta(percorso)) {
        const sessione = await autorizzaRichiesta(request, response, percorso);

        if (!sessione) {
            return;
        }
    }

    const saloneId = request.auth ? request.auth.salone_id : null;

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
                "Content-Type": "text/javascript; charset=utf-8",
                "Cache-Control": "no-store, no-cache, must-revalidate"
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
            request.url === "/conteggio-iniziale"
            ) {
                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8"
                });

                response.end(fs.readFileSync("conteggio-iniziale.html", "utf8"));

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
                percorso === "/api/magazzino"//e il percorso è /api/magazzino
                ) {//try in caso di qualsiasi errore
                try {//mandi la query sql e dai await cosi aspetti che sql risponda
                    const paginazione = leggiPaginazione(url);
                    const risultato = await pool.query(`
                    WITH movimenti_magazzino AS (
                        SELECT
                            salone_id,
                            prodotto_id,
                            quantita_variazione AS variazione
                        FROM public.rettifiche_magazzino
                        WHERE salone_id = $1

                        UNION ALL

                        SELECT
                            salone_id,
                            prodotto_id,
                            quantita AS variazione
                        FROM public.righe_acquisto
                        WHERE salone_id = $1

                        UNION ALL

                        SELECT
                            salone_id,
                            prodotto_id,
                            -quantita AS variazione
                        FROM public.righe_vendita
                        WHERE prodotto_id IS NOT NULL
                          AND salone_id = $1
                    )
                    SELECT
                        prodotti.id,
                        prodotti.nome,
                        prodotti.marca,
                        GREATEST(COALESCE(SUM(movimenti_magazzino.variazione), 0), 0)::integer AS giacenza,
                        prodotti.soglia_riordino,
                        prodotti.prezzo_vendita,
                        COUNT(*) OVER() AS totale_risultati
                    FROM public.prodotti AS prodotti
                    LEFT JOIN movimenti_magazzino
                        ON movimenti_magazzino.prodotto_id = prodotti.id
                       AND movimenti_magazzino.salone_id = prodotti.salone_id
                    WHERE prodotti.salone_id = $1
                      AND (
                          $2 = ''
                          OR prodotti.nome ILIKE '%' || $2 || '%'
                          OR COALESCE(prodotti.marca, '') ILIKE '%' || $2 || '%'
                      )
                    GROUP BY
                        prodotti.id,
                        prodotti.nome,
                        prodotti.marca,
                        prodotti.soglia_riordino,
                        prodotti.prezzo_vendita
                    ORDER BY prodotti.nome, prodotti.id
                    LIMIT $3 OFFSET $4;
                `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

                rispondiPagina(response, risultato, paginazione);
            } catch (errore) {
                console.error("Errore nel caricamento del magazzino:", errore);

                rispondiErrorePaginazione(response, errore, "Impossibile caricare il magazzino.");

            }

            } else if (
        request.method === "POST" &&
        request.url === "/api/rettifiche-magazzino"
    ) {
        let dati;

        try {
            dati = validaPayloadRettificaMagazzino(await leggiJson(request));
        } catch (errore) {
            const messaggio = errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido.";

            rispondiJson(response, 400, { errore: messaggio });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const prodotto = await client.query(
                    `SELECT id FROM public.prodotti WHERE id = $1 AND salone_id = $2;`,
                    [dati.prodottoId, saloneId]
                );

                if (prodotto.rowCount === 0) {
                    throw new ErroreRichiesta("Il prodotto selezionato non esiste.", 404);
                }

                const rettifica = await client.query(
                    `
                        INSERT INTO public.rettifiche_magazzino
                            (salone_id, prodotto_id, quantita_variazione, motivo)
                        VALUES ($1, $2, $3, $4)
                        RETURNING id, prodotto_id, quantita_variazione, data_movimento, motivo;
                    `,
                    [saloneId, dati.prodottoId, dati.quantitaVariazione, dati.motivo]
                );

                return rettifica.rows[0];
            });

            rispondiJson(response, 201, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile registrare la rettifica di magazzino.");
        }
            } else if (
        request.method === "GET" &&
        percorso === "/api/rettifiche-magazzino"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                SELECT
                    rettifiche_magazzino.id,
                    rettifiche_magazzino.data_movimento,
                    rettifiche_magazzino.quantita_variazione,
                    rettifiche_magazzino.motivo,
                    prodotti.nome AS prodotto,
                    prodotti.marca,
                    COUNT(*) OVER() AS totale_risultati
                FROM public.rettifiche_magazzino AS rettifiche_magazzino
                JOIN public.prodotti AS prodotti
                    ON prodotti.id = rettifiche_magazzino.prodotto_id
                   AND prodotti.salone_id = rettifiche_magazzino.salone_id
                WHERE rettifiche_magazzino.salone_id = $1
                  AND (
                      $2 = ''
                      OR prodotti.nome ILIKE '%' || $2 || '%'
                      OR COALESCE(prodotti.marca, '') ILIKE '%' || $2 || '%'
                      OR COALESCE(rettifiche_magazzino.motivo, '') ILIKE '%' || $2 || '%'
                  )
                ORDER BY
                    rettifiche_magazzino.data_movimento DESC,
                    rettifiche_magazzino.id DESC
                LIMIT $3 OFFSET $4;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            rispondiErrorePaginazione(
                response,
                errore,
                "Impossibile caricare le rettifiche di magazzino."
            );
        }
            } else if (
        request.method === "GET" &&
        percorso === "/api/movimenti-recenti"
    ) {
        try {
            const risultato = await pool.query(
                `
                    SELECT *
                    FROM (
                        SELECT
                            vendite.id AS riferimento,
                            to_char(vendite.data_vendita, 'YYYY-MM-DD') AS data_movimento,
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
                           AND clienti.salone_id = vendite.salone_id
                        LEFT JOIN public.righe_vendita AS righe_vendita
                            ON righe_vendita.vendita_id = vendite.id
                           AND righe_vendita.salone_id = vendite.salone_id
                        WHERE vendite.salone_id = $1
                        GROUP BY
                            vendite.id,
                            vendite.data_vendita,
                            clienti.nome,
                            clienti.cognome

                        UNION ALL

                        SELECT
                            acquisti.id AS riferimento,
                            to_char(acquisti.data_acquisto, 'YYYY-MM-DD') AS data_movimento,
                            'Acquisto' AS operazione,
                            COALESCE(fornitori.nome, 'Acquisto senza fornitore') AS soggetto,
                            COALESCE(
                                SUM(righe_acquisto.quantita * righe_acquisto.costo_unitario),
                                0
                            ) AS importo
                        FROM public.acquisti AS acquisti
                        LEFT JOIN public.fornitori AS fornitori
                            ON fornitori.id = acquisti.fornitore_id
                           AND fornitori.salone_id = acquisti.salone_id
                        LEFT JOIN public.righe_acquisto AS righe_acquisto
                            ON righe_acquisto.acquisto_id = acquisti.id
                           AND righe_acquisto.salone_id = acquisti.salone_id
                        WHERE acquisti.salone_id = $1
                        GROUP BY
                            acquisti.id,
                            acquisti.data_acquisto,
                            fornitori.nome

                        UNION ALL

                        SELECT
                            rettifiche_magazzino.id AS riferimento,
                            to_char(rettifiche_magazzino.data_movimento, 'YYYY-MM-DD') AS data_movimento,
                            CASE
                                WHEN rettifiche_magazzino.motivo = $3
                                    THEN 'Giacenza iniziale'
                                ELSE 'Rettifica magazzino'
                            END AS operazione,
                            prodotti.nome || ' — ' || rettifiche_magazzino.motivo AS soggetto,
                            NULL::numeric AS importo
                        FROM public.rettifiche_magazzino AS rettifiche_magazzino
                        JOIN public.prodotti AS prodotti
                            ON prodotti.id = rettifiche_magazzino.prodotto_id
                           AND prodotti.salone_id = rettifiche_magazzino.salone_id
                        WHERE rettifiche_magazzino.salone_id = $1

                        UNION ALL

                        SELECT
                            clienti.id AS riferimento,
                            to_char(clienti.creata_il, 'YYYY-MM-DD') AS data_movimento,
                            'Registrazione cliente' AS operazione,
                            clienti.nome || ' ' || clienti.cognome AS soggetto,
                            NULL::numeric AS importo
                        FROM public.clienti AS clienti
                        WHERE clienti.salone_id = $1

                        UNION ALL

                        SELECT
                            fornitori.id AS riferimento,
                            to_char(fornitori.creata_il, 'YYYY-MM-DD') AS data_movimento,
                            'Registrazione fornitore' AS operazione,
                            fornitori.nome AS soggetto,
                            NULL::numeric AS importo
                        FROM public.fornitori AS fornitori
                        WHERE fornitori.salone_id = $1
                    ) AS movimenti
                    ORDER BY data_movimento DESC, operazione ASC, riferimento DESC
                    LIMIT $2;
                `,
                [saloneId, 10, MOTIVO_GIACENZA_INIZIALE]
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
                        salone_id,
                        prodotto_id,
                        quantita_variazione AS variazione
                    FROM public.rettifiche_magazzino
                    WHERE salone_id = $1

                    UNION ALL

                    SELECT
                        salone_id,
                        prodotto_id,
                        quantita AS variazione
                    FROM public.righe_acquisto
                    WHERE salone_id = $1

                    UNION ALL

                    SELECT
                        salone_id,
                        prodotto_id,
                        -quantita AS variazione
                    FROM public.righe_vendita
                    WHERE prodotto_id IS NOT NULL
                      AND salone_id = $1
                ),
                prodotti_con_giacenza AS (
                    SELECT
                        prodotti.id,
                        prodotti.salone_id,
                        prodotti.soglia_riordino,
                        GREATEST(COALESCE(SUM(movimenti_magazzino.variazione), 0), 0)::integer AS giacenza
                    FROM public.prodotti AS prodotti
                    LEFT JOIN movimenti_magazzino
                        ON movimenti_magazzino.prodotto_id = prodotti.id
                       AND movimenti_magazzino.salone_id = prodotti.salone_id
                    WHERE prodotti.salone_id = $1
                    GROUP BY prodotti.id, prodotti.salone_id, prodotti.soglia_riordino
                ),
                vendite_mese AS (
                    SELECT COALESCE(
                        SUM(righe_vendita.quantita * righe_vendita.prezzo_unitario),
                        0
                    ) AS totale
                    FROM public.vendite AS vendite
                    LEFT JOIN public.righe_vendita AS righe_vendita
                        ON righe_vendita.vendita_id = vendite.id
                       AND righe_vendita.salone_id = vendite.salone_id
                    WHERE vendite.salone_id = $1
                      AND vendite.data_vendita >= date_trunc('month', CURRENT_TIMESTAMP)
                ),
                acquisti_mese AS (
                    SELECT COALESCE(
                        SUM(righe_acquisto.quantita * righe_acquisto.costo_unitario),
                        0
                    ) AS totale
                    FROM public.acquisti AS acquisti
                    LEFT JOIN public.righe_acquisto AS righe_acquisto
                        ON righe_acquisto.acquisto_id = acquisti.id
                       AND righe_acquisto.salone_id = acquisti.salone_id
                    WHERE acquisti.salone_id = $1
                      AND acquisti.data_acquisto >= date_trunc('month', CURRENT_TIMESTAMP)
                )
                SELECT
                    (SELECT totale FROM vendite_mese) AS vendite_mese,
                    (SELECT totale FROM acquisti_mese) AS acquisti_mese,
                    (SELECT COUNT(*)::integer FROM public.clienti WHERE salone_id = $1) AS clienti_totali,
                    (
                        SELECT COUNT(*)::integer
                        FROM prodotti_con_giacenza
                        WHERE giacenza <= soglia_riordino
                    ) AS prodotti_da_riordinare;
            `, [saloneId]);

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
        percorso === "/api/prodotti"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                WITH movimenti_magazzino AS (
                    SELECT
                        salone_id,
                        prodotto_id,
                        quantita_variazione AS variazione
                    FROM public.rettifiche_magazzino
                    WHERE salone_id = $1

                    UNION ALL

                    SELECT
                        salone_id,
                        prodotto_id,
                        quantita AS variazione
                    FROM public.righe_acquisto
                    WHERE salone_id = $1

                    UNION ALL

                    SELECT
                        salone_id,
                        prodotto_id,
                        -quantita AS variazione
                    FROM public.righe_vendita
                    WHERE prodotto_id IS NOT NULL
                      AND salone_id = $1
                )
                SELECT
                    prodotti.id,
                    prodotti.nome,
                    prodotti.marca,
                    prodotti.prezzo_vendita,
                    prodotti.soglia_riordino,
                    GREATEST(COALESCE(SUM(movimenti_magazzino.variazione), 0), 0)::integer AS giacenza,
                    COUNT(*) OVER() AS totale_risultati
                FROM public.prodotti AS prodotti
                LEFT JOIN movimenti_magazzino
                    ON movimenti_magazzino.prodotto_id = prodotti.id
                   AND movimenti_magazzino.salone_id = prodotti.salone_id
                WHERE prodotti.salone_id = $1
                  AND (
                      $2 = ''
                      OR prodotti.nome ILIKE '%' || $2 || '%'
                      OR COALESCE(prodotti.marca, '') ILIKE '%' || $2 || '%'
                  )
                GROUP BY
                    prodotti.id,
                    prodotti.nome,
                    prodotti.marca,
                    prodotti.prezzo_vendita,
                    prodotti.soglia_riordino
                ORDER BY prodotti.nome, prodotti.id
                LIMIT $3 OFFSET $4;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            console.error("Errore nel caricamento dei prodotti:", errore);
            rispondiErrorePaginazione(response, errore, "Impossibile caricare i prodotti.");
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
            const risultato = await eseguiTransazione(async (client) => {
                await client.query("SELECT pg_advisory_xact_lock($1);", [LOCK_NAMESPACE_PRODOTTI]);
                await verificaProdottoDuplicato(client, dati, saloneId);

                const prodotto = await client.query(
                    `
                        INSERT INTO public.prodotti
                            (salone_id, nome, marca, prezzo_vendita, soglia_riordino)
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING id, nome, marca, prezzo_vendita, soglia_riordino;
                    `,
                    [
                        saloneId,
                        dati.nome,
                        dati.marca,
                        dati.prezzoVendita,
                        dati.sogliaRiordino
                    ]
                );

                return prodotto.rows[0];
            });

            rispondiJson(response, 201, risultato);
        } catch (errore) {
            console.error("Errore nel salvataggio del prodotto:", errore);
            rispondiErroreOperazione(response, errore, "Impossibile salvare il prodotto.");
        }
    } else if (
        request.method === "POST" &&
        request.url === "/api/giacenze-iniziali"
    ) {
        let dati;

        try {
            dati = validaPayloadConteggioIniziale(await leggiJson(request));
        } catch (errore) {
            const messaggio = errore instanceof ErroreRichiesta
                ? errore.message
                : "Il contenuto inviato non è un JSON valido.";

            rispondiJson(response, 400, { errore: messaggio });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                // Serializza i conteggi iniziali concorrenti senza aggiungere vincoli allo schema.
                await client.query("SELECT pg_advisory_xact_lock($1);", [LOCK_NAMESPACE_PRODOTTI]);

                const salvati = [];

                for (const riga of dati.righe) {
                    await verificaProdottoDuplicato(client, riga, saloneId);

                    const prodotto = await client.query(
                        `
                            INSERT INTO public.prodotti
                                (salone_id, nome, marca, prezzo_vendita, soglia_riordino)
                            VALUES ($1, $2, $3, $4, $5)
                            RETURNING id, nome, marca, prezzo_vendita, soglia_riordino;
                        `,
                        [
                            saloneId,
                            riga.nome,
                            riga.marca,
                            riga.prezzoVendita,
                            riga.sogliaRiordino
                        ]
                    );

                    const rettifica = await client.query(
                        `
                            SELECT id
                            FROM public.rettifiche_magazzino
                            WHERE salone_id = $1
                              AND prodotto_id = $2
                              AND motivo = $3
                            LIMIT 1;
                        `,
                        [saloneId, prodotto.rows[0].id, MOTIVO_GIACENZA_INIZIALE]
                    );

                    if (rettifica.rowCount > 0) {
                        throw new ErroreRichiesta(
                            `La giacenza iniziale per "${riga.nome}" è già stata registrata.`,
                            409
                        );
                    }

                    await client.query(
                        `
                            INSERT INTO public.rettifiche_magazzino
                                (salone_id, prodotto_id, quantita_variazione, motivo)
                            VALUES ($1, $2, $3, $4);
                        `,
                        [saloneId, prodotto.rows[0].id, riga.quantitaContata, MOTIVO_GIACENZA_INIZIALE]
                    );

                    salvati.push(prodotto.rows[0]);
                }

                return { prodotti: salvati };
            });

            rispondiJson(response, 201, risultato);
        } catch (errore) {
            rispondiErroreOperazione(
                response,
                errore,
                "Impossibile salvare il conteggio iniziale: nessuna riga è stata registrata."
            );
        }
    } else if (
        request.method === "GET" &&
        percorso === "/api/servizi-gestione"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                SELECT id, nome, prezzo, attivo,
                       COUNT(*) OVER() AS totale_risultati
                FROM public.servizi
                WHERE salone_id = $1
                  AND ($2 = '' OR nome ILIKE '%' || $2 || '%')
                ORDER BY nome, id
                LIMIT $3 OFFSET $4;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            console.error("Errore nel caricamento dei servizi:", errore);
            rispondiErrorePaginazione(response, errore, "Impossibile caricare i servizi.");
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
                    INSERT INTO public.servizi (salone_id, nome, prezzo)
                    VALUES ($1, $2, $3)
                    RETURNING id, nome, prezzo, attivo;
                `,
                [saloneId, dati.nome, dati.prezzo]
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
        percorso === "/api/fornitori"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                SELECT id, nome, telefono, email, note, creata_il,
                       COUNT(*) OVER() AS totale_risultati
                FROM public.fornitori
                WHERE salone_id = $1
                  AND (
                      $2 = ''
                      OR nome ILIKE '%' || $2 || '%'
                      OR COALESCE(telefono, '') ILIKE '%' || $2 || '%'
                      OR COALESCE(email, '') ILIKE '%' || $2 || '%'
                      OR COALESCE(note, '') ILIKE '%' || $2 || '%'
                  )
                ORDER BY nome, id
                LIMIT $3 OFFSET $4;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            console.error("Errore nel caricamento dei fornitori:", errore);
            rispondiErrorePaginazione(response, errore, "Impossibile caricare i fornitori.");
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
                    INSERT INTO public.fornitori (salone_id, nome, telefono, email, note)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id, nome, telefono, email, note, creata_il;
                `,
                [saloneId, dati.nome, dati.telefono, dati.email, dati.note]
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
        percorso === "/api/acquisti"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                WITH acquisti_base AS (
                SELECT
                    acquisti.id,
                    to_char(acquisti.data_acquisto, 'YYYY-MM-DD') AS data_acquisto,
                    COALESCE(fornitori.nome, 'Acquisto senza fornitore') AS fornitore,
                    COALESCE(
                        SUM(righe_acquisto.quantita * righe_acquisto.costo_unitario),
                        0
                    ) AS totale,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', righe_acquisto.id,
                                'prodottoId', righe_acquisto.prodotto_id,
                                'prodotto', prodotti.nome,
                                'quantita', righe_acquisto.quantita,
                                'costoUnitario', righe_acquisto.costo_unitario
                            )
                            ORDER BY righe_acquisto.id
                        ) FILTER (WHERE righe_acquisto.id IS NOT NULL),
                        '[]'::json
                    ) AS righe,
                    COUNT(*) OVER() AS totale_risultati
                FROM public.acquisti AS acquisti
                LEFT JOIN public.fornitori AS fornitori
                    ON fornitori.id = acquisti.fornitore_id
                   AND fornitori.salone_id = acquisti.salone_id
                LEFT JOIN public.righe_acquisto AS righe_acquisto
                    ON righe_acquisto.acquisto_id = acquisti.id
                   AND righe_acquisto.salone_id = acquisti.salone_id
                LEFT JOIN public.prodotti AS prodotti
                    ON prodotti.id = righe_acquisto.prodotto_id
                   AND prodotti.salone_id = righe_acquisto.salone_id
                WHERE acquisti.salone_id = $1
                  AND (
                      $2 = ''
                      OR COALESCE(fornitori.nome, 'Acquisto senza fornitore') ILIKE '%' || $2 || '%'
                      OR EXISTS (
                          SELECT 1
                          FROM public.righe_acquisto AS righe_ricerca
                          JOIN public.prodotti AS prodotti_ricerca
                              ON prodotti_ricerca.id = righe_ricerca.prodotto_id
                             AND prodotti_ricerca.salone_id = righe_ricerca.salone_id
                          WHERE righe_ricerca.acquisto_id = acquisti.id
                            AND righe_ricerca.salone_id = acquisti.salone_id
                            AND prodotti_ricerca.nome ILIKE '%' || $2 || '%'
                      )
                  )
                GROUP BY
                    acquisti.id,
                    acquisti.data_acquisto,
                    fornitori.nome
                ORDER BY acquisti.data_acquisto DESC, acquisti.id DESC
                LIMIT $3 OFFSET $4
                )
                SELECT *
                FROM acquisti_base
                ORDER BY data_acquisto DESC, id DESC;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            console.error("Errore nel caricamento degli acquisti:", errore);
            rispondiErrorePaginazione(response, errore, "Impossibile caricare gli acquisti.");
        }
    } else if (
        request.method === "GET" &&
        percorso === "/api/vendite"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                WITH vendite_base AS (
                SELECT
                    vendite.id,
                    to_char(vendite.data_vendita, 'YYYY-MM-DD') AS data_vendita,
                    vendite.note,
                    COALESCE(
                        clienti.nome || ' ' || clienti.cognome,
                        'Vendita senza cliente'
                    ) AS cliente,
                    COALESCE(
                        SUM(righe_vendita.quantita * righe_vendita.prezzo_unitario),
                        0
                    ) AS totale,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', righe_vendita.id,
                                'tipo', CASE
                                    WHEN righe_vendita.prodotto_id IS NOT NULL
                                        THEN 'prodotto'
                                    ELSE 'servizio'
                                END,
                                'elemento', COALESCE(prodotti.nome, servizi.nome),
                                'quantita', righe_vendita.quantita,
                                'prezzoUnitario', righe_vendita.prezzo_unitario
                            )
                            ORDER BY righe_vendita.id
                        ) FILTER (WHERE righe_vendita.id IS NOT NULL),
                        '[]'::json
                    ) AS righe,
                    COUNT(*) OVER() AS totale_risultati
                FROM public.vendite AS vendite
                LEFT JOIN public.clienti AS clienti
                    ON clienti.id = vendite.cliente_id
                   AND clienti.salone_id = vendite.salone_id
                LEFT JOIN public.righe_vendita AS righe_vendita
                    ON righe_vendita.vendita_id = vendite.id
                   AND righe_vendita.salone_id = vendite.salone_id
                LEFT JOIN public.prodotti AS prodotti
                    ON prodotti.id = righe_vendita.prodotto_id
                   AND prodotti.salone_id = righe_vendita.salone_id
                LEFT JOIN public.servizi AS servizi
                    ON servizi.id = righe_vendita.servizio_id
                   AND servizi.salone_id = righe_vendita.salone_id
                WHERE vendite.salone_id = $1
                  AND (
                      $2 = ''
                      OR COALESCE(clienti.nome || ' ' || clienti.cognome, 'Vendita senza cliente') ILIKE '%' || $2 || '%'
                      OR COALESCE(vendite.note, '') ILIKE '%' || $2 || '%'
                      OR EXISTS (
                          SELECT 1
                          FROM public.righe_vendita AS righe_ricerca
                          LEFT JOIN public.prodotti AS prodotti_ricerca
                              ON prodotti_ricerca.id = righe_ricerca.prodotto_id
                             AND prodotti_ricerca.salone_id = righe_ricerca.salone_id
                          LEFT JOIN public.servizi AS servizi_ricerca
                              ON servizi_ricerca.id = righe_ricerca.servizio_id
                             AND servizi_ricerca.salone_id = righe_ricerca.salone_id
                          WHERE righe_ricerca.vendita_id = vendite.id
                            AND righe_ricerca.salone_id = vendite.salone_id
                            AND COALESCE(prodotti_ricerca.nome, servizi_ricerca.nome) ILIKE '%' || $2 || '%'
                      )
                  )
                GROUP BY
                    vendite.id,
                    vendite.data_vendita,
                    vendite.note,
                    clienti.nome,
                    clienti.cognome
                ORDER BY vendite.data_vendita DESC, vendite.id DESC
                LIMIT $3 OFFSET $4
                )
                SELECT *
                FROM vendite_base
                ORDER BY data_vendita DESC, id DESC;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            rispondiErrorePaginazione(
                response,
                errore,
                "Impossibile caricare le vendite."
            );
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

            if (dati.fornitoreId !== null) {
                const fornitore = await client.query(
                    `
                        SELECT id
                        FROM public.fornitori
                        WHERE id = $1
                          AND salone_id = $2;
                    `,
                    [dati.fornitoreId, saloneId]
                );

                if (fornitore.rowCount === 0) {
                    throw new ErroreRichiesta("Il fornitore selezionato non esiste.", 404);
                }
            }

            const prodottiIds = [...new Set(dati.righe.map((riga) => riga.prodottoId))];
            const prodotti = await client.query(
                `
                    SELECT id
                    FROM public.prodotti
                    WHERE salone_id = $1
                      AND id = ANY($2::integer[]);
                `,
                [saloneId, prodottiIds]
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
                        INSERT INTO public.acquisti (salone_id, fornitore_id, note)
                        VALUES ($1, $2, $3)
                        RETURNING id;
                    `,
                    [saloneId, dati.fornitoreId, dati.note]
                )
                : await client.query(
                    `
                        INSERT INTO public.acquisti (salone_id, fornitore_id, data_acquisto, note)
                        VALUES ($1, $2, $3::date, $4)
                        RETURNING id;
                    `,
                    [saloneId, dati.fornitoreId, dati.dataAcquisto, dati.note]
                );

            const acquistoId = acquisto.rows[0].id;

            for (const riga of dati.righe) {
                await client.query(
                    `
                        INSERT INTO public.righe_acquisto
                            (salone_id, acquisto_id, prodotto_id, quantita, costo_unitario)
                        VALUES ($1, $2, $3, $4, $5);
                    `,
                    [saloneId, acquistoId, riga.prodottoId, riga.quantita, riga.costoUnitario]
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
        percorso === "/api/servizi"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                SELECT id, nome, prezzo,
                       COUNT(*) OVER() AS totale_risultati
                FROM public.servizi
                WHERE salone_id = $1
                  AND attivo = TRUE
                  AND ($2 = '' OR nome ILIKE '%' || $2 || '%')
                ORDER BY nome, id
                LIMIT $3 OFFSET $4;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            console.error("Errore nel caricamento dei servizi:", errore);

            rispondiErrorePaginazione(response, errore, "Impossibile caricare i servizi.");
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
                    SELECT id, nome, cognome, note, creata_il
                    FROM public.clienti
                    WHERE id = $1
                      AND salone_id = $2;
                `,
                [clienteId, saloneId]
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
                        to_char(vendite.data_vendita, 'YYYY-MM-DD') AS data_vendita,
                        vendite.note,
                        COALESCE(
                            SUM(righe_vendita.quantita * righe_vendita.prezzo_unitario),
                            0
                        ) AS totale
                        FROM public.vendite AS vendite
                        LEFT JOIN public.righe_vendita AS righe_vendita
                            ON righe_vendita.vendita_id = vendite.id
                           AND righe_vendita.salone_id = vendite.salone_id
                    WHERE vendite.cliente_id = $1
                      AND vendite.salone_id = $2
                    GROUP BY vendite.id, vendite.data_vendita, vendite.note
                    ORDER BY vendite.data_vendita DESC, vendite.id DESC;
                `,
                [clienteId, saloneId]
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
                           AND prodotti.salone_id = righe_vendita.salone_id
                        LEFT JOIN public.servizi AS servizi
                            ON servizi.id = righe_vendita.servizio_id
                           AND servizi.salone_id = righe_vendita.salone_id
                        WHERE righe_vendita.salone_id = $2
                          AND righe_vendita.vendita_id = ANY($1::integer[])
                        ORDER BY righe_vendita.vendita_id DESC, righe_vendita.id;
                    `,
                    [vendite.rows.map((vendita) => vendita.id), saloneId]
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
        percorso === "/api/clienti"
    ) {
        try {
            const paginazione = leggiPaginazione(url);
            const risultato = await pool.query(`
                SELECT id, nome, cognome, note, creata_il,
                       COUNT(*) OVER() AS totale_risultati
                FROM public.clienti
                WHERE salone_id = $1
                  AND (
                      $2 = ''
                      OR nome ILIKE '%' || $2 || '%'
                      OR cognome ILIKE '%' || $2 || '%'
                      OR COALESCE(note, '') ILIKE '%' || $2 || '%'
                  )
                ORDER BY cognome, nome, id
                LIMIT $3 OFFSET $4;
            `, [saloneId, paginazione.ricerca, paginazione.limite, paginazione.offset]);

            rispondiPagina(response, risultato, paginazione);
        } catch (errore) {
            console.error("Errore nel caricamento delle clienti:", errore);

            rispondiErrorePaginazione(response, errore, "Impossibile caricare le clienti.");
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
                    INSERT INTO public.clienti (salone_id, nome, cognome, note)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, nome, cognome, note, creata_il;
                `,
                [saloneId, nome, cognome, note || null]
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
                        WHERE id = $1
                          AND salone_id = $2;
                    `,
                    [dati.clienteId, saloneId]
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
                        WHERE id = $1
                          AND salone_id = $2;
                    `,
                    [prodottoId, saloneId]
                );

                if (prodotto.rowCount === 0) {
                    throw new ErroreRichiesta("Il prodotto selezionato non esiste.", 404);
                }

                const giacenza = await client.query(
                    `
                        WITH movimenti_magazzino AS (
                            SELECT
                                salone_id,
                                prodotto_id,
                                quantita_variazione AS variazione
                            FROM public.rettifiche_magazzino
                            WHERE salone_id = $2

                            UNION ALL

                            SELECT
                                salone_id,
                                prodotto_id,
                                quantita AS variazione
                            FROM public.righe_acquisto
                            WHERE salone_id = $2

                            UNION ALL

                            SELECT
                                salone_id,
                                prodotto_id,
                                -quantita AS variazione
                            FROM public.righe_vendita
                            WHERE prodotto_id IS NOT NULL
                              AND salone_id = $2
                        )
                        SELECT
                            GREATEST(COALESCE(SUM(movimenti_magazzino.variazione), 0), 0)::bigint AS giacenza
                        FROM public.prodotti AS prodotti
                        LEFT JOIN movimenti_magazzino
                            ON movimenti_magazzino.prodotto_id = prodotti.id
                           AND movimenti_magazzino.salone_id = prodotti.salone_id
                        WHERE prodotti.id = $1
                          AND prodotti.salone_id = $2
                        GROUP BY prodotti.id;
                    `,
                    [prodottoId, saloneId]
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
                          AND salone_id = $2
                          AND attivo = TRUE;
                    `,
                    [servizioId, saloneId]
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
                    INSERT INTO public.vendite (salone_id, cliente_id, data_vendita, note)
                    VALUES ($1, $2, $3::date, $4)
                    RETURNING id;
                `,
                [saloneId, dati.clienteId, dati.dataVendita, dati.note]
            );

            const venditaId = vendita.rows[0].id;

            for (const riga of dati.righe) {
                if (riga.tipo === "prodotto") {
                    const prodotto = catalogoProdotti.get(riga.elementoId);

                    await client.query(
                        `
                            INSERT INTO public.righe_vendita
                                (salone_id, vendita_id, prodotto_id, servizio_id, quantita, prezzo_unitario)
                            VALUES ($1, $2, $3, NULL, $4, $5);
                        `,
                        [saloneId, venditaId, riga.elementoId, riga.quantita, prodotto.prezzo]
                    );
                } else {
                    const servizio = catalogoServizi.get(riga.elementoId);

                    await client.query(
                        `
                            INSERT INTO public.righe_vendita
                                (salone_id, vendita_id, prodotto_id, servizio_id, quantita, prezzo_unitario)
                            VALUES ($1, $2, NULL, $3, $4, $5);
                        `,
                        [saloneId, venditaId, riga.elementoId, riga.quantita, servizio.prezzo]
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
        request.method === "DELETE" &&
        /^\/api\/vendite\/\d+$/.test(request.url)
    ) {
        const venditaId = Number(request.url.split("/").pop());

        if (!idInteroValido(venditaId)) {
            rispondiJson(response, 400, { errore: "L'ID della vendita non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const righe = await client.query(
                    `DELETE FROM public.righe_vendita WHERE salone_id = $1 AND vendita_id = $2 RETURNING id;`,
                    [saloneId, venditaId]
                );
                const vendita = await client.query(
                    `DELETE FROM public.vendite WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                    [saloneId, venditaId]
                );

                if (vendita.rowCount === 0) {
                    throw new ErroreRichiesta("La vendita richiesta non esiste.", 404);
                }

                return { id: venditaId, righeCancellate: righe.rowCount };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare la vendita.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/acquisti\/\d+$/.test(request.url)
    ) {
        const acquistoId = Number(request.url.split("/").pop());

        if (!idInteroValido(acquistoId)) {
            rispondiJson(response, 400, { errore: "L'ID dell'acquisto non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const acquistoEsistente = await client.query(
                    `SELECT id FROM public.acquisti WHERE salone_id = $1 AND id = $2;`,
                    [saloneId, acquistoId]
                );

                if (acquistoEsistente.rowCount === 0) {
                    throw new ErroreRichiesta("L'acquisto richiesto non esiste.", 404);
                }

                const righe = await client.query(
                    `DELETE FROM public.righe_acquisto WHERE salone_id = $1 AND acquisto_id = $2 RETURNING id;`,
                    [saloneId, acquistoId]
                );
                const acquisto = await client.query(
                    `DELETE FROM public.acquisti WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                    [saloneId, acquistoId]
                );

                if (acquisto.rowCount === 0) {
                    throw new ErroreRichiesta("L'acquisto richiesto non esiste più.", 404);
                }

                return { id: acquistoId, righeCancellate: righe.rowCount };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare l'acquisto.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/righe-vendita\/\d+$/.test(request.url)
    ) {
        const rigaId = Number(request.url.split("/").pop());

        if (!idInteroValido(rigaId)) {
            rispondiJson(response, 400, { errore: "L'ID della riga di vendita non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const riga = await client.query(
                    `DELETE FROM public.righe_vendita WHERE salone_id = $1 AND id = $2 RETURNING vendita_id;`,
                    [saloneId, rigaId]
                );

                if (riga.rowCount === 0) {
                    throw new ErroreRichiesta("La riga di vendita richiesta non esiste.", 404);
                }

                const venditaId = riga.rows[0].vendita_id;
                const restanti = await client.query(
                    `SELECT COUNT(*)::integer AS conteggio FROM public.righe_vendita WHERE salone_id = $1 AND vendita_id = $2;`,
                    [saloneId, venditaId]
                );
                let testataCancellata = false;

                if (Number(restanti.rows[0].conteggio) === 0) {
                    const vendita = await client.query(
                        `DELETE FROM public.vendite WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                        [saloneId, venditaId]
                    );
                    testataCancellata = vendita.rowCount === 1;
                }

                return { id: rigaId, venditaId, testataCancellata };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare la riga di vendita.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/righe-acquisto\/\d+$/.test(request.url)
    ) {
        const rigaId = Number(request.url.split("/").pop());

        if (!idInteroValido(rigaId)) {
            rispondiJson(response, 400, { errore: "L'ID della riga di acquisto non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const rigaDaRimuovere = await client.query(
                    `
                        SELECT id, acquisto_id, prodotto_id, quantita
                        FROM public.righe_acquisto
                        WHERE salone_id = $1
                          AND id = $2;
                    `,
                    [saloneId, rigaId]
                );

                if (rigaDaRimuovere.rowCount === 0) {
                    throw new ErroreRichiesta("La riga di acquisto richiesta non esiste.", 404);
                }

                const riga = rigaDaRimuovere.rows[0];
                const acquistoId = riga.acquisto_id;

                const cancellata = await client.query(
                    `DELETE FROM public.righe_acquisto WHERE salone_id = $1 AND id = $2 RETURNING acquisto_id;`,
                    [saloneId, rigaId]
                );

                if (cancellata.rowCount === 0) {
                    throw new ErroreRichiesta("La riga di acquisto richiesta non esiste più.", 404);
                }

                const restanti = await client.query(
                    `SELECT COUNT(*)::integer AS conteggio FROM public.righe_acquisto WHERE salone_id = $1 AND acquisto_id = $2;`,
                    [saloneId, acquistoId]
                );
                let testataCancellata = false;

                if (Number(restanti.rows[0].conteggio) === 0) {
                    const acquisto = await client.query(
                        `DELETE FROM public.acquisti WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                        [saloneId, acquistoId]
                    );
                    testataCancellata = acquisto.rowCount === 1;
                }

                return { id: rigaId, acquistoId, testataCancellata };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare la riga di acquisto.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/prodotti\/\d+$/.test(request.url)
    ) {
        const prodottoId = Number(request.url.split("/").pop());

        if (!idInteroValido(prodottoId)) {
            rispondiJson(response, 400, { errore: "L'ID del prodotto non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const collegamenti = await client.query(
                    `
                        SELECT
                            (SELECT COUNT(*) FROM public.righe_acquisto WHERE salone_id = $1 AND prodotto_id = $2)::integer AS acquisti,
                            (SELECT COUNT(*) FROM public.righe_vendita WHERE salone_id = $1 AND prodotto_id = $2)::integer AS vendite,
                            (SELECT COUNT(*) FROM public.rettifiche_magazzino WHERE salone_id = $1 AND prodotto_id = $2)::integer AS rettifiche;
                    `,
                    [saloneId, prodottoId]
                );
                const collegamento = collegamenti.rows[0];

                if (Number(collegamento.acquisti) > 0 || Number(collegamento.vendite) > 0 || Number(collegamento.rettifiche) > 0) {
                    throw new ErroreRichiesta(
                        `Il prodotto è collegato a ${collegamento.acquisti} acquisti, ${collegamento.vendite} vendite e ${collegamento.rettifiche} rettifiche: rimuovi prima le operazioni collegate.`,
                        409
                    );
                }

                const prodotto = await client.query(
                    `DELETE FROM public.prodotti WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                    [saloneId, prodottoId]
                );

                if (prodotto.rowCount === 0) {
                    throw new ErroreRichiesta("Il prodotto richiesto non esiste.", 404);
                }

                return { id: prodottoId };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare il prodotto.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/servizi\/\d+$/.test(request.url)
    ) {
        const servizioId = Number(request.url.split("/").pop());

        if (!idInteroValido(servizioId)) {
            rispondiJson(response, 400, { errore: "L'ID del servizio non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const collegamenti = await client.query(
                    `SELECT COUNT(*)::integer AS vendite FROM public.righe_vendita WHERE salone_id = $1 AND servizio_id = $2;`,
                    [saloneId, servizioId]
                );

                if (Number(collegamenti.rows[0].vendite) > 0) {
                    throw new ErroreRichiesta(
                        "Il servizio è collegato a vendite esistenti: rimuovi prima le righe di vendita collegate.",
                        409
                    );
                }

                const servizio = await client.query(
                    `DELETE FROM public.servizi WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                    [saloneId, servizioId]
                );

                if (servizio.rowCount === 0) {
                    throw new ErroreRichiesta("Il servizio richiesto non esiste.", 404);
                }

                return { id: servizioId };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare il servizio.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/clienti\/\d+$/.test(request.url)
    ) {
        const clienteId = Number(request.url.split("/").pop());

        if (!idInteroValido(clienteId)) {
            rispondiJson(response, 400, { errore: "L'ID della cliente non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const collegamenti = await client.query(
                    `SELECT COUNT(*)::integer AS vendite FROM public.vendite WHERE salone_id = $1 AND cliente_id = $2;`,
                    [saloneId, clienteId]
                );

                if (Number(collegamenti.rows[0].vendite) > 0) {
                    throw new ErroreRichiesta(
                        "La cliente è collegata a vendite esistenti: rimuovi prima le vendite collegate.",
                        409
                    );
                }

                const cliente = await client.query(
                    `DELETE FROM public.clienti WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                    [saloneId, clienteId]
                );

                if (cliente.rowCount === 0) {
                    throw new ErroreRichiesta("La cliente richiesta non esiste.", 404);
                }

                return { id: clienteId };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare la cliente.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/fornitori\/\d+$/.test(request.url)
    ) {
        const fornitoreId = Number(request.url.split("/").pop());

        if (!idInteroValido(fornitoreId)) {
            rispondiJson(response, 400, { errore: "L'ID del fornitore non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const collegamenti = await client.query(
                    `SELECT COUNT(*)::integer AS acquisti FROM public.acquisti WHERE salone_id = $1 AND fornitore_id = $2;`,
                    [saloneId, fornitoreId]
                );

                if (Number(collegamenti.rows[0].acquisti) > 0) {
                    throw new ErroreRichiesta(
                        "Il fornitore è collegato ad acquisti esistenti: rimuovi prima gli acquisti collegati.",
                        409
                    );
                }

                const fornitore = await client.query(
                    `DELETE FROM public.fornitori WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                    [saloneId, fornitoreId]
                );

                if (fornitore.rowCount === 0) {
                    throw new ErroreRichiesta("Il fornitore richiesto non esiste.", 404);
                }

                return { id: fornitoreId };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare il fornitore.");
        }
    } else if (
        request.method === "DELETE" &&
        /^\/api\/rettifiche-magazzino\/\d+$/.test(request.url)
    ) {
        const rettificaId = Number(request.url.split("/").pop());

        if (!idInteroValido(rettificaId)) {
            rispondiJson(response, 400, { errore: "L'ID della rettifica non è valido." });
            return;
        }

        try {
            const risultato = await eseguiTransazione(async (client) => {
                const rettifica = await client.query(
                    `DELETE FROM public.rettifiche_magazzino WHERE salone_id = $1 AND id = $2 RETURNING id;`,
                    [saloneId, rettificaId]
                );

                if (rettifica.rowCount === 0) {
                    throw new ErroreRichiesta("La rettifica richiesta non esiste.", 404);
                }

                return { id: rettificaId };
            });

            rispondiJson(response, 200, risultato);
        } catch (errore) {
            rispondiErroreOperazione(response, errore, "Impossibile cancellare la rettifica.");
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
