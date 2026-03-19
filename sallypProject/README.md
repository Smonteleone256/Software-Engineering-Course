# Veterinary Medical Records + Structured SOAP Notes (Prototype)

This browser prototype focuses on visits/encounters as the medical record.

## What is implemented

- Global search (live filter) by:
  - client first/last name
  - phone number (normalized)
  - patient name
- Client + patient CRUD basics with safer delete confirmations.
- Better edit flow using dedicated edit screens for clients and patients.
- Patient sex/reproductive dropdown includes:
  - Spayed Female
  - Neutered Male
  - Intact Female
  - Intact Male
  - Unknown
- Patient Detail screen:
  - patient summary
  - visits list sorted most recent first
  - **Start Visit** action (creates draft visit immediately)
- Visit Editor screen:
  - datetime
  - reason for visit
  - status dropdown (`draft`, `finalized`)
  - vitals weight entered in **lbs** with live **kg** conversion preview
  - structured SOAP fields (Subjective, Objective, Assessment, Plan)
  - autosave for drafts + explicit **Save Visit** button
  - finalize lock (cannot edit finalized visit)
  - version snapshot on finalize
  - attachment picker via system file chooser (Add Attachment button)
  - clickable attachment links after upload

## Visit data model (in-memory)

- `visitId`
- `dateTime`
- `reasonForVisit`
- `status` (`draft` or `finalized`)
- `vitals.weightLbs`
- `vitals.weightKg`
- `soap.subjective`
- `soap.objective`
- `soap.assessment`
- `soap.plan`
- `attachments[]`
- `versions[]`
- `createdAt`
- `lastEditedAt`
- `lastEditedBy`

## Core rules

- A client cannot be saved without at least one patient.
- A patient can only be added inside an existing client context.
- Phone numbers are normalized to digits for storage/search.
- Finalizing a visit requires all SOAP fields to be present.
- Finalized visits are locked from editing.

## Run locally (fixed ports)

Frontend is fixed to `4173` and backend is fixed to `4242`.

In terminal 1:

```bash
./start_backend.sh
```

In terminal 2:

```bash
./start_frontend.sh
```

Open: `http://localhost:4173`

## Notes

- Data is in-memory only (refresh clears data).
- Attachment links use object URLs from selected local files.
- No AI feature is implemented yet.
