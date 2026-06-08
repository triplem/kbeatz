# Test Fixtures

This directory contains real id-file fixtures used by the kbeatz-tagger unit tests.
The fixture files are sourced from the discogstagger project's test suite at:
https://github.com/triplem/discogstagger/tree/master/test/files

---

## Fixture Files and Expected Values

### id.txt

Real example adapted from `discogs_id.txt` in the discogstagger test suite.

Format: INI / [source] section

| Key | Value | Notes |
|---|---|---|
| `name` | `discogs` | source adapter name |
| `discogs_id` | `4712` | Discogs release ID used in assertions |

Asserted in: `IdFileReaderTest.should parse real id-txt fixture with discogs_id 4712`

---

### local_ids.txt

Real example adapted from `multiple_id.txt` in the discogstagger test suite.
Demonstrates a file with multiple source IDs (both `amg_id` and `discogs_id`).

Format: INI / [source] section

| Key | Value | Notes |
|---|---|---|
| `name` | `amg` | source adapter name |
| `amg_id` | `4711` | AMG release ID |
| `discogs_id` | `4713` | Discogs release ID used in assertions |

Asserted in: `IdFileReaderTest.should parse real local-ids-txt fixture with discogs_id 4713 and amg_id 4711`

---

### metadata.yml

YAML format file that includes UTF-8 special characters (u-umlaut in the `artist` field).
Used to verify that the YAML parser correctly decodes multi-byte UTF-8 characters.

Format: YAML / `sources:` block

| Key | Value | Notes |
|---|---|---|
| `discogs_id` | `3083` | Discogs release ID used in assertions |
| `name` | `Kruder & Dorfmeister` | no special chars |
| `artist` | `Krüder & Dorfmeister` | contains U+00FC (u-umlaut) -- UTF-8 decode test |
| `label` | `K7 Records` | label name |

Asserted in:
- `IdFileReaderTest.should parse real metadata-yml fixture and return discogs_id 3083`
- `IdFileReaderTest.should decode UTF-8 umlaut correctly from real metadata-yml fixture`

---

### malformed-id.txt

A deliberately malformed INI file that has a `[source]` section but no `discogs_id` key.
Used to verify that the parser returns `null` with a meaningful absence signal (not an exception)
when the required field is missing.

Format: INI / [source] section with no `discogs_id`

| Key | Value | Notes |
|---|---|---|
| `name` | `discogs` | source name only - discogs_id is intentionally absent |

Expected result: `IdFileReader.read()` returns `null`

Asserted in: `IdFileReaderTest.should return null for malformed id-txt fixture missing discogs_id`

---

## Shared Directory

This fixtures/ directory is shared between story #287 (FLAC codec fixture files) and story #302
(id-file parser fixture files). The FLAC binary fixtures (.flac) live alongside the id-file text
fixtures in the same classpath root.
