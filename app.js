//funzioni che fanno query e passano alle tabelle corrispettive
let prodottiPerVendita = [];
let serviziPerVendita = [];
let righeVendita = [];
let prodottiPerAcquisto = [];
let righeAcquisto = [];
async function caricaDatiMagazzino() {
    const corpoTabella = document.querySelector("#corpo-magazzino");
    const contatore = document.querySelector("#conteggio-riordino");

    try {
        const risposta = await fetch("/api/magazzino");

        if (!risposta.ok) {
            throw new Error(`Richiesta fallita: HTTP ${risposta.status}`);
        }

        const prodotti = await risposta.json();

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
    }
}


async function caricaClienti() {
    const corpoTabella = document.querySelector("#corpo-clienti");

    try {
        const risposta = await fetch("/api/clienti");

        if (!risposta.ok) {
            throw new Error(`Richiesta fallita: HTTP ${risposta.status}`);
        }

        const clienti = await risposta.json();

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
                cliente.telefono || "—",
                cliente.note || "—",
                new Date(cliente.creata_il).toLocaleDateString("it-IT")
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore ?? "";
                riga.appendChild(cella);
            }

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
        const risposta = await fetch("/api/dashboard");

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
                schedaRiordino.classList.toggle(
                    "scheda-statistica-riordino",
                    prodottiDaRiordinare > 0
                );
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
            schedaRiordino.classList.remove("scheda-statistica-riordino");
        }
    }
}

async function caricaMovimentiRecenti() {
    const corpo = document.querySelector("#corpo-movimenti");

    if (!corpo) {
        return;
    }

    try {
        const risposta = await fetch("/api/movimenti-recenti");

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
                new Date(movimento.data_movimento).toLocaleDateString("it-IT"),
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
        const risposta = await fetch(`/api/clienti/${clienteId}`);
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
        document.querySelector("#dettaglio-telefono").textContent =
            cliente.telefono || "—";
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
                new Date(vendita.data_vendita).toLocaleDateString("it-IT"),
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
        telefono: form.elements.telefono.value.trim() || null,
        note: form.elements.note.value.trim()
    };

    try {
        const risposta = await fetch("/api/clienti", {
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

async function caricaGestioneProdotti() {
    const corpo = document.querySelector("#corpo-prodotti");
    const messaggio = document.querySelector("#messaggio-prodotto");

    try {
        const risposta = await fetch("/api/prodotti");

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const prodotti = await risposta.json();
        corpo.replaceChildren();

        if (prodotti.length === 0) {
            mostraErroreTabella(
                "#corpo-prodotti",
                5,
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

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei prodotti:", errore);
        mostraErroreTabella(
            "#corpo-prodotti",
            5,
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
        const risposta = await fetch("/api/prodotti", {
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

async function caricaGestioneServizi() {
    const corpo = document.querySelector("#corpo-servizi");
    const messaggio = document.querySelector("#messaggio-servizio");

    try {
        const risposta = await fetch("/api/servizi-gestione");

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const servizi = await risposta.json();
        corpo.replaceChildren();

        if (servizi.length === 0) {
            mostraErroreTabella(
                "#corpo-servizi",
                3,
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

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei servizi:", errore);
        mostraErroreTabella(
            "#corpo-servizi",
            3,
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
        const risposta = await fetch("/api/servizi-gestione", {
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

    try {
        const risposta = await fetch("/api/fornitori");

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const fornitori = await risposta.json();
        corpo.replaceChildren();

        if (fornitori.length === 0) {
            mostraErroreTabella(
                "#corpo-fornitori",
                5,
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

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei fornitori:", errore);
        mostraErroreTabella(
            "#corpo-fornitori",
            5,
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
        const risposta = await fetch("/api/fornitori", {
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

    const risposta = await fetch("/api/fornitori");

    if (!risposta.ok) {
        const risultato = await risposta.json().catch(() => ({}));
        throw new Error(
            risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
        );
    }

    const fornitori = await risposta.json();
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

    const risposta = await fetch("/api/prodotti");

    if (!risposta.ok) {
        const risultato = await risposta.json().catch(() => ({}));
        throw new Error(
            risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
        );
    }

    prodottiPerAcquisto = await risposta.json();
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

        const cellaAzione = document.createElement("td");
        const pulsanteRimuovi = document.createElement("button");

        pulsanteRimuovi.type = "button";
        pulsanteRimuovi.textContent = "Rimuovi";
        pulsanteRimuovi.className = "pulsante-tabella";
        pulsanteRimuovi.addEventListener("click", () => {
            righeAcquisto.splice(indice, 1);
            mostraRigheAcquisto();
        });

        cellaAzione.appendChild(pulsanteRimuovi);
        riga.appendChild(cellaAzione);
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

    try {
        const risposta = await fetch("/api/acquisti");

        if (!risposta.ok) {
            const risultato = await risposta.json().catch(() => ({}));
            throw new Error(
                risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
            );
        }

        const acquisti = await risposta.json();
        corpo.replaceChildren();

        if (acquisti.length === 0) {
            mostraErroreTabella(
                "#corpo-acquisti",
                3,
                "Non ci sono acquisti registrati."
            );
            return;
        }

        for (const acquisto of acquisti) {
            const riga = document.createElement("tr");
            const valori = [
                new Date(acquisto.data_acquisto).toLocaleDateString("it-IT"),
                acquisto.fornitore,
                formattaEuro(acquisto.totale)
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore;
                riga.appendChild(cella);
            }

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento degli acquisti:", errore);
        mostraErroreTabella(
            "#corpo-acquisti",
            3,
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
        const risposta = await fetch("/api/acquisti", {
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
        const risposte = await Promise.all([
            fetch("/api/clienti"),
            fetch("/api/magazzino"),
            fetch("/api/servizi")
        ]);

        for (const risposta of risposte) {
            if (!risposta.ok) {
                throw new Error(`Richiesta fallita: HTTP ${risposta.status}`);
            }
        }

        const [clienti, prodotti, servizi] = await Promise.all(
            risposte.map((risposta) => risposta.json())
        );

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

        const cellaAzione = document.createElement("td");
        const pulsanteRimuovi = document.createElement("button");

        pulsanteRimuovi.type = "button";
        pulsanteRimuovi.textContent = "Rimuovi";

        pulsanteRimuovi.addEventListener("click", () => {
            righeVendita.splice(indice, 1);
            mostraRigheVendita();
        });

        cellaAzione.appendChild(pulsanteRimuovi);
        riga.appendChild(cellaAzione);
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

    if (righeVendita.length === 0) {
        messaggio.textContent = "Aggiungi almeno un prodotto o servizio.";
        return;
    }

    const vendita = {
        clienteId: selectCliente.value === ""
            ? null
            : Number(selectCliente.value),
        note: form.elements.note.value.trim() || null,
        righe: righeVendita.map((riga) => ({
            tipo: riga.tipo,
            elementoId: Number(riga.elementoId),
            quantita: riga.quantita
        }))
    };

    try {
        const risposta = await fetch("/api/vendite", {
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

if (document.querySelector("#corpo-magazzino")) {
    caricaDatiMagazzino();
}

if (document.querySelector("#conteggio-riordino")) {
    caricaRiepilogoPanoramica();
}

if (document.querySelector("#corpo-movimenti")) {
    caricaMovimentiRecenti();
}

if (document.querySelector("#corpo-clienti")) {
    caricaClienti();
}

if (document.querySelector("#corpo-vendite-cliente")) {
    caricaDettaglioCliente();
}
const formCliente = document.querySelector("#form-cliente");

if (formCliente) {
    formCliente.addEventListener("submit", gestisciFormCliente);
}

const formProdotto = document.querySelector("#form-prodotto");

if (document.querySelector("#corpo-prodotti")) {
    caricaGestioneProdotti();
}

if (formProdotto) {
    formProdotto.addEventListener("submit", gestisciFormProdotto);
}

const formServizio = document.querySelector("#form-servizio");

if (document.querySelector("#corpo-servizi")) {
    caricaGestioneServizi();
}

if (formServizio) {
    formServizio.addEventListener("submit", gestisciFormServizio);
}

const formFornitore = document.querySelector("#form-fornitore");

if (document.querySelector("#corpo-fornitori")) {
    caricaGestioneFornitori();
}

if (formFornitore) {
    formFornitore.addEventListener("submit", gestisciFormFornitore);
}

const formAcquisto = document.querySelector("#form-acquisto");

if (formAcquisto) {
    const pulsanteAggiungiRiga = document.querySelector("#aggiungi-riga-acquisto");
    const pulsanteAggiornaFornitori = document.querySelector("#aggiorna-fornitori");

    pulsanteAggiungiRiga.addEventListener("click", aggiungiRigaAcquisto);
    pulsanteAggiornaFornitori.addEventListener("click", async () => {
        const messaggio = document.querySelector("#messaggio-acquisto");

        try {
            await caricaFornitoriPerAcquisto();
            messaggio.textContent = "Elenco fornitori aggiornato.";
        } catch (errore) {
            messaggio.textContent = errore.message;
        }
    });
    formAcquisto.addEventListener("submit", gestisciFormAcquisto);

    caricaDatiAcquisto();
}

const formVendita = document.querySelector("#form-vendita");

if (formVendita) {
    const tipoElemento = document.querySelector("#tipo-elemento");
    const pulsanteAggiungi = document.querySelector("#aggiungi-riga");

    tipoElemento.addEventListener("change", aggiornaElencoElementi);
    pulsanteAggiungi.addEventListener("click", aggiungiRigaVendita);
    formVendita.addEventListener("submit", gestisciFormVendita);

    caricaDatiVendita();
}
