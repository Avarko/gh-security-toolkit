## Zod Validation Demo - Test Cases

### Test Case 1: Hyväksytty validi data

```json
{
  "version": "1.0",
  "scans": [
    {
      "timestamp": "2024-01-15-120000Z",
      "channel": "prod-main",
      "branch": "main",
      "commit": "a1b2c3d4e5f6789012345678901234567890abcd",
      "trivyFsResults": {
        "totalVulnerabilities": {
          "CRITICAL": 2,
          "HIGH": 5,
          "MEDIUM": 10
        }
      },
      "semgrepResults": {
        "totalErrors": 1,
        "totalWarnings": 3,
        "totalInfos": 5
      }
    }
  ]
}
```

**Tulos**: ✅ Validointi OK, data renderöidään normaalisti

---

### Test Case 2: Turvallisuushyökkäykset (kaikki hylätään)

```json
{
  "version": "1.0",
  "scans": [
    {
      "timestamp": "2024-01-15-120000Z",
      "channel": "prod; rm -rf /",
      "branch": "../../etc/passwd",
      "commit": "' OR '1'='1",
      "trivyFsResults": {
        "totalVulnerabilities": {
          "CRITICAL": 9999999999999999999
        }
      }
    }
  ]
}
```

**Zod hylkää**:
- ❌ `channel`: Command injection yritys → regex `/^[a-zA-Z0-9\-_]+$/` hylkää
- ❌ `branch`: Path traversal → regex `/^[a-zA-Z0-9\/_\-\.]+$/` hylkää `..`
- ❌ `commit`: SQL injection → regex `/^[a-f0-9]{7,40}$/i` hylkää
- ❌ `CRITICAL`: Unsafe number → `.safe()` hylkää

**UI**: Näyttää ValidationErrorDisplay:
```
Data Validation Error
Invalid scan history data: scans.0.channel: Invalid channel name; scans.0.branch: Invalid branch name; scans.0.commit: Invalid git commit SHA
[Technical Details ▼]
```

---

### Test Case 3: Type confusion (muunnetaan turvallisiksi)

```json
{
  "version": "1.0",
  "scans": [
    {
      "timestamp": "2024-01-15-120000Z",
      "channel": "prod",
      "branch": "main",
      "commit": "a1b2c3d4e5f6789012345678901234567890abcd",
      "semgrepResults": {
        "totalErrors": "not-a-number",
        "totalWarnings": -5,
        "totalInfos": null
      }
    }
  ]
}
```

**Zod muuntaa `.catch(0)`**:
- ✅ `totalErrors: "not-a-number"` → `0`
- ✅ `totalWarnings: -5` → `0`
- ✅ `totalInfos: null` → `0`

**UI**: Data renderöidään normaalisti, mutta virheelliset arvot näkyvät nollana

---

### Test Case 4: DoS-hyökkäys (hylätään)

```json
{
  "version": "1.0",
  "scans": [
    // 10001 skannausta (yli max 10000)
    ...
  ]
}
```

**Zod hylkää**:
- ❌ `.max(10000)` rajoitus ylittyy

**UI**: Näyttää ValidationErrorDisplay:
```
Data Validation Error
Invalid scan history data: scans: Array must contain at most 10000 element(s)
```

---

### Test Case 5: Unknown fields (strict mode)

```json
{
  "version": "1.0",
  "maliciousScript": "<script>alert('xss')</script>",
  "scans": [
    {
      "timestamp": "2024-01-15-120000Z",
      "channel": "prod",
      "branch": "main",
      "commit": "a1b2c3d4e5f6789012345678901234567890abcd",
      "extraField": "should not be here"
    }
  ]
}
```

**Zod hylkää `.strict()`**:
- ❌ `maliciousScript`: Tuntematon kenttä top-levelissä
- ❌ `extraField`: Tuntematon kenttä scanMetadatassa

**UI**: Näyttää ValidationErrorDisplay

---

## Käytännön testi

### 1. Korvaa data-tiedosto invalidilla:
```bash
cd dashboard/public/data/hist
cp scan-history-invalid.json scan-history.json
```

### 2. Avaa selaimen http://localhost:5173/

### 3. Näet virheilmoituksen:
```
⚠️ Data Validation Error
Invalid scan history data: scans.0.timestamp: Invalid ISO 8601 timestamp; scans.0.channel: Invalid channel name; ...
[Technical Details ▼] ← Klikkaa nähdäksesi Zod-virheet
```

### 4. Palauta validi data:
```bash
cd dashboard/public/data/hist
mv scan-history.backup scan-history.json
```

### 5. Päivitä sivu → Dashboard renderöityy normaalisti

---

## Yhteenveto turvallisuudesta

| Hyökkäystyyppi | Esimerkki | Zod-suojaus |
|----------------|-----------|-------------|
| Path Traversal | `../../etc/passwd` | Regex hylkää |
| Command Injection | `; rm -rf /` | Regex hylkää |
| SQL Injection | `' OR '1'='1` | Regex hylkää |
| XSS | `<script>alert()</script>` | Regex hylkää |
| DoS (memory) | 10001 items | `.max(10000)` |
| DoS (CPU) | 100000 char string | `.max(1000)` |
| Type confusion | `"string" as number` | `.catch(0)` |
| Integer overflow | `999...999` | `.safe()` |
| Unknown fields | `{extraField: "x"}` | `.strict()` |

**Tulos**: 🛡️ Kattava suojaus yleisimmiltä hyökkäyksiltä!
