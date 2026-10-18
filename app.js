//funzioni che fanno query e passano alle tabelle corrispettive
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


if (
    document.querySelector("#corpo-magazzino") ||
    document.querySelector("#conteggio-riordino")
) {
    caricaDatiMagazzino();
}

if (document.querySelector("#corpo-clienti")) {
    caricaClienti();
}