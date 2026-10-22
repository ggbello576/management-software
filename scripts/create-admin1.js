require("dotenv").config();

const { Client } = require("pg");
const readline = require("node:readline");
const { hashPassword } = require("../auth");

const SALONE_ID = 1;

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

            if (codice === "\u007f") {
                password = password.slice(0, -1);
                return;
            }

            password += codice;
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

async function main() {
    const interfaccia = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let nome;
    let email;

    try {
        nome = (await domanda(interfaccia, "Nome: ")).trim();
        email = normalizzaEmail(await domanda(interfaccia, "Email: "));
    } finally {
        interfaccia.close();
    }

    if (nome === "") {
        throw new Error("Il nome è obbligatorio.");
    }

    let password = await passwordNascosta("Password amministratore: ");

    try {
        if (password.length < 8 || password.length > 1024) {
            throw new Error("La password deve contenere tra 8 e 1024 caratteri.");
        }

        const client = new Client();

        try {
            await client.connect();
            await client.query("BEGIN");

            const salone = await client.query(
                "SELECT 1 FROM public.saloni WHERE id = $1;",
                [SALONE_ID]
            );

            if (salone.rowCount === 0) {
                throw new Error("Il salone 1 non esiste.");
            }

            const duplicato = await client.query(
                "SELECT 1 FROM public.utenti WHERE lower(email) = $1 LIMIT 1;",
                [email]
            );

            if (duplicato.rowCount > 0) {
                throw new Error("Esiste già un account con questa email.");
            }

            let passwordHash = "";

            try {
                passwordHash = await hashPassword(password);
            } finally {
                password = "";
            }

            const utente = await client.query(
                `
                    INSERT INTO public.utenti (nome, email, password_hash)
                    VALUES ($1, $2, $3)
                    RETURNING id;
                `,
                [nome, email, passwordHash]
            );

            passwordHash = "";

            await client.query(
                `
                    INSERT INTO public.utenti_saloni (salone_id, utente_id, ruolo)
                    VALUES ($1, $2, 'amministratore');
                `,
                [SALONE_ID, utente.rows[0].id]
            );

            await client.query("COMMIT");
            console.log("Account amministratore creato.");
        } catch (errore) {
            try {
                await client.query("ROLLBACK");
            } catch {
                // Il rollback può fallire se la connessione non è stata aperta.
            }

            if (errore.code === "23505" && errore.constraint === "utenti_email_minuscole_uq") {
                throw new Error("Esiste già un account con questa email.");
            }

            throw errore;
        } finally {
            await client.end().catch(() => {});
        }
    } finally {
        password = "";
    }
}

main().catch((errore) => {
    console.error(errore.message);
    process.exitCode = 1;
});
