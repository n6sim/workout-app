# Canadian Nutrient File 2015 (source data)

Source: Health Canada, Canadian Nutrient File (CNF), 2015, https://open.canada.ca
Licence: Open Government Licence - Canada.

These are the unmodified CSV files. `npm run build-seed-foods` reads them (they are ISO-8859-1 encoded)
and writes `src/data/seedFoods.json`. Nutrition values in the app come from here and are never typed by hand.
