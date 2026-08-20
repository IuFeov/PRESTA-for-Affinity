# Selective White — Cosa fa questo script

## A cosa serve

Questo script per Affinity Designer automatizza la preparazione del livello di **stampa bianca selettiva** (Selective White) in un file grafico destinato alla stampa: trova tutti gli elementi bianchi nel documento, li prepara correttamente per la stampa e genera un PDF pronto per la stampa — tutto in un solo click.

## Cosa deve esserci nel documento

Lo script riconosce come "bianco selettivo" qualsiasi elemento del disegno che abbia:
- un contorno o un riempimento nel colore tecnico convenzionale usato per il bianco, **oppure**
- un nome che contiene la parola "white" o "bianco"

Non è necessario selezionare nulla a mano: lo script scansiona da solo l'intero documento, comprese le forme raggruppate o nascoste dentro cartelle/sottolivelli.

## Cosa fa, passo per passo

1. **Trova** tutti gli elementi bianchi nel documento, ovunque si trovino.
2. **Converte i contorni in aree piene**: se un elemento è disegnato solo come "linea" (contorno) anziché come forma piena, lo trasforma in un'area di inchiostro reale della forma esatta — passaggio necessario perché in stampa serve un'area piena, non solo una linea.
3. **Unisce tutto in un unico elemento**: tutte le forme bianche trovate (contorni convertiti e riempimenti originali) vengono fuse in un solo tracciato, per semplicità ed efficienza in stampa.
4. **Applica lo stile di stampa corretto** a quell'unico elemento (colore tecnico e sovrastampa impostati secondo lo standard aziendale).
5. **Riorganizza i livelli**: crea un livello chiamato "white" con dentro l'elemento unito, e sposta tutta la restante grafica in un livello "Artwork", pulito e senza sottocartelle inutili.
6. **Esporta un PDF pronto per la stampa**, con le impostazioni tecniche corrette già incorporate (compatibilità PDF/X-4, gestione colore, tinte piatte, livelli), salvato con il nome del file originale seguito da "_ok".

## Cosa serve avere pronto prima di usarlo

- Il documento aperto in Affinity Designer.
- Due "macro" (piccole automazioni di Affinity) già registrate una volta sola: una per convertire i contorni in aree piene, una per applicare lo stile di stampa.
- Un preset di esportazione PDF salvato in Affinity con le impostazioni di stampa desiderate.

(Se uno di questi elementi manca, lo script te lo segnala con un messaggio chiaro invece di procedere con impostazioni sbagliate.)

## Cosa vedi alla fine

Un messaggio di conferma con il numero di elementi trovati ed elaborati, e la conferma che il PDF è stato esportato correttamente, con il percorso dove trovarlo.

## Cosa NON fa

- Non modifica il colore o la forma della grafica normale (tutto ciò che non è bianco resta intatto).
- Non richiede di salvare manualmente il file — l'esportazione PDF è automatica e separata dal file di lavoro originale, che resta invariato a parte la riorganizzazione dei livelli descritta sopra.
