# Menja i Mut Gestionale — avvio online

## Cosa offre questa versione

Pagina statica compatibile con GitHub Pages, autenticazione Supabase, profili cliente in attesa di approvazione manuale, autorizzazione per categoria, dati centrali con protezione RLS, ordini inizialmente da approvare, esportazione/importazione manuale JSON. Non gestisce pagamenti. Il logo originale è invariato.

## Setup una tantum

1. Crea un progetto gratuito su Supabase e attendi che sia pronto.
2. Apri **SQL Editor → New query**, incolla tutto `supabase/schema.sql` e premi **Run**.
3. In **Project Settings → API** copia Project URL e la chiave **anon/public** (o publishable). Inseriscile in `config.js`. Questa chiave è pubblica per definizione; la sicurezza è nelle policy SQL. Non copiare mai `service_role`/secret key nel sito.
4. In **Authentication → URL Configuration**, aggiungi l'URL GitHub Pages del sito a Site URL e Redirect URLs. Per il test locale puoi usare `http://localhost:8000/**`.
5. In **Authentication → Providers → Email**, abilita email/password e conferma email. SMTP predefinito potrebbe avere limiti; per uso reale configura SMTP del titolare.
6. Registra il tuo account dal sito, conferma l'email e accedi. Nel SQL Editor esegui l'istruzione commentata in fondo a `schema.sql`, sostituendo il tuo indirizzo. Questo abilita il primo amministratore.
7. L'amministratore approva i clienti e ordini dalle tabelle/strumenti admin Supabase (o dal gestionale nelle sezioni Clienti e Ordini); l'approvazione dell'account è separata da quella dell'ordine. Categoria cliente: Privati, Pizzerie, Hotel, Ristoranti, Negozi e rivenditori, Altre attività.
8. Pubblica i file sul branch `main`; in GitHub vai in **Settings → Pages**, scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`, quindi Save. Attendi il completamento di Actions e apri l'URL indicato nella pagina Pages.

## Backup e ripristino

Usa **Esporta dati** e conserva il JSON nel tuo Google Drive. Per ripristinare, accedi come amministratore, usa **Importa backup** e seleziona il JSON. È un trasferimento manuale: non avviene alcuna sincronizzazione automatica con Drive. Salva copie periodiche e prova un ripristino prima dell'uso operativo.

## Limiti e sicurezza

GitHub Pages non ha backend segreto: sono pubblicati HTML, CSS, JavaScript e `config.js`. Le policy RLS permettono ai clienti approvati di leggere catalogo/listini e i propri ordini; solo admin gestisce dati gestionali. I nuovi ordini dei clienti possono essere inseriti soltanto con stato `Da approvare`. L'amministratore iniziale va promosso manualmente dopo avere verificato il proprio account. Disattiva le registrazioni pubbliche in Supabase se desideri un accesso su invito.

La fatturazione elettronica, invio email operativo e integrazione Drive OAuth non sono inclusi. Questo progetto non esegue pagamenti. Configura anche backup automatici del database offerti dal piano scelto: il JSON è un'ulteriore copia manuale, non un sostituto del backup gestito.
