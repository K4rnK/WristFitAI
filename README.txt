WristFit AI - Updated Payment/Admin Build

Files:
- WristFit_AI_updated.tsx  Main React component
- qr-pay.jpg               PromptPay QR image supplied by user
- wristfit-logo.jpg        New logo image supplied by user

Important:
The TSX imports both images from the same folder, so keep the three files together.

Changes:
1. PromptPay QR uses the supplied QR image asset.
2. New header logo uses the supplied logo image asset.
3. User must upload a payment slip after transfer.
4. Payment creates a PENDING request; credits are NOT added immediately.
5. Admin can view the slip, edit the approved amount and credits, then approve/reject.
6. Admin can edit a user's credit balance.
7. Admin can delete users.
8. Firestore sync is included when Firebase is configured; localStorage remains as a fallback.

Production note:
For a real multi-user deployment, protect Admin authentication and move payment-slip storage/approval logic to trusted server-side Firebase rules/backend. The current client-side Admin passcode is not secure for production.
