# gcs-local-setup-infra Specification

## Purpose

Local Google Cloud Storage provisioning for incrementa-gestion: PowerShell setup script under `infra/gcp/`, service account credentials written to `backend/secrets/`, and gitignore rules so GCP JSON keys are never committed.

## Requirements

### Requirement: GCS setup script exists and is runnable from infra/gcp

The repository SHALL provide `infra/gcp/setup-gcs.ps1` that operators run from the `infra/gcp/` directory using PowerShell and the Google Cloud SDK (`gcloud`).

#### Scenario: Script documents usage and environment variables

- **WHEN** a developer opens `infra/gcp/setup-gcs.ps1`
- **THEN** the file header states that execution is from `infra/gcp/` and that `$PROJECT`, `$BUCKET`, and `$REGION` at the top of the file are the values to change for another environment

#### Scenario: Default dev targets are preconfigured

- **WHEN** the script is used without editing environment variables
- **THEN** `$PROJECT` is `incrementa-gestion-dev`, `$BUCKET` is `incrementa-contratos-dev`, and `$REGION` is `us-central1`

### Requirement: Script provisions bucket, service account, and IAM

The setup script SHALL configure the active gcloud project, create the GCS bucket with uniform bucket-level access, create service account `incrementa-gcs-sa`, grant `roles/storage.objectAdmin` on that bucket to the service account, and write a JSON key to `backend/secrets/gcs-service-account.json` relative to the repository root.

#### Scenario: Successful first-time provisioning

- **WHEN** an authenticated operator runs `.\setup-gcs.ps1` from `infra/gcp/` and GCP resources do not yet exist
- **THEN** gcloud sets the project, creates `gs://<BUCKET>`, creates the service account, applies the bucket IAM binding, ensures `backend/secrets/` exists, and writes `gcs-service-account.json` under `backend/secrets/`

#### Scenario: Progress output in Spanish-friendly markers

- **WHEN** each major step runs
- **THEN** the script writes host messages prefixed with `→` for steps and `✓` on completion including the final key path

### Requirement: GCP secrets directory is never committed

The root `.gitignore` SHALL ignore the entire `backend/secrets/` directory immediately after the entry for `backend/SET_VARS_AMBIENTE_LOCAL.cmd`, with a comment identifying GCP credentials.

#### Scenario: Secrets path is gitignored

- **WHEN** `git status` is run after generating `backend/secrets/gcs-service-account.json`
- **THEN** files under `backend/secrets/` do not appear as untracked files eligible for commit
