const crypto = require("node:crypto");
const argon2 = require("argon2");

const SESSION_COOKIE_NAME = "gestionale_session";
const CSRF_COOKIE_NAME = "gestionale_csrf";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

function authEnabled() {
    // L'autenticazione è attiva per impostazione predefinita. Può essere
    // disattivata solo esplicitamente con AUTH_ENABLED=false.
    return process.env.AUTH_ENABLED !== "false";
}

function randomToken() {
    return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function secretsEqual(first, second) {
    if (typeof first !== "string" || typeof second !== "string") {
        return false;
    }

    const firstBuffer = Buffer.from(first, "utf8");
    const secondBuffer = Buffer.from(second, "utf8");

    return firstBuffer.length === secondBuffer.length &&
        crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function parseCookies(header) {
    const cookies = {};

    if (typeof header !== "string") {
        return cookies;
    }

    for (const parte of header.split(";")) {
        const separatore = parte.indexOf("=");

        if (separatore < 0) {
            continue;
        }

        const nome = parte.slice(0, separatore).trim();
        const valore = parte.slice(separatore + 1).trim();

        if (nome !== "") {
            try {
                cookies[nome] = decodeURIComponent(valore);
            } catch {
                cookies[nome] = "";
            }
        }
    }

    return cookies;
}

function cookieOptions({ httpOnly, maxAge }) {
    const parti = [
        "Path=/",
        "SameSite=Lax",
        httpOnly ? "HttpOnly" : null,
        process.env.NODE_ENV === "production" ? "Secure" : null
    ].filter(Boolean);

    if (maxAge !== undefined) {
        parti.push(`Max-Age=${maxAge}`);
    }

    return parti.join("; ");
}

function authCookies(sessionToken, csrfToken) {
    return [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; ${cookieOptions({
            httpOnly: true,
            maxAge: SESSION_DURATION_SECONDS
        })}`,
        `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}; ${cookieOptions({
            httpOnly: false,
            maxAge: SESSION_DURATION_SECONDS
        })}`
    ];
}

function csrfCookie(csrfToken, maxAge = 600) {
    return `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}; ${cookieOptions({
        httpOnly: false,
        maxAge
    })}`;
}

function clearAuthCookies() {
    return [
        `${SESSION_COOKIE_NAME}=; ${cookieOptions({
            httpOnly: true,
            maxAge: 0
        })}`,
        `${CSRF_COOKIE_NAME}=; ${cookieOptions({
            httpOnly: false,
            maxAge: 0
        })}`
    ];
}

function expectedOrigin(request) {
    if (process.env.APP_ORIGIN) {
        return process.env.APP_ORIGIN.replace(/\/$/, "");
    }

    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    return `${protocol}://${request.headers.host || "localhost:3000"}`;
}

function originIsAllowed(request) {
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    let requestOrigin = origin || null;

    if (!requestOrigin && referer) {
        try {
            requestOrigin = new URL(referer).origin;
        } catch {
            return false;
        }
    }

    return requestOrigin === expectedOrigin(request);
}

function csrfIsValid(request, csrfTokenHash) {
    const cookies = parseCookies(request.headers.cookie);
    const cookieToken = cookies[CSRF_COOKIE_NAME];
    const headerToken = request.headers["x-csrf-token"];

    return typeof headerToken === "string" &&
        secretsEqual(cookieToken, headerToken) &&
        secretsEqual(hashToken(headerToken), csrfTokenHash);
}

function csrfHeaderMatchesCookie(request) {
    const cookies = parseCookies(request.headers.cookie);
    const cookieToken = cookies[CSRF_COOKIE_NAME];
    const headerToken = request.headers["x-csrf-token"];

    return typeof headerToken === "string" &&
        secretsEqual(cookieToken, headerToken);
}

async function autenticaRichiesta(pool, request) {
    const cookies = parseCookies(request.headers.cookie);
    const sessionToken = cookies[SESSION_COOKIE_NAME];

    if (!sessionToken) {
        return null;
    }

    const risultato = await pool.query(
        `
            SELECT
                sessioni.id AS session_id,
                sessioni.utente_id,
                sessioni.salone_id,
                sessioni.csrf_token_hash,
                utenti.nome AS utente_nome,
                utenti.email AS utente_email,
                utenti_saloni.ruolo
            FROM public.sessioni AS sessioni
            JOIN public.utenti AS utenti
                ON utenti.id = sessioni.utente_id
            JOIN public.utenti_saloni AS utenti_saloni
                ON utenti_saloni.utente_id = sessioni.utente_id
               AND utenti_saloni.salone_id = sessioni.salone_id
            WHERE sessioni.token_hash = $1
              AND sessioni.revocata_il IS NULL
              AND sessioni.scade_il > CURRENT_TIMESTAMP
            LIMIT 1;
        `,
        [hashToken(sessionToken)]
    );

    if (risultato.rowCount === 0) {
        return null;
    }

    return risultato.rows[0];
}

async function hashPassword(password) {
    return argon2.hash(password, { type: argon2.argon2id });
}

async function verificaPassword(password, passwordHash) {
    return argon2.verify(passwordHash, password);
}

module.exports = {
    CSRF_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    SESSION_DURATION_SECONDS,
    authCookies,
    authEnabled,
    autenticaRichiesta,
    clearAuthCookies,
    csrfCookie,
    csrfHeaderMatchesCookie,
    csrfIsValid,
    expectedOrigin,
    hashPassword,
    hashToken,
    originIsAllowed,
    randomToken,
    verificaPassword
};
