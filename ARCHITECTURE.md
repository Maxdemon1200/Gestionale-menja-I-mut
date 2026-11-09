# Architettura attuale — Menja i Mut Gestionale

Data ispezione: 9 novembre 2026. Repository `Maxdemon1200/Gestionale-menja-I-mut`, branch `main`, commit iniziale `67c61bb`.

## Inventario

- `index.html` (17.090 byte): interfaccia, CSS responsive, navigazione, moduli, form, logica demo e persistenza in un unico file.
- `menjaimut.jpg` (26.436 byte): logo originale referenziato dall'interfaccia.
- `README.txt` (894 byte): avvio locale e limiti dichiarati della demo.
- `Menja-i-Mut-Gestionale-prototipo-v0.2.zip` (27.290 byte): archivio del prototipo con copie di `index.html`, `README.txt`, `menjaimut.jpg`; non è parte dell'esecuzione online.

## Flusso attuale

La pagina si apre direttamente nel browser. Un oggetto JavaScript contiene clienti, ordini, prodotti, lotti, magazzino, fatture ed eventi e lo salva in `localStorage` (`menjaimut-v02`). L'esportazione genera un JSON scaricabile. Non esistono build, dipendenze, server, autenticazione, database centrale, API, RLS o sincronizzazione multi-dispositivo.

I moduli sono tabelle e form generici in memoria locale. Gli ordini partono nello stato “Da approvare”, ma l'interfaccia non impone ruoli. I prodotti hanno un campo note ricetta incorporato; non vi è un archivio strutturato ricette. Le categorie clienti e il logo sono già presenti. Il README avverte che verifica email, notifiche, database e funzioni fiscali non sono implementate.

## Limiti e direzione

GitHub Pages può servire solo file statici. Per dati condivisi e autenticazione occorre collegare il browser a Supabase con la sola chiave anon/publishable e proteggere ogni tabella tramite RLS. La chiave `service_role` deve restare esclusivamente lato server e non serve alla soluzione statica. Backup su Google Drive non può essere dichiarato automatico senza un'integrazione OAuth/server affidabile: il flusso manuale esporta e reimporta file JSON.
