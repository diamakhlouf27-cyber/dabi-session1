const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load configuration from environment variables (Never hardcode secrets!)
const BASE_URL = process.env.BASE_URL || 'https://api.yapily.com';
const APPLICATION_ID = process.env.APPLICATION_ID;
const APPLICATION_SECRET = process.env.APPLICATION_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://dabi-session1-cosv.onrender.com/callback/consent';
const APPLICATION_USER_ID = process.env.APPLICATION_USER_ID || 'dabi-lab3';
const INSTITUTION_ID = 'modelo-sandbox';

// Helper for HTTP Basic Auth
const getAuthHeader = () => {
  const credentials = Buffer.from(`${APPLICATION_ID}:${APPLICATION_SECRET}`).toString('base64');
  return `Basic ${credentials}`;
};

// --- FRONTEND ROUTE ---
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DABI Lab 3 - Open Banking AIS</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f4f4f9; color: #333; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        button { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        pre { background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>DABI Lab 3: Open Banking AIS</h1>
      
      <div class="card">
        <h3>Step 1: Start Bank Consent</h3>
        <p>Click below to initialize account authorization with <b>modelo-sandbox</b>.</p>
        <button onclick="startConsent()">Authorize Bank Access</button>
      </div>

      <div class="card" id="results-card" style="display:none;">
        <h3>Step 2: Accounts & Consent Duration</h3>
        <pre id="output">Loading data...</pre>
      </div>

      <script>
        async function startConsent() {
          const res = await fetch('/api/auth-request', { method: 'POST' });
          const data = await res.json();
          if (data.authorisationUrl) {
            window.location.href = data.authorisationUrl;
          } else {
            alert('Error starting consent: ' + JSON.stringify(data));
          }
        }
      </script>
    </body>
    </html>
  `);
});

// --- BACKEND API: Create Account Authorisation ---
app.post('/api/auth-request', async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/account-auth-requests`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        applicationUserId: APPLICATION_USER_ID,
        institutionId: INSTITUTION_ID,
        callback: CALLBACK_URL
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CALLBACK ROUTE (Handles return from bank) ---
app.get('/callback/consent', async (req, res) => {
  const consentToken = req.query.consentToken || req.query.consent;
  
  if (!consentToken) {
    return res.status(400).send("Error: No consent token found in redirect query string.");
  }

  try {
    // Fetch Accounts using the consent token header
    const accountsRes = await fetch(`${BASE_URL}/accounts`, {
      headers: {
        'Authorization': getAuthHeader(),
        'consent': consentToken
      }
    });
    const accountsData = await accountsRes.json();

    // Render success view back to the user
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Consent Success</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f4f4f9; color: #333; }
          .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          pre { background: #eee; padding: 15px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ Bank Authorization Successful!</h2>
          <p><strong>Consent Token Captured:</strong> ${consentToken}</p>
          <h3>Fetched Accounts (GET /accounts):</h3>
          <pre>${JSON.stringify(accountsData, null, 2)}</pre>
          <a href="/">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Error fetching accounts: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
