# Curriculum map: Year 1 to 6 (issue #9)

Source of truth: [`src/data/curriculum.json`](../src/data/curriculum.json). Topic ids (like `t3.muldiv100`) are what the question schema (#10) uses in its `topic` field. `tests/curriculum.test.ts` checks that every topic here matches the JSON.

**Status: DRAFT, needs a teacher check.** I wrote this from general knowledge of Kurikulum Merdeka (Matematika SD). I could not open the official Capaian Pembelajaran (CP) documents to confirm it. Two kinds of uncertainty:

1. **Fase level.** The CP is written per Fase (A = Kelas 1-2, B = Kelas 3-4, C = Kelas 5-6), not per grade. Splitting each Fase into two tiers is my judgement.
2. **Topics marked "check" (⚠).** I am least sure these belong in that Fase or grade, or I am unsure of the exact range (for example whether Fase A includes multiplication, or whether speed and scale are in Fase C). The CP was also revised in 2024, so a teacher should check against the current version.

The CP's five elements are used as the `element` field: **bilangan** (number), **aljabar** (algebra), **pengukuran** (measurement), **geometri** (geometry), **data** (analisis data dan peluang).

"Gen" means a procedural generator is planned for this topic in #11. Topics without one are handwritten in #12.


## Year 1 (Kelas 1, Fase A)

| Id | Topik | Topic | Element | Gen | Check |
|---|---|---|---|---|---|
| `t1.count20` | Membilang dan membandingkan bilangan sampai 20 | Counting and comparing numbers to 20 | bilangan | yes |  |
| `t1.addsub20` | Penjumlahan dan pengurangan sampai 20 | Addition and subtraction within 20 | bilangan | yes |  |
| `t1.pattern` | Pola bilangan dan benda sederhana | Simple number and object patterns | aljabar | yes |  |
| `t1.shapes` | Mengenal bangun datar dan bangun ruang | Recognising 2D and 3D shapes | geometri | no |  |
| `t1.compare_measure` | Membandingkan panjang dan berat (satuan tidak baku) | Comparing length and weight (non-standard units) | pengukuran | no |  |

## Year 2 (Kelas 2, Fase A)

| Id | Topik | Topic | Element | Gen | Check |
|---|---|---|---|---|---|
| `t2.place100` | Bilangan sampai 100 dan nilai tempat | Numbers to 100 and place value | bilangan | yes |  |
| `t2.addsub100` | Penjumlahan dan pengurangan sampai 100 | Addition and subtraction within 100 | bilangan | yes |  |
| `t2.half_quarter` | Mengenal pecahan setengah dan seperempat | Halves and quarters | bilangan | yes |  |
| `t2.equal_groups` | Perkalian sebagai penjumlahan berulang | Multiplication as repeated addition | bilangan | yes | ⚠ |
| `t2.money_time` | Uang (Rupiah) dan membaca jam | Money (Rupiah) and telling the time | pengukuran | yes | ⚠ |
| `t2.pictogram` | Turus dan piktogram | Tally charts and pictograms | data | no |  |

## Year 3 (Kelas 3, Fase B)

| Id | Topik | Topic | Element | Gen | Check |
|---|---|---|---|---|---|
| `t3.place1000` | Bilangan sampai 1.000 dan nilai tempat | Numbers to 1,000 and place value | bilangan | yes |  |
| `t3.addsub1000` | Penjumlahan dan pengurangan sampai 1.000 | Addition and subtraction within 1,000 | bilangan | yes |  |
| `t3.muldiv100` | Perkalian dan pembagian sampai 100 | Multiplication and division within 100 | bilangan | yes |  |
| `t3.fraction_compare` | Membandingkan pecahan sederhana | Comparing simple fractions | bilangan | yes |  |
| `t3.std_units` | Satuan baku panjang dan berat (cm, m, g, kg) | Standard units of length and weight (cm, m, g, kg) | pengukuran | yes |  |
| `t3.bar_chart` | Diagram gambar dan diagram batang | Picture graphs and bar charts | data | no |  |

## Year 4 (Kelas 4, Fase B)

| Id | Topik | Topic | Element | Gen | Check |
|---|---|---|---|---|---|
| `t4.place10000` | Bilangan sampai 10.000 | Numbers to 10,000 | bilangan | yes |  |
| `t4.multidigit` | Perkalian dan pembagian bilangan bersusun | Multi-digit multiplication and division | bilangan | yes | ⚠ |
| `t4.equiv_fractions` | Pecahan senilai | Equivalent fractions | bilangan | yes |  |
| `t4.decimals_intro` | Desimal persepuluhan dan perseratusan | Tenths and hundredths as decimals | bilangan | yes | ⚠ |
| `t4.perim_area` | Keliling dan luas persegi dan persegi panjang | Perimeter and area of squares and rectangles | pengukuran | yes |  |
| `t4.polygons` | Ciri-ciri segitiga, segiempat dan segibanyak | Properties of triangles, quadrilaterals and polygons | geometri | no |  |

## Year 5 (Kelas 5, Fase C)

| Id | Topik | Topic | Element | Gen | Check |
|---|---|---|---|---|---|
| `t5.big_numbers` | Bilangan sampai 1.000.000 | Numbers to 1,000,000 | bilangan | yes |  |
| `t5.kpk_fpb` | KPK dan FPB | Lowest common multiple and highest common factor | bilangan | yes |  |
| `t5.frac_addsub` | Penjumlahan dan pengurangan pecahan | Adding and subtracting fractions | bilangan | yes |  |
| `t5.decimal_percent` | Desimal dan persen | Decimals and percentages | bilangan | yes |  |
| `t5.angles` | Mengukur dan membandingkan sudut | Measuring and comparing angles | geometri | no | ⚠ |
| `t5.data_mean` | Membaca diagram, rata-rata dan modus | Reading charts, mean and mode | data | yes | ⚠ |

## Year 6 (Kelas 6, Fase C)

| Id | Topik | Topic | Element | Gen | Check |
|---|---|---|---|---|---|
| `t6.frac_muldiv` | Perkalian dan pembagian pecahan | Multiplying and dividing fractions | bilangan | yes | ⚠ |
| `t6.ratio` | Rasio dan perbandingan | Ratio and proportion | aljabar | yes | ⚠ |
| `t6.speed_scale` | Kecepatan dan skala | Speed and scale | pengukuran | yes | ⚠ |
| `t6.mixed_ops` | Operasi hitung campuran | Mixed operations (order of operations) | bilangan | yes |  |
| `t6.volume` | Volume kubus dan balok | Volume of cubes and cuboids | pengukuran | yes | ⚠ |
| `t6.chance` | Peluang: pasti, mungkin, tidak mungkin | Chance: certain, possible, impossible | data | no | ⚠ |

**Totals:** 35 topics, 28 with generators, 11 marked for checking.

## Not in the MVP
Negative integers, coordinates on a grid, and Year 7 to 12 topics. If the teacher check moves a topic into Year 1 to 6, add it to the JSON and this file.

## Teacher sign-off

When the check is done, fill in `signoff` in `curriculum.json`, set `status` to `"approved"`, clear the ⚠ flags that were confirmed, and record changes here.

| Teacher | Date | Notes |
|---|---|---|
| _pending_ | | |
