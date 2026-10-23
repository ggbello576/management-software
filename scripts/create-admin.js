require("dotenv").config();

const { Client } = require("pg");
const readline = require("node:readline");
const { hashPassword, verificaPassword } = require("../auth");

const RUOLI_AMMESSI = new Set(["amministratore", "operatore"]);

function domanda(interfaccia, testo) {
    return new Promise((resolve) => {
        interfaccia.question(testo, resolve);
    });
}

function passwordNascosta(testo) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error("Lo script deve essere eseguito da un terminale interattivo.");
    }

    return new Promise((resolve, reject) => {
        let password = "";

        process.stdout.write(testo);
        process.stdin.setRawMode(true);
        process.stdin.resume();

        const leggiCarattere = (carattere) => {
            const codice = carattere.toString();

            if (codice === "\u0003") {
                termina();
                reject(new Error("Operazione annullata."));
                return;
            }

            if (codice === "\r" || codice === "\n") {
                termina();
                process.stdout.write("\n");
                resolve(password);
                return;
            }

            if (codice === "\u007f" || codice === "\b") {
                if (password.length > 0) {
                    password = password.slice(0, -1);
                    process.stdout.write("\b \b");
                }
                return;
            }

            password += codice;
            process.stdout.write("*");
        };

        const termina = () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener("data", leggiCarattere);
        };

        process.stdin.on("data", leggiCarattere);
    });
}

function normalizzaEmail(valore) {
    const email = valore.trim().toLowerCase();

    if (email === "" || email.length > 320 || !email.includes("@")) {
        throw new Error("Inserisci un indirizzo email valido.");
    }

    return email;
}

function normalizzaNomeUtente(valore) {
    const nomeUtente = valore.trim().toLowerCase();

    if (nomeUtente === "" || nomeUtente.length > 100) {
        throw new Error("Il nome utente deve contenere tra 1 e 100 caratteri.");
    }

    return nomeUtente;
}

function normalizzaSaloneId(valore) {
    const saloneId = Number(valore.trim());

    if (!Number.isSafeInteger(saloneId) || saloneId < 1) {
        throw new Error("L'ID del salone deve essere un numero intero positivo.");
    }

    return saloneId;
}

function normalizzaRuolo(valore) {
    const ruolo = valore.trim();

    if (!RUOLI_AMMESSI.has(ruolo)) {
        throw new Error("Ruolo non valido. Scegli tra amministratore e operatore.");
    }

    return ruolo;
}

async function main() {
    const client = new Client();
    const interfaccia = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let transazioneAvviata = false;
    let nome;
    let nomeUtente;
    let email;
    let saloneId;
    let ruolo;
    let password = "";
    let confermaPassword = "";

    try {
        await client.connect();

        const saloni = await client.query(
            "SELECT id, nome FROM public.saloni ORDER BY id;"
        );

        if (saloni.rowCount === 0) {
            throw new Error("Non esistono saloni disponibili.");
        }

        console.log("Saloni disponibili:");
        for (const salone of saloni.rows) {
            console.log(`  ${salone.id} - ${salone.nome}`);
        }

        saloneId = normalizzaSaloneId(
            await domanda(interfaccia, "ID salone: ")
        );

        const saloneScelto = await client.query(
            "SELECT id, nome FROM public.saloni WHERE id = $1;",
            [saloneId]
        );

        if (saloneScelto.rowCount === 0) {
            throw new Error(`Il salone con ID ${saloneId} non esiste.`);
        }

        console.log("Ruoli disponibili:");
        console.log("  amministratore");
        console.log("  operatore");
        ruolo = normalizzaRuolo(
            await domanda(interfaccia, "Ruolo: ")
        );

        nome = (await domanda(interfaccia, "Nome visualizzato: ")).trim();
        nomeUtente = normalizzaNomeUtente(await domanda(interfaccia, "Nome utente: "));
        email = normalizzaEmail(await domanda(interfaccia, "Email: "));
    } catch (errore) {
        await client.end().catch(() => {});
        throw errore;
    } finally {
        interfaccia.close();
    }

    if (nome === "") {
        await client.end().catch(() => {});
        throw new Error("Il nome è obbligatorio.");
    }

    try {
        password = await passwordNascosta("Password amministratore: ");
        confermaPassword = await passwordNascosta("Conferma password: ");

        if (password.length < 8 || password.length > 1024) {
            throw new Error("La password deve contenere tra 8 e 1024 caratteri.");
        }

        if (confermaPassword.length < 8 || confermaPassword.length > 1024) {
            throw new Error("La conferma della password non è valida.");
        }

        await client.query("BEGIN");
        transazioneAvviata = true;

        const salone = await client.query(
            "SELECT 1 FROM public.saloni WHERE id = $1;",
            [saloneId]
        );

        if (salone.rowCount === 0) {
            throw new Error(`Il salone con ID ${saloneId} non esiste più.`);
        }

        const duplicato = await client.query(
            `
                SELECT
                    EXISTS (
                        SELECT 1
                        FROM public.utenti
                        WHERE lower(nome_utente) = $1
                    ) AS nome_utente_duplicato,
                    EXISTS (
                        SELECT 1
                        FROM public.utenti
                        WHERE lower(email) = $2
                    ) AS email_duplicata;
            `,
            [nomeUtente, email]
        );

        if (duplicato.rows[0].nome_utente_duplicato) {
            throw new Error("Esiste già un account con questo nome utente.");
        }

        if (duplicato.rows[0].email_duplicata) {
            throw new Error("Esiste già un account con questa email.");
        }

        let passwordHash = "";

        try {
            passwordHash = await hashPassword(password);

            if (!await verificaPassword(confermaPassword, passwordHash)) {
                throw new Error("Le password non coincidono.");
            }
        } finally {
            password = "";
            confermaPassword = "";
        }

        const utente = await client.query(
            `
                INSERT INTO public.utenti
                    (nome, nome_utente, email, password_hash)
                VALUES ($1, $2, $3, $4)
                RETURNING id;
            `,
            [nome, nomeUtente, email, passwordHash]
        );

        passwordHash = "";

        await client.query(
            `
                INSERT INTO public.utenti_saloni (salone_id, utente_id, ruolo)
                VALUES ($1, $2, $3);
            `,
            [saloneId, utente.rows[0].id, ruolo]
        );

        await client.query("COMMIT");
        transazioneAvviata = false;
        console.log(`Account ${ruolo} creato.`);
    } catch (errore) {
        if (transazioneAvviata) {
            try {
                await client.query("ROLLBACK");
            } catch {
                // Il rollback può fallire se la connessione non è stata aperta.
            }
        }

        if (errore.code === "23505" && errore.constraint === "utenti_email_minuscole_uq") {
            throw new Error("Esiste già un account con questa email.");
        }

        if (errore.code === "23505" && errore.constraint === "utenti_nome_utente_minuscole_uq") {
            throw new Error("Esiste già un account con questo nome utente.");
        }

        throw errore;
    } finally {
        password = "";
        confermaPassword = "";
        await client.end().catch(() => {});
    }
}

main().catch((errore) => {
    console.error(errore.message);
    process.exitCode = 1;
});
