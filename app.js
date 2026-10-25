//funzioni che fanno query e passano alle tabelle corrispettive
let prodottiPerVendita = [];
let serviziPerVendita = [];
let righeVendita = [];
let prodottiPerAcquisto = [];
let righeAcquisto = [];
const paginaLogin = window.location.pathname === "/login";
const paginaHome = ["/", "/index.html"].includes(window.location.pathname);
let sessioneCorrente = null;
let valoriPanoramicaNascosti = false;

const percorsiSezioni = new Set([
    "/",
    "/magazzino",
    "/rettifiche-magazzino",
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
let popupModificaTabella = null;
let elementoPrimaDelPopupModifica = null;
const LIMITE_LISTE = 10;
const statiListe = new Map();

const contenutiGuida = {
    "/": {
        titolo: "Panoramica",
        tutorial: [
            "Leggi i quattro riquadri in alto: mostrano prodotti da riordinare, vendite del mese, acquisti del mese e clienti registrati.",
            "Se vuoi nascondere gli importi e i conteggi, premi l'icona dell'occhio; premila di nuovo per mostrarli.",
            "Scorri fino a Ultimi movimenti per leggere le operazioni recenti: la panoramica serve per controllare la situazione, non per registrare dati."
        ],
        regole: [
            "I riquadri sono riepiloghi: non cambiano le quantità e non sostituiscono le pagine Acquisti, Vendite o Rettifiche.",
            "La tabella degli ultimi movimenti resta visibile anche quando i valori dei riquadri sono nascosti.",
            "I dati appartengono al salone attivo della sessione."
        ]
    },
    "/acquisti": {
        titolo: "Acquisti",
        tutorial: [
            "Nella sezione Fornitore scegli un fornitore; se non vuoi associarlo, lascia il menu su Nessun fornitore selezionato.",
            "Nella sezione Data e prodotti scegli la data e seleziona un prodotto già presente nel catalogo. Se non esiste ancora, vai prima in Prodotti, crealo e poi torna qui.",
            "Inserisci quantità e costo unitario, poi premi Aggiungi alla lista.",
            "Puoi aggiungere più prodotti ricevuti nello stesso giorno: appartengono tutti a questo acquisto. Se gli acquisti sono avvenuti in date diverse, salva questa registrazione e creane un'altra scegliendo l'altra data, anche se il fornitore è lo stesso. Le note sono facoltative.",
            "Controlla le righe e il Totale acquisto nel Riepilogo, poi premi Salva acquisto. Dopo il salvataggio ogni acquisto compare nello storico con la propria data e il proprio totale, e la giacenza dei prodotti aumenta."
        ],
        regole: [
            "La data è obbligatoria, il fornitore e le note sono facoltativi; quantità e costo unitario devono essere validi.",
            "Il totale di ogni riga è quantità × costo unitario. Esempio: 3 prodotti a 4 € fanno 12 €; il totale dell'acquisto somma tutte le righe.",
            "Un acquisto di 2 pezzi aumenta di 2 la giacenza di quel prodotto. L'acquisto riguarda prodotti, non servizi."
        ],
        azioni: [
            "Prima del salvataggio, nel Riepilogo puoi aprire Azioni e scegliere Rimuovi per togliere una riga dalla lista dell'acquisto che stai preparando.",
            "Nello storico degli acquisti apri il menu Azioni sulla riga desiderata.",
            "Puoi cancellare una singola riga dell'acquisto oppure cancellare l'acquisto completo.",
            "Cancellare una riga o l'acquisto aggiorna la giacenza dei prodotti coinvolti e ricarica lo storico. Se cancelli l'ultima riga, viene cancellato anche l'acquisto senza righe.",
            "Prima della cancellazione compare una conferma con la data e il prodotto o l'acquisto interessato."
        ]
    },
    "/vendite": {
        titolo: "Vendite",
        tutorial: [
            "Nella sezione Cliente scegli una cliente abituale oppure lascia il menu su Nessuna cliente selezionata.",
            "Nella sezione Aggiungi un elemento scegli Prodotto o Servizio, seleziona l'elemento, inserisci la quantità e premi Aggiungi alla vendita.",
            "Scegli la data della vendita. Puoi aggiungere altre righe, scrivere una nota facoltativa e controllare tutto nel Riepilogo.",
            "Quando le righe sono corrette, premi Salva vendita. La vendita compare nello storico; solo le righe di prodotto aggiornano la giacenza."
        ],
        regole: [
            "La cliente e le note sono facoltative; servono una data e almeno una riga prima di salvare.",
            "Il totale di una riga è prezzo dell'elemento × quantità. Esempio: un prodotto da 15 € venduto 2 volte vale 30 €.",
            "Solo i prodotti diminuiscono la giacenza: se ce ne sono 2 e ne vendi 1, la giacenza diventa 1. Un servizio entra nel totale ma non cambia la giacenza."
        ],
        azioni: [
            "Prima del salvataggio, nel Riepilogo puoi aprire Azioni e scegliere Rimuovi per togliere una riga dalla vendita che stai preparando.",
            "Nello storico delle vendite apri il menu Azioni sulla riga desiderata.",
            "Se la vendita ha più righe puoi cancellare una singola riga oppure cancellare la vendita completa. Se ha una sola riga, è disponibile solo la cancellazione della vendita.",
            "Cancellare una vendita o una riga aggiorna lo storico e ricalcola la giacenza dei prodotti coinvolti. Le righe di servizio non cambiano la giacenza.",
            "Prima della cancellazione compare una conferma con la data e il prodotto, servizio o vendita interessata."
        ]
    },
    "/magazzino": {
        titolo: "Magazzino",
        tutorial: [
            "Nel campo Cerca scrivi il nome o la marca di un prodotto; usa Precedente e Successiva per cambiare pagina.",
            "Leggi Giacenza per sapere quanti pezzi risultano disponibili e Soglia di riordino per capire quando rifornire il prodotto.",
            "Controlla Stato: Da riordinare significa che la giacenza è uguale o inferiore alla soglia. Per cambiare una quantità usa Rettifiche magazzino.",
            "Leggi Valore stimato del magazzino per una stima basata sulla quantità e sul costo storico di acquisto."
        ],
        regole: [
            "La giacenza parte dal conteggio iniziale, aumenta con gli acquisti, diminuisce con le vendite di prodotti e cambia con le rettifiche.",
            "La soglia non cambia la quantità: serve solo per mostrare lo stato Da riordinare quando la giacenza è uguale o inferiore a quella soglia.",
            "La stima usa giacenza × costo unitario dell'acquisto reale più recente; se manca, usa il costo indicativo. Non usa il prezzo di vendita."
        ]
    },
    "/rettifiche-magazzino": {
        titolo: "Rettifiche",
        tutorial: [
            "Nel campo Prodotto seleziona il prodotto la cui quantità non è corretta.",
            "In Variazione quantità scrivi un numero positivo per aggiungere pezzi o negativo per toglierli; non usare zero.",
            "Scrivi il Motivo, per esempio prodotto rotto o prodotto mancante, poi premi Registra rettifica.",
            "Dopo il salvataggio controlla la riga nello Storico rettifiche e la nuova quantità nella pagina Magazzino."
        ],
        regole: [
            "Una rettifica positiva aumenta la giacenza: da 5 con variazione +2 si passa a 7.",
            "Una rettifica negativa la riduce: da 5 con variazione -1 si passa a 4. Il motivo è obbligatorio e la variazione non può essere zero.",
            "La rettifica corregge una quantità già registrata; non crea un acquisto e non registra una vendita."
        ],
        azioni: [
            "Nello Storico rettifiche apri il menu Azioni sulla riga desiderata.",
            "L'unica operazione disponibile è cancellare la rettifica del prodotto indicato.",
            "La cancellazione rimuove quella correzione, ricalcola la giacenza del prodotto e aggiorna lo storico.",
            "Prima della cancellazione compare una conferma con il prodotto e la variazione interessati."
        ]
    },
    "/conteggio-iniziale": {
        titolo: "Conteggio",
        tutorial: [
            "Apri Conteggio iniziale quando cominci a usare il gestionale e premi Aggiungi prodotto per creare una riga.",
            "Per ogni prodotto compila Nome, Prezzo di vendita, Soglia di riordino, Quantità contata fisicamente e Costo unitario d'acquisto indicativo; Marca è facoltativa.",
            "Aggiungi una riga per ogni prodotto già presente, poi premi Salva conteggio iniziale. Il conteggio crea anche la scheda del prodotto e registra la quantità iniziale in Magazzino: non devi inserirlo di nuovo in Prodotti o in Acquisti."
        ],
        regole: [
            "Nome, prezzo di vendita, soglia, quantità contata e costo indicativo sono obbligatori; la marca è facoltativa.",
            "Il conteggio comunica al gestionale cosa c'è già nel salone quando inizi a usarlo: non è un acquisto e non registra una vendita.",
            "Il costo indicativo serve come riferimento per la stima del magazzino quando non esiste ancora un costo di acquisto reale."
        ],
        azioni: [
            "Nel riepilogo delle righe inserite apri il menu Azioni sulla riga che vuoi togliere.",
            "Scegli Rimuovi per eliminare quella riga dalla compilazione corrente del conteggio.",
            "Rimuovi non cancella prodotti già salvati e non cambia il Magazzino: prima del salvataggio modifica solo l'elenco che stai preparando."
        ]
    },
    "/clienti": {
        titolo: "Clienti",
        tutorial: [
            "Nel modulo in alto inserisci Nome e Cognome; se serve, scrivi una Nota.",
            "Premi Salva cliente. Il nuovo nominativo compare nell'elenco sottostante.",
            "Per trovare una cliente usa Cerca. Su una riga premi Modifica, scegli Modifica cliente, aggiorna i campi e premi Salva modifiche."
        ],
        regole: [
            "Nome e cognome sono obbligatori; la nota è facoltativa.",
            "La cliente può essere scelta in una vendita, ma una vendita può anche restare senza cliente.",
            "Cancellare una cliente richiede una conferma. Il dettaglio cliente mostra anche lo storico delle vendite associate."
        ],
        modifica: [
            "Nella riga della cliente desiderata apri il menu delle azioni e scegli Modifica cliente.",
            "Si apre una finestra con nome, cognome e note già compilati. Questi sono i campi presenti nella scheda cliente.",
            "Cambia solo i campi necessari e premi Salva modifiche. Annulla chiude la finestra senza salvare i cambiamenti.",
            "Dopo il salvataggio l'elenco mostra i dati aggiornati: la modifica aggiorna la scheda esistente e non crea una nuova cliente.",
            "Cancella è un'azione separata e non serve per correggere un dato."
        ]
    },
    "/prodotti": {
        titolo: "Prodotti",
        tutorial: [
            "Nel modulo in alto inserisci Nome, Prezzo di vendita e Soglia di riordino; puoi aggiungere Marca e costo indicativo.",
            "Premi Salva prodotto per creare la scheda nel catalogo. Questa operazione da sola non aumenta la giacenza: per un prodotto già presente all'avvio usa Conteggio iniziale; per un prodotto arrivato dopo usa Acquisti.",
            "Per aggiornare un prodotto premi Modifica nella sua riga, scegli Modifica prodotto, cambia i campi e premi Salva modifiche."
        ],
        regole: [
            "Nome, prezzo di vendita e soglia di riordino sono obbligatori; marca e costo indicativo sono facoltativi.",
            "Il costo indicativo non cambia il prezzo di vendita e viene usato per stimare il magazzino solo quando manca un costo di acquisto reale.",
            "La giacenza non si modifica qui: usa Conteggio iniziale all'avvio o Rettifiche magazzino per le correzioni successive."
        ],
        modifica: [
            "Nella riga del prodotto desiderato apri il menu delle azioni e scegli Modifica prodotto.",
            "Si apre una finestra con i dati attuali già compilati. Puoi cambiare nome, marca, prezzo di vendita, costo indicativo e soglia di riordino.",
            "Cambia solo i campi necessari e premi Salva modifiche. Annulla chiude la finestra senza salvare i cambiamenti.",
            "Dopo il salvataggio l'elenco mostra i dati aggiornati: la modifica aggiorna la scheda esistente e non crea un nuovo prodotto.",
            "La quantità disponibile non si modifica qui. Per correggerla usa Rettifiche magazzino. Cancella è un'azione separata e non serve per correggere un dato."
        ]
    },
    "/servizi": {
        titolo: "Servizi",
        tutorial: [
            "Nel modulo in alto inserisci il Nome del servizio e il Prezzo.",
            "Premi Salva servizio: il servizio diventa disponibile nel menu delle vendite.",
            "Per aggiornarlo premi Modifica nella riga, scegli Modifica servizio, cambia i campi e premi Salva modifiche."
        ],
        regole: [
            "Nome e prezzo sono obbligatori; il prezzo non può essere negativo.",
            "Il prezzo del servizio entra nel totale della vendita moltiplicato per la quantità.",
            "I servizi non hanno giacenza: anche se venduti, non cambiano il Magazzino."
        ],
        modifica: [
            "Nella riga del servizio desiderato apri il menu delle azioni e scegli Modifica servizio.",
            "Si apre una finestra con i dati attuali già compilati. Puoi cambiare il nome e il prezzo.",
            "Lo stato attivo è mostrato nell'elenco dei servizi; questa finestra modifica solo nome e prezzo, come previsto dalla sezione.",
            "Cambia solo i campi necessari e premi Salva modifiche. Annulla chiude la finestra senza salvare i cambiamenti.",
            "Dopo il salvataggio l'elenco mostra i dati aggiornati: la modifica aggiorna la scheda esistente e non crea un nuovo servizio. Cancella è un'azione separata e non serve per correggere un dato."
        ]
    },
    "/fornitori": {
        titolo: "Fornitori",
        tutorial: [
            "Nel modulo in alto inserisci il Nome del fornitore; Telefono, Email e Note possono essere lasciati vuoti.",
            "Premi Salva fornitore. Il fornitore compare nell'elenco e potrà essere scelto durante un acquisto.",
            "Per aggiornarlo premi Modifica nella riga, scegli Modifica fornitore, cambia i campi e premi Salva modifiche."
        ],
        regole: [
            "Il nome è obbligatorio; telefono, email e note sono facoltativi.",
            "Un fornitore può essere scelto negli acquisti, ma un acquisto può restare senza fornitore.",
            "Il fornitore non cambia direttamente la giacenza: è il salvataggio dell'acquisto con le sue righe di prodotto a incrementarla."
        ],
        modifica: [
            "Nella riga del fornitore desiderato apri il menu delle azioni e scegli Modifica fornitore.",
            "Si apre una finestra con nome, telefono, email e note già compilati.",
            "Cambia solo i campi necessari e premi Salva modifiche. Annulla chiude la finestra senza salvare i cambiamenti.",
            "Dopo il salvataggio l'elenco mostra i dati aggiornati: la modifica aggiorna la scheda esistente e non crea un nuovo fornitore.",
            "Cancella è un'azione separata e non serve per correggere un dato."
        ]
    }
};

const guidaPrimaVolta = {
    sezioni: [
        {
            titolo: "Prima di iniziare",
            elenco: [
                "Vai in Conteggio iniziale e inserisci i prodotti che sono già presenti in salone, indicando quanti ce ne sono. Così il gestionale crea le schede e registra le quantità di partenza.",
                "Vai in Servizi e inserisci i servizi che offri, con i relativi prezzi.",
                "Da quel momento puoi registrare le operazioni del salone."
            ],
            ordinato: true
        },
        {
            titolo: "A cosa serve ogni sezione",
            elenco: [
                "Panoramica: mostra le informazioni principali del salone e gli ultimi movimenti.",
                "Magazzino: mostra i prodotti disponibili e quelli da riordinare.",
                "Conteggio iniziale: serve per caricare i prodotti e le quantità che hai già quando inizi a usare il gestionale.",
                "Prodotti: serve per creare o modificare le schede dei prodotti. Se in futuro vuoi acquistare un prodotto non ancora presente, crealo qui e poi registra l'arrivo in Acquisti.",
                "Servizi: serve per inserire o modificare i servizi e i loro prezzi. I servizi non modificano le quantità in magazzino.",
                "Acquisti: registra i prodotti ricevuti e aumenta le quantità in magazzino.",
                "Vendite: registra i prodotti venduti e i servizi svolti. La vendita di un prodotto diminuisce la quantità disponibile.",
                "Rettifiche magazzino: corregge le quantità per prodotti rotti, danneggiati o mancanti.",
                "Clienti: conserva i dati delle clienti abituali e permette di consultare i loro acquisti.",
                "Fornitori: conserva i dati dei fornitori."
            ]
        }
    ],
    nota: "Il conteggio iniziale riguarda ciò che è già presente in salone. Non registrare questi prodotti anche come acquisti."
};

const percorsiConGuidaModifica = new Set([
    "/prodotti",
    "/servizi",
    "/clienti",
    "/fornitori"
]);

const percorsiConGuidaAzioni = new Set([
    "/acquisti",
    "/vendite",
    "/rettifiche-magazzino",
    "/conteggio-iniziale"
]);

function guidaPerPercorso(percorso) {
    if (/^\/clienti\/\d+$/.test(percorso)) {
        return {
            ...contenutiGuida["/clienti"],
            titolo: "Dettaglio cliente"
        };
    }

    return contenutiGuida[percorso] || {
        titolo: "Gestionale",
        tutorial: [
            "Consulta le informazioni della sezione aperta.",
            "Usa i moduli e le tabelle disponibili per svolgere l'operazione necessaria.",
            "Controlla il messaggio di conferma o di errore dopo ogni operazione."
        ],
        regole: [
            "I dati mostrati appartengono al salone della sessione autenticata.",
            "I campi obbligatori sono indicati nel modulo della sezione.",
            "Le operazioni vengono controllate dal gestionale prima del salvataggio."
        ]
    };
}

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
        },
        riepilogo: risultato?.riepilogo
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
        const contenitoreTabella = corpo?.closest(
            ".tabella-scroll, .tabella-gestione-scroll, .tabella-vendita-scroll"
        );

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

function inizializzaDataAcquisto() {
    const campo = document.querySelector("#data-acquisto");

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
        nome: "costoUnitarioIndicativo",
        etichetta: "Costo unitario d'acquisto indicativo",
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
        costoUnitarioIndicativo: riga.querySelector('[data-campo-conteggio="costoUnitarioIndicativo"]').value === ""
            ? null
            : Number(riga.querySelector('[data-campo-conteggio="costoUnitarioIndicativo"]').value),
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
    const valoreStimato = document.querySelector("#valore-stimato-magazzino");
    const prodottiSenzaCosto = document.querySelector("#prodotti-senza-costo-magazzino");

    // Nella pagina Rettifiche serve il catalogo completo per il selettore,
    // ma non esiste una tabella Magazzino da aggiornare con una pagina separata.
    if (!corpoTabella && document.querySelector("#prodotto-rettifica")) {
        try {
            popolaProdottiRettifica(await caricaTutteLePagine("/api/magazzino"));
        } catch (errore) {
            console.error("Errore nel caricamento dei prodotti per la rettifica:", errore);
            popolaProdottiRettifica([]);
        }
        return;
    }

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

        if (valoreStimato && dati.riepilogo) {
            valoreStimato.textContent = formattaEuro(dati.riepilogo.valore_stimato);
        }

        if (prodottiSenzaCosto && dati.riepilogo) {
            const conteggio = Number(dati.riepilogo.prodotti_senza_costo);
            prodottiSenzaCosto.textContent = conteggio === 0
                ? "Tutti i prodotti con giacenza positiva hanno un costo noto."
                : `${conteggio} ${conteggio === 1 ? "prodotto" : "prodotti"} con giacenza positiva senza costo noto: non ${conteggio === 1 ? "è incluso" : "sono inclusi"} nella stima.`;
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

        if (valoreStimato) {
            valoreStimato.textContent = "—";
        }

        if (prodottiSenzaCosto) {
            prodottiSenzaCosto.textContent = "Impossibile calcolare la stima.";
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

            const pulsanteCancella = creaPulsanteCancellazione(`Cancella rettifica di «${rettifica.prodotto}»`, async () => {
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
                [pulsanteCancella],
                "Azioni"
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

            const pulsanteCancella = creaPulsanteCancellazione(`Cancella cliente «${cliente.nome} ${cliente.cognome}»`, async () => {
                await cancellaRisorsa(
                    `/api/clienti/${cliente.id}`,
                    `Vuoi cancellare definitivamente la cliente "${cliente.nome} ${cliente.cognome}"? Verrà rimossa dall'elenco; se è collegata a vendite esistenti, la cancellazione non sarà consentita.`,
                    document.querySelector("#messaggio-cancellazione-cliente"),
                    caricaClienti
                );
            });
            const pulsanteModifica = creaPulsanteAzioneTabella("Modifica cliente", () => {
                apriPopupModificaCliente(cliente);
            });
            riga.appendChild(creaCellaAzioniPopup(
                `cliente ${cliente.nome} ${cliente.cognome}`,
                [pulsanteModifica, pulsanteCancella]
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

            impostaValorePanoramica(conteggioRiordino, prodottiDaRiordinare);

            if (schedaRiordino) {
                schedaRiordino.classList.add("scheda-statistica-riordino");
            }
        }

        if (totaleVendite) {
            impostaValorePanoramica(totaleVendite, formattaEuro(riepilogo.vendite_mese));
        }

        if (totaleAcquisti) {
            impostaValorePanoramica(totaleAcquisti, formattaEuro(riepilogo.acquisti_mese));
        }

        if (conteggioClienti) {
            impostaValorePanoramica(conteggioClienti, riepilogo.clienti_totali);
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
                impostaValorePanoramica(elemento, "—");
            }
        }

        if (schedaRiordino) {
            schedaRiordino.classList.add("scheda-statistica-riordino");
        }
    }
}

function impostaValorePanoramica(elemento, valore) {
    if (!elemento) {
        return;
    }

    elemento.dataset.valorePanoramica = String(valore);
    elemento.textContent = valoriPanoramicaNascosti ? "****" : elemento.dataset.valorePanoramica;
}

function elementiValoriPanoramica() {
    return [
        document.querySelector("#conteggio-riordino"),
        document.querySelector("#totale-vendite-mese"),
        document.querySelector("#totale-acquisti-mese"),
        document.querySelector("#conteggio-clienti")
    ].filter(Boolean);
}

function aggiornaVisibilitaValoriPanoramica() {
    for (const elemento of elementiValoriPanoramica()) {
        if (elemento?.dataset.valorePanoramica !== undefined) {
            elemento.textContent = valoriPanoramicaNascosti
                ? "****"
                : elemento.dataset.valorePanoramica;
        }
    }

    const pulsante = document.querySelector("#toggle-valori-panoramica");

    if (!pulsante) {
        return;
    }

    const descrizione = valoriPanoramicaNascosti
        ? "Mostra valori"
        : "Nascondi valori";

    pulsante.setAttribute("aria-label", descrizione);
    pulsante.setAttribute("aria-pressed", String(valoriPanoramicaNascosti));
    pulsante.title = descrizione;

    const icone = pulsante.querySelectorAll(".icona-occhio");
    icone.forEach((icona, indice) => {
        const nascondiIcona = valoriPanoramicaNascosti ? indice === 0 : indice === 1;
        icona.toggleAttribute("hidden", nascondiIcona);
        icona.classList.toggle("icona-occhio-nascosta", nascondiIcona);
    });
}

function inizializzaControlloValoriPanoramica() {
    const pulsante = document.querySelector("#toggle-valori-panoramica");

    if (!pulsante || pulsante.dataset.inizializzato === "true") {
        return;
    }

    valoriPanoramicaNascosti = false;
    pulsante.dataset.inizializzato = "true";
    for (const elemento of elementiValoriPanoramica()) {
        elemento.dataset.valorePanoramica = elemento.textContent;
    }
    pulsante.addEventListener("click", () => {
        valoriPanoramicaNascosti = !valoriPanoramicaNascosti;
        aggiornaVisibilitaValoriPanoramica();
    });
    aggiornaVisibilitaValoriPanoramica();
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
        const risposta = await fetchDati(
            "/api/clienti",
            {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nuovaCliente)
            }
        );

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
            messaggio.textContent = errore.message === "Failed to fetch"
                ? "Impossibile contattare il server."
                : errore.message;
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

function creaPulsanteAzioneTabella(testo, gestore) {
    const pulsante = document.createElement("button");
    pulsante.type = "button";
    pulsante.textContent = testo;
    pulsante.className = "pulsante-tabella pulsante-secondario";
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

function creaCellaAzioniPopup(titoloContesto, pulsanti, etichetta = "Modifica") {
    const cella = document.createElement("td");
    const modifica = document.createElement("button");
    const contenitore = document.createElement("div");

    modifica.type = "button";
    modifica.className = "pulsante-tabella pulsante-modifica";
    modifica.textContent = etichetta;
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

function chiudiPopupModifica() {
    if (!popupModificaTabella) {
        return;
    }

    popupModificaTabella.popup.remove();
    popupModificaTabella = null;
    document.body.classList.remove("popup-azioni-aperta");

    if (
        elementoPrimaDelPopupModifica instanceof HTMLElement &&
        document.contains(elementoPrimaDelPopupModifica)
    ) {
        elementoPrimaDelPopupModifica.focus();
    }

    elementoPrimaDelPopupModifica = null;
}

function creaCampoPopupModifica(configurazione) {
    const campo = document.createElement("div");
    const etichetta = document.createElement("label");
    const input = configurazione.tipo === "textarea"
        ? document.createElement("textarea")
        : document.createElement("input");

    campo.className = `campo-gestione${configurazione.largo ? " campo-gestione-largo" : ""}`;
    etichetta.htmlFor = configurazione.id;
    etichetta.textContent = configurazione.etichetta;
    input.id = configurazione.id;
    input.name = configurazione.nome;
    input.value = configurazione.valore ?? "";

    if (configurazione.tipo && configurazione.tipo !== "textarea") {
        input.type = configurazione.tipo;
    }

    if (configurazione.rows) {
        input.rows = configurazione.rows;
    }

    for (const attributo of ["min", "max", "step", "placeholder"]) {
        if (configurazione[attributo] !== undefined) {
            input.setAttribute(attributo, configurazione[attributo]);
        }
    }

    if (configurazione.required) {
        input.required = true;
    }

    campo.append(etichetta, input);
    return campo;
}

function apriPopupModifica(configurazione) {
    const elementoRitorno = elementoPrimaDelPopupAzioni;

    chiudiPopupAzioni();
    chiudiPopupModifica();

    const popup = document.createElement("div");
    const pannello = document.createElement("section");
    const intestazione = document.createElement("div");
    const titolo = document.createElement("h2");
    const chiudi = document.createElement("button");
    const form = document.createElement("form");
    const campi = document.createElement("div");
    const messaggio = document.createElement("p");
    const azioni = document.createElement("div");
    const salva = document.createElement("button");

    popup.className = "popup-azioni-tabella popup-modifica-tabella";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-labelledby", "titolo-popup-modifica-tabella");

    pannello.className = "popup-azioni-tabella-pannello";
    intestazione.className = "popup-azioni-tabella-intestazione";
    titolo.id = "titolo-popup-modifica-tabella";
    titolo.textContent = configurazione.titolo;

    chiudi.type = "button";
    chiudi.className = "popup-azioni-tabella-chiudi";
    chiudi.textContent = "Annulla";
    chiudi.setAttribute("aria-label", "Annulla modifica");

    form.className = "popup-modifica-form";
    campi.className = "campi-gestione";
    configurazione.campi.forEach((campo) => {
        campi.appendChild(creaCampoPopupModifica(campo));
    });

    messaggio.className = "messaggio-gestione popup-modifica-messaggio";
    messaggio.setAttribute("aria-live", "polite");

    azioni.className = "popup-modifica-azioni";
    salva.type = "submit";
    salva.className = "pulsante-salva";
    salva.textContent = "Salva modifiche";
    azioni.appendChild(salva);

    form.append(campi, messaggio, azioni);
    intestazione.append(titolo, chiudi);
    pannello.append(intestazione, form);
    popup.appendChild(pannello);
    document.body.appendChild(popup);

    popupModificaTabella = { popup };
    elementoPrimaDelPopupModifica = elementoRitorno;
    document.body.classList.add("popup-azioni-aperta");

    const elementiFocalizzabili = () => [
        chiudi,
        ...form.querySelectorAll("input, textarea, select, button:not(:disabled)")
    ];

    chiudi.addEventListener("click", chiudiPopupModifica);
    popup.addEventListener("click", (evento) => {
        if (evento.target === popup) {
            chiudiPopupModifica();
        }
    });
    popup.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            evento.preventDefault();
            chiudiPopupModifica();
            return;
        }

        if (evento.key !== "Tab") {
            return;
        }

        const elementi = elementiFocalizzabili();
        const primo = elementi[0];
        const ultimo = elementi[elementi.length - 1];

        if (evento.shiftKey && document.activeElement === primo) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primo.focus();
        }
    });
    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        salva.disabled = true;
        messaggio.textContent = "";

        try {
            const risposta = await fetchDati(configurazione.url, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(configurazione.creaPayload(form))
            });
            const risultato = await risposta.json().catch(() => ({}));

            if (!risposta.ok) {
                throw new Error(
                    risultato.errore || `Richiesta fallita: HTTP ${risposta.status}`
                );
            }

            chiudiPopupModifica();
            const messaggioPagina = document.querySelector(configurazione.messaggioSelettore);
            if (messaggioPagina) {
                messaggioPagina.textContent = configurazione.messaggioSuccesso;
            }
            await configurazione.aggiorna();
        } catch (errore) {
            console.error("Errore nel salvataggio della modifica:", errore);
            messaggio.textContent = errore.message === "Failed to fetch"
                ? "Impossibile contattare il server."
                : errore.message;
            salva.disabled = false;
        }
    });

    const primoCampo = form.querySelector("input, textarea, select");
    (primoCampo || chiudi).focus();
}

function apriPopupModificaProdotto(prodotto) {
    apriPopupModifica({
        titolo: "Modifica prodotto",
        url: `/api/prodotti/${prodotto.id}`,
        messaggioSelettore: "#messaggio-prodotto",
        messaggioSuccesso: "Prodotto aggiornato.",
        aggiorna: caricaGestioneProdotti,
        campi: [
            {
                id: "popup-modifica-prodotto-nome",
                nome: "nome",
                etichetta: "Nome",
                valore: prodotto.nome,
                required: true,
                largo: true
            },
            {
                id: "popup-modifica-prodotto-marca",
                nome: "marca",
                etichetta: "Marca",
                valore: prodotto.marca,
                largo: true
            },
            {
                id: "popup-modifica-prodotto-prezzo-vendita",
                nome: "prezzoVendita",
                etichetta: "Prezzo di vendita",
                tipo: "number",
                valore: prodotto.prezzo_vendita,
                min: "0",
                step: "0.01",
                required: true
            },
            {
                id: "popup-modifica-prodotto-costo",
                nome: "costoUnitarioIndicativo",
                etichetta: "Costo unitario d'acquisto indicativo",
                tipo: "number",
                valore: prodotto.costo_unitario_indicativo,
                min: "0",
                step: "0.01",
                placeholder: "Facoltativo"
            },
            {
                id: "popup-modifica-prodotto-soglia",
                nome: "sogliaRiordino",
                etichetta: "Soglia di riordino",
                tipo: "number",
                valore: prodotto.soglia_riordino,
                min: "0",
                step: "1",
                required: true
            }
        ],
        creaPayload: (form) => ({
            nome: form.elements.nome.value.trim(),
            marca: form.elements.marca.value.trim() || null,
            prezzoVendita: Number(form.elements.prezzoVendita.value),
            costoUnitarioIndicativo: form.elements.costoUnitarioIndicativo.value === ""
                ? null
                : Number(form.elements.costoUnitarioIndicativo.value),
            sogliaRiordino: Number(form.elements.sogliaRiordino.value)
        })
    });
}

function apriPopupModificaServizio(servizio) {
    apriPopupModifica({
        titolo: "Modifica servizio",
        url: `/api/servizi/${servizio.id}`,
        messaggioSelettore: "#messaggio-servizio",
        messaggioSuccesso: "Servizio aggiornato.",
        aggiorna: caricaGestioneServizi,
        campi: [
            {
                id: "popup-modifica-servizio-nome",
                nome: "nome",
                etichetta: "Nome",
                valore: servizio.nome,
                required: true,
                largo: true
            },
            {
                id: "popup-modifica-servizio-prezzo",
                nome: "prezzo",
                etichetta: "Prezzo",
                tipo: "number",
                valore: servizio.prezzo,
                min: "0",
                step: "0.01",
                required: true
            }
        ],
        creaPayload: (form) => ({
            nome: form.elements.nome.value.trim(),
            prezzo: Number(form.elements.prezzo.value)
        })
    });
}

function apriPopupModificaCliente(cliente) {
    apriPopupModifica({
        titolo: "Modifica cliente",
        url: `/api/clienti/${cliente.id}`,
        messaggioSelettore: "#messaggio-cliente",
        messaggioSuccesso: "Cliente aggiornata.",
        aggiorna: caricaClienti,
        campi: [
            {
                id: "popup-modifica-cliente-nome",
                nome: "nome",
                etichetta: "Nome",
                valore: cliente.nome,
                required: true
            },
            {
                id: "popup-modifica-cliente-cognome",
                nome: "cognome",
                etichetta: "Cognome",
                valore: cliente.cognome,
                required: true
            },
            {
                id: "popup-modifica-cliente-note",
                nome: "note",
                etichetta: "Note",
                tipo: "textarea",
                rows: 3,
                valore: cliente.note,
                largo: true
            }
        ],
        creaPayload: (form) => ({
            nome: form.elements.nome.value.trim(),
            cognome: form.elements.cognome.value.trim(),
            note: form.elements.note.value.trim()
        })
    });
}

function apriPopupModificaFornitore(fornitore) {
    apriPopupModifica({
        titolo: "Modifica fornitore",
        url: `/api/fornitori/${fornitore.id}`,
        messaggioSelettore: "#messaggio-fornitore",
        messaggioSuccesso: "Fornitore aggiornato.",
        aggiorna: caricaGestioneFornitori,
        campi: [
            {
                id: "popup-modifica-fornitore-nome",
                nome: "nome",
                etichetta: "Nome",
                valore: fornitore.nome,
                required: true,
                largo: true
            },
            {
                id: "popup-modifica-fornitore-telefono",
                nome: "telefono",
                etichetta: "Telefono",
                valore: fornitore.telefono
            },
            {
                id: "popup-modifica-fornitore-email",
                nome: "email",
                etichetta: "Email",
                tipo: "email",
                valore: fornitore.email
            },
            {
                id: "popup-modifica-fornitore-note",
                nome: "note",
                etichetta: "Note",
                tipo: "textarea",
                rows: 3,
                valore: fornitore.note,
                largo: true
            }
        ],
        creaPayload: (form) => ({
            nome: form.elements.nome.value.trim(),
            telefono: form.elements.telefono.value.trim() || null,
            email: form.elements.email.value.trim() || null,
            note: form.elements.note.value.trim() || null
        })
    });
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
                7,
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
                prodotto.costo_unitario_indicativo === null || prodotto.costo_unitario_indicativo === undefined
                    ? "—"
                    : formattaEuro(prodotto.costo_unitario_indicativo),
                prodotto.soglia_riordino,
                prodotto.giacenza
            ];

            for (const valore of valori) {
                const cella = document.createElement("td");
                cella.textContent = valore ?? "";
                riga.appendChild(cella);
            }

            const pulsanteCancella = creaPulsanteCancellazione(`Cancella prodotto «${prodotto.nome}»`, async () => {
                await cancellaRisorsa(
                    `/api/prodotti/${prodotto.id}`,
                    `Vuoi cancellare definitivamente il prodotto "${prodotto.nome}"? Verrà rimosso dall'elenco, ma puoi farlo solo se non è collegato ad acquisti, vendite o rettifiche.`,
                    messaggio,
                    caricaGestioneProdotti
                );
            });
            const pulsanteModifica = creaPulsanteAzioneTabella("Modifica prodotto", () => {
                apriPopupModificaProdotto(prodotto);
            });
            riga.appendChild(creaCellaAzioniPopup(
                `prodotto ${prodotto.nome}`,
                [pulsanteModifica, pulsanteCancella]
            ));

            corpo.appendChild(riga);
        }
    } catch (errore) {
        console.error("Errore nel caricamento dei prodotti:", errore);
        mostraErroreTabella(
            "#corpo-prodotti",
            7,
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
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const prodotto = {
        nome: form.elements.nome.value.trim(),
        marca: form.elements.marca.value.trim() || null,
        prezzoVendita: Number(form.elements.prezzoVendita.value),
        costoUnitarioIndicativo: form.elements.costoUnitarioIndicativo.value === ""
            ? null
            : Number(form.elements.costoUnitarioIndicativo.value),
        sogliaRiordino: Number(form.elements.sogliaRiordino.value)
    };

    try {
        const risposta = await fetchDati(
            "/api/prodotti",
            {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(prodotto)
            }
        );

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

            const pulsanteCancella = creaPulsanteCancellazione(`Cancella servizio «${servizio.nome}»`, async () => {
                await cancellaRisorsa(
                    `/api/servizi/${servizio.id}`,
                    `Vuoi cancellare definitivamente il servizio "${servizio.nome}"? Verrà rimosso dall'elenco, ma puoi farlo solo se non è collegato a vendite.`,
                    messaggio,
                    caricaGestioneServizi
                );
            });
            const pulsanteModifica = creaPulsanteAzioneTabella("Modifica servizio", () => {
                apriPopupModificaServizio(servizio);
            });
            riga.appendChild(creaCellaAzioniPopup(
                `servizio ${servizio.nome}`,
                [pulsanteModifica, pulsanteCancella]
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
        const risposta = await fetchDati(
            "/api/servizi-gestione",
            {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nuovoServizio)
            }
        );

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

            const pulsanteCancella = creaPulsanteCancellazione(`Cancella fornitore «${fornitore.nome}»`, async () => {
                await cancellaRisorsa(
                    `/api/fornitori/${fornitore.id}`,
                    `Vuoi cancellare definitivamente il fornitore "${fornitore.nome}"? Verrà rimosso dall'elenco, ma puoi farlo solo se non è collegato ad acquisti.`,
                    messaggio,
                    caricaGestioneFornitori
                );
            });
            const pulsanteModifica = creaPulsanteAzioneTabella("Modifica fornitore", () => {
                apriPopupModificaFornitore(fornitore);
            });
            riga.appendChild(creaCellaAzioniPopup(
                `fornitore ${fornitore.nome}`,
                [pulsanteModifica, pulsanteCancella]
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
        const risposta = await fetchDati(
            "/api/fornitori",
            {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nuovoFornitore)
            }
        );

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
        messaggio.textContent = errore.message === "Failed to fetch"
            ? "Impossibile contattare il server."
            : errore.message;
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
            [pulsanteRimuovi],
            "Azioni"
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
                formattaDataSenzaConversione(acquisto.data_acquisto),
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
                const pulsante = creaPulsanteCancellazione(`Cancella riga «${rigaAcquisto.prodotto}»`, async () => {
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

            const pulsanteAcquisto = creaPulsanteCancellazione(`Cancella acquisto del ${formattaDataSenzaConversione(acquisto.data_acquisto)}`, async () => {
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
                    `Cancellazione definitiva dell'acquisto del ${formattaDataSenzaConversione(acquisto.data_acquisto)} da ${acquisto.fornitore}.\n\nEffetto sulla giacenza:\n- ${effetti.join("\n- ")}\n\nConfermi?`,
                    messaggio,
                    async () => {
                        await caricaElencoAcquisti();
                        await caricaProdottiPerAcquisto();
                    }
                );
            });
            azioni.push(pulsanteAcquisto);
            riga.appendChild(creaCellaAzioniPopup(
                `acquisto del ${formattaDataSenzaConversione(acquisto.data_acquisto)} da ${acquisto.fornitore}`,
                azioni,
                "Azioni"
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
    inizializzaDataAcquisto();

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
        fornitoreId: form.elements.fornitoreId.value === ""
            ? null
            : Number(form.elements.fornitoreId.value),
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
        inizializzaDataAcquisto();
        righeAcquisto = [];
        mostraRigheAcquisto();
        messaggio.textContent = "Acquisto salvato.";

        const statoListaAcquisti = statiListe.get("corpo-acquisti");
        if (statoListaAcquisti) {
            statoListaAcquisti.pagina = 1;
        }

        await Promise.all([
            caricaProdottiPerAcquisto(),
            caricaElencoAcquisti()
        ]);
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
            const righeVendita = Array.isArray(vendita.righe) ? vendita.righe : [];
            const riga = document.createElement("tr");
            const valori = [
                formattaDataSenzaConversione(vendita.data_vendita),
                vendita.cliente || "Vendita senza cliente",
                righeVendita.map((rigaVendita) => {
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

            if (righeVendita.length > 1) {
                for (const rigaVendita of righeVendita) {
                    azioni.push(creaPulsanteCancellazione(`Cancella riga «${rigaVendita.elemento}»`, async () => {
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
            }

            azioni.push(creaPulsanteCancellazione(`Cancella vendita del ${formattaDataSenzaConversione(vendita.data_vendita)}`, async () => {
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
                azioni,
                "Azioni"
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
            [pulsanteRimuovi],
            "Azioni"
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

        await Promise.all([
            caricaDatiVendita(),
            caricaElencoVendite()
        ]);
    } catch (errore) {
        console.error("Errore nel salvataggio della vendita:", errore);

        messaggio.textContent = errore.message === "Failed to fetch"
            ? "Impossibile contattare il server."
            : errore.message;
    }
}

function raccogliAggiornamentiSezioniPrincipali() {
    const aggiornamenti = [];

    if (
        document.querySelector("#corpo-magazzino") ||
        document.querySelector("#form-rettifica-magazzino")
    ) {
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

    return aggiornamenti;
}

async function aggiornaDatiPaginaVisibile() {
    const aggiornamenti = raccogliAggiornamentiSezioniPrincipali();

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
        ["/rettifiche-magazzino", "↕", "Rettifiche magazzino"],
        ["/acquisti", "↙", "Acquisti"],
        ["/vendite", "↗", "Vendite"],
        ["/clienti", "♙", "Clienti"],
        ["/prodotti", "□", "Prodotti"],
        ["/servizi", "✦", "Servizi"],
        ["/fornitori", "⌁", "Fornitori"],
        ["/conteggio-iniziale", "#", "Conteggio iniziale"]
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

function creaElencoGuida(elementi) {
    const elenco = document.createElement("ol");
    elenco.className = "dashboard-help-list";

    for (const testo of elementi) {
        const voce = document.createElement("li");
        voce.textContent = testo;
        elenco.appendChild(voce);
    }

    return elenco;
}

function creaContenutoGuida(contenuto) {
    if (Array.isArray(contenuto)) {
        return creaElencoGuida(contenuto);
    }

    const contenitore = document.createElement("div");
    contenitore.className = "dashboard-help-sections";

    for (const sezione of contenuto.sezioni || []) {
        const elementoSezione = document.createElement("section");
        elementoSezione.className = "dashboard-help-section";

        const titolo = document.createElement("h3");
        titolo.textContent = sezione.titolo;

        const elenco = document.createElement(sezione.ordinato ? "ol" : "ul");
        for (const testo of sezione.elenco || []) {
            const voce = document.createElement("li");
            voce.textContent = testo;
            elenco.appendChild(voce);
        }

        elementoSezione.append(titolo, elenco);
        contenitore.appendChild(elementoSezione);
    }

    if (contenuto.nota) {
        const nota = document.createElement("p");
        nota.className = "dashboard-help-note";
        nota.textContent = contenuto.nota;
        contenitore.appendChild(nota);
    }

    return contenitore;
}

function creaGuidaApplicazione(percorso) {
    let guidaCorrente = guidaPerPercorso(percorso);

    const contenitore = document.createElement("aside");
    contenitore.className = "dashboard-help";
    contenitore.setAttribute("aria-label", "Help Center KIND SQL");

    const pulsanteMobile = document.createElement("button");
    pulsanteMobile.type = "button";
    pulsanteMobile.className = "dashboard-help-mobile-toggle pulsante-secondario";
    pulsanteMobile.textContent = "Aiuto";
    pulsanteMobile.setAttribute("aria-expanded", "false");
    pulsanteMobile.setAttribute("aria-controls", "pannello-guida-kind-sql");

    const pannello = document.createElement("div");
    pannello.id = "pannello-guida-kind-sql";
    pannello.className = "dashboard-help-panel";

    const intestazione = document.createElement("div");
    intestazione.className = "dashboard-help-heading";

    const etichetta = document.createElement("span");
    etichetta.className = "dashboard-help-label";
    etichetta.textContent = "HELP CENTER";

    const titolo = document.createElement("h2");
    titolo.className = "dashboard-help-title";
    titolo.textContent = "Guida KIND SQL";

    const contesto = document.createElement("p");
    contesto.className = "dashboard-help-context";

    intestazione.append(etichetta, titolo, contesto);

    const azioni = document.createElement("div");
    azioni.className = "dashboard-help-actions";

    const pulsantePrimaVolta = document.createElement("button");
    pulsantePrimaVolta.type = "button";
    pulsantePrimaVolta.className = "pulsante-secondario dashboard-help-primary";
    pulsantePrimaVolta.dataset.guidaTipo = "prima-volta";
    pulsantePrimaVolta.textContent = "Prima volta nel Gestionale";

    const pulsanteTutorial = document.createElement("button");
    pulsanteTutorial.type = "button";
    pulsanteTutorial.className = "pulsante-secondario";
    pulsanteTutorial.dataset.guidaTipo = "tutorial";
    pulsanteTutorial.textContent = "Tutorial passo passo";

    const pulsanteRegole = document.createElement("button");
    pulsanteRegole.type = "button";
    pulsanteRegole.className = "pulsante-secondario";
    pulsanteRegole.dataset.guidaTipo = "regole";
    pulsanteRegole.textContent = "Regole e calcoli";

    const pulsanteModifica = document.createElement("button");
    pulsanteModifica.type = "button";
    pulsanteModifica.className = "pulsante-secondario";
    pulsanteModifica.dataset.guidaTipo = "modifica";
    pulsanteModifica.textContent = "Modifica: cosa fa?";

    const pulsanteAzioni = document.createElement("button");
    pulsanteAzioni.type = "button";
    pulsanteAzioni.className = "pulsante-secondario";
    pulsanteAzioni.dataset.guidaTipo = "azioni";
    pulsanteAzioni.textContent = "Azioni: cosa puoi fare?";

    azioni.append(
        pulsantePrimaVolta,
        pulsanteTutorial,
        pulsanteRegole,
        pulsanteModifica,
        pulsanteAzioni
    );

    const dialogo = document.createElement("dialog");
    dialogo.className = "dashboard-help-dialog";
    dialogo.setAttribute("aria-labelledby", "titolo-dialogo-guida-kind-sql");

    const dialogoIntestazione = document.createElement("div");
    dialogoIntestazione.className = "dashboard-help-dialog-heading";
    const dialogoTitolo = document.createElement("h2");
    dialogoTitolo.id = "titolo-dialogo-guida-kind-sql";
    const chiudi = document.createElement("button");
    chiudi.type = "button";
    chiudi.className = "pulsante-secondario dashboard-help-close";
    chiudi.textContent = "Chiudi";
    dialogoIntestazione.append(dialogoTitolo, chiudi);

    const dialogoContenuto = document.createElement("div");
    dialogoContenuto.className = "dashboard-help-dialog-content";
    dialogo.append(dialogoIntestazione, dialogoContenuto);

    const piede = document.createElement("footer");
    piede.className = "dashboard-help-footer";

    const supporto = document.createElement("div");
    supporto.className = "dashboard-help-support";
    const pulsanteHelp = document.createElement("a");
    pulsanteHelp.className = "pulsante-secondario";
    pulsanteHelp.textContent = "Help";
    pulsanteHelp.href = "mailto:gabrigentile05@gmail.com?subject=Richiesta%20di%20assistenza%20KIND%20SQL";
    pulsanteHelp.setAttribute("aria-label", "Apri una richiesta di assistenza via email");
    supporto.appendChild(pulsanteHelp);

    const autore = document.createElement("span");
    autore.className = "dashboard-help-author";
    autore.textContent = "Developed by Gabriele Gentile";

    const versione = document.createElement("span");
    versione.className = "dashboard-help-version";
    versione.textContent = "Versione in caricamento…";
    piede.append(supporto, autore, versione);

    const aggiornaVersione = async () => {
        try {
            const risposta = await fetch("/api/versione", {
                credentials: "same-origin",
                cache: "no-store"
            });
            const risultato = await risposta.json().catch(() => ({}));

            if (!risposta.ok || typeof risultato.version !== "string" || !risultato.version) {
                throw new Error("Versione non disponibile.");
            }

            versione.textContent = `Versione ${risultato.version}`;
        } catch (errore) {
            console.error("Errore nel caricamento della versione:", errore);
            versione.textContent = "Versione non disponibile";
        }
    };

    const aggiornaContesto = (nuovoPercorso) => {
        guidaCorrente = guidaPerPercorso(nuovoPercorso);
        contesto.textContent = `Indicazioni per: ${guidaCorrente.titolo}`;
        contenitore.dataset.sezioneGuida = nuovoPercorso;
        pulsantePrimaVolta.hidden = !["/", "/index.html"].includes(nuovoPercorso);
        pulsanteModifica.hidden = !percorsiConGuidaModifica.has(nuovoPercorso);
        pulsanteAzioni.hidden = !percorsiConGuidaAzioni.has(nuovoPercorso);
        contenitore.classList.remove("guida-aperta");
        pulsanteMobile.textContent = "Aiuto";
        pulsanteMobile.setAttribute("aria-expanded", "false");
    };

    const apriGuida = (tipo) => {
        const titoli = {
            "prima-volta": "Prima volta nel Gestionale",
            tutorial: "Tutorial passo passo",
            regole: "Regole e calcoli",
            modifica: "Modifica: cosa fa?",
            azioni: "Azioni: cosa puoi fare?"
        };
        const titoloTipo = titoli[tipo] || "Guida";
        dialogoTitolo.textContent = `${titoloTipo} — ${guidaCorrente.titolo}`;
        dialogoContenuto.replaceChildren(
            creaContenutoGuida(tipo === "prima-volta" ? guidaPrimaVolta : guidaCorrente[tipo])
        );

        if (typeof dialogo.showModal === "function") {
            dialogo.showModal();
        } else {
            dialogo.setAttribute("open", "");
        }
    };

    pulsanteMobile.addEventListener("click", () => {
        const aperto = contenitore.classList.toggle("guida-aperta");
        pulsanteMobile.textContent = aperto ? "Chiudi aiuto" : "Aiuto";
        pulsanteMobile.setAttribute("aria-expanded", String(aperto));
    });

    for (const pulsante of azioni.querySelectorAll("button[data-guida-tipo]")) {
        pulsante.addEventListener("click", () => apriGuida(pulsante.dataset.guidaTipo));
    }

    chiudi.addEventListener("click", () => dialogo.close());
    dialogo.addEventListener("click", (evento) => {
        if (evento.target === dialogo) {
            dialogo.close();
        }
    });

    pannello.append(intestazione, azioni);
    pannello.appendChild(piede);
    contenitore.append(pulsanteMobile, pannello, dialogo);
    aggiornaContesto(percorso);
    aggiornaVersione();

    return {
        elemento: contenitore,
        aggiorna: aggiornaContesto
    };
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

    chiudiPopupModifica();
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
        shellApplicazione.guida.aggiorna(percorso);
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
    const guida = creaGuidaApplicazione(window.location.pathname);
    main.replaceChildren(creaSidebarApplicazione(), contenuto, guida.elemento);
    main.addEventListener("click", gestisciNavigazioneApplicazione);

    shellApplicazione = { main, content: contenuto, guida };
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
    inizializzaControlloValoriPanoramica();
    const aggiornamenti = raccogliAggiornamentiSezioniPrincipali();

    if (document.querySelector("#form-acquisto")) {
        const formAcquisto = document.querySelector("#form-acquisto");
        const pulsanteAggiungiRiga = document.querySelector("#aggiungi-riga-acquisto");

        if (formAcquisto.dataset.inizializzato !== "true") {
            formAcquisto.dataset.inizializzato = "true";
            pulsanteAggiungiRiga?.addEventListener("click", aggiungiRigaAcquisto);
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
            chiudiPopupModifica();
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
