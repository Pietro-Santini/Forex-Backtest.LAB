# NASCE LA SEZIONE «SALE SEGNALI», SEPARATA DA «COLLEGAMENTO».
#
# RICHIESTA DEL PROPRIETARIO (22 ottobre 2026), parola per parola:
# «non può stare tutto quanto all'interno di collegamento. Le cose del collegamento saranno
#  all'interno della pagina collegamento. Le cose che riguardano la sala segnale, la cronologia,
#  configurazione di apertura automatica e tutto quello che riguarda le sale andrà proprio nella
#  sezione sale segnali».
#
# COME E' FATTO, E PERCHE' COSI':
#
# 1. LE RIGHE ESISTENTI VENGONO SPOSTATE, NON RISCRITTE. Il file ha dentro emoji (📡 📜 📹 ✈️ 📱)
#    e trattini lunghi: copiarli a mano rischia di cambiarne uno di mezzo e di rompere la
#    grafica. Qui si prendono le righe esistenti e si rimettono in un altro ordine: il contenuto
#    e' IDENTICO, byte per byte, e cambia solo dove sta.
#
# 2. L'ORDINE E' QUELLO DEL PROPRIETARIO:
#       in COLLEGAMENTO restano  lo stato del ponte, la porta, l'accesso da altri dispositivi,
#                               l'account Telegram e la prima configurazione (api_id/api_hash);
#       in SALE SEGNALI vanno     il pannello dei segnali, l'apertura automatica, la cronologia,
#                               l'elenco delle sale e tutta la sezione Syntra.
#
# 3. LE SCHEDE TELEGRAM/SYNTRA (quelle che scelgono da quale arriva il segnale) SEGUONO LE SALE:
#    senza di loro non si saprebbe da quale parte e' la sala che si sta guardando. Restano
#    identiche, cambia solo il contenitore in cui stanno.
#
# QUATTRO CONTROLLI PRIMA DI SCRIVERE (vedi anche cervello/LEZIONI.md):
#    - i segnaposto del file devono essere dove ci si aspetta (il file potrebbe essere cambiato
#      sotto i piedi: in quel caso lo script esce e NON tocca niente);
#    - ogni id deve esistere UNA volta sola, prima e dopo;
#    - i <div> aperti e chiusi devono bilanciarsi: una parentesi dimenticata renderebbe la
#      pagina tutta storta, e il conto lo dice subito;
#    - i due pannelli non possono stare dentro l'uno dell'altro.
import io
import os
import re
import sys

RADICE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FILE = os.path.join(RADICE, 'app.html')

# I segnaposto: numero di riga -> pezzo di testo che DEVE esserci in quella riga.
SEGNAPOSTI = {
    1694: 'data-gensettings-tab="collegamento"',
    1852: 'data-gensettings-panel="collegamento"',
    1855: 'id="tgStatusBox"',
    1859: 'id="tgPort"',
    1860: 'id="tgRefreshBtn"',
    1865: 'id="tgOpenPanelBtn"',
    1866: 'id="tgAutoBtn"',
    1869: 'class="toolBtn fblCronoBtn"',
    1872: 'id="fblRemotoBtn"',
    1877: 'ACCOUNT TELEGRAM',
    1879: 'id="tgToggleBtn"',
    1882: 'id="tgDimenticaTelBtn"',
    1885: 'id="tgTelefonoSalvatoLbl"',
    1886: 'id="tgTelefonoForgetBtn"',
    1888: 'class="fbModalTabs"',
    1889: 'data-salasessione="telegram"',
    1890: 'data-salasessione="syntra"',
    1892: 'data-salasessione-panel="telegram"',
    1903: 'id="tgSetupBox"',
    1914: 'id="tgApiId"',
    1915: 'id="tgApiHash"',
    1918: 'id="tgSalvaCredBtn"',
    1921: 'Il numero viene ricordato',
    1922: 'SALE SEGNALI',
    1923: 'id="tgGroupList"',
    1925: 'id="tgNewGroup"',
    1926: 'id="tgAddBtn"',
    1930: '</div>',
    1931: 'data-salasessione-panel="syntra"',
    1932: 'Syntra (dall',
    1940: 'id="syntraStatoBox"',
    1941: 'id="syntraAttivo"',
    1942: 'id="syntraAvvio"',
    1955: 'id="syntraFolder"',
    1956: 'id="syntraRefreshBtn"',
    1965: 'id="syntraUtentiList"',
    1967: '</div>',
    1968: '</div>',
    1969: 'data-gensettings-panel="versione"',
}

# Gli id che devono restare UNO per uno.
ID_UNICI = [
    'tgStatusBox', 'tgPort', 'tgRefreshBtn', 'tgToggleBtn', 'tgDimenticaTelBtn',
    'tgTelefonoSalvatoLbl', 'tgTelefonoForgetBtn', 'tgSetupBox', 'tgApiId', 'tgApiHash',
    'tgSalvaCredBtn', 'tgOpenPanelBtn', 'tgAutoBtn', 'fblRemotoBtn', 'tgGroupList',
    'tgNewGroup', 'tgAddBtn', 'syntraStatoBox', 'syntraAttivo', 'syntraAvvio',
    'syntraFolder', 'syntraRefreshBtn', 'syntraUtentiList',
]

SCHEDA = ('      <button type="button" id="genSettingsTabSale" class="fbModalTab" '
          'data-gensettings-tab="sale">\U0001F4E1 Sale segnali</button>')

INTRO_COLLEGAMENTO = (
    '        <div style="font-size:11.5px;color:#8b96a5;margin-bottom:10px">Come '
    "l'app si collega al mondo esterno: lo stato del ponte dei segnali, l'accesso da altri "
    'dispositivi (telefono, tablet, server Oracle sempre acceso) e l\'account Telegram. '
    'Le sale da cui arrivano i segnali stanno nella sezione «Sale segnali».</div>')

INTRO_SALE = (
    '        <div style="font-size:11.5px;color:#8b96a5;margin-bottom:10px">Le sale da cui '
    'arrivano i segnali: i canali Telegram, gli utenti Syntra, l\'apertura automatica e la '
    'cronologia. Qui si sceglie da dove arrivano i segnali e che cosa succede dopo.</div>')

TITOLO_PONTE = ('        <div class="hint" style="margin:0 0 6px;font-weight:700;'
                'letter-spacing:.3px">PONTE DEI SEGNALI</div>')
TITOLO_REMOTO = ('        <div class="hint" style="margin:0 0 6px;font-weight:700;'
                 'letter-spacing:.3px">ACCESSO DA ALTRI DISPOSITIVI</div>')


def main():
    with io.open(FILE, 'r', encoding='utf-8', newline='') as f:
        testo = f.read()
    righe = testo.split('\r\n')
    if righe and righe[-1] == '':
        righe = righe[:-1]
    else:
        sys.exit('ERRORE: il file non termina con CRLF: non lo tocco.')

    # CONTROLLO 1: i segnaposto sono dove devono essere.
    for (n, pezzo) in SEGNAPOSTI.items():
        if n > len(righe):
            sys.exit('ERRORE: il file ha solo %d righe (ne servono %d): non lo tocco.'
                     % (len(righe), n))
        if pezzo not in righe[n - 1]:
            sys.exit('ERRORE: alla riga %d mi aspettavo %r e c\'e %r: il file è cambiato, '
                     'non lo tocco.' % (n, pezzo, righe[n - 1][:120]))

    # CONTROLLO 2: ogni id c'e' una volta sola, PRIMA.
    for id_ in ID_UNICI:
        n = testo.count('id="%s"' % id_)
        if n != 1:
            sys.exit('ERRORE: id="%s" compare %d volte (mi aspettavo 1): non lo tocco.'
                     % (id_, n))

    def pezzo(a, b):
        """Le righe da a a b (1-based, chiuse)."""
        return righe[a - 1:b]

    # ---- IL NUOVO COLLEGAMENTO ----
    collegamento = []
    collegamento.append('      <div data-gensettings-panel="collegamento" style="display:none">')
    collegamento.append(INTRO_COLLEGAMENTO)
    collegamento.append('')
    collegamento.append(TITOLO_PONTE)
    collegamento += pezzo(1855, 1855)                         # tgStatusBox
    collegamento.append('')
    collegamento += pezzo(1857, 1861)                         # porta + ricontrolla
    collegamento.append('')
    collegamento.append(TITOLO_REMOTO)
    collegamento += pezzo(1871, 1873)                         # accesso da altri dispositivi
    collegamento.append('')
    collegamento += pezzo(1877, 1887)                         # ACCOUNT TELEGRAM
    collegamento.append('')
    collegamento += pezzo(1900, 1921)                         # prima configurazione + nota
    collegamento.append('      </div>')

    # ---- LA NUOVA SEZIONE SALE SEGNALI ----
    sale = []
    sale.append('      <div data-gensettings-panel="sale" style="display:none">')
    sale.append(INTRO_SALE)
    sale.append('')
    sale += pezzo(1864, 1870)              # pannello segnali, apertura auto, cronologia
    sale.append('')
    sale += pezzo(1888, 1891)              # schede Telegram / Syntra
    sale += pezzo(1892, 1899)              # segnale manuale (Telegram)
    sale += pezzo(1922, 1930)              # elenco delle sale (+ chiusura scheda Telegram)
    sale += pezzo(1931, 1967)              # tutta la sezione Syntra
    sale.append('      </div>')

    # ---- CONTROLLO 3: i <div> bilanciano ----
    def conta_div(blocchi):
        aperti = 0
        for r in blocchi:
            aperti += len(re.findall(r'<div\b', r))
            aperti -= len(re.findall(r'</div>', r))
        return aperti
    if conta_div(collegamento) != 0:
        sys.exit('ERRORE: il nuovo COLLEGAMENTO ha %d <div> non chiusi.'
                 % conta_div(collegamento))
    if conta_div(sale) != 0:
        sys.exit('ERRORE: la nuova sezione SALE ha %d <div> non chiusi.' % conta_div(sale))

    # ---- ASSEMBLAGGIO ----
    nuove = righe[:1851] + collegamento + sale + righe[1968:]
    # La nuova scheda va subito dopo la scheda «Collegamento».
    for i, r in enumerate(nuove):
        if 'data-gensettings-tab="collegamento"' in r:
            nuove.insert(i + 1, SCHEDA)
            break
    else:
        sys.exit('ERRORE: non trovo la scheda «Collegamento» nella barra: non scrivo il file.')

    nuovo = '\r\n'.join(nuove) + '\r\n'

    # CONTROLLO 4: nel testo finale ogni id c'e' una volta sola.
    for id_ in ID_UNICI:
        n = nuovo.count('id="%s"' % id_)
        if n != 1:
            sys.exit('ERRORE DOPO LA MODIFICA: id="%s" compare %d volte invece di 1: '
                     'non scrivo il file.' % (id_, n))
    if nuovo.count('data-gensettings-panel="collegamento"') != 1:
        sys.exit('ERRORE: il pannello collegamento non c\'è una volta sola.')
    if nuovo.count('data-gensettings-panel="sale"') != 1:
        sys.exit('ERRORE: il pannello sale non c\'è una volta sola.')
    if nuovo.count('data-gensettings-tab="sale"') != 1:
        sys.exit('ERRORE: la scheda sale non c\'è una volta sola.')
    # I due pannelli non possono stare dentro l'uno dell'altro: sono fratelli, e in ordine.
    i_col = nuovo.find('data-gensettings-panel="collegamento"')
    i_sale = nuovo.find('data-gensettings-panel="sale"')
    i_vers = nuovo.find('data-gensettings-panel="versione"')
    if not (i_col < i_sale < i_vers):
        sys.exit('ERRORE: i pannelli non sono nell\'ordine atteso.')

    with io.open(FILE, 'w', encoding='utf-8', newline='') as f:
        f.write(nuovo)

    print('COLLEGAMENTO: %d righe' % len(collegamento))
    print('SALE SEGNALI: %d righe' % len(sale))
    print('RIGHE: %d -> %d' % (len(righe), len(nuove)))


if __name__ == '__main__':
    main()
