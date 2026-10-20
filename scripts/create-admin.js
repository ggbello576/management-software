require("dotenv").config();

const { Client } = require("pg");
const { hashPassword } = require("../auth");

function argomento(nome) {
    const indice = process.argv.indexOf(`--${nome}`);
    return indice >= 0 ? process.argv[indice + 1] : null;
}

function passwordNascosta() {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error("Lo script deve essere eseguito da un terminale interattivo.");
    }

    return new Promise((resolve, reject) => {
        let password = "";

        process.stdout.write("Password amministratore: ");
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

async function main() {
    const nome = argomento("nome");
    const email = argomento("email");
    const saloneId = Number(argomento("salone-id"));

    if (!nome || !email || !Number.isSafeInteger(saloneId) || saloneId < 1) {
        throw new Error(
            "Uso: node scripts/create-admin.js --nome \"Nome\" --email admin@example.test --salone-id 1"
        );
    }

    const password = await passwordNascosta();

    if (password.length < 8 || password.length > 1024) {
        throw new Error("La password deve contenere tra 8 e 1024 caratteri.");
    }

    const client = new Client();

    try {
        await client.connect();
        await client.query("BEGIN");

        const salone = await client.query(
            "SELECT id FROM public.saloni WHERE id = $1;",
            [saloneId]
        );

        if (salone.rowCount === 0) {
            throw new Error("Il salone indicato non esiste.");
        }

        const passwordHash = await hashPassword(password);
        const utente = await client.query(
            `
                INSERT INTO public.utenti (nome, email, password_hash)
                VALUES ($1, lower($2), $3)
                RETURNING id;
            `,
            [nome.trim(), email.trim(), passwordHash]
        );

        await client.query(
            `
                INSERT INTO public.utenti_saloni (salone_id, utente_id, ruolo)
                VALUES ($1, $2, 'amministratore');
            `,
            [saloneId, utente.rows[0].id]
        );

        await client.query("COMMIT");
        console.log("Account amministratore creato.");
    } catch (errore) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // Il rollback può fallire se la connessione non è stata aperta.
        }

        throw errore;
    } finally {
        await client.end().catch(() => {});
    }
}

main().catch((errore) => {
    console.error(errore.message);
    process.exitCode = 1;
});
