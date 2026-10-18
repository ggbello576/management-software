//file per far comunicare js con PostgreSQL    PG
//STIAMO PRENDENDO LE INFORMAZIONI DAL FILE .ENV E LI PASSIAMO A PG, 
//TRAMITE UN OGGETTO JS

const { Pool } = require("pg"); //carica libreria PG
//estrae la classe Pool, gestisce le connessioni al database e le usa 

const pool = new Pool({ //istanza classe pool
    host: process.env.PGHOST,  //Dice a pg su quale computer cercare PostgreSQL. Prende il valore di PGHOST dal file .env.
    port: Number(process.env.PGPORT), //converte la porta da testo a numero il valore della porta che in .env è stringa
    database: process.env.PGDATABASE,//quale database postgresql usare, process.. recupera il valore da env
    user: process.env.PGUSER,//quale utente, lo prende da pguser in env
    password: process.env.PGPASSWORD//solito discorso
});

module.exports = pool; //rende disponibile pool agli altri file del progetto.