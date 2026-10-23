# FixFlow frontend

This archive contains the frontend only. It does not include or modify the FixFlow backend.

## Run locally

1. Install Node.js and npm.
2. From this directory, run `npm install`.
3. Start the backend separately on `http://localhost:3000`.
4. Run `npm run dev` and open the Vite URL printed in the terminal.

Vite forwards `/api` requests to `http://localhost:3000` using `vite.config.js`.

## Verify the frontend

- `npm run build` creates the production bundle.
- `npm run lint` checks the source with ESLint.

## Source structure

```text
src/
  components/
    auth/             Role selection and route guards
    complaints/       Shared complaint card, toolbar, timeline, image,
                      status badge, and empty state
    layout/           Dashboard shell, app header, and sign-out dialog
    registration/     Registration terms modal
  context/            Auth provider, context, and auth hook
  features/
    admin/            Unassigned/assigned complaint cards and assignment controls
    staff/            Staff complaint card, status, and resolution-proof form
    student/          Complaint submission, history panel, card, and detail view
  layouts/            Application-level route layout
  pages/              Route-level pages for student, staff, admin, and auth
  services/           API requests
  utils/              Complaint configuration and PDF generation
```

The dashboard pages use shared complaint components and role-specific feature components. Pages retain API requests and workflow state; extracted components render the existing UI and call page-owned handlers. The existing styles and interactions are retained.
