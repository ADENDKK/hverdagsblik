# Hverdagsblik

En installerbar React-webapp til familiens udgifter, indtægter og tilbudsønsker. Appen virker lokalt og kan forbindes til Supabase, så to eller flere telefoner deler samme husstand i realtid.

## Start programmet

1. Åbn en terminal i denne mappe.
2. Kør `npm install`.
3. Kør `npm run dev`.
4. Åbn adressen, der vises i terminalen (normalt `http://127.0.0.1:5173`).

## Det virker allerede

- Månedsoversigt, budgetkategorier og rådighedsbeløb.
- Tilføj og slet udgifter eller importér Spar Nord CSV-filer med dubletkontrol.
- Søgning i udgifter.
- Find automatisk SPAR Arden og 365discount Arden ud fra telefonens placering, eller redigér listen manuelt.
- Se alle offentlige tilbud som standard, deres gyldighedsperiode og den officielle tilbudsavis.
- Slå tilbudsovervågning til/fra og tilføj varer til ønskelisten.
- Skriv nettoløn efter skat for én eller flere personer.
- Beregn rådighedsbeløbet ud fra de registrerede indtægter og udgifter.
- Responsivt layout til computer og mobil.
- Kan installeres som genvej/app på hjemmeskærmen.
- Offline-cache efter første besøg.
- Sikker husstandssynkronisering med invitationskode og Row Level Security.

## Slå fælles synkronisering til

1. Opret et gratis projekt på Supabase.
2. Aktivér **Anonymous Sign-Ins** under Authentication → Providers → Anonymous.
3. Åbn SQL Editor og kør hele [supabase/schema.sql](./supabase/schema.sql).
4. Kopiér `.env.example` til `.env.local`.
5. Indsæt projektets URL og den offentlige `anon`/publishable key i `.env.local`.
6. Genstart appen med `npm run dev`.
7. Gå til **Indstillinger → Fælles synkronisering** på den første telefon og vælg **Opret vores husstand**.
8. Skriv den viste invitationskode på telefon nummer to.

Databasen bruger anonyme, separate brugere og databasehåndhævet adgangskontrol. Kun medlemmer af den samme husstand kan læse eller ændre husstandens data.

## Installer på telefonen

Appen skal ligge på en offentlig HTTPS-adresse, før installation og synkronisering virker stabilt på telefoner.

- **iPhone/iPad:** Åbn siden i Safari, tryk **Del**, og vælg **Føj til hjemmeskærm**.
- **Android:** Åbn siden i Chrome og vælg **Installer app** eller brug knappen under Indstillinger.

PWA-manifestet, app-ikonet og offline-service-workeren er allerede med i projektet. Det eneste resterende driftstrin er at udgive `dist`-mappen på en HTTPS-host.

## Udgiv med GitHub Pages

Projektet indeholder en færdig GitHub Actions-workflow i `.github/workflows/deploy-pages.yml`. Den bygger og udgiver automatisk appen ved hvert push til `main`.

1. Opret et nyt GitHub-repository, eksempelvis `hverdagsblik`.
2. Push denne projektmappe til repositoryets `main`-branch.
3. Gå til **Settings → Pages** og vælg **GitHub Actions** som kilde.
4. Indsæt projektets offentlige URL og browsernøgle i workflowets `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY`.
5. Kør workflowet fra fanen **Actions**, eller push en ny ændring.

Adressen bliver normalt `https://BRUGERNAVN.github.io/hverdagsblik/`. GitHub Pages leverer HTTPS, så installation på telefonen og service workeren virker.

Workflowet `Opdater lokale tilbud` kører hver morgen og opdaterer `public/offers.json` fra SPARs og 365discounts officielle sider. En ændring udløser automatisk en ny Pages-udgivelse.

`dist`, `node_modules` og lokale `.env`-filer er udelukket via `.gitignore`.

## Begrænsninger

- Fuldautomatisk bankimport kræver en PSD2/open-banking-leverandør og brugerens samtykke. Uden kontoadgang er de mest private muligheder manuel CSV-import fra netbank eller scanning af kvitteringer.
- Offentlige tilbud hentes automatisk. Personlige medlemskuponer kan ikke hentes uden brugerens særskilte login og samtykke hos butikskæden.
- Produktion bør have backup og klare sletteregler for persondata.

Uden Supabase-konfiguration bliver alle data fortsat på den enkelte enhed. Med Supabase aktiveret sendes husstandens data til brugerens eget Supabase-projekt.
