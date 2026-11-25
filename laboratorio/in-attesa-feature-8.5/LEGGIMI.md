# Banchi in attesa: provano feature che in `app.html` NON CI SONO

**Messi da parte il 24 novembre 2026, su decisione del proprietario** («Mettili da parte»).

## Perché sono qui

Questi quattro banchi provano le feature **8.5.13–8.5.18**. Quelle feature erano state
implementate, poi `app.html` e' stata **ripristinata da HEAD** dopo una corruzione da parentesi
sbilanciate, e **non sono mai state riapplicate**. I banchi invece sono rimasti.

MISURATO il 24 novembre: le funzioni che cercano **non esistono** nel sorgente —
`fblSplitRiquadri`, `fblRiquadroPagina`, `bookStoricoPerAsset`, `memoriaCampioni`: **0 occorrenze**
in `app.html`. Non stavano trovando un difetto: stavano chiedendo a `app.html` del codice che non
e' mai tornato.

Erano **8 test rossi su 1821**, e tenevano `Falliti: 1` nel riassunto del collaudo. Siccome
`.claude/hooks/guardia_git.py` pubblica su `main` **solo** con `Falliti: 0`, bloccavano ogni
pubblicazione — comprese cure che non c'entravano niente con loro.

| file | test rossi che portava |
|---|---|
| `split_riquadri.test.mjs` | 4 (pulsante 1→2→4→1, pagina-riquadro, riquadro sull'asset della madre, mirino verso il riquadro) |
| `replay_journal_visibile.test.mjs` | 2 (chiusura storica nel Journal, trade che resta dopo l'uscita dal replay) |
| `book_storico_cambio_asset.test.mjs` | 1 (storico book che tiene solo l'asset corrente) |
| `memoria_crescita_campioni.test.mjs` | 1 (campionamento memoria che aggiunge righe col tempo) |

## Perché NON sono stati cancellati

Sono lavoro buono: descrivono cosa quelle feature **dovevano** fare, e riscriverli da zero
costerebbe piu' che tenerli. Quando le 8.5.13–8.5.18 verranno riapplicate, questi banchi sono la
specifica pronta.

## Come si rimettono in gioco

Il collaudo raccoglie **solo** `laboratorio/app/*.test.mjs` (non le sottocartelle, vedi la riga
`node --test ... app/*.test.mjs` in `collauda.sh`): finche' stanno qui, sono fuori. Per rimetterli:

```
mv laboratorio/in-attesa-feature-8.5/*.test.mjs laboratorio/app/
```

**Da fare prima**, altrimenti tornano rossi uguali: riapplicare in `app.html` le feature
8.5.13–8.5.18. Riportarli indietro senza quel codice rimette il collaudo a `Falliti: 1` e blocca di
nuovo la pubblicazione.

## Cosa NON significa

Spostarli **non** vuol dire che quelle feature sono abbandonate, e **non** vuol dire che il
collaudo ora copre di meno cio' che l'app fa davvero: copre esattamente le stesse righe di codice
di prima, perche' il codice che questi banchi provano non c'e'. L'unica cosa che cambia e' che il
riassunto non mente piu' dicendo «1 fallito» su un difetto che non esiste in `app.html`.
