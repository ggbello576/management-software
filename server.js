//backend
require("dotenv").config();//carica la libreria dotenv, .config()cerca e legge .env
const http = require("node:http"); // prende il modulo http da node
const fs = require("node:fs"); //fs modulo per lavorare con i file
const pool = require("./db");//esportiamo l'oggetto pool ,il suo file

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

        } else if (
        request.method === "GET" &&
        request.url === "/api/clienti"
    ) {
        try {
            const risultato = await pool.query(`
                SELECT id, nome, cognome, note, creata_il
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
    }else if (
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
