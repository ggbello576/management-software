//funzioni che fanno query e passano alle tabelle corrispettive
let prodottiPerVendita = [];
let serviziPerVendita = [];
let righeVendita = [];
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

            cella.colSpan = 4;
            cella.textContent = "Non ci sono clienti registrate.";

            riga.appendChild(cella);
            corpoTabella.appendChild(riga);
            return;
        }

        for (const cliente of clienti) {
            const riga = document.createElement("tr");

            const valori = [
                cliente.nome,
                cliente.cognome,
                cliente.note,
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

        cella.colSpan = 4;
        cella.textContent = "Impossibile caricare le clienti.";

        riga.appendChild(cella);
        corpoTabella.appendChild(riga);
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
function aggiungiOpzione(select, valore, testo) {
    const opzione = document.createElement("option");
    opzione.value = valore;
    opzione.textContent = testo;
    select.appendChild(opzione);
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
        elementi = prodottiPerVendita.filter((prodotto) => {
            return Number(prodotto.giacenza) > 0;
        });
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

            descrizione = elemento.marca
                ? `${elemento.nome} - ${elemento.marca}`
                : elemento.nome;

            descrizione += ` — ${formatoEuro.format(prezzo)}; giacenza: ${elemento.giacenza}`;
        } else {
            prezzo = Number(elemento.prezzo);
            descrizione = `${elemento.nome} — ${formatoEuro.format(prezzo)}`;
        }

        aggiungiOpzione(selectElemento, elemento.id, descrizione);
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

if (
    document.querySelector("#corpo-magazzino") ||
    document.querySelector("#conteggio-riordino")
) {
    caricaDatiMagazzino();
}

if (document.querySelector("#corpo-clienti")) {
    caricaClienti();
}
const formCliente = document.querySelector("#form-cliente");

if (formCliente) {
    formCliente.addEventListener("submit", gestisciFormCliente);
}
const formVendita = document.querySelector("#form-vendita");

if (formVendita) {
    const tipoElemento = document.querySelector("#tipo-elemento");
    const pulsanteAggiungi = document.querySelector("#aggiungi-riga");

    tipoElemento.addEventListener("change", aggiornaElencoElementi);
    pulsanteAggiungi.addEventListener("click", aggiungiRigaVendita);

    caricaDatiVendita();
}