//funzioni che fanno query e passano alle tabelle corrispettive
let prodottiPerVendita = [];
let serviziPerVendita = [];
let righeVendita = [];
let prodottiPerAcquisto = [];
let righeAcquisto = [];
const paginaLogin = window.location.pathname === "/login";
const paginaHome = ["/", "/index.html"].includes(window.location.pathname);
let sessioneCorrente = null;

const percorsiSezioni = new Set([
    "/",
    "/magazzino",
    "/conteggio-iniziale",
    "/acquisti",
    "/vendite",
    "/clienti",
    "/prodotti",
    "/servizi",
    "/fornitori"
]);

let shellApplicazione = null;
let caricamentoSezioneInCorso = false;
const limiteTestoCella = 35;
let tooltipCellaTabella = null;
let popupCellaTabella = null;
let elementoPrimaDelPopup = null;
let popupAzioniTabella = null;
let elementoPrimaDelPopupAzioni = null;
const LIMITE_LISTE = 10;
const statiListe = new Map();

function normalizzaRispostaLista(risultato) {
    if (Array.isArray(risultato)) {
        return {
            elementi: risultato,
            paginazione: {
                pagina: 1,
                limite: risultato.length || LIMITE_LISTE,
                totale: risultato.length,
                pagine: 1
            }
        };
    }

    return {
        elementi: Array.isArray(risultato?.elementi) ? risultato.elementi : [],
        paginazione: risultato?.paginazione || {
            pagina: 1,
            limite: LIMITE_LISTE,
            totale: 0,
            pagine: 0
        }
    };
}

function configuraListaPaginata(idCorpo, segnaposto, ricarica) {
    let stato = statiListe.get(idCorpo);

    if (!stato) {
        stato = {
            pagina: 1,
            ricerca: "",
            richiesta: 0,
            ricarica
        };
        statiListe.set(idCorpo, stato);
    } else {
        stato.ricarica = ricarica;
    }

    let controlli = document.querySelector(`[data-paginazione="${idCorpo}"]`);

    if (!controlli) {
        const corpo = document.getElementById(idCorpo);
        const contenitoreTabella = corpo?.closest(".tabella-scroll, .tabella-gestione-scroll");

        if (!corpo || !contenitoreTabella) {
            return stato;
        }

        controlli = document.createElement("div");
        controlli.className = "controlli-lista";
        controlli.dataset.paginazione = idCorpo;

        const campo = document.createElement("div");
        campo.className = "campo-ricerca-lista";
        const label = document.createElement("label");
        const input = document.createElement("input");
        const idRicerca = `${idCorpo}-ricerca`;
        label.htmlFor = idRicerca;
        label.textContent = "Cerca";
        input.type = "search";
        input.id = idRicerca;
        input.placeholder = segnaposto;
        input.autocomplete = "off";
        input.value = stato.ricerca;
        campo.append(label, input);

        const riepilogo = document.createElement("span");
        riepilogo.className = "riepilogo-paginazione";
        riepilogo.setAttribute("aria-live", "polite");

        const azioni = document.createElement("div");
        azioni.className = "azioni-paginazione";
        const precedente = document.createElement("button");
        precedente.type = "button";
        precedente.className = "pulsante-secondario";
        precedente.textContent = "Precedente";
        const successiva = document.createElement("button");
        successiva.type = "button";
        successiva.className = "pulsante-secondario";
        successiva.textContent = "Successiva";
        azioni.append(precedente, successiva);
        controlli.append(campo, riepilogo, azioni);
        contenitoreTabella.parentNode.insertBefore(controlli, contenitoreTabella);

        let timerRicerca = null;
        input.addEventListener("input", () => {
            window.clearTimeout(timerRicerca);
            timerRicerca = window.setTimeout(() => {
                stato.ricerca = input.value.trim();
                stato.pagina = 1;
                stato.ricarica();
            }, 250);
        });
        precedente.addEventListener("click", () => {
            if (stato.pagina > 1) {
                stato.pagina -= 1;
                stato.ricarica();
            }
        });
        successiva.addEventListener("click", () => {
            const pagine = Number(stato.pagine || 1);
            if (stato.pagina < pagine) {
                stato.pagina += 1;
                stato.ricarica();
            }
        });
    }

    return stato;
}

function urlListaPaginata(percorso, stato) {
    const parametri = new URLSearchParams({
        page: String(stato.pagina),
        limit: String(LIMITE_LISTE)
    });

    if (stato.ricerca) {
        parametri.set("search", stato.ricerca);
    }

    return `${percorso}?${parametri.toString()}`;
}

function dataLocaleISO() {
    const oggi = new Date();
    const anno = oggi.getFullYear();
    const mese = String(oggi.getMonth() + 1).padStart(2, "0");
    const giorno = String(oggi.getDate()).padStart(2, "0");
    return `${anno}-${mese}-${giorno}`;
}

function inizializzaDataVendita() {
    const campo = document.querySelector("#data-vendita");

    if (campo && campo.value === "") {
        campo.value = dataLocaleISO();
    }
}

function formattaDataSenzaConversione(valore) {
    if (typeof valore === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valore)) {
        const [anno, mese, giorno] = valore.slice(0, 10).split("-");
        return `${giorno}/${mese}/${anno}`;
    }

    return new Date(valore).toLocaleDateString("it-IT");
}

function aggiornaControlliLista(idCorpo, paginazione, stato) {
    const controlli = document.querySelector(`[data-paginazione="${idCorpo}"]`);

    if (!controlli) {
        return true;
    }

    const totale = Number(paginazione.totale) || 0;
    const pagine = Number(paginazione.pagine) || 0;

    if (totale === 0 && stato.pagina > 1) {
        stato.pagina -= 1;
        stato.ricarica();
        return false;
    }

    if (pagine > 0 && stato.pagina > pagine) {
        stato.pagina = pagine;
        stato.ricarica();
        return false;
    }

    stato.pagine = pagine;
    const primo = totale === 0 ? 0 : ((stato.pagina - 1) * LIMITE_LISTE) + 1;
    const ultimo = totale === 0 ? 0 : Math.min(stato.pagina * LIMITE_LISTE, totale);
    controlli.querySelector(".riepilogo-paginazione").textContent =
        `${primo}–${ultimo} di ${totale} risultati`;
    controlli.querySelector("button").disabled = stato.pagina <= 1;
    controlli.querySelectorAll("button")[1].disabled = pagine === 0 || stato.pagina >= pagine;
    return true;
}

async function caricaTutteLePagine(percorso, ricerca = "") {
    const elementi = [];
    let pagina = 1;

    while (true) {
        const stato = { pagina, ricerca };
        const risposta = await fetchDati(urlListaPaginata(percorso, stato));
        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`);
        }

        const dati = normalizzaRispostaLista(risultato);
        elementi.push(...dati.elementi);

        if (pagina >= Number(dati.paginazione.pagine || 1) || dati.elementi.length === 0) {
            return elementi;
        }

        pagina += 1;
    }
}

function leggiCookie(nome) {
    const voce = document.cookie
        .split(";")
        .map((parte) => parte.trim())
        .find((parte) => parte.startsWith(`${nome}=`));

    if (!voce) {
        return null;
    }

    return decodeURIComponent(voce.slice(nome.length + 1));
}

function mostraBarraSessione(sessione) {
    if (!sessione || paginaLogin || document.querySelector("#barra-sessione")) {
        return;
    }

    const barra = document.createElement("div");
    barra.id = "barra-sessione";
    barra.className = "barra-sessione";

    const informazioni = document.createElement("span");
    informazioni.textContent = `${sessione.utente.nome} — ${sessione.saloneAttivo.nome}`;

    aggiornaNomeSaloneVisibile(sessione);

    const controlli = document.createElement("div");
    controlli.className = "controlli-sessione";

    if (sessione.saloni.length > 1) {
        const selettore = document.createElement("select");
        selettore.id = "salone-attivo";
        selettore.setAttribute("aria-label", "Salone attivo");

        for (const salone of sessione.saloni) {
            const opzione = document.createElement("option");
            opzione.value = salone.id;
            opzione.textContent = `${salone.nome} (${salone.ruolo})`;
            opzione.selected = salone.id === sessione.saloneAttivo.id;
            selettore.appendChild(opzione);
        }

        selettore.addEventListener("change", async () => {
            try {
                const risposta = await fetchDati("/api/sessione/salone", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ saloneId: Number(selettore.value) })
                });

                const risultato = await risposta.json().catch(() => ({}));

                if (!risposta.ok) {
                    throw new Error(risultato.errore || "Cambio salone non riuscito.");
                }

                window.location.reload();
            } catch (errore) {
                window.alert(errore.message);
                selettore.value = String(sessione.saloneAttivo.id);
            }
        });

        controlli.appendChild(selettore);
    }

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "pulsante-secondario";
    logout.textContent = "Esci";
    logout.addEventListener("click", async () => {
        try {
            const risposta = await fetchDati("/api/logout", { method: "POST" });

            if (!risposta.ok) {
                const risultato = await risposta.json().catch(() => ({}));
                throw new Error(risultato.errore || "Logout non riuscito.");
            }

            window.location.href = "/login";
        } catch (errore) {
            window.alert(errore.message);
        }
    });
    controlli.appendChild(logout);

    barra.append(informazioni, controlli);
    document.body.prepend(barra);
}

function aggiornaNomeSaloneVisibile(sessione = sessioneCorrente) {
    const nomeSalone = sessione?.saloneAttivo?.nome;

    if (!nomeSalone) {
        return;
    }

    for (const elemento of document.querySelectorAll(".soprattitolo")) {
        elemento.textContent = nomeSalone;
    }
}

async function inizializzaSessione() {
    try {
        const risposta = await fetch("/api/sessione", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (risposta.status === 401) {
            const ritorno = encodeURIComponent(window.location.pathname);
            window.location.replace(`/login?ritorno=${ritorno}`);
            throw new Error("Sessione non valida.");
        }

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(risultato.errore || "Impossibile verificare la sessione.");
        }

        sessioneCorrente = risultato;
        mostraBarraSessione(risultato);
        return risultato;
    } catch (errore) {
        console.error("Errore nella verifica della sessione:", errore);
        throw errore;
    }
}

const sessionePronta = paginaLogin
    ? Promise.resolve(null)
    : inizializzaSessione();

function aggiungiCampoConteggio(riga, configurazione) {
    const campo = document.createElement("div");
    campo.className = "campo-gestione";

    const id = `conteggio-${configurazione.nome}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = configurazione.etichetta;

    const input = document.createElement("input");
    input.type = configurazione.tipo || "text";
    input.id = id;
    input.name = configurazione.nome;
    input.dataset.campoConteggio = configurazione.nome;
    input.required = true;

    if (configurazione.tipo === "number") {
        input.min = configurazione.min;
        input.max = configurazione.max;
        input.step = configurazione.step;
        input.value = configurazione.valore;
    }

    if (configurazione.facoltativo) {
        input.required = false;
    }

    campo.append(label, input);
    riga.appendChild(campo);
}

function creaRigaConteggioIniziale() {
    const contenitore = document.querySelector("#righe-conteggio-iniziale");

    if (!contenitore) {
        return;
    }

    const riga = document.createElement("fieldset");
    riga.className = "riga-conteggio";

    const titolo = document.createElement("legend");
    titolo.textContent = `Prodotto ${contenitore.children.length + 1}`;
    riga.appendChild(titolo);

    aggiungiCampoConteggio(riga, {
        nome: "nome",
        etichetta: "Nome",
        facoltativo: false
    });
    aggiungiCampoConteggio(riga, {
        nome: "marca",
        etichetta: "Marca (facoltativa)",
        facoltativo: true
    });
    aggiungiCampoConteggio(riga, {
        nome: "prezzoVendita",
        etichetta: "Prezzo di vendita",
        tipo: "number",
        min: "0",
        max: "99999999.99",
        step: "0.01",
        valore: ""
    });
    aggiungiCampoConteggio(riga, {
        nome: "sogliaRiordino",
        etichetta: "Soglia di riordino",
        tipo: "number",
        min: "0",
        max: "2147483647",
        step: "1",
        valore: "0"
    });
    aggiungiCampoConteggio(riga, {
        nome: "quantitaContata",
        etichetta: "Quantità contata fisicamente",
        tipo: "number",
        min: "1",
        max: "2147483647",
        step: "1",
        valore: ""
    });

    const azioni = document.createElement("div");
    azioni.className = "azioni-riga-conteggio";
    const rimuovi = document.createElement("button");
    rimuovi.type = "button";
    rimuovi.className = "pulsante-tabella pulsante-cancella";
    rimuovi.textContent = "Rimuovi";
    rimuovi.addEventListener("click", () => {
        riga.remove();

        if (contenitore.children.length === 0) {
            creaRigaConteggioIniziale();
        }

        [...contenitore.children].forEach((elemento, indice) => {
            elemento.querySelector("legend").textContent = `Prodotto ${indice + 1}`;
        });
    });
    azioni.appendChild(rimuovi);
    riga.appendChild(azioni);
    contenitore.appendChild(riga);
}

function leggiRigheConteggioIniziale() {
    return [...document.querySelectorAll(".riga-conteggio")].map((riga) => ({
        nome: riga.querySelector('[data-campo-conteggio="nome"]').value.trim(),
        marca: riga.querySelector('[data-campo-conteggio="marca"]').value.trim() || null,
        prezzoVendita: Number(riga.querySelector('[data-campo-conteggio="prezzoVendita"]').value),
        sogliaRiordino: Number(riga.querySelector('[data-campo-conteggio="sogliaRiordino"]').value),
        quantitaContata: Number(riga.querySelector('[data-campo-conteggio="quantitaContata"]').value)
    }));
}

function chiaveProdottoClient(nome, marca) {
    return `${nome.trim().toLowerCase()}\u0000${(marca || "").trim().toLowerCase()}`;
}

async function gestisciFormConteggioIniziale(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const messaggio = document.querySelector("#messaggio-conteggio-iniziale");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const righe = leggiRigheConteggioIniziale();
    const chiavi = new Set();

    for (const riga of righe) {
        const chiave = chiaveProdottoClient(riga.nome, riga.marca);

        if (chiavi.has(chiave)) {
            messaggio.textContent = `Il prodotto "${riga.nome}" con la stessa marca è ripetuto nel conteggio.`;
            return;
        }

        chiavi.add(chiave);
    }

    try {
        const risposta = await fetchDati("/api/giacenze-iniziali", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ righe })
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();
        document.querySelector("#righe-conteggio-iniziale").replaceChildren();
        creaRigaConteggioIniziale();
        messaggio.textContent = `Conteggio iniziale salvato: ${risultato.prodotti.length} prodotti.`;
    } catch (errore) {
        console.error("Errore nel salvataggio del conteggio iniziale:", errore);
        messaggio.textContent = errore.message === "Failed to fetch"
            ? "Impossibile contattare il server."
            : errore.message;
    }
}

function fetchDati(url, opzioni = {}) {
    return sessionePronta.then(() => {
        const metodo = (opzioni.method || "GET").toUpperCase();
        const headers = new Headers(opzioni.headers || {});

        if (["POST", "PUT", "PATCH", "DELETE"].includes(metodo)) {
            const csrfToken = leggiCookie("gestionale_csrf");

            if (csrfToken) {
                headers.set("X-CSRF-Token", csrfToken);
            }
        }

        return fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...opzioni,
            headers
        });
    });
}

async function caricaDatiMagazzino() {
    const corpoTabella = document.querySelector("#corpo-magazzino");
    const contatore = document.querySelector("#conteggio-riordino");
    const stato = configuraListaPaginata(
        "corpo-magazzino",
        "prodotto o marca",
        caricaDatiMagazzino
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/magazzino", stato));

        if (!risposta.ok) {
            throw new Error(`Richiesta fallita: HTTP ${risposta.status}`);
        }

        const dati = normalizzaRispostaLista(await risposta.json());
        if (richiesta !== stato.richiesta) {
            return;
        }
        if (!aggiornaControlliLista("corpo-magazzino", dati.paginazione, stato)) {
            return;
        }
        const prodotti = dati.elementi;

        if (document.querySelector("#prodotto-rettifica")) {
            popolaProdottiRettifica(await caricaTutteLePagine("/api/magazzino"));
        }

        const prodottiDaRiordinare = prodotti.filter((prodotto) => {
            return Number(prodotto.giacenza) <= Number(prodotto.soglia_riordino);
        });

        if (contatore) {
            contatore.textContent = prodottiDaRiordinare.length;
        }

        if (!corpoTabella) {
            return;
        }

        corpoTabella.replaceChildren();

        if (prodotti.length === 0) {
            const riga = document.createElement("tr");
            const cella = document.createElement("td");

            cella.colSpan = 6;
            cella.textContent = "Non ci sono prodotti registrati.";

            riga.appendChild(cella);
            corpoTabella.appendChild(riga);
            return;
        }

        const formatoEuro = new Intl.NumberFormat("it-IT", {
            style: "currency",
            currency: "EUR"
        });

        for (const prodotto of prodotti) {
            const riga = document.createElement("tr");

            const prodottoDaRiordinare =
                Number(prodotto.giacenza) <= Number(prodotto.soglia_riordino);

            let stato = "Disponibile";

            if (prodottoDaRiordinare) {
                stato = "Da riordinare";
                riga.classList.add("prodotto-da-riordinare");
            }

            const valori = [
                prodotto.nome,
                prodotto.marca,
                prodotto.giacenza,
                prodotto.soglia_riordino,
                formatoEuro.format(Number(prodotto.prezzo_vendita)),
                stato
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore ?? "";
                riga.appendChild(cella);
            }

            corpoTabella.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento del magazzino:", errore);

        if (contatore) {
            contatore.textContent = "—";
        }

        if (corpoTabella) {
            corpoTabella.replaceChildren();

            const riga = document.createElement("tr");
            const cella = document.createElement("td");

            cella.colSpan = 6;
            cella.textContent = "Impossibile caricare il magazzino.";

            riga.appendChild(cella);
            corpoTabella.appendChild(riga);
        }

        popolaProdottiRettifica([]);
    }
}

function popolaProdottiRettifica(prodotti) {
    const select = document.querySelector("#prodotto-rettifica");

    if (!select) {
        return;
    }

    select.replaceChildren();

    if (prodotti.length === 0) {
        aggiungiOpzione(select, "", "Nessun prodotto registrato");
        select.disabled = true;
        return;
    }

    select.disabled = false;
    aggiungiOpzione(select, "", "Seleziona un prodotto");

    for (const prodotto of prodotti) {
        const descrizione = prodotto.marca
            ? `${prodotto.nome} — ${prodotto.marca}`
            : prodotto.nome;
        aggiungiOpzione(select, prodotto.id, descrizione);
    }
}

async function caricaRettificheMagazzino() {
    const corpo = document.querySelector("#corpo-rettifiche-magazzino");

    if (!corpo) {
        return;
    }

    const stato = configuraListaPaginata(
        "corpo-rettifiche-magazzino",
        "prodotto o motivo",
        caricaRettificheMagazzino
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/rettifiche-magazzino", stato));
        const risultato = normalizzaRispostaLista(await risposta.json().catch(() => ({})));

        if (!risposta.ok) {
            throw new Error(risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`);
        }

        if (richiesta !== stato.richiesta || !aggiornaControlliLista("corpo-rettifiche-magazzino", risultato.paginazione, stato)) {
            return;
        }

        chiudiPopupAzioni();
        corpo.replaceChildren();

        if (risultato.elementi.length === 0) {
            mostraErroreTabella("#corpo-rettifiche-magazzino", 5, "Non ci sono rettifiche registrate.");
            return;
        }

        for (const rettifica of risultato.elementi) {
            const riga = document.createElement("tr");
            const valori = [
                new Date(rettifica.data_movimento).toLocaleDateString("it-IT"),
                rettifica.prodotto,
                rettifica.quantita_variazione,
                rettifica.motivo || "—"
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore ?? "";
                riga.appendChild(cella);
            }

            const pulsanteCancella = creaPulsanteCancellazione("Cancella", async () => {
                await cancellaRisorsa(
                    `/api/rettifiche-magazzino/${rettifica.id}`,
                    `Vuoi cancellare definitivamente la rettifica di ${rettifica.quantita_variazione} unità per "${rettifica.prodotto}"? La giacenza verrà ricalcolata.`,
                    null,
                    async () => {
                        await caricaDatiMagazzino();
                        await caricaRettificheMagazzino();
                    }
                );
            });
            riga.appendChild(creaCellaAzioniPopup(
                `rettifica di ${rettifica.prodotto}`,
                [pulsanteCancella]
            ));
            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento delle rettifiche:", errore);
        mostraErroreTabella("#corpo-rettifiche-magazzino", 5, errore.message);
    }
}


async function caricaClienti() {
    const corpoTabella = document.querySelector("#corpo-clienti");
    const stato = configuraListaPaginata(
        "corpo-clienti",
        "nome, cognome o note",
        caricaClienti
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/clienti", stato));

        if (!risposta.ok) {
            throw new Error(`Richiesta fallita: HTTP ${risposta.status}`);
        }

        const dati = normalizzaRispostaLista(await risposta.json());
        if (richiesta !== stato.richiesta || !aggiornaControlliLista("corpo-clienti", dati.paginazione, stato)) {
            return;
        }
        const clienti = dati.elementi;

        chiudiPopupAzioni();
        corpoTabella.replaceChildren();

        if (clienti.length === 0) {
            const riga = document.createElement("tr");
            const cella = document.createElement("td");

            cella.colSpan = 5;
            cella.textContent = "Non ci sono clienti registrate.";

            riga.appendChild(cella);
            corpoTabella.appendChild(riga);
            return;
        }

        for (const cliente of clienti) {
            const riga = document.createElement("tr");

            const cellaNome = document.createElement("td");
            const collegamento = document.createElement("a");

            collegamento.href = `/clienti/${cliente.id}`;
            collegamento.className = "link-cliente";
            collegamento.textContent = cliente.nome;
            cellaNome.appendChild(collegamento);
            riga.appendChild(cellaNome);

            const valori = [
                cliente.cognome,
                cliente.note || "—",
                new Date(cliente.creata_il).toLocaleDateString("it-IT")
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore ?? "";
                riga.appendChild(cella);
            }

            const pulsanteCancella = creaPulsanteCancellazione("Cancella", async () => {
                await cancellaRisorsa(
                    `/api/clienti/${cliente.id}`,
                    `Vuoi cancellare definitivamente la cliente "${cliente.nome} ${cliente.cognome}"?`,
                    document.querySelector("#messaggio-cancellazione-cliente"),
                    caricaClienti
                );
            });
            riga.appendChild(creaCellaAzioniPopup(
                `cliente ${cliente.nome} ${cliente.cognome}`,
                [pulsanteCancella]
            ));

            corpoTabella.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento delle clienti:", errore);

        corpoTabella.replaceChildren();

        const riga = document.createElement("tr");
        const cella = document.createElement("td");

        cella.colSpan = 5;
        cella.textContent = "Impossibile caricare le clienti.";

        riga.appendChild(cella);
        corpoTabella.appendChild(riga);
    }
}

async function caricaRiepilogoPanoramica() {
    const conteggioRiordino = document.querySelector("#conteggio-riordino");
    const totaleVendite = document.querySelector("#totale-vendite-mese");
    const totaleAcquisti = document.querySelector("#totale-acquisti-mese");
    const conteggioClienti = document.querySelector("#conteggio-clienti");
    const schedaRiordino = document.querySelector("#scheda-riordino");

    if (!conteggioRiordino && !totaleVendite && !totaleAcquisti && !conteggioClienti) {
        return;
    }

    try {
        const risposta = await fetchDati("/api/dashboard");

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const riepilogo = await risposta.json();

        if (conteggioRiordino) {
            const prodottiDaRiordinare = Number(riepilogo.prodotti_da_riordinare);

            conteggioRiordino.textContent = prodottiDaRiordinare;

            if (schedaRiordino) {
                schedaRiordino.classList.add("scheda-statistica-riordino");
            }
        }

        if (totaleVendite) {
            totaleVendite.textContent = formattaEuro(riepilogo.vendite_mese);
        }

        if (totaleAcquisti) {
            totaleAcquisti.textContent = formattaEuro(riepilogo.acquisti_mese);
        }

        if (conteggioClienti) {
            conteggioClienti.textContent = riepilogo.clienti_totali;
        }
    } catch (errore) {
        console.error("Errore nel caricamento del riepilogo:", errore);

        for (const elemento of [
            conteggioRiordino,
            totaleVendite,
            totaleAcquisti,
            conteggioClienti
        ]) {
            if (elemento) {
                elemento.textContent = "—";
            }
        }

        if (schedaRiordino) {
            schedaRiordino.classList.add("scheda-statistica-riordino");
        }
    }
}

async function caricaMovimentiRecenti() {
    const corpo = document.querySelector("#corpo-movimenti");

    if (!corpo) {
        return;
    }

    try {
        const risposta = await fetchDati("/api/movimenti-recenti");

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const movimenti = await risposta.json();
        corpo.replaceChildren();

        if (movimenti.length === 0) {
            mostraErroreTabella(
                "#corpo-movimenti",
                4,
                "Non ci sono ancora movimenti registrati."
            );
            return;
        }

        for (const movimento of movimenti) {
            const riga = document.createElement("tr");

            if (movimento.operazione === "Vendita") {
                riga.classList.add("movimento-vendita");
            } else if (movimento.operazione === "Acquisto") {
                riga.classList.add("movimento-acquisto");
            }

            const valori = [
                formattaDataSenzaConversione(movimento.data_movimento),
                movimento.operazione,
                movimento.soggetto,
                movimento.importo === null
                    ? "—"
                    : formattaEuro(movimento.importo)
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore;
                riga.appendChild(cella);
            }

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei movimenti recenti:", errore);
        mostraErroreTabella(
            "#corpo-movimenti",
            4,
            "Impossibile caricare gli ultimi movimenti."
        );
    }
}

async function caricaDettaglioCliente() {
    const clienteId = window.location.pathname.split("/").pop();
    const messaggio = document.querySelector("#messaggio-dettaglio-cliente");

    try {
        const risposta = await fetchDati(`/api/clienti/${clienteId}`);
        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const cliente = risultato.cliente;
        const titolo = document.querySelector("#titolo-cliente");
        const nome = `${cliente.nome} ${cliente.cognome}`;

        titolo.textContent = nome;
        document.title = `${nome} - Gestionale del salone`;
        document.querySelector("#dettaglio-nome").textContent = nome;
        document.querySelector("#dettaglio-note").textContent = cliente.note || "—";
        document.querySelector("#dettaglio-creata").textContent =
            new Date(cliente.creata_il).toLocaleDateString("it-IT");

        const corpo = document.querySelector("#corpo-vendite-cliente");
        corpo.replaceChildren();

        if (risultato.vendite.length === 0) {
            mostraErroreTabella(
                "#corpo-vendite-cliente",
                4,
                "Questa cliente non ha ancora vendite associate."
            );
            return;
        }

        for (const vendita of risultato.vendite) {
            const riga = document.createElement("tr");
            const elementi = vendita.righe.map((elemento) => {
                return `${elemento.elemento} × ${elemento.quantita}`;
            }).join(", ");

            const valori = [
                formattaDataSenzaConversione(vendita.data_vendita),
                elementi || "—",
                vendita.note || "—",
                formattaEuro(vendita.totale)
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore;
                riga.appendChild(cella);
            }

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento del dettaglio cliente:", errore);

        if (messaggio) {
            messaggio.textContent = errore.message;
        }

        mostraErroreTabella(
            "#corpo-vendite-cliente",
            4,
            "Impossibile caricare le vendite della cliente."
        );
    }
}

async function gestisciFormCliente(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const messaggio = document.querySelector("#messaggio-cliente");

    const nuovaCliente = {
        nome: form.elements.nome.value.trim(),
        cognome: form.elements.cognome.value.trim(),
        note: form.elements.note.value.trim()
    };

    try {
        const risposta = await fetchDati("/api/clienti", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nuovaCliente)
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();

        if (messaggio) {
            messaggio.textContent = "Cliente salvata.";
        }

        await caricaClienti();
    } catch (errore) {
        console.error("Errore nel salvataggio della cliente:", errore);

        if (messaggio) {
            messaggio.textContent = "Impossibile salvare la cliente.";
        }
    }
}

function mostraErroreTabella(idCorpo, colonne, testo) {
    const corpo = document.querySelector(idCorpo);

    if (!corpo) {
        return;
    }

    corpo.replaceChildren();

    const riga = document.createElement("tr");
    const cella = document.createElement("td");

    cella.colSpan = colonne;
    cella.className = "tabella-vuota";
    cella.textContent = testo;

    riga.appendChild(cella);
    corpo.appendChild(riga);
}

function formattaEuro(valore) {
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    }).format(Number(valore));
}

function creaPulsanteCancellazione(testo, gestore) {
    const pulsante = document.createElement("button");
    pulsante.type = "button";
    pulsante.textContent = testo;
    pulsante.className = "pulsante-tabella pulsante-cancella";
    pulsante.addEventListener("click", gestore);
    return pulsante;
}

function chiudiPopupAzioni() {
    if (!popupAzioniTabella) {
        return;
    }

    const { popup, contenitore, pulsanti } = popupAzioniTabella;
    pulsanti.forEach((pulsante) => contenitore.appendChild(pulsante));
    popup.remove();
    popupAzioniTabella = null;
    document.body.classList.remove("popup-azioni-aperta");

    if (
        elementoPrimaDelPopupAzioni instanceof HTMLElement &&
        document.contains(elementoPrimaDelPopupAzioni)
    ) {
        elementoPrimaDelPopupAzioni.focus();
    }

    elementoPrimaDelPopupAzioni = null;
}

function apriPopupAzioni(titoloContesto, contenitore, pulsanteApertura) {
    chiudiPopupCella();
    chiudiPopupAzioni();

    const popup = document.createElement("div");
    const pannello = document.createElement("section");
    const intestazione = document.createElement("div");
    const titolo = document.createElement("h2");
    const chiudi = document.createElement("button");
    const azioni = document.createElement("div");
    const pulsanti = Array.from(contenitore.querySelectorAll("button"));

    popup.className = "popup-azioni-tabella";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-labelledby", "titolo-popup-azioni-tabella");

    pannello.className = "popup-azioni-tabella-pannello";
    intestazione.className = "popup-azioni-tabella-intestazione";
    titolo.id = "titolo-popup-azioni-tabella";
    titolo.textContent = `Azioni: ${titoloContesto}`;
    chiudi.type = "button";
    chiudi.className = "popup-azioni-tabella-chiudi";
    chiudi.textContent = "Chiudi";
    chiudi.setAttribute("aria-label", "Chiudi le azioni del record");
    azioni.className = "popup-azioni-tabella-elenco";

    pulsanti.forEach((pulsante) => azioni.appendChild(pulsante));

    chiudi.addEventListener("click", chiudiPopupAzioni);
    popup.addEventListener("click", (evento) => {
        if (evento.target === popup) {
            chiudiPopupAzioni();
        }
    });
    popup.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            evento.preventDefault();
            chiudiPopupAzioni();
            return;
        }

        if (evento.key !== "Tab") {
            return;
        }

        const elementiFocalizzabili = [
            chiudi,
            ...azioni.querySelectorAll("button:not(:disabled)")
        ];
        const primo = elementiFocalizzabili[0];
        const ultimo = elementiFocalizzabili[elementiFocalizzabili.length - 1];

        if (evento.shiftKey && document.activeElement === primo) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primo.focus();
        }
    });

    intestazione.append(titolo, chiudi);
    pannello.append(intestazione, azioni);
    popup.appendChild(pannello);
    document.body.appendChild(popup);

    popupAzioniTabella = { popup, contenitore, pulsanti };
    elementoPrimaDelPopupAzioni = pulsanteApertura;
    document.body.classList.add("popup-azioni-aperta");
    chiudi.focus();
}

function creaCellaAzioniPopup(titoloContesto, pulsanti) {
    const cella = document.createElement("td");
    const modifica = document.createElement("button");
    const contenitore = document.createElement("div");

    modifica.type = "button";
    modifica.className = "pulsante-tabella pulsante-modifica";
    modifica.textContent = "Modifica";
    modifica.setAttribute("aria-haspopup", "dialog");
    modifica.setAttribute("aria-label", `Apri le azioni: ${titoloContesto}`);

    contenitore.className = "azioni-tabella-nascoste";
    contenitore.hidden = true;
    contenitore.append(...pulsanti);

    modifica.addEventListener("click", () => {
        apriPopupAzioni(titoloContesto, contenitore, modifica);
    });

    cella.append(modifica, contenitore);
    return cella;
}

async function cancellaRisorsa(url, testoConferma, messaggio, aggiorna) {
    if (!window.confirm(testoConferma)) {
        return false;
    }

    try {
        const risposta = await fetchDati(url, { method: "DELETE" });
        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`);
        }

        if (messaggio) {
            messaggio.textContent = "Cancellazione completata.";
        }

        if (aggiorna) {
            await aggiorna(risultato);
        }

        return true;
    } catch (errore) {
        console.error("Errore nella cancellazione:", errore);

        if (messaggio) {
            messaggio.textContent = errore.message;
        } else {
            window.alert(errore.message);
        }

        return false;
    }
}

async function caricaGestioneProdotti() {
    const corpo = document.querySelector("#corpo-prodotti");
    const messaggio = document.querySelector("#messaggio-prodotto");
    const stato = configuraListaPaginata(
        "corpo-prodotti",
        "nome o marca",
        caricaGestioneProdotti
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/prodotti", stato));

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const dati = normalizzaRispostaLista(await risposta.json());
        if (richiesta !== stato.richiesta || !aggiornaControlliLista("corpo-prodotti", dati.paginazione, stato)) {
            return;
        }
        const prodotti = dati.elementi;
        chiudiPopupAzioni();
        corpo.replaceChildren();

        if (prodotti.length === 0) {
            mostraErroreTabella(
                "#corpo-prodotti",
                6,
                "Non ci sono prodotti registrati."
            );
            return;
        }

        for (const prodotto of prodotti) {
            const riga = document.createElement("tr");
            const valori = [
                prodotto.nome,
                prodotto.marca || "—",
                formattaEuro(prodotto.prezzo_vendita),
                prodotto.soglia_riordino,
                prodotto.giacenza
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore ?? "";
                riga.appendChild(cella);
            }

            const pulsanteCancella = creaPulsanteCancellazione("Cancella", async () => {
                await cancellaRisorsa(
                    `/api/prodotti/${prodotto.id}`,
                    `Vuoi cancellare definitivamente il prodotto "${prodotto.nome}"? Puoi farlo solo se non è collegato a movimenti.`,
                    messaggio,
                    caricaGestioneProdotti
                );
            });
            riga.appendChild(creaCellaAzioniPopup(
                `prodotto ${prodotto.nome}`,
                [pulsanteCancella]
            ));

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei prodotti:", errore);
        mostraErroreTabella(
            "#corpo-prodotti",
            6,
            "Impossibile caricare i prodotti."
        );

        if (messaggio) {
            messaggio.textContent = errore.message;
        }
    }
}

async function gestisciFormProdotto(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const messaggio = document.querySelector("#messaggio-prodotto");
    const nuovoProdotto = {
        nome: form.elements.nome.value.trim(),
        marca: form.elements.marca.value.trim() || null,
        prezzoVendita: Number(form.elements.prezzoVendita.value),
        sogliaRiordino: Number(form.elements.sogliaRiordino.value)
    };

    try {
        const risposta = await fetchDati("/api/prodotti", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nuovoProdotto)
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();
        messaggio.textContent = "Prodotto salvato.";
        await caricaGestioneProdotti();
    } catch (errore) {
        console.error("Errore nel salvataggio del prodotto:", errore);
        messaggio.textContent = errore.message;
    }
}

async function gestisciFormRettificaMagazzino(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const select = form.elements.prodottoId;
    const quantita = Number(form.elements.quantitaVariazione.value);
    const motivo = form.elements.motivo.value.trim();
    const messaggio = document.querySelector("#messaggio-rettifica-magazzino");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (!Number.isInteger(quantita) || quantita === 0) {
        messaggio.textContent = "La quantità della rettifica deve essere un intero diverso da zero.";
        return;
    }

    const prodotto = select.options[select.selectedIndex]?.textContent || "prodotto selezionato";

    if (!window.confirm(
        `Registrare la rettifica per ${prodotto}?\n\nVariazione: ${quantita > 0 ? "+" : ""}${quantita}\nMotivo: ${motivo}`
    )) {
        return;
    }

    try {
        const risposta = await fetchDati("/api/rettifiche-magazzino", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prodottoId: Number(select.value),
                quantitaVariazione: quantita,
                motivo
            })
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();
        messaggio.textContent = "Rettifica registrata.";
        await Promise.all([
            caricaDatiMagazzino(),
            caricaRettificheMagazzino()
        ]);
    } catch (errore) {
        console.error("Errore nel salvataggio della rettifica:", errore);
        messaggio.textContent = errore.message === "Failed to fetch"
            ? "Impossibile contattare il server."
            : errore.message;
    }
}

async function caricaGestioneServizi() {
    const corpo = document.querySelector("#corpo-servizi");
    const messaggio = document.querySelector("#messaggio-servizio");
    const stato = configuraListaPaginata(
        "corpo-servizi",
        "nome del servizio",
        caricaGestioneServizi
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/servizi-gestione", stato));

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const dati = normalizzaRispostaLista(await risposta.json());
        if (richiesta !== stato.richiesta || !aggiornaControlliLista("corpo-servizi", dati.paginazione, stato)) {
            return;
        }
        const servizi = dati.elementi;
        chiudiPopupAzioni();
        corpo.replaceChildren();

        if (servizi.length === 0) {
            mostraErroreTabella(
                "#corpo-servizi",
                4,
                "Non ci sono servizi registrati."
            );
            return;
        }

        for (const servizio of servizi) {
            const riga = document.createElement("tr");
            const valori = [
                servizio.nome,
                formattaEuro(servizio.prezzo),
                servizio.attivo ? "Attivo" : "Disattivato"
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore ?? "";
                riga.appendChild(cella);
            }

            const pulsanteCancella = creaPulsanteCancellazione("Cancella", async () => {
                await cancellaRisorsa(
                    `/api/servizi/${servizio.id}`,
                    `Vuoi cancellare definitivamente il servizio "${servizio.nome}"? Puoi farlo solo se non è collegato a vendite.`,
                    messaggio,
                    caricaGestioneServizi
                );
            });
            riga.appendChild(creaCellaAzioniPopup(
                `servizio ${servizio.nome}`,
                [pulsanteCancella]
            ));

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei servizi:", errore);
        mostraErroreTabella(
            "#corpo-servizi",
            4,
            "Impossibile caricare i servizi."
        );

        if (messaggio) {
            messaggio.textContent = errore.message;
        }
    }
}

async function gestisciFormServizio(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const messaggio = document.querySelector("#messaggio-servizio");
    const nuovoServizio = {
        nome: form.elements.nome.value.trim(),
        prezzo: Number(form.elements.prezzo.value)
    };

    try {
        const risposta = await fetchDati("/api/servizi-gestione", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nuovoServizio)
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();
        messaggio.textContent = "Servizio salvato.";
        await caricaGestioneServizi();
    } catch (errore) {
        console.error("Errore nel salvataggio del servizio:", errore);
        messaggio.textContent = errore.message;
    }
}

async function caricaGestioneFornitori() {
    const corpo = document.querySelector("#corpo-fornitori");
    const messaggio = document.querySelector("#messaggio-fornitore");
    const stato = configuraListaPaginata(
        "corpo-fornitori",
        "nome, telefono, email o note",
        caricaGestioneFornitori
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/fornitori", stato));

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const dati = normalizzaRispostaLista(await risposta.json());
        if (richiesta !== stato.richiesta || !aggiornaControlliLista("corpo-fornitori", dati.paginazione, stato)) {
            return;
        }
        const fornitori = dati.elementi;
        chiudiPopupAzioni();
        corpo.replaceChildren();

        if (fornitori.length === 0) {
            mostraErroreTabella(
                "#corpo-fornitori",
                6,
                "Non ci sono fornitori registrati."
            );
            return;
        }

        for (const fornitore of fornitori) {
            const riga = document.createElement("tr");
            const valori = [
                fornitore.nome,
                fornitore.telefono || "—",
                fornitore.email || "—",
                fornitore.note || "—",
                new Date(fornitore.creata_il).toLocaleDateString("it-IT")
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore;
                riga.appendChild(cella);
            }

            const pulsanteCancella = creaPulsanteCancellazione("Cancella", async () => {
                await cancellaRisorsa(
                    `/api/fornitori/${fornitore.id}`,
                    `Vuoi cancellare definitivamente il fornitore "${fornitore.nome}"? Puoi farlo solo se non è collegato ad acquisti.`,
                    messaggio,
                    caricaGestioneFornitori
                );
            });
            riga.appendChild(creaCellaAzioniPopup(
                `fornitore ${fornitore.nome}`,
                [pulsanteCancella]
            ));

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei fornitori:", errore);
        mostraErroreTabella(
            "#corpo-fornitori",
            6,
            "Impossibile caricare i fornitori."
        );

        if (messaggio) {
            messaggio.textContent = errore.message;
        }
    }
}

async function gestisciFormFornitore(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const messaggio = document.querySelector("#messaggio-fornitore");
    const nuovoFornitore = {
        nome: form.elements.nome.value.trim(),
        telefono: form.elements.telefono.value.trim() || null,
        email: form.elements.email.value.trim() || null,
        note: form.elements.note.value.trim() || null
    };

    try {
        const risposta = await fetchDati("/api/fornitori", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nuovoFornitore)
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();
        messaggio.textContent = "Fornitore salvato.";
        await caricaGestioneFornitori();
    } catch (errore) {
        console.error("Errore nel salvataggio del fornitore:", errore);
        messaggio.textContent = errore.message;
    }
}

async function caricaFornitoriPerAcquisto() {
    const selectFornitore = document.querySelector("#fornitore-acquisto");

    if (!selectFornitore) {
        return;
    }

    const fornitori = await caricaTutteLePagine("/api/fornitori");
    selectFornitore.replaceChildren();
    aggiungiOpzione(selectFornitore, "", "Seleziona un fornitore");

    for (const fornitore of fornitori) {
        aggiungiOpzione(selectFornitore, fornitore.id, fornitore.nome);
    }

    selectFornitore.disabled = fornitori.length === 0;
}

async function caricaProdottiPerAcquisto() {
    const selectProdotto = document.querySelector("#prodotto-acquisto");

    if (!selectProdotto) {
        return;
    }

    prodottiPerAcquisto = await caricaTutteLePagine("/api/prodotti");
    selectProdotto.replaceChildren();
    aggiungiOpzione(selectProdotto, "", "Seleziona un prodotto");

    for (const prodotto of prodottiPerAcquisto) {
        const descrizione = prodotto.marca
            ? `${prodotto.nome} - ${prodotto.marca}`
            : prodotto.nome;

        aggiungiOpzione(selectProdotto, prodotto.id, descrizione);
    }

    selectProdotto.disabled = prodottiPerAcquisto.length === 0;
}

function mostraRigheAcquisto() {
    const corpoTabella = document.querySelector("#corpo-righe-acquisto");
    const totale = document.querySelector("#totale-acquisto");

    if (!corpoTabella || !totale) {
        return;
    }

    chiudiPopupAzioni();
    corpoTabella.replaceChildren();

    if (righeAcquisto.length === 0) {
        const riga = document.createElement("tr");
        const cella = document.createElement("td");

        cella.colSpan = 5;
        cella.className = "tabella-vuota";
        cella.textContent = "Aggiungi almeno un prodotto.";

        riga.appendChild(cella);
        corpoTabella.appendChild(riga);
        totale.textContent = formattaEuro(0);
        return;
    }

    let totaleAcquisto = 0;

    righeAcquisto.forEach((elemento, indice) => {
        const riga = document.createElement("tr");
        const subtotale = elemento.quantita * elemento.costoUnitario;

        totaleAcquisto += subtotale;

        const valori = [
            elemento.nome,
            elemento.quantita,
            formattaEuro(elemento.costoUnitario),
            formattaEuro(subtotale)
        ];

        for (const valore of valori) {
            const cella = document.createElement("td");
            cella.textContent = valore;
            riga.appendChild(cella);
        }

        const pulsanteRimuovi = document.createElement("button");

        pulsanteRimuovi.type = "button";
        pulsanteRimuovi.textContent = "Rimuovi";
        pulsanteRimuovi.className = "pulsante-tabella";
        pulsanteRimuovi.addEventListener("click", () => {
            righeAcquisto.splice(indice, 1);
            mostraRigheAcquisto();
        });

        riga.appendChild(creaCellaAzioniPopup(
            `riga acquisto ${elemento.nome}`,
            [pulsanteRimuovi]
        ));
        corpoTabella.appendChild(riga);
    });

    totale.textContent = formattaEuro(totaleAcquisto);
}

function aggiungiRigaAcquisto() {
    const selectProdotto = document.querySelector("#prodotto-acquisto");
    const quantitaInput = document.querySelector("#quantita-acquisto");
    const costoInput = document.querySelector("#costo-acquisto");
    const messaggio = document.querySelector("#messaggio-acquisto");
    const prodottoId = Number(selectProdotto.value);
    const quantita = Number(quantitaInput.value);
    const costoUnitario = Number(costoInput.value);

    if (!idNumericoValidoNelBrowser(prodottoId)) {
        messaggio.textContent = "Seleziona un prodotto.";
        return;
    }

    if (!Number.isInteger(quantita) || quantita < 1) {
        messaggio.textContent = "La quantità deve essere un numero intero maggiore di zero.";
        return;
    }

    if (
        costoInput.value === "" ||
        !Number.isFinite(costoUnitario) ||
        costoUnitario < 0
    ) {
        messaggio.textContent = "Il costo unitario deve essere un numero non negativo.";
        return;
    }

    const prodotto = prodottiPerAcquisto.find((elemento) => {
        return Number(elemento.id) === prodottoId;
    });

    if (!prodotto) {
        messaggio.textContent = "Il prodotto selezionato non è disponibile.";
        return;
    }

    righeAcquisto.push({
        prodottoId,
        nome: prodotto.marca ? `${prodotto.nome} - ${prodotto.marca}` : prodotto.nome,
        quantita,
        costoUnitario
    });

    selectProdotto.value = "";
    quantitaInput.value = "1";
    costoInput.value = "";
    messaggio.textContent = "Riga aggiunta all'acquisto.";
    mostraRigheAcquisto();
}

function idNumericoValidoNelBrowser(valore) {
    return Number.isSafeInteger(valore) && valore > 0;
}

async function caricaElencoAcquisti() {
    const corpo = document.querySelector("#corpo-acquisti");

    if (!corpo) {
        return;
    }

    const stato = configuraListaPaginata(
        "corpo-acquisti",
        "fornitore o prodotto",
        caricaElencoAcquisti
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/acquisti", stato));

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const dati = normalizzaRispostaLista(await risposta.json());
        if (richiesta !== stato.richiesta || !aggiornaControlliLista("corpo-acquisti", dati.paginazione, stato)) {
            return;
        }
        const acquisti = dati.elementi;
        chiudiPopupAzioni();
        corpo.replaceChildren();

        if (acquisti.length === 0) {
            mostraErroreTabella(
                "#corpo-acquisti",
                5,
                "Non ci sono acquisti registrati."
            );
            return;
        }

        for (const acquisto of acquisti) {
            const riga = document.createElement("tr");
            const valori = [
                new Date(acquisto.data_acquisto).toLocaleDateString("it-IT"),
                acquisto.fornitore,
                acquisto.righe.map((rigaAcquisto) => {
                    return `${rigaAcquisto.prodotto} × ${rigaAcquisto.quantita} (${formattaEuro(rigaAcquisto.costoUnitario)})`;
                }).join(", ") || "—",
                formattaEuro(acquisto.totale)
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore;
                riga.appendChild(cella);
            }

            const azioni = [];
            const messaggio = document.querySelector("#messaggio-acquisto");

            for (const rigaAcquisto of acquisto.righe) {
                const pulsante = creaPulsanteCancellazione(`Riga ${rigaAcquisto.prodotto}`, async () => {
                    await cancellaRisorsa(
                        `/api/righe-acquisto/${rigaAcquisto.id}`,
                        `Vuoi cancellare definitivamente la riga "${rigaAcquisto.prodotto}" (${rigaAcquisto.quantita} unità)? La giacenza verrà ricalcolata.`,
                        messaggio,
                        async (risultato) => {
                            await caricaElencoAcquisti();
                            await caricaProdottiPerAcquisto();
                            if (risultato.testataCancellata && messaggio) {
                                messaggio.textContent = "Era l'ultima riga: acquisto e riga cancellati.";
                            }
                        }
                    );
                });
                azioni.push(pulsante);
            }

            const pulsanteAcquisto = creaPulsanteCancellazione("Cancella acquisto", async () => {
                try {
                    await caricaProdottiPerAcquisto();
                } catch (errore) {
                    const messaggio = document.querySelector("#messaggio-acquisto");
                    if (messaggio) {
                        messaggio.textContent = "Impossibile aggiornare le giacenze: ricarica la pagina e riprova.";
                    }
                    return;
                }

                const quantitaPerProdotto = new Map();

                for (const rigaAcquisto of acquisto.righe) {
                    const quantita = quantitaPerProdotto.get(Number(rigaAcquisto.prodottoId)) || 0;
                    quantitaPerProdotto.set(
                        Number(rigaAcquisto.prodottoId),
                        quantita + Number(rigaAcquisto.quantita)
                    );
                }

                const effetti = [];
                for (const [prodottoId, quantita] of quantitaPerProdotto) {
                    const prodotto = prodottiPerAcquisto.find((elemento) => {
                        return Number(elemento.id) === prodottoId;
                    });

                    if (!prodotto) {
                        if (messaggio) {
                            messaggio.textContent = "Impossibile mostrare la giacenza aggiornata: ricarica i prodotti e riprova.";
                        }
                        return;
                    }

                    const giacenzaPrima = Number(prodotto.giacenza);
                    const giacenzaDopoCalcolata = giacenzaPrima - quantita;
                    const giacenzaDopo = Math.max(0, giacenzaDopoCalcolata);
                    const avviso = giacenzaDopoCalcolata < 0 ? " — verrà impostata a 0" : "";
                    effetti.push(`${prodotto.nome}: ${giacenzaPrima} → ${giacenzaDopo}${avviso}`);
                }

                await cancellaRisorsa(
                    `/api/acquisti/${acquisto.id}`,
                    `Cancellazione definitiva dell'acquisto del ${new Date(acquisto.data_acquisto).toLocaleDateString("it-IT")} da ${acquisto.fornitore}.\n\nEffetto sulla giacenza:\n- ${effetti.join("\n- ")}\n\nConfermi?`,
                    messaggio,
                    async () => {
                        await caricaElencoAcquisti();
                        await caricaProdottiPerAcquisto();
                    }
                );
            });
            azioni.push(pulsanteAcquisto);
            riga.appendChild(creaCellaAzioniPopup(
                `acquisto del ${new Date(acquisto.data_acquisto).toLocaleDateString("it-IT")} da ${acquisto.fornitore}`,
                azioni
            ));

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento degli acquisti:", errore);
        mostraErroreTabella(
            "#corpo-acquisti",
            5,
            "Impossibile caricare gli acquisti."
        );
    }
}

async function caricaDatiAcquisto() {
    const messaggio = document.querySelector("#messaggio-acquisto");

    try {
        await Promise.all([
            caricaFornitoriPerAcquisto(),
            caricaProdottiPerAcquisto(),
            caricaElencoAcquisti()
        ]);
        mostraRigheAcquisto();
    } catch (errore) {
        console.error("Errore nel caricamento dei dati di acquisto:", errore);

        if (messaggio) {
            messaggio.textContent = errore.message;
        }
    }
}

async function gestisciFormAcquisto(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const messaggio = document.querySelector("#messaggio-acquisto");

    if (righeAcquisto.length === 0) {
        messaggio.textContent = "Aggiungi almeno un prodotto.";
        return;
    }

    const acquisto = {
        fornitoreId: Number(form.elements.fornitoreId.value),
        dataAcquisto: form.elements.dataAcquisto.value || null,
        note: form.elements.note.value.trim() || null,
        righe: righeAcquisto.map((riga) => ({
            prodottoId: riga.prodottoId,
            quantita: riga.quantita,
            costoUnitario: riga.costoUnitario
        }))
    };

    try {
        const risposta = await fetchDati("/api/acquisti", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(acquisto)
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();
        righeAcquisto = [];
        mostraRigheAcquisto();
        messaggio.textContent = "Acquisto salvato.";
        await caricaElencoAcquisti();
    } catch (errore) {
        console.error("Errore nel salvataggio dell'acquisto:", errore);
        messaggio.textContent = errore.message === "Failed to fetch"
            ? "Impossibile contattare il server."
            : errore.message;
    }
}

async function caricaElencoVendite() {
    const corpo = document.querySelector("#corpo-vendite");

    if (!corpo) {
        return;
    }

    const stato = configuraListaPaginata(
        "corpo-vendite",
        "cliente, prodotto, servizio o note",
        caricaElencoVendite
    );
    const richiesta = ++stato.richiesta;

    try {
        const risposta = await fetchDati(urlListaPaginata("/api/vendite", stato));
        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`);
        }

        const dati = normalizzaRispostaLista(risultato);
        if (richiesta !== stato.richiesta || !aggiornaControlliLista("corpo-vendite", dati.paginazione, stato)) {
            return;
        }

        chiudiPopupAzioni();
        corpo.replaceChildren();

        if (dati.elementi.length === 0) {
            mostraErroreTabella("#corpo-vendite", 6, "Non ci sono vendite registrate.");
            return;
        }

        for (const vendita of dati.elementi) {
            const riga = document.createElement("tr");
            const valori = [
                formattaDataSenzaConversione(vendita.data_vendita),
                vendita.cliente || "Vendita senza cliente",
                vendita.righe.map((rigaVendita) => {
                    return `${rigaVendita.elemento} × ${rigaVendita.quantita} (${formattaEuro(rigaVendita.prezzoUnitario)})`;
                }).join(", ") || "—",
                formattaEuro(vendita.totale),
                vendita.note || "—"
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore;
                riga.appendChild(cella);
            }

            const azioni = [];
            const messaggio = document.querySelector("#messaggio-vendita");

            for (const rigaVendita of vendita.righe) {
                azioni.push(creaPulsanteCancellazione(`Riga ${rigaVendita.elemento}`, async () => {
                    await cancellaRisorsa(
                        `/api/righe-vendita/${rigaVendita.id}`,
                        `Vuoi cancellare definitivamente la riga "${rigaVendita.elemento}" (${rigaVendita.quantita} unità)? La giacenza verrà ricalcolata se è un prodotto.`,
                        messaggio,
                        async (risultatoCancellazione) => {
                            await caricaElencoVendite();
                            await caricaDatiVendita();
                            if (risultatoCancellazione.testataCancellata && messaggio) {
                                messaggio.textContent = "Era l'ultima riga: vendita e riga cancellate.";
                            }
                        }
                    );
                }));
            }

            azioni.push(creaPulsanteCancellazione("Cancella vendita", async () => {
                await cancellaRisorsa(
                    `/api/vendite/${vendita.id}`,
                    `Vuoi cancellare definitivamente la vendita del ${formattaDataSenzaConversione(vendita.data_vendita)}? Le righe saranno rimosse e la giacenza verrà ricalcolata.`,
                    messaggio,
                    async () => {
                        await caricaElencoVendite();
                        await caricaDatiVendita();
                    }
                );
            }));
            riga.appendChild(creaCellaAzioniPopup(
                `vendita del ${formattaDataSenzaConversione(vendita.data_vendita)}`,
                azioni
            ));
            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento delle vendite:", errore);
        mostraErroreTabella("#corpo-vendite", 6, "Impossibile caricare le vendite.");
    }
}

function aggiungiOpzione(select, valore, testo) {
    const opzione = document.createElement("option");
    opzione.value = valore;
    opzione.textContent = testo;
    select.appendChild(opzione);
    return opzione;
}

function aggiornaElencoElementi() {
    const tipo = document.querySelector("#tipo-elemento");
    const selectElemento = document.querySelector("#elemento-vendita");

    if (!tipo || !selectElemento) {
        return;
    }

    selectElemento.replaceChildren();

    let elementi;

    if (tipo.value === "prodotto") {
        elementi = prodottiPerVendita;
    } else {
        elementi = serviziPerVendita;
    }

    if (elementi.length === 0) {
        selectElemento.disabled = true;

        const testo =
            tipo.value === "prodotto"
                ? "Nessun prodotto disponibile"
                : "Nessun servizio attivo";

        aggiungiOpzione(selectElemento, "", testo);
        return;
    }

    selectElemento.disabled = false;
    aggiungiOpzione(selectElemento, "", "Seleziona un elemento");

    const formatoEuro = new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    });

    for (const elemento of elementi) {
        let prezzo;
        let descrizione;

        if (tipo.value === "prodotto") {
            prezzo = Number(elemento.prezzo_vendita);
            const giacenza = Number(elemento.giacenza);

            descrizione = elemento.marca
                ? `${elemento.nome} - ${elemento.marca}`
                : elemento.nome;

            descrizione += ` — ${formatoEuro.format(prezzo)}; giacenza: ${giacenza}`;

            if (giacenza <= 0) {
                descrizione += " (esaurito)";
            }
        } else {
            prezzo = Number(elemento.prezzo);
            descrizione = `${elemento.nome} — ${formatoEuro.format(prezzo)}`;
        }

        const opzione = aggiungiOpzione(selectElemento, elemento.id, descrizione);

        if (tipo.value === "prodotto" && Number(elemento.giacenza) <= 0) {
            opzione.disabled = true;
        }
    }
}

async function caricaDatiVendita() {
    const selectCliente = document.querySelector("#cliente-vendita");
    const messaggio = document.querySelector("#messaggio-vendita");

    try {
        const [clienti, prodotti, servizi] = await Promise.all([
            caricaTutteLePagine("/api/clienti"),
            caricaTutteLePagine("/api/magazzino"),
            caricaTutteLePagine("/api/servizi")
        ]);

        prodottiPerVendita = prodotti;
        serviziPerVendita = servizi;

        selectCliente.replaceChildren();
        aggiungiOpzione(selectCliente, "", "Nessuna cliente selezionata");

        for (const cliente of clienti) {
            aggiungiOpzione(
                selectCliente,
                cliente.id,
                `${cliente.nome} ${cliente.cognome}`
            );
        }

        aggiornaElencoElementi();
    } catch (errore) {
        console.error("Errore nel caricamento dei dati di vendita:", errore);

        if (messaggio) {
            messaggio.textContent =
                "Impossibile caricare clienti, prodotti o servizi.";
        }
    }
}
function mostraRigheVendita() {
    const corpoTabella = document.querySelector("#corpo-righe-vendita");
    const totale = document.querySelector("#totale-vendita");

    if (!corpoTabella || !totale) {
        return;
    }

    chiudiPopupAzioni();
    corpoTabella.replaceChildren();

    const formatoEuro = new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    });

    if (righeVendita.length === 0) {
        const riga = document.createElement("tr");
        const cella = document.createElement("td");

        cella.colSpan = 6;
        cella.className = "tabella-vuota";
        cella.textContent = "Aggiungi almeno un prodotto o servizio.";

        riga.appendChild(cella);
        corpoTabella.appendChild(riga);
        totale.textContent = formatoEuro.format(0);
        return;
    }

    let totaleVendita = 0;

    righeVendita.forEach((elemento, indice) => {
        const riga = document.createElement("tr");
        const subtotale = elemento.quantita * elemento.prezzoUnitario;

        totaleVendita += subtotale;

        const valori = [
            elemento.tipo === "prodotto" ? "Prodotto" : "Servizio",
            elemento.nome,
            elemento.quantita,
            formatoEuro.format(elemento.prezzoUnitario),
            formatoEuro.format(subtotale)
        ];

        for (const valore of valori) {
            const cella = document.createElement("td");
            cella.textContent = valore;
            riga.appendChild(cella);
        }

        const pulsanteRimuovi = document.createElement("button");

        pulsanteRimuovi.type = "button";
        pulsanteRimuovi.textContent = "Rimuovi";

        pulsanteRimuovi.addEventListener("click", () => {
            righeVendita.splice(indice, 1);
            mostraRigheVendita();
        });

        riga.appendChild(creaCellaAzioniPopup(
            `riga vendita ${elemento.nome}`,
            [pulsanteRimuovi]
        ));
        corpoTabella.appendChild(riga);
    });

    totale.textContent = formatoEuro.format(totaleVendita);
}

function aggiungiRigaVendita() {
    const tipo = document.querySelector("#tipo-elemento").value;
    const selectElemento = document.querySelector("#elemento-vendita");
    const quantitaInput = document.querySelector("#quantita-vendita");
    const messaggio = document.querySelector("#messaggio-vendita");

    const quantita = Number(quantitaInput.value);
    const idSelezionato = selectElemento.value;

    if (idSelezionato === "") {
        messaggio.textContent = "Seleziona prima un prodotto o un servizio.";
        return;
    }

    if (!Number.isInteger(quantita) || quantita < 1) {
        messaggio.textContent = "La quantità deve essere un numero intero maggiore di zero.";
        return;
    }

    let elementoSelezionato;

    if (tipo === "prodotto") {
        elementoSelezionato = prodottiPerVendita.find((prodotto) => {
            return String(prodotto.id) === idSelezionato;
        });
    } else {
        elementoSelezionato = serviziPerVendita.find((servizio) => {
            return String(servizio.id) === idSelezionato;
        });
    }

    if (!elementoSelezionato) {
        messaggio.textContent = "L’elemento selezionato non è disponibile.";
        return;
    }

    if (tipo === "prodotto") {
        const quantitaGiaAggiunta = righeVendita
            .filter((riga) => {
                return riga.tipo === "prodotto" &&
                    riga.elementoId === elementoSelezionato.id;
            })
            .reduce((somma, riga) => somma + riga.quantita, 0);

        const giacenzaDisponibile = Number(elementoSelezionato.giacenza);

        if (quantitaGiaAggiunta + quantita > giacenzaDisponibile) {
            messaggio.textContent =
                `Giacenza insufficiente. Disponibili: ${giacenzaDisponibile}.`;
            return;
        }
    }

    const prezzoUnitario =
        tipo === "prodotto"
            ? Number(elementoSelezionato.prezzo_vendita)
            : Number(elementoSelezionato.prezzo);

    righeVendita.push({
        tipo,
        elementoId: elementoSelezionato.id,
        nome: elementoSelezionato.nome,
        quantita,
        prezzoUnitario
    });

    quantitaInput.value = "1";
    messaggio.textContent = "Elemento aggiunto alla vendita.";
    mostraRigheVendita();
}

async function gestisciFormVendita(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const selectCliente = document.querySelector("#cliente-vendita");
    const messaggio = document.querySelector("#messaggio-vendita");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (righeVendita.length === 0) {
        messaggio.textContent = "Aggiungi almeno un prodotto o servizio.";
        return;
    }

    const vendita = {
        clienteId: selectCliente.value === ""
            ? null
            : Number(selectCliente.value),
        dataVendita: form.elements.dataVendita.value,
        note: form.elements.note.value.trim() || null,
        righe: righeVendita.map((riga) => ({
            tipo: riga.tipo,
            elementoId: Number(riga.elementoId),
            quantita: riga.quantita
        }))
    };

    try {
        const risposta = await fetchDati("/api/vendite", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(vendita)
        });

        const risultato = await risposta.json().catch(() => ({}));

        if (!risposta.ok) {
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        form.reset();
        inizializzaDataVendita();
        righeVendita = [];
        mostraRigheVendita();
        messaggio.textContent = "Vendita salvata.";

        await caricaDatiVendita();
    } catch (errore) {
        console.error("Errore nel salvataggio della vendita:", errore);

        messaggio.textContent = errore.message === "Failed to fetch"
            ? "Impossibile contattare il server."
            : errore.message;
    }
}

async function aggiornaDatiPaginaVisibile() {
    const aggiornamenti = [];

    if (document.querySelector("#corpo-magazzino")) {
        aggiornamenti.push(caricaDatiMagazzino());
    }

    if (document.querySelector("#corpo-rettifiche-magazzino")) {
        aggiornamenti.push(caricaRettificheMagazzino());
    }

    if (document.querySelector("#conteggio-riordino")) {
        aggiornamenti.push(caricaRiepilogoPanoramica());
    }

    if (document.querySelector("#corpo-movimenti")) {
        aggiornamenti.push(caricaMovimentiRecenti());
    }

    if (document.querySelector("#corpo-clienti")) {
        aggiornamenti.push(caricaClienti());
    }

    if (document.querySelector("#corpo-vendite-cliente")) {
        aggiornamenti.push(caricaDettaglioCliente());
    }

    if (document.querySelector("#corpo-prodotti")) {
        aggiornamenti.push(caricaGestioneProdotti());
    }

    if (document.querySelector("#corpo-servizi")) {
        aggiornamenti.push(caricaGestioneServizi());
    }

    if (document.querySelector("#corpo-fornitori")) {
        aggiornamenti.push(caricaGestioneFornitori());
    }

    if (document.querySelector("#form-acquisto")) {
        aggiornamenti.push(caricaDatiAcquisto());
    } else if (document.querySelector("#corpo-acquisti")) {
        aggiornamenti.push(caricaElencoAcquisti());
    }

    if (document.querySelector("#form-vendita")) {
        aggiornamenti.push(caricaDatiVendita());
    }

    if (document.querySelector("#corpo-vendite")) {
        aggiornamenti.push(caricaElencoVendite());
    }

    await Promise.allSettled(aggiornamenti);
}

window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) {
        aggiornaDatiPaginaVisibile();
    }
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        aggiornaDatiPaginaVisibile();
    }
});

function percorsoSezioneValido(percorso) {
    return percorsiSezioni.has(percorso) || /^\/clienti\/\d+$/.test(percorso);
}

function percorsoAttivo(percorso) {
    if (percorso === "/") {
        return paginaHome;
    }

    return percorso === "/clienti" && /^\/clienti\/\d+$/.test(window.location.pathname)
        ? true
        : window.location.pathname === percorso;
}

function creaSidebarApplicazione() {
    const sidebar = document.createElement("aside");
    sidebar.className = "dashboard-sidebar";
    sidebar.setAttribute("aria-label", "Navigazione gestionale");

    const brand = document.createElement("div");
    brand.className = "dashboard-brand";

    const brandMark = document.createElement("span");
    brandMark.className = "dashboard-brand-mark";
    brandMark.textContent = "K";

    const brandText = document.createElement("span");
    const brandName = document.createElement("strong");
    brandName.textContent = "KIND SQL";
    const brandDescription = document.createElement("small");
    brandDescription.textContent = "salone manager";
    brandText.append(brandName, brandDescription);
    brand.append(brandMark, brandText);

    const label = document.createElement("p");
    label.className = "dashboard-sidebar-label";
    label.textContent = "Workspace";

    const nav = document.createElement("nav");
    nav.className = "navigazione dashboard-navigation";
    nav.setAttribute("aria-label", "Sezioni del gestionale");

    const voci = [
        ["/", "⌂", "Panoramica"],
        ["/magazzino", "▦", "Magazzino"],
        ["/conteggio-iniziale", "#", "Conteggio iniziale"],
        ["/acquisti", "↙", "Acquisti"],
        ["/vendite", "↗", "Vendite"],
        ["/clienti", "♙", "Clienti"],
        ["/prodotti", "□", "Prodotti"],
        ["/servizi", "✦", "Servizi"],
        ["/fornitori", "⌁", "Fornitori"]
    ];

    for (const [percorso, simbolo, testo] of voci) {
        const link = document.createElement("a");
        link.href = percorso;
        link.className = "pulsante-sezione";
        link.dataset.percorso = percorso;

        if (percorsoAttivo(percorso)) {
            link.classList.add("attivo");
            link.setAttribute("aria-current", "page");
        }

        const icona = document.createElement("span");
        icona.className = "nav-icon";
        icona.setAttribute("aria-hidden", "true");
        icona.textContent = simbolo;

        const etichetta = document.createElement("span");
        etichetta.textContent = testo;
        link.append(icona, etichetta);
        nav.appendChild(link);
    }

    const stato = document.createElement("div");
    stato.className = "dashboard-sidebar-card";
    const statoTitolo = document.createElement("span");
    statoTitolo.className = "dashboard-sidebar-card-label";
    statoTitolo.textContent = "Stato applicazione";
    const statoValore = document.createElement("strong");
    statoValore.textContent = "LIVE";
    const statoNota = document.createElement("span");
    statoNota.className = "dashboard-sidebar-card-note";
    statoNota.textContent = "dati sincronizzati";
    stato.append(statoTitolo, statoValore, statoNota);

    sidebar.append(brand, label, nav, stato);
    return sidebar;
}

function aggiornaSezioneAttiva(percorso) {
    if (!shellApplicazione) {
        return;
    }

    for (const link of shellApplicazione.main.querySelectorAll(".dashboard-navigation .pulsante-sezione")) {
        const attivo = link.dataset.percorso === percorso ||
            (link.dataset.percorso === "/clienti" && /^\/clienti\/\d+$/.test(percorso));
        link.classList.toggle("attivo", attivo);

        if (attivo) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    }
}

function estraiContenutoPagina(html, percorso) {
    const documento = new DOMParser().parseFromString(html, "text/html");
    const main = documento.querySelector("main");

    if (!main || documento.querySelector("#form-login")) {
        throw new Error("La sezione richiesta non è disponibile nella sessione corrente.");
    }

    const navigazione = main.querySelector(":scope > nav.navigazione");
    if (navigazione) {
        navigazione.remove();
    }

    const frammento = document.createDocumentFragment();
    for (const figlio of [...main.children]) {
        frammento.appendChild(figlio);
    }

    return {
        frammento,
        titolo: documento.querySelector("title")?.textContent || "Gestionale del salone",
        percorso
    };
}

async function caricaSezioneApplicazione(percorso, opzioni = {}) {
    if (!shellApplicazione || !percorsoSezioneValido(percorso) || caricamentoSezioneInCorso) {
        return;
    }

    if (window.location.pathname === percorso && !opzioni.forza) {
        aggiornaSezioneAttiva(percorso);
        return;
    }

    caricamentoSezioneInCorso = true;
    shellApplicazione.main.setAttribute("aria-busy", "true");
    shellApplicazione.content.classList.add("dashboard-section-loading");

    try {
        const risposta = await fetch(percorso, {
            credentials: "same-origin",
            cache: "no-store",
            headers: { "X-Requested-With": "GestionaleSPA" }
        });

        if (!risposta.ok) {
            throw new Error(`Impossibile caricare la sezione: HTTP ${risposta.status}`);
        }

        const html = await risposta.text();
        const contenuto = estraiContenutoPagina(html, percorso);

        shellApplicazione.content.replaceChildren(contenuto.frammento);
        aggiornaNomeSaloneVisibile();
        shellApplicazione.main.classList.toggle("dashboard-home", percorso === "/");
        shellApplicazione.main.classList.toggle("dashboard-page-shell", percorso !== "/");
        document.title = contenuto.titolo;
        aggiornaSezioneAttiva(percorso);

        righeAcquisto = [];
        righeVendita = [];

        if (opzioni.aggiornaCronologia !== false) {
            window.history.pushState({ percorso }, "", percorso);
        }

        await inizializzaPaginaVisibile();
        window.scrollTo(0, 0);
    } catch (errore) {
        console.error("Errore nel cambio sezione:", errore);
        window.alert("Non è stato possibile aprire questa sezione. Riprova.");
    } finally {
        caricamentoSezioneInCorso = false;
        shellApplicazione.main.removeAttribute("aria-busy");
        shellApplicazione.content.classList.remove("dashboard-section-loading");
    }
}

function gestisciNavigazioneApplicazione(evento) {
    if (!(evento.target instanceof Element)) {
        return;
    }

    const link = evento.target.closest("a[href]");

    if (!link || link.target === "_blank" || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) {
        return;
    }

    const url = new URL(link.href, window.location.href);

    if (url.origin !== window.location.origin || !percorsoSezioneValido(url.pathname)) {
        return;
    }

    evento.preventDefault();
    caricaSezioneApplicazione(url.pathname);
}

function creaShellApplicazione() {
    if (paginaLogin || shellApplicazione) {
        return;
    }

    const main = document.querySelector("main");

    if (!main) {
        return;
    }

    const navigazione = main.querySelector(":scope > nav.navigazione");
    if (navigazione) {
        navigazione.remove();
    }

    const contenuto = document.createElement("div");
    contenuto.className = "dashboard-main-content";

    for (const figlio of [...main.children]) {
        contenuto.appendChild(figlio);
    }

    main.classList.add("dashboard-main");
    main.classList.add(paginaHome ? "dashboard-home" : "dashboard-page-shell");
    main.replaceChildren(creaSidebarApplicazione(), contenuto);
    main.addEventListener("click", gestisciNavigazioneApplicazione);

    shellApplicazione = { main, content: contenuto };
}

function inizializzaFormLogin() {
    const formLogin = document.querySelector("#form-login");

    if (!formLogin || formLogin.dataset.inizializzato === "true") {
        return;
    }

    formLogin.dataset.inizializzato = "true";
    formLogin.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const messaggio = document.querySelector("#messaggio-login");
        const pulsante = formLogin.querySelector("button[type=submit]");

        if (!formLogin.checkValidity()) {
            formLogin.reportValidity();
            return;
        }

        if (pulsante) {
            pulsante.disabled = true;
        }

        try {
            const risposta = await fetchDati("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nomeUtente: formLogin.elements.nomeUtente.value.trim(),
                    password: formLogin.elements.password.value
                })
            });

            const risultato = await risposta.json().catch(() => ({}));

            if (!risposta.ok) {
                throw new Error(risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`);
            }

            const ritorno = new URLSearchParams(window.location.search).get("ritorno");
            const destinazione = ritorno && ritorno.startsWith("/") && !ritorno.startsWith("//")
                ? ritorno
                : "/";

            window.location.replace(destinazione);
        } catch (errore) {
            if (messaggio) {
                messaggio.textContent = errore.message === "Failed to fetch"
                    ? "Impossibile contattare il server."
                    : errore.message;
            }
        } finally {
            if (pulsante) {
                pulsante.disabled = false;
            }
        }
    });
}

async function inizializzaPaginaVisibile() {
    const aggiornamenti = [];

    if (document.querySelector("#corpo-magazzino")) {
        aggiornamenti.push(caricaDatiMagazzino());
    }

    if (document.querySelector("#corpo-rettifiche-magazzino")) {
        aggiornamenti.push(caricaRettificheMagazzino());
    }

    if (document.querySelector("#conteggio-riordino")) {
        aggiornamenti.push(caricaRiepilogoPanoramica());
    }

    if (document.querySelector("#corpo-movimenti")) {
        aggiornamenti.push(caricaMovimentiRecenti());
    }

    if (document.querySelector("#corpo-clienti")) {
        aggiornamenti.push(caricaClienti());
    }

    if (document.querySelector("#corpo-vendite-cliente")) {
        aggiornamenti.push(caricaDettaglioCliente());
    }

    if (document.querySelector("#corpo-prodotti")) {
        aggiornamenti.push(caricaGestioneProdotti());
    }

    if (document.querySelector("#corpo-servizi")) {
        aggiornamenti.push(caricaGestioneServizi());
    }

    if (document.querySelector("#corpo-fornitori")) {
        aggiornamenti.push(caricaGestioneFornitori());
    }

    if (document.querySelector("#form-acquisto")) {
        const formAcquisto = document.querySelector("#form-acquisto");
        const pulsanteAggiungiRiga = document.querySelector("#aggiungi-riga-acquisto");
        const pulsanteAggiornaFornitori = document.querySelector("#aggiorna-fornitori");

        if (formAcquisto.dataset.inizializzato !== "true") {
            formAcquisto.dataset.inizializzato = "true";
            pulsanteAggiungiRiga?.addEventListener("click", aggiungiRigaAcquisto);
            pulsanteAggiornaFornitori?.addEventListener("click", async () => {
                const messaggio = document.querySelector("#messaggio-acquisto");

                try {
                    await caricaFornitoriPerAcquisto();
                    messaggio.textContent = "Elenco fornitori aggiornato.";
                } catch (errore) {
                    messaggio.textContent = errore.message;
                }
            });
            formAcquisto.addEventListener("submit", gestisciFormAcquisto);
        }

        aggiornamenti.push(caricaDatiAcquisto());
    } else if (document.querySelector("#corpo-acquisti")) {
        aggiornamenti.push(caricaElencoAcquisti());
    }

    if (document.querySelector("#form-vendita")) {
        const formVendita = document.querySelector("#form-vendita");
        const tipoElemento = document.querySelector("#tipo-elemento");
        const pulsanteAggiungi = document.querySelector("#aggiungi-riga");

        if (formVendita.dataset.inizializzato !== "true") {
            formVendita.dataset.inizializzato = "true";
            inizializzaDataVendita();
            tipoElemento?.addEventListener("change", aggiornaElencoElementi);
            pulsanteAggiungi?.addEventListener("click", aggiungiRigaVendita);
            formVendita.addEventListener("submit", gestisciFormVendita);
        }

        aggiornamenti.push(caricaDatiVendita());
    }

    if (document.querySelector("#corpo-vendite")) {
        aggiornamenti.push(caricaElencoVendite());
    }

    const formCliente = document.querySelector("#form-cliente");
    if (formCliente && formCliente.dataset.inizializzato !== "true") {
        formCliente.dataset.inizializzato = "true";
        formCliente.addEventListener("submit", gestisciFormCliente);
    }

    const formProdotto = document.querySelector("#form-prodotto");
    if (formProdotto && formProdotto.dataset.inizializzato !== "true") {
        formProdotto.dataset.inizializzato = "true";
        formProdotto.addEventListener("submit", gestisciFormProdotto);
    }

    const formRettificaMagazzino = document.querySelector("#form-rettifica-magazzino");
    if (formRettificaMagazzino && formRettificaMagazzino.dataset.inizializzato !== "true") {
        formRettificaMagazzino.dataset.inizializzato = "true";
        formRettificaMagazzino.addEventListener("submit", gestisciFormRettificaMagazzino);
    }

    const formConteggioIniziale = document.querySelector("#form-conteggio-iniziale");
    if (formConteggioIniziale && formConteggioIniziale.dataset.inizializzato !== "true") {
        formConteggioIniziale.dataset.inizializzato = "true";
        document.querySelector("#aggiungi-riga-conteggio")?.addEventListener(
            "click",
            creaRigaConteggioIniziale
        );
        creaRigaConteggioIniziale();
        formConteggioIniziale.addEventListener("submit", gestisciFormConteggioIniziale);
    }

    const formServizio = document.querySelector("#form-servizio");
    if (formServizio && formServizio.dataset.inizializzato !== "true") {
        formServizio.dataset.inizializzato = "true";
        formServizio.addEventListener("submit", gestisciFormServizio);
    }

    const formFornitore = document.querySelector("#form-fornitore");
    if (formFornitore && formFornitore.dataset.inizializzato !== "true") {
        formFornitore.dataset.inizializzato = "true";
        formFornitore.addEventListener("submit", gestisciFormFornitore);
    }

    await Promise.allSettled(aggiornamenti);
}

function cellaTabellaDaElemento(elemento) {
    if (!(elemento instanceof Element)) {
        return null;
    }

    return elemento.closest("td.cella-testo-lungo");
}

function testoCompletoCella(cella) {
    return cella?.dataset.testoCompleto || "";
}

function abilitaPopupCella(cella, testoCompleto) {
    if (cella.classList.contains("cella-testo-lungo")) {
        return;
    }

    cella.classList.add("cella-testo-lungo");
    cella.dataset.testoCompleto = testoCompleto;
    cella.dataset.tooltip = testoCompleto;
    cella.title = testoCompleto;
    cella.tabIndex = 0;
    cella.setAttribute("role", "button");
    cella.setAttribute("aria-haspopup", "dialog");
    cella.setAttribute("aria-label", `Visualizza il testo completo: ${testoCompleto}`);
}

function preparaCellaTabella(cella) {
    if (!(cella instanceof HTMLTableCellElement) || cella.dataset.cellaPreparata === "true") {
        return;
    }

    if (cella.classList.contains("tabella-vuota") || cella.colSpan > 1) {
        return;
    }

    if (cella.querySelector("button, input, select, textarea")) {
        return;
    }

    const testoOriginale = cella.textContent || "";
    const testoCompleto = testoOriginale.trim();

    if (!testoCompleto) {
        return;
    }

    const contenuto = document.createElement("span");
    contenuto.className = "contenuto-cella-tabella";

    while (cella.firstChild) {
        contenuto.appendChild(cella.firstChild);
    }

    cella.appendChild(contenuto);
    cella.dataset.cellaPreparata = "true";

    if (Array.from(testoCompleto).length > limiteTestoCella) {
        abilitaPopupCella(cella, testoCompleto);
        return;
    }

    requestAnimationFrame(() => {
        if (contenuto.scrollWidth > contenuto.clientWidth) {
            abilitaPopupCella(cella, testoCompleto);
        }
    });
}

function preparaCelleTabelle(radice = document) {
    const celle = [];

    if (radice instanceof HTMLTableCellElement) {
        celle.push(radice);
    } else if (radice?.querySelectorAll) {
        celle.push(...radice.querySelectorAll("td"));
    }

    celle.forEach(preparaCellaTabella);
}

function ottieniTooltipCella() {
    if (tooltipCellaTabella) {
        return tooltipCellaTabella;
    }

    tooltipCellaTabella = document.createElement("div");
    tooltipCellaTabella.id = "tooltip-cella-tabella";
    tooltipCellaTabella.className = "tooltip-cella-tabella";
    tooltipCellaTabella.setAttribute("role", "tooltip");
    tooltipCellaTabella.hidden = true;
    document.body.appendChild(tooltipCellaTabella);
    return tooltipCellaTabella;
}

function nascondiTooltipCella() {
    if (tooltipCellaTabella) {
        tooltipCellaTabella.hidden = true;
    }
}

function mostraTooltipCella(cella) {
    const testo = testoCompletoCella(cella);

    if (!testo) {
        return;
    }

    const tooltip = ottieniTooltipCella();
    const rettangolo = cella.getBoundingClientRect();

    tooltip.textContent = testo;
    tooltip.hidden = false;
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";

    const tooltipRettangolo = tooltip.getBoundingClientRect();
    const margine = 10;
    let sinistra = rettangolo.left;
    let alto = rettangolo.bottom + 8;

    if (sinistra + tooltipRettangolo.width > window.innerWidth - margine) {
        sinistra = window.innerWidth - tooltipRettangolo.width - margine;
    }

    if (alto + tooltipRettangolo.height > window.innerHeight - margine) {
        alto = rettangolo.top - tooltipRettangolo.height - 8;
    }

    tooltip.style.left = `${Math.max(margine, sinistra)}px`;
    tooltip.style.top = `${Math.max(margine, alto)}px`;
}

function chiudiPopupCella() {
    if (!popupCellaTabella || popupCellaTabella.hidden) {
        return;
    }

    popupCellaTabella.hidden = true;
    document.body.classList.remove("tabella-popup-aperta");
    nascondiTooltipCella();

    if (elementoPrimaDelPopup instanceof HTMLElement && document.contains(elementoPrimaDelPopup)) {
        elementoPrimaDelPopup.focus();
    }

    elementoPrimaDelPopup = null;
}

function ottieniPopupCella() {
    if (popupCellaTabella) {
        return popupCellaTabella;
    }

    const popup = document.createElement("div");
    const pannello = document.createElement("section");
    const intestazione = document.createElement("div");
    const titolo = document.createElement("h2");
    const chiudi = document.createElement("button");
    const contenuto = document.createElement("p");

    popup.id = "popup-cella-tabella";
    popup.className = "popup-cella-tabella";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-labelledby", "titolo-popup-cella-tabella");
    popup.hidden = true;

    pannello.className = "popup-cella-tabella-pannello";
    intestazione.className = "popup-cella-tabella-intestazione";
    titolo.id = "titolo-popup-cella-tabella";
    titolo.textContent = "Contenuto completo";
    chiudi.type = "button";
    chiudi.className = "popup-cella-tabella-chiudi";
    chiudi.textContent = "Chiudi";
    chiudi.setAttribute("aria-label", "Chiudi il contenuto completo");
    contenuto.className = "popup-cella-tabella-contenuto";

    chiudi.addEventListener("click", chiudiPopupCella);
    popup.addEventListener("click", (evento) => {
        if (evento.target === popup) {
            chiudiPopupCella();
        }
    });

    intestazione.append(titolo, chiudi);
    pannello.append(intestazione, contenuto);
    popup.appendChild(pannello);
    document.body.appendChild(popup);

    popupCellaTabella = popup;
    return popup;
}

function apriPopupCella(cella) {
    const testo = testoCompletoCella(cella);

    if (!testo) {
        return;
    }

    const popup = ottieniPopupCella();
    const contenuto = popup.querySelector(".popup-cella-tabella-contenuto");
    const chiudi = popup.querySelector(".popup-cella-tabella-chiudi");

    elementoPrimaDelPopup = document.activeElement;
    contenuto.textContent = testo;
    popup.hidden = false;
    document.body.classList.add("tabella-popup-aperta");
    nascondiTooltipCella();
    chiudi.focus();
}

function inizializzaGestoreTabelle() {
    if (!document.body || document.body.dataset.gestoreTabelle === "true") {
        return;
    }

    document.body.dataset.gestoreTabelle = "true";
    preparaCelleTabelle();

    document.addEventListener("pointerover", (evento) => {
        if (evento.pointerType && evento.pointerType !== "mouse") {
            return;
        }

        const cella = cellaTabellaDaElemento(evento.target);

        if (!cella || (evento.relatedTarget instanceof Node && cella.contains(evento.relatedTarget))) {
            return;
        }

        mostraTooltipCella(cella);
    });

    document.addEventListener("pointerout", (evento) => {
        const cella = cellaTabellaDaElemento(evento.target);

        if (cella && !(evento.relatedTarget instanceof Node && cella.contains(evento.relatedTarget))) {
            nascondiTooltipCella();
        }
    });

    document.addEventListener("focusin", (evento) => {
        const cella = cellaTabellaDaElemento(evento.target);

        if (cella) {
            mostraTooltipCella(cella);
        }
    });

    document.addEventListener("focusout", (evento) => {
        const cella = cellaTabellaDaElemento(evento.target);

        if (cella && !(evento.relatedTarget instanceof Node && cella.contains(evento.relatedTarget))) {
            nascondiTooltipCella();
        }
    });

    document.addEventListener("click", (evento) => {
        const elemento = evento.target;

        if (!(elemento instanceof Element) || elemento.closest("button, a, input, select, textarea")) {
            return;
        }

        const cella = cellaTabellaDaElemento(elemento);

        if (cella) {
            apriPopupCella(cella);
        }
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            chiudiPopupAzioni();
            chiudiPopupCella();
            return;
        }

        if (evento.key !== "Enter" && evento.key !== " ") {
            return;
        }

        const cella = cellaTabellaDaElemento(evento.target);

        if (cella) {
            evento.preventDefault();
            apriPopupCella(cella);
        }
    });

    const osservatoreTabelle = new MutationObserver((mutazioni) => {
        const contieneTabelle = mutazioni.some((mutazione) => {
            return [...mutazione.addedNodes].some((nodo) => {
                return nodo instanceof Element && (
                    nodo.matches("table, tbody, tr, td") ||
                    nodo.querySelector("table, tbody, tr, td")
                );
            });
        });

        if (contieneTabelle) {
            preparaCelleTabelle();
        }
    });

    osservatoreTabelle.observe(document.body, { childList: true, subtree: true });
}

function avviaApplicazione() {
    inizializzaGestoreTabelle();

    if (paginaLogin) {
        inizializzaFormLogin();
        return;
    }

    creaShellApplicazione();
    inizializzaPaginaVisibile();
}

window.addEventListener("popstate", () => {
    if (shellApplicazione && percorsoSezioneValido(window.location.pathname)) {
        caricaSezioneApplicazione(window.location.pathname, {
            aggiornaCronologia: false,
            forza: true
        });
    }
});

avviaApplicazione();
